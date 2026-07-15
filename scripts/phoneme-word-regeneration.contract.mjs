import "./elevenlabs-dictionary-lifecycle.contract.mjs";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import path from "node:path";
import test from "node:test";
import { atomicPromoteBatch } from "./lib/atomic-audio-promotion.mjs";
import {
  assertPromotionAllowed,
  assertRegenerationPlan,
  assertSelectionRecord,
  assertThirdRoundPlan,
  bindCandidateObservations,
  bindGeneratedCandidateHistories,
  buildRegenerationPlan,
  buildSelectionRecord,
  buildThirdRoundCandidate,
  buildThirdRoundPlan,
  computeCandidateConfigDigest,
  computeCandidateTtsConfigDigest,
  computeReferenceDigest,
  computeRegenerationPlanSha,
  computeThirdRoundPlanSha,
  EXPECTED_ASSETS_BY_LANGUAGE,
  EXPECTED_ASSETS_BY_VOICE,
  EXPECTED_FIRST_ROUND_CANDIDATE_COUNT,
  EXPECTED_FIRST_ROUND_CHARACTERS,
  EXPECTED_REGENERATION_ASSET_COUNT,
  evaluateCandidate,
  isGeneratedCandidateCacheReusable,
  MAX_REGENERATION_CANDIDATE_COUNT,
  normalizePronunciationDictionaryIpa,
  runFailStopPool,
  selectCandidateForAsset,
  validatePromotionLedger,
  withCurrentCandidateAuditContext,
} from "./lib/phoneme-word-regeneration-core.mjs";
import { sha256Bytes, sha256File } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const output = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14",
);
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

function buildPlan() {
  return readJson(
    path.join(output, "regenerated-candidates", "regeneration-plan.json"),
  );
}

const plan = buildPlan();

test("regeneration scope is exactly the locked 416-asset risk batch", () => {
  assert.equal(plan.sourceAssetCount, EXPECTED_REGENERATION_ASSET_COUNT);
  assert.deepEqual(plan.byLanguage, EXPECTED_ASSETS_BY_LANGUAGE);
  assert.deepEqual(plan.byVoice, EXPECTED_ASSETS_BY_VOICE);
  assert.equal(
    plan.firstRoundCandidateCount,
    EXPECTED_FIRST_ROUND_CANDIDATE_COUNT,
  );
  assert.equal(plan.firstRoundCharacters, EXPECTED_FIRST_ROUND_CHARACTERS);
  assert.equal(plan.maximumCandidateCount, MAX_REGENERATION_CANDIDATE_COUNT);
  assertRegenerationPlan(plan);
});

test("regeneration planning includes blocked observations without weakening locked gates", () => {
  const inventory = readJson(path.join(output, "inventory.json"));
  const consensus = readJson(path.join(output, "machine-consensus.json"));
  const gold = readJson(path.join(output, "gold-pronunciations.json"));
  const manifests = Object.fromEntries(
    ["es-ES", "fr-FR", "ru-RU"].map((languageId) => [
      languageId,
      readJson(
        path.resolve(
          root,
          `public/audio/language-packs/${languageId}/manifest.json`,
        ),
      ),
    ]),
  );
  const rebuilt = buildRegenerationPlan({
    inventory,
    consensus,
    gold,
    manifests,
  });
  const blockedIds = new Set(
    consensus.items
      .filter((item) => item.priority === "blocked")
      .map((item) => item.assetId),
  );
  assert.equal(blockedIds.size, 64);
  assert.equal(
    rebuilt.sourceAssets.filter((asset) => blockedIds.has(asset.sourceAssetId))
      .length,
    64,
  );
  assert.deepEqual(rebuilt.byLanguage, EXPECTED_ASSETS_BY_LANGUAGE);
  assert.deepEqual(rebuilt.byVoice, EXPECTED_ASSETS_BY_VOICE);
  assert.throws(
    () =>
      buildRegenerationPlan({
        inventory,
        consensus: {
          ...consensus,
          items: consensus.items.filter(
            (item) => item.assetId !== [...blockedIds][0],
          ),
        },
        gold,
        manifests,
      }),
    /416 locked-risk assets, received 415/u,
  );
});

