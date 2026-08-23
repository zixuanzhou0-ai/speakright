#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFormalAudioPaths,
  assertIgnoredOutputPath,
  buildArtifactPaths,
  buildFfmpegStages,
  buildImmutablePlan,
  digestJson,
  finiteNumber,
  PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT,
  resolveWithin,
  selectPromotedLoudnessAnomalies,
  stableJson,
  validateV2CandidateQuality,
  verifyImmutablePlan,
} from "./lib/promoted-audio-loudness-v2-core.mjs";

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function rejects(callback, pattern) {
  assertions += 1;
  assert.throws(callback, pattern);
}

const selectedAssets = Array.from(
  { length: PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT },
  (_, index) => {
    const assetId = index.toString(16).padStart(20, "0");
    return {
      assetId,
      candidateId: `candidate-${index}`,
      sha256: `${index}`.padStart(64, "a"),
      languageId: index < 21 ? "fr-FR" : "ru-RU",
      text: `word-${index}`,
      voiceName: index < 21 ? "Rachel" : "Valeria",
      voiceGender: "feminine",
      desktopPath: `public/audio/language-packs/${index < 21 ? "fr-FR" : "ru-RU"}/word-${index}.mp3`,
      browserPath: `apps/browser/public/audio/language-packs/${index < 21 ? "fr-FR" : "ru-RU"}/word-${index}.mp3`,
    };
  },
);
const bundle = { digest: "bundle-digest", assets: selectedAssets };
const report = {
  bundleDigest: bundle.digest,
  crossVoice: [
    {
      languageId: "fr-FR",
      status: "fail",
      voices: [
        { voiceName: "Rachel", medianIntegratedLufs: -34.65 },
        { voiceName: "Clément", medianIntegratedLufs: -21.35 },
      ],
    },
    {
      languageId: "ru-RU",
      status: "fail",
      voices: [
        { voiceName: "Valeria", medianIntegratedLufs: -28.21 },
        { voiceName: "Sergey", medianIntegratedLufs: -20.46 },
      ],
    },
    {
      languageId: "en-US",
      status: "pass",
      voices: [
        { voiceName: "Max", medianIntegratedLufs: -16 },
        { voiceName: "Nichalia", medianIntegratedLufs: -14 },
      ],
    },
  ],
  rows: selectedAssets.map((asset) => ({
    assetId: asset.assetId,
    sha256: asset.sha256,
    languageId: asset.languageId,
    voiceName: asset.voiceName,
    inputI: asset.languageId === "fr-FR" ? -34.65 : -28.21,
    inputTp: -12,
    inputLra: 0,
    inputThreshold: -45,
    targetOffset: 0,
  })),
};

const selected = selectPromotedLoudnessAnomalies({ bundle, report });
check(
  selected.length === 28,
  "dynamic anomaly selection keeps the 28 current assets",
);
check(
  selected.filter((asset) => asset.voiceName === "Rachel").length === 21,
  "French quieter voice group is selected dynamically",
);
check(
  selected.filter((asset) => asset.voiceName === "Valeria").length === 7,
  "Russian quieter voice group is selected dynamically",
);
check(
  selected.every((asset) => asset.anomaly.spreadLufs > 6),
  "only failed cross-voice groups enter the v2 plan",
);

rejects(() => finiteNumber(Number.NaN, "bad"), /finite number/u);
rejects(() => finiteNumber(Number.POSITIVE_INFINITY, "bad"), /finite number/u);
rejects(
  () => resolveWithin("E:/SpeakRight/outputs", "../public/audio/x.mp3"),
  /unsafe segment/u,
);
rejects(
  () =>
    assertFormalAudioPaths({
      desktopPath: "outputs/a.mp3",
      browserPath: "apps/browser/public/audio/a.mp3",
    }),
  /Unsafe formal desktop path/u,
);
rejects(
  () => assertIgnoredOutputPath("public/audio/changed.mp3"),
  /outside the ignored v2 root/u,
);

const artifacts = buildArtifactPaths(selected[0]);
check(
  artifacts.decodedSourceWav.endsWith(".decoded-source.wav"),
  "decoded source is WAV",
);
check(
  artifacts.normalizedMasterWav.endsWith(".normalized-master.wav"),
  "normalized master is lossless WAV",
);
check(
  artifacts.deliveryCandidateMp3.endsWith(".delivery-candidate.mp3"),
  "delivery candidate is a distinct MP3 artifact",
);

const stages = buildFfmpegStages({
  sourcePath: "formal.mp3",
  decodedWavPath: "decoded.wav",
  normalizedMasterPath: "master.wav",
  deliveryCandidatePath: "candidate.mp3",
  sampleRate: 44_100,
  channels: 1,
  measurements: {
    inputI: -34,
    inputTp: -20,
    inputLra: 0,
    inputThreshold: -45,
    targetOffset: 0,
  },
});
check(
  stages.length === 3,
  "pipeline has decode, normalize, and delivery stages",
);
check(
  stages.reduce((sum, stage) => sum + stage.lossyEncodeCount, 0) === 1,
  "pipeline contains exactly one lossy encode",
);
check(stages[0].args.includes("pcm_s24le"), "formal MP3 decodes to 24-bit PCM");
check(
  stages[1].inputPath === "decoded.wav",
  "normalization consumes decoded WAV",
);
check(
  stages[1].args.includes("pcm_s24le"),
  "normalization writes a 24-bit PCM master",
);
check(
  stages[2].inputPath === "master.wav",
  "MP3 encoding consumes the normalized master",
);
check(
  stages[2].args.includes("libmp3lame"),
  "only delivery stage uses MP3 encoding",
);
check(
  !stages.slice(0, 2).some((stage) => stage.args.includes("libmp3lame")),
  "lossless stages cannot perform an MP3 encode",
);

