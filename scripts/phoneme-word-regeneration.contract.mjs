import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  assertPromotionAllowed,
  assertRegenerationPlan,
  buildRegenerationPlan,
  buildThirdRoundCandidate,
  computeRegenerationPlanSha,
  EXPECTED_ASSETS_BY_LANGUAGE,
  EXPECTED_ASSETS_BY_VOICE,
  EXPECTED_FIRST_ROUND_CANDIDATE_COUNT,
  EXPECTED_FIRST_ROUND_CHARACTERS,
  EXPECTED_REGENERATION_ASSET_COUNT,
  evaluateCandidate,
  MAX_REGENERATION_CANDIDATE_COUNT,
  selectCandidateForAsset,
} from "./lib/phoneme-word-regeneration-core.mjs";

const root = process.cwd();
const output = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14",
);
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
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

function buildPlan() {
  return buildRegenerationPlan({
    inventory: readJson(path.join(output, "inventory.json")),
    consensus: readJson(path.join(output, "machine-consensus.json")),
    gold: readJson(path.join(output, "gold-pronunciations.json")),
    manifests,
  });
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
    referenceSourceCount: 2,
  };
  const third = buildThirdRoundCandidate(confirmed, pair);
  assert.equal(third.generationRound, 3);
  assert.equal(third.modelId, "eleven_v3");
  assert.equal(third.pronunciationDictionary.alphabet, "ipa");
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