test("goat is the only IPA chart asset and is assigned to Max", () => {
  const chartAssets = plan.sourceAssets.filter(
    (asset) => asset.role === "ipa-word-normal",
  );
  assert.equal(chartAssets.length, 1);
  assert.equal(chartAssets[0].text, "goat");
  assert.equal(chartAssets[0].voiceName, "Max");
  assert.equal(chartAssets[0].voiceGender, "masculine");
});

test("all 415 example words preserve original speaker and Russian gender semantics", () => {
  assert.equal(
    plan.sourceAssets.filter((asset) => asset.role === "example-word").length,
    415,
  );
  assert.ok(plan.sourceAssets.every((asset) => asset.voiceId));
  assert.ok(
    plan.sourceAssets
      .filter(
        (asset) => asset.languageId === "ru-RU" && asset.voiceSlot === "blue",
      )
      .every(
        (asset) =>
          asset.voiceName === "Valeria" && asset.voiceGender === "feminine",
      ),
  );
  assert.ok(
    plan.sourceAssets
      .filter(
        (asset) => asset.languageId === "ru-RU" && asset.voiceSlot === "pink",
      )
      .every(
        (asset) =>
          asset.voiceName === "Sergey" && asset.voiceGender === "masculine",
      ),
  );
});

test("A/B seeds are distinct, deterministic, and network retries do not create candidates", () => {
  assert.equal(
    new Set(plan.candidates.map((candidate) => candidate.candidateId)).size,
    832,
  );
  for (const source of plan.sourceAssets) {
    const pair = plan.candidates.filter(
      (candidate) => candidate.sourceAssetId === source.sourceAssetId,
    );
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0].seed, pair[1].seed);
  }
  const rebuilt = buildPlan();
  assert.deepEqual(
    rebuilt.candidates.map(({ candidateId, seed }) => ({ candidateId, seed })),
    plan.candidates.map(({ candidateId, seed }) => ({ candidateId, seed })),
  );
  assert.equal(
    computeRegenerationPlanSha(rebuilt),
    computeRegenerationPlanSha(plan),
  );
});

test("third candidate requires two failed candidates and two-source reference", () => {
  const source = plan.sourceAssets[0];
  const pair = plan.candidates
    .filter((candidate) => candidate.sourceAssetId === source.sourceAssetId)
    .map((candidate) => ({ ...candidate, status: "machine-failed" }));
  assert.throws(
    () => buildThirdRoundCandidate(source, pair),
    /unresolved reference/,
  );
  const confirmed = {
    ...source,
    referenceStatus: "two-source-confirmed",
    referenceSources: [{ name: "source-a" }, { name: "source-b" }],
    referenceSourceCount: 2,
    referenceDigest: undefined,
    relationshipIssues: [],
  };
  const third = buildThirdRoundCandidate(confirmed, pair);
  assert.equal(third.generationRound, 3);
  assert.equal(third.modelId, "eleven_v3");
  assert.equal(third.pronunciationDictionary.alphabet, "ipa");
  assert.equal(third.configDigest, computeCandidateConfigDigest(third));
});

test("pronunciation dictionary preserves stress and only strips outer delimiters", () => {
  assert.equal(
    normalizePronunciationDictionaryIpa("  /ˌɪn.tɚˈnæʃ.ə.nəl/  "),
    "ˌɪn.tɚˈnæʃ.ə.nəl",
  );
  assert.equal(normalizePronunciationDictionaryIpa(" /a b/ "), "a b");
});