const sourceAnalysis = {
  probe: {
    codecName: "mp3",
    sampleRate: 44_100,
    channels: 1,
    durationSeconds: 1,
  },
  loudness: {
    integratedLufs: -34,
    truePeakDbtp: -20,
    loudnessRangeLu: 0,
    thresholdLufs: -45,
    targetOffsetLu: 0,
  },
  timeDomain: {
    peakLevelDbfs: -20,
    nanCount: 0,
    infiniteCount: 0,
    denormalCount: 0,
  },
  silence: {
    totalSeconds: 0.1,
    ratio: 0.1,
    leadingSeconds: 0.05,
    trailingSeconds: 0.05,
  },
  spectrum: {
    centroidHz: 2_000,
    spreadHz: 3_000,
    flatness: 0.1,
    rolloffHz: 7_000,
  },
};
const plan = buildImmutablePlan({
  bundle,
  loudnessReportPath:
    "outputs/phoneme-word-auditory-audit-2026-07-14/report.json",
  loudnessReportSha256: "b".repeat(64),
  selected: selected.map((asset) => ({ ...asset, sourceAnalysis })),
});
check(verifyImmutablePlan(plan) === plan.planSha256, "immutable plan verifies");
const samePlan = buildImmutablePlan({
  bundle,
  loudnessReportPath:
    "outputs/phoneme-word-auditory-audit-2026-07-14/report.json",
  loudnessReportSha256: "b".repeat(64),
  selected: selected.map((asset) => ({ ...asset, sourceAnalysis })),
});
check(plan.planSha256 === samePlan.planSha256, "plan digest is deterministic");
check(
  stableJson({ b: 1, a: 2 }) === stableJson({ a: 2, b: 1 }),
  "canonical JSON sorts keys",
);
check(
  digestJson({ sourceSha: "a" }) !== digestJson({ sourceSha: "b" }),
  "SHA changes bind a new plan",
);
rejects(
  () => verifyImmutablePlan({ ...plan, assetCount: 27 }),
  /digest mismatch/u,
);

const decoded = {
  ...sourceAnalysis,
  probe: { ...sourceAnalysis.probe, codecName: "pcm_s24le" },
};
const master = {
  ...decoded,
  loudness: { ...decoded.loudness, integratedLufs: -23, truePeakDbtp: -2.1 },
  timeDomain: { ...decoded.timeDomain, peakLevelDbfs: -2.2 },
};
const delivery = {
  ...master,
  probe: { ...master.probe, codecName: "mp3", durationSeconds: 1.02 },
  loudness: { ...master.loudness, integratedLufs: -23.2, truePeakDbtp: -2.05 },
  spectrum: {
    centroidHz: 2_050,
    spreadHz: 3_050,
    flatness: 0.105,
    rolloffHz: 6_950,
  },
};
const passed = validateV2CandidateQuality({
  source: sourceAnalysis,
  decoded,
  master,
  delivery,
  sourceMasterSiSdr: { infinite: false, valueDb: 80 },
  masterDeliverySiSdr: { infinite: false, valueDb: 25 },
});
check(
  passed.passed,
  `valid safe-v2 candidate passes: ${passed.reasons.join(", ")}`,
);

const clipping = validateV2CandidateQuality({
  source: sourceAnalysis,
  decoded,
  master,
  delivery: {
    ...delivery,
    loudness: { ...delivery.loudness, truePeakDbtp: 0.1 },
    timeDomain: { ...delivery.timeDomain, peakLevelDbfs: 0 },
  },
  sourceMasterSiSdr: { infinite: false, valueDb: 80 },
  masterDeliverySiSdr: { infinite: false, valueDb: 25 },
});
check(!clipping.passed, "true-peak/sample clipping blocks a candidate");

const spectralDamage = validateV2CandidateQuality({
  source: sourceAnalysis,
  decoded,
  master,
  delivery: {
    ...delivery,
    spectrum: {
      centroidHz: 500,
      spreadHz: 800,
      flatness: 0.5,
      rolloffHz: 2_000,
    },
  },
  sourceMasterSiSdr: { infinite: false, valueDb: 80 },
  masterDeliverySiSdr: { infinite: false, valueDb: 25 },
});
check(!spectralDamage.passed, "spectral damage blocks a candidate");

const invalidSamples = validateV2CandidateQuality({
  source: sourceAnalysis,
  decoded,
  master,
  delivery: {
    ...delivery,
    timeDomain: { ...delivery.timeDomain, nanCount: 1 },
  },
  sourceMasterSiSdr: { infinite: false, valueDb: 80 },
  masterDeliverySiSdr: { infinite: false, valueDb: 25 },
});
check(!invalidSamples.passed, "NaN PCM samples block a candidate");

const cliSource = readFileSync(
  "scripts/promoted-audio-loudness-v2.mjs",
  "utf8",
);
check(
  !cliSource.includes("rmSync"),
  "v2 CLI does not recursively or force-delete paths",
);
check(!cliSource.includes("fetch("), "v2 CLI has no network call");
check(!cliSource.includes("https://"), "v2 CLI has no remote endpoint");
check(
  (cliSource.match(/libmp3lame/gu) ?? []).length === 0,
  "CLI delegates codec topology to the tested core",
);
check(
  !cliSource.includes("loudness-normalization-candidates"),
  "v2 CLI never consumes the earlier lossy v1 candidate directory",
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      assertions,
      assetCount: selected.length,
      lossyEncodeCountPerAsset: stages.reduce(
        (sum, stage) => sum + stage.lossyEncodeCount,
        0,
      ),
    },
    null,
    2,
  ),
);
