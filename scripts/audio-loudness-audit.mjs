#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const TARGET_RMS = 0.12;
const MAX_PEAK = 0.94;
const MIN_GAIN = 0.45;
const MAX_GAIN = 12;
const VIDEO_REFERENCE_MARGIN_DB = 7;
const MAX_PAIR_SPREAD_DB = 3.5;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const root = process.cwd();
const reportPath = join(root, "src-tauri", "target", "audio-loudness", "report.json");

const videoReferences = [
  {
    id: "es-video-a",
    label: "Spanish /a/ teaching video",
    path: "public/videos/language-assets/es-ES/animation/es-a.mp4",
  },
  {
    id: "fr-video-i",
    label: "French /i/ teaching video",
    path: "public/videos/language-assets/fr-FR/articulation/fr-i.mp4",
  },
];

const wordSamples = [
  {
    id: "en-able-blue",
    pairId: "en-able",
    label: "English able blue",
    path: "public/audio/words/blue/able.mp3",
  },
  {
    id: "en-able-pink",
    pairId: "en-able",
    label: "English able pink",
    path: "public/audio/words/pink/able.mp3",
  },
  {
    id: "fr-accueil-blue",
    pairId: "fr-accueil",
    label: "French accueil blue",
    path: "public/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
  },
  {
    id: "fr-accueil-pink",
    pairId: "fr-accueil",
    label: "French accueil pink",
    path: "public/audio/language-packs/fr-FR/accueil-pink-acf26f7271.mp3",
  },
  {
    id: "es-casa-blue",
    label: "Spanish casa blue",
    path: "public/audio/language-packs/es-ES/casa-81bce1f3bf.mp3",
  },
  {
    id: "ru-papa-blue",
    label: "Russian papa blue",
    path: "public/audio/language-packs/ru-RU/word-918d73538e.mp3",
  },
  {
    id: "ipa-cat-normal",
    pairId: "ipa-cat-chart",
    label: "IPA chart cat normal",
    path: "public/audio/ipa/normal/cat.mp3",
  },
  {
    id: "ipa-cat-slow",
    pairId: "ipa-cat-chart",
    label: "IPA chart cat slow",
    path: "public/audio/ipa/slow/cat.mp3",
  },
  {
    id: "ipa-dinosaur-normal",
    label: "IPA chart dinosaur normal",
    path: "public/audio/ipa/normal/dinosaur.mp3",
  },
];

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`${command} failed to start: ${result.error.message}`);
  }

  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

function measureVolume(sample) {
  const fullPath = join(root, sample.path);
  const output = run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    fullPath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "NUL",
  ]);

  const meanMatch = output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/);
  const maxMatch = output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/);

  if (!meanMatch || !maxMatch) {
    throw new Error(`Could not parse ffmpeg volumedetect output for ${sample.path}`);
  }

  return {
    ...sample,
    meanDb: Number(meanMatch[1]),
    maxDb: Number(maxMatch[1]),
  };
}

function dbToLinear(db) {
  return 10 ** (db / 20);
}

function gainToDb(gain) {
  return 20 * Math.log10(gain);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fallbackGainForPath(path) {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const isPink = normalized.includes("/pink/") || normalized.includes("-pink-");

  if (normalized.includes("/audio/language-packs/fr-fr/")) {
    return isPink ? 12 : 2.2;
  }

  if (normalized.includes("/audio/language-packs/es-es/")) {
    return isPink ? 2.5 : 1.25;
  }

  if (normalized.includes("/audio/language-packs/ru-ru/")) {
    return isPink ? 1.75 : 5;
  }

  if (normalized.includes("/audio/words/")) {
    return isPink ? 1.15 : 1.25;
  }

  if (
    normalized.includes("/audio/ipa/normal/") ||
    normalized.includes("/audio/ipa/slow/")
  ) {
    return 1.6;
  }

  return 1;
}

function predictedPlayback(sample) {
  const rms = dbToLinear(sample.meanDb);
  const peak = dbToLinear(sample.maxDb);
  const fallbackGain = fallbackGainForPath(sample.path);
  const rmsGain = TARGET_RMS / rms;
  const peakGain = MAX_PEAK / peak;
  const normalizationGain = Math.max(
    MIN_GAIN,
    Math.min(rmsGain, peakGain, MAX_GAIN),
  );
  const preferredGain = Math.max(normalizationGain, fallbackGain);
  const peakSafeGain = Math.min(MAX_GAIN, peakGain);
  const playbackGain = clamp(Math.min(preferredGain, peakSafeGain), 0.08, MAX_GAIN);

  return {
    ...sample,
    fallbackGain,
    normalizationGain,
    playbackGain,
    predictedMeanDb: sample.meanDb + gainToDb(playbackGain),
    predictedMaxDb: sample.maxDb + gainToDb(playbackGain),
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pairSpreads(samples) {
  const pairs = new Map();
  for (const sample of samples) {
    if (!sample.pairId) continue;
    const group = pairs.get(sample.pairId) ?? [];
    group.push(sample);
    pairs.set(sample.pairId, group);
  }

  return [...pairs.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([pairId, group]) => {
      const predictedMeans = group.map((sample) => sample.predictedMeanDb);
      return {
        pairId,
        spreadDb: Math.max(...predictedMeans) - Math.min(...predictedMeans),
        sampleIds: group.map((sample) => sample.id),
      };
    });
}

function main() {
  if (!dryRun) {
    throw new Error("Pass --dry-run. This audit is read-only and never generates audio.");
  }

  const measuredVideos = videoReferences.map(measureVolume);
  const measuredWords = wordSamples.map(measureVolume).map(predictedPlayback);
  const referenceMeanDb = average(measuredVideos.map((sample) => sample.meanDb));
  const predictedFloorDb = referenceMeanDb - VIDEO_REFERENCE_MARGIN_DB;
  const spreads = pairSpreads(measuredWords);

  const quietFailures = measuredWords.filter(
    (sample) => sample.predictedMeanDb < predictedFloorDb,
  );
  const spreadFailures = spreads.filter(
    (pair) => pair.spreadDb > MAX_PAIR_SPREAD_DB,
  );

  const report = {
    dryRun: true,
    generatedAudio: false,
    referenceMeanDb,
    predictedFloorDb,
    maxPairSpreadDb: MAX_PAIR_SPREAD_DB,
    videos: measuredVideos,
    wordSamples: measuredWords,
    pairSpreads: spreads,
    failures: {
      quietSamples: quietFailures,
      pairSpreads: spreadFailures,
    },
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Audio loudness dry-run written: ${reportPath}`);
  console.log(
    `Reference video mean: ${referenceMeanDb.toFixed(1)} dB; word floor: ${predictedFloorDb.toFixed(1)} dB`,
  );
  for (const sample of measuredWords) {
    console.log(
      `${sample.id}: raw ${sample.meanDb.toFixed(1)} dB -> predicted ${sample.predictedMeanDb.toFixed(1)} dB (gain ${sample.playbackGain.toFixed(2)}x)`,
    );
  }

  if (quietFailures.length || spreadFailures.length) {
    console.error("Audio loudness dry-run failed.");
    for (const sample of quietFailures) {
      console.error(
        `  Quiet: ${sample.id} predicted ${sample.predictedMeanDb.toFixed(1)} dB < ${predictedFloorDb.toFixed(1)} dB`,
      );
    }
    for (const pair of spreadFailures) {
      console.error(
        `  Pair spread: ${pair.pairId} ${pair.spreadDb.toFixed(1)} dB > ${MAX_PAIR_SPREAD_DB} dB`,
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("Audio loudness dry-run passed. No ElevenLabs calls were made.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