test("third candidate rejects pair IPA pollution, relationship issues, and duplicate sources", () => {
  const source = plan.sourceAssets[0];
  const pair = plan.candidates
    .filter((candidate) => candidate.sourceAssetId === source.sourceAssetId)
    .map((candidate) => ({ ...candidate, status: "machine-failed" }));
  const confirmed = {
    ...source,
    referenceStatus: "two-source-confirmed",
    referenceSources: [{ name: "a" }, { name: "b" }],
    referenceDigest: undefined,
    relationshipIssues: [],
  };
  assert.throws(
    () =>
      buildThirdRoundCandidate(
        { ...confirmed, canonicalIpa: "/a/ ~ /b/" },
        pair,
      ),
    /polluted IPA/,
  );
  assert.throws(
    () =>
      buildThirdRoundCandidate(
        { ...confirmed, relationshipIssues: ["target-unit-missing"] },
        pair,
      ),
    /relationship issues/,
  );
  assert.throws(
    () =>
      buildThirdRoundCandidate(
        {
          ...confirmed,
          referenceSources: [{ name: "same" }, { name: "same" }],
        },
        pair,
      ),
    /unresolved reference/,
  );
  assert.throws(
    () =>
      buildThirdRoundCandidate(
        {
          ...confirmed,
          referenceSources: [
            { name: "Wiktionary" },
            { name: "Kaikki derived from Wiktionary" },
          ],
        },
        pair,
      ),
    /unresolved reference/,
  );
  assert.throws(
    () =>
      buildThirdRoundCandidate(
        {
          ...confirmed,
          referenceSources: [
            { name: "mirror-a", independenceGroup: "publisher-one" },
            { name: "mirror-b", publisherId: "publisher-one" },
          ],
        },
        pair,
      ),
    /unresolved reference/,
  );
});

test("reference digest covers source provenance and normalized evidence", () => {
  const base = {
    canonicalIpa: "/ˈtɛst/",
    referenceStatus: "two-source-confirmed",
    relationshipIssues: [],
    referenceSources: [
      {
        name: "dictionary-a",
        independenceGroup: "publisher-a",
        publisherId: "publisher-a",
        url: "https://example.test/a",
        revisionOrDate: "2026-07-15",
        license: "CC-BY",
        rawValue: " /ˈtɛst/ ",
        normalizedValue: "ˈtɛst",
      },
    ],
  };
  const digest = computeReferenceDigest(base);
  for (const changed of [
    { url: "https://example.test/b" },
    { license: "CC-BY-SA" },
    { rawValue: "/test/" },
    { normalizedValue: "test" },
    { independenceGroup: "publisher-b" },
    { publisherId: "publisher-b" },
  ]) {
    assert.notEqual(
      computeReferenceDigest({
        ...base,
        referenceSources: [{ ...base.referenceSources[0], ...changed }],
      }),
      digest,
    );
  }
});

function buildReviewedThirdPlanFixture() {
  const source = plan.sourceAssets[0];
  const sourceCandidateIds = new Set(
    plan.candidates
      .filter((candidate) => candidate.sourceAssetId === source.sourceAssetId)
      .map((candidate) => candidate.candidateId),
  );
  const selection = {
    results: plan.candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      status: sourceCandidateIds.has(candidate.candidateId)
        ? "machine-failed"
        : "machine-passed",
    })),
  };
  const gold = {
    entries: [
      {
        languageId: source.languageId,
        text: source.text,
        canonicalIpa: "/ˈtɛst/",
        status: "two-source-confirmed",
        sources: [
          { name: "dictionary-a", revisionOrDate: "v1", value: "ˈtɛst" },
          { name: "dictionary-b", revisionOrDate: "v2", value: "ˈtɛst" },
        ],
        syllableCount: 1,
        primaryStress: 1,
      },
    ],
  };
  const currentAssetById = new Map([
    [source.sourceAssetId, { ...source, relationshipIssues: [] }],
  ]);
  const currentShaByPath = new Map([
    [source.desktopPath, source.sourceSha256],
    [source.browserPath, source.sourceSha256],
  ]);
  return {
    source,
    selection,
    gold,
    currentAssetById,
    currentShaByPath,
  };
}

test("pure third-round plan overlays current references and has an immutable SHA", () => {
  const fixture = buildReviewedThirdPlanFixture();
  const thirdPlan = buildThirdRoundPlan({ plan, ...fixture });
  assert.equal(thirdPlan.candidateCount, 1);
  assert.equal(thirdPlan.blockedCount, 0);
  assert.equal(thirdPlan.paidCallsMade, false);
  assert.equal(
    thirdPlan.characterCount,
    thirdPlan.candidates[0].characterCount,
  );
  assert.equal(
    thirdPlan.sourceDurationSeconds,
    Number(fixture.source.durationSeconds),
  );
  assert.equal(thirdPlan.thirdPlanSha256, computeThirdRoundPlanSha(thirdPlan));
  assert.equal(
    thirdPlan.candidates[0].pronunciationDictionary.phoneme,
    "ˈtɛst",
  );
  assertThirdRoundPlan(thirdPlan, { plan, ...fixture });

  const changed = {
    ...thirdPlan,
    characterCount: thirdPlan.characterCount + 1,
  };
  assert.throws(
    () => assertThirdRoundPlan(changed, { plan, ...fixture }),
    /immutable payload/,
  );
});

