import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertPromotionAllowed,
  assertRegenerationPlan,
  assertThirdRoundPlan,
  buildThirdRoundCandidate,
  buildThirdRoundPlan,
  computeCandidateConfigDigest,
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
  selectCandidateForAsset,
} from "./lib/phoneme-word-regeneration-core.mjs";

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

test("regeneration scope is exactly the locked 416-asset P0 batch", () => {
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
  const legacyCandidate = plan.candidates[0];
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

const stable = { outcome: "exact", answerLeakage: false };
const goodSignal = { ok: true, issues: [], distanceFromVoiceMedian: 0.1 };

test("all three blind listeners are mandatory and any risk blocks promotion", () => {
  const candidate = plan.candidates.find((item) => item.languageId !== "en-US");
  const passed = evaluateCandidate({
    candidate,
    signal: goodSignal,
    whisper: stable,
    azure: stable,
    scribe: stable,
  });
  assert.equal(passed.status, "machine-passed");
  const failed = evaluateCandidate({
    candidate,
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