test("third-round plan blocks stale desktop or browser source SHA", () => {
  const fixture = buildReviewedThirdPlanFixture();
  fixture.currentShaByPath.set(fixture.source.browserPath, "changed");
  const thirdPlan = buildThirdRoundPlan({ plan, ...fixture });
  assert.equal(thirdPlan.candidateCount, 0);
  assert.equal(thirdPlan.blockedCount, 1);
  assert.match(thirdPlan.blocked[0].reason, /Current source SHA changed/);
});

test("candidate cache requires source, reference, and generation config digests", () => {
  const legacyCandidate = { ...plan.candidates[0] };
  delete legacyCandidate.referenceDigest;
  delete legacyCandidate.configDigest;
  const candidate = {
    ...legacyCandidate,
    referenceDigest: "reference-digest",
    configDigest: "config-digest",
  };
  const cached = { ...candidate };
  assert.equal(
    isGeneratedCandidateCacheReusable({
      cached: legacyCandidate,
      candidate: legacyCandidate,
      audioExists: true,
    }),
    false,
  );
  assert.equal(
    isGeneratedCandidateCacheReusable({ cached, candidate, audioExists: true }),
    true,
  );
  assert.equal(
    isGeneratedCandidateCacheReusable({
      cached: { ...cached, referenceDigest: "stale" },
      candidate,
      audioExists: true,
    }),
    false,
  );
  assert.equal(
    isGeneratedCandidateCacheReusable({
      cached: { ...cached, configDigest: "stale" },
      candidate,
      audioExists: true,
    }),
    false,
  );
});

function loadTestPostProcessingLineage() {
  const lineageRoot = path.join(output, "loudness-normalization-v2");
  const result = new Map();
  const pending = existsSync(lineageRoot) ? [lineageRoot] : [];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
      } else if (/^journal-completed-[a-f0-9]+\.json$/u.test(entry.name)) {
        const journal = readJson(absolutePath);
        if (journal.status !== "completed") continue;
        for (const item of journal.entries ?? []) {
          result.set(item.assetId, {
            sourceSha256: item.sourceSha256,
            candidateSha256: item.candidateSha256,
            desktopPath: item.desktop.targetPath.replaceAll("\\", "/"),
            browserPath: item.browser.targetPath.replaceAll("\\", "/"),
          });
        }
      }
    }
  }
  return result;
}
test("current 64 promotions are SHA-verified and exactly 704 legacy A/B candidates remain active", () => {
  const regenerationRoot = path.join(output, "regenerated-candidates");
  const history = readFileSync(
    path.join(regenerationRoot, "generated.jsonl"),
    "utf8",
  )
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(history.length, 832);
  const actualAudioShaByCandidateId = new Map(
    plan.candidates.map((candidate) => {
      const audioPath = path.join(
        regenerationRoot,
        "audio",
        `${candidate.candidateId}.mp3`,
      );
      assert.ok(existsSync(audioPath));
      return [candidate.candidateId, sha256File(audioPath)];
    }),
  );
  const formalShaByPath = new Map(
    plan.sourceAssets.flatMap((source) =>
      [source.desktopPath, source.browserPath].map((relativePath) => [
        relativePath,
        sha256File(path.resolve(root, relativePath)),
      ]),
    ),
  );
  const promotion = validatePromotionLedger({
    plan,
    ledger: readJson(path.join(regenerationRoot, "promotion-ledger.json")),
    generatedHistory: history,
    actualAudioShaByCandidateId,
    formalShaByPath,
    postProcessingLineageBySourceAssetId: loadTestPostProcessingLineage(),
  });
  assert.equal(promotion.replacementCount, 64);
  assert.ok(
    promotion.replacements.every(
      (row) => row.status === "already-promoted-pending-human",
    ),
  );
  const promoted = new Set(
    promotion.replacements.map((row) => row.sourceAssetId),
  );
  const currentCandidates = plan.candidates.map((candidate) =>
    withCurrentCandidateAuditContext(
      candidate,
      plan.sourceAssets.find(
        (source) => source.sourceAssetId === candidate.sourceAssetId,
      ),
    ),
  );
  const binding = bindGeneratedCandidateHistories({
    plannedCandidates: currentCandidates,
    historyRows: history,
    actualAudioShaByCandidateId,
    excludedSourceAssetIds: promoted,
  });
  assert.deepEqual(binding.issues, []);
  assert.equal(binding.bound.length, 704);
  assert.ok(binding.bound.every((candidate) => candidate.candidateSha256));
  assert.equal(
    computeCandidateTtsConfigDigest(binding.bound[0]),
    binding.bound[0].ttsConfigDigest,
  );
});

test("validated round-C candidates are allowed in a promotion ledger", () => {
  const baseSource = {
    ...plan.sourceAssets[0],
    referenceStatus: "two-source-confirmed",
    referenceSources: [
      { name: "dictionary-a", independenceGroup: "publisher-a" },
      { name: "dictionary-b", independenceGroup: "publisher-b" },
    ],
    relationshipIssues: [],
  };
  baseSource.referenceDigest = computeReferenceDigest(baseSource);
  const pair = plan.candidates
    .filter((candidate) => candidate.sourceAssetId === baseSource.sourceAssetId)
    .map((candidate) => ({ ...candidate, status: "machine-failed" }));
  const third = buildThirdRoundCandidate(baseSource, pair);
  const formalSha = "c".repeat(64);
  const currentSource = { ...baseSource, sourceSha256: formalSha };
  const ledger = validatePromotionLedger({
    plan: { sourceAssets: [currentSource], candidates: [] },
    ledger: {
      replacementCount: 1,
      replacements: [
        {
          sourceAssetId: baseSource.sourceAssetId,
          candidateId: third.candidateId,
          oldSha256: baseSource.sourceSha256,
          newSha256: formalSha,
        },
      ],
    },
    generatedHistory: [{ ...third, candidateSha256: formalSha }],
    actualAudioShaByCandidateId: new Map([[third.candidateId, formalSha]]),
    formalShaByPath: new Map([
      [currentSource.desktopPath, formalSha],
      [currentSource.browserPath, formalSha],
    ]),
    additionalPlannedCandidates: [third],
  });
  assert.equal(ledger.replacementCount, 1);
  assert.equal(ledger.replacements[0].status, "already-promoted-pending-human");
  const reloaded = validatePromotionLedger({
    plan: { sourceAssets: [currentSource], candidates: [] },
    ledger,
    generatedHistory: [{ ...third, candidateSha256: formalSha }],
    actualAudioShaByCandidateId: new Map([[third.candidateId, formalSha]]),
    formalShaByPath: new Map([
      [currentSource.desktopPath, formalSha],
      [currentSource.browserPath, formalSha],
    ]),
    additionalPlannedCandidates: [third],
  });
  assert.deepEqual(reloaded, ledger);
});
test("stale observation SHA is rejected instead of rebound by candidate ID", () => {
  const candidate = {
    candidateId: "candidate-a",
    candidateSha256: "current-audio-sha",
  };
  const binding = bindCandidateObservations({
    candidates: [candidate],
    rows: [
      {
        candidateId: candidate.candidateId,
        candidateSha256: "stale-audio-sha",
        outcome: "exact",
      },
    ],
  });
  assert.equal(binding.byCandidateId.size, 0);
  assert.deepEqual(binding.issues, ["stale-observation:candidate-a"]);
});

test("selection binds base/third plan, promoted IDs, and its own SHA", () => {
  const selection = buildSelectionRecord({
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: null,
    promotedSourceAssetIds: ["promoted-b", "promoted-a"],
    totalSourceAssetCount: 3,
    results: [
      {
        candidateId: "candidate-a",
        generationRound: 1,
        status: "machine-failed",
      },
    ],
    selected: [],
  });
  assertSelectionRecord(selection, {
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: null,
    promotedSourceAssetIds: ["promoted-a", "promoted-b"],
  });
  assert.throws(
    () =>
      assertSelectionRecord(
        { ...selection, selectionSha256: "stale" },
        {
          basePlanSha256: plan.planSha256,
          thirdPlanSha256: null,
          promotedSourceAssetIds: ["promoted-a", "promoted-b"],
        },
      ),
    /Selection digest is stale/u,
  );
});
function confirmedSourceFor(candidate) {
  return {
    ...plan.sourceAssets.find(
      (source) => source.sourceAssetId === candidate.sourceAssetId,
    ),
    referenceStatus: "two-source-confirmed",
    referenceSources: [
      { name: "dictionary-a", independenceGroup: "publisher-a" },
      { name: "dictionary-b", independenceGroup: "publisher-b" },
    ],
    relationshipIssues: [],
  };
}
const stable = { outcome: "exact", answerLeakage: false };
const goodSignal = { ok: true, issues: [], distanceFromVoiceMedian: 0.1 };

test("all three blind listeners are mandatory and any risk blocks promotion", () => {
  const candidate = plan.candidates.find((item) => item.languageId !== "en-US");
  const passed = evaluateCandidate({
    candidate,
    source: confirmedSourceFor(candidate),
    signal: goodSignal,
    whisper: stable,
    azure: stable,
    scribe: stable,
  });
  assert.equal(passed.status, "machine-passed");
  const failed = evaluateCandidate({
    candidate,
    source: confirmedSourceFor(candidate),
    signal: goodSignal,
    whisper: stable,
    azure: { outcome: "different-word" },
    scribe: stable,
  });
  assert.equal(failed.status, "machine-failed");
  assert.ok(failed.reasons.includes("azure-different-word"));
});

test("English additionally requires target, syllable, and stress evidence", () => {
  const candidate = plan.candidates.find((item) => item.languageId === "en-US");
  const base = {
    candidate,
    source: confirmedSourceFor(candidate),
    signal: goodSignal,
    whisper: stable,
    azure: stable,
    scribe: stable,
  };
  assert.equal(
    evaluateCandidate({
      ...base,
      azurePronunciation: {
        ok: true,
        targetUnitAligned: true,
        syllableCountAligned: true,
        stressAligned: true,
        wordAccuracy: 90,
      },
    }).status,
    "machine-passed",
  );
  assert.equal(
    evaluateCandidate({
      ...base,
      azurePronunciation: {
        ok: true,
        targetUnitAligned: false,
        syllableCountAligned: true,
        stressAligned: true,
      },
    }).status,
    "machine-failed",
  );
});

test("candidate selection is deterministic and favors exact listeners before score", () => {
  const a = {
    candidateId: "a",
    status: "machine-passed",
    exactListenerCount: 3,
    wordAccuracy: 80,
    distanceFromVoiceMedian: 0.4,
  };
  const b = {
    candidateId: "b",
    status: "machine-passed",
    exactListenerCount: 2,
    wordAccuracy: 99,
    distanceFromVoiceMedian: 0.1,
  };
  assert.equal(selectCandidateForAsset([b, a]).candidateId, "a");
  assert.equal(
    selectCandidateForAsset([{ ...a, candidateId: "b" }, a]).candidateId,
    "a",
  );
});

test("promotion rejects unpassed candidates and changed source SHA", () => {
  const source = plan.sourceAssets[0];
  assert.throws(
    () =>
      assertPromotionAllowed({
        source,
        candidate: {
          sourceAssetId: source.sourceAssetId,
          status: "machine-failed",
        },
        currentSourceSha256: source.sourceSha256,
      }),
    /not machine-passed/,
  );
  assert.throws(
    () =>
      assertPromotionAllowed({
        source,
        candidate: {
          sourceAssetId: source.sourceAssetId,
          status: "machine-passed",
        },
        currentSourceSha256: "changed",
      }),
    /Source SHA changed/,
  );
});

test("blind clients contain no prompt or expected-word field", () => {
  const source = readFileSync(
    "scripts/lib/elevenlabs-audio-clients.mjs",
    "utf8",
  );
  const scribeBody = source.slice(
    source.indexOf("export async function transcribeElevenLabsScribe"),
  );
  assert.doesNotMatch(scribeBody, /keyterm|expected[_-]?word|prompt/iu);
  const azureSource = readFileSync("scripts/lib/azure-stt-client.mjs", "utf8");
  assert.doesNotMatch(azureSource, /ReferenceText|Pronunciation-Assessment/iu);
});

test("round C requires both reviewed plan SHAs and reserves only its exact cost", () => {
  const source = readFileSync("scripts/phoneme-word-regeneration.mjs", "utf8");
  assert.match(source, /Paid TTS generation requires --confirm/u);
  assert.match(
    source,
    /exact --plan-sha from the reviewed dry-run is required/u,
  );
  assert.match(
    source,
    /exact --third-plan-sha from the reviewed third-round plan is required/u,
  );
  assert.match(source, /subscription\.remaining - thirdPlan\.characterCount/u);
  assert.doesNotMatch(
    source,
    /subscription\.remaining\s*-\s*plan\.firstRoundCharacters\s*-\s*thirdPlan\.characterCount/u,
  );
});

test("paid POST operations are not automatically retried and promotion is batch-atomic", () => {
  const source = readFileSync("scripts/phoneme-word-regeneration.mjs", "utf8");
  for (const paidCall of [
    "createElevenLabsPronunciationDictionary",
    "synthesizeElevenLabsCandidate",
    "transcribeElevenLabsScribe",
    "recognizeAzureWordBlind",
    "assessAzurePronunciation",
  ]) {
    assert.doesNotMatch(
      source,
      new RegExp(`withRetry\\(\\(\\) =>\\s*${paidCall}`, "u"),
    );
  }
  assert.match(
    source,
    /import \{ atomicPromoteBatch \} from "\.\/lib\/atomic-audio-promotion\.mjs"/u,
  );
  assert.match(source, /const promotionOperations = \[\]/u);
  assert.match(
    source,
    /atomicPromoteBatch\(\{[\s\S]*operations: promotionOperations/u,
  );
  assert.match(source, /ledgerPath: promotionPath/u);
  assert.match(source, /ledgerBytes: Buffer\.from/u);
  assert.doesNotMatch(source, /atomicPromotePair/u);
});

test("paid worker pool stops allocating work after the first failure", async () => {
  const started = [];
  const completed = [];
  await assert.rejects(
    runFailStopPool([0, 1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("paid failure");
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
      completed.push(item);
    }),
    /paid failure/u,
  );
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(completed, [1]);
});

test("ledger activation failure rolls back every formal file and the old ledger", () => {
  const temporaryRoot = mkdtempSync(path.join(output, "promotion-contract-"));
  try {
    const desktopPath = path.join(temporaryRoot, "desktop.mp3");
    const browserPath = path.join(temporaryRoot, "browser.mp3");
    const ledgerPath = path.join(temporaryRoot, "promotion-ledger.json");
    const oldBytes = Buffer.from("old-audio", "utf8");
    const newBytes = Buffer.from("new-audio", "utf8");
    const oldLedger = Buffer.from("old-ledger", "utf8");
    const newLedger = Buffer.from("new-ledger", "utf8");
    writeFileSync(desktopPath, oldBytes);
    writeFileSync(browserPath, oldBytes);
    writeFileSync(ledgerPath, oldLedger);

    assert.throws(
      () =>
        atomicPromoteBatch({
          operations: [
            {
              desktopPath,
              browserPath,
              bytes: newBytes,
              candidateSha256: sha256Bytes(newBytes),
              expectedOldSha256: sha256Bytes(oldBytes),
            },
          ],
          ledgerPath,
          ledgerBytes: newLedger,
          faultInjector: (phase) => {
            if (phase === "after-ledger-activation") {
              throw new Error("simulated ledger durability failure");
            }
          },
        }),
      /simulated ledger durability failure/u,
    );
    assert.deepEqual(readFileSync(desktopPath), oldBytes);
    assert.deepEqual(readFileSync(browserPath), oldBytes);
    assert.deepEqual(readFileSync(ledgerPath), oldLedger);
    assert.deepEqual(
      readdirSync(temporaryRoot).filter((name) =>
        /\.regen-.*\.(tmp|bak)$/u.test(name),
      ),
      [],
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("promotion reload includes additional round-C candidate identities", () => {
  const source = readFileSync("scripts/phoneme-word-regeneration.mjs", "utf8");
  assert.match(
    source,
    /\[\.\.\.plan\.candidates, \.\.\.additionalPlannedCandidates\]\.map/u,
  );
  assert.match(source, /additionalPlannedCandidates,/u);
});
