#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const includePending = process.argv.includes("--include-pending");
const catalog = JSON.parse(
  await readFile(
    path.join(
      root,
      "packages/core/src/content/training-perception-catalog.json",
    ),
    "utf8",
  ),
);
const manifest = JSON.parse(
  await readFile(
    path.join(root, "packages/core/src/content/training-speaker-manifest.json"),
    "utf8",
  ),
);
const speakers = manifest.filter(
  (speaker) => includePending || speaker.reviewStatus === "reviewed",
);
const words = Array.from(
  new Set(
    catalog.flatMap((pack) =>
      pack.examples.flatMap((example) => [
        example.wordA.toLowerCase(),
        example.wordB.toLowerCase(),
      ]),
    ),
  ),
).sort();
const desktopRoot = path.join(root, "public/audio/words");
const browserRoot = path.join(root, "apps/browser/public/audio/words");
const failures = [];
const measurements = [];

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  });
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

function probeDuration(filePath) {
  const result = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  if (result.status !== 0) {
    return {
      duration: Number.NaN,
      error: result.error?.message ?? result.stderr?.trim(),
    };
  }
  return { duration: Number.parseFloat(result.stdout.trim()) };
}

function analyzeLevels(filePath) {
  const result = run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    filePath,
    "-af",
    "silencedetect=noise=-50dB:d=0.15,volumedetect",
    "-f",
    "null",
    "NUL",
  ]);
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const meanVolume = Number.parseFloat(
    output.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? "NaN",
  );
  const maxVolume = Number.parseFloat(
    output.match(/max_volume:\s*(-?\d+(?:\.\d+)?) dB/)?.[1] ?? "NaN",
  );
  const silenceSeconds = Array.from(
    output.matchAll(/silence_duration:\s*(\d+(?:\.\d+)?)/g),
  ).reduce((sum, match) => sum + Number.parseFloat(match[1]), 0);
  return {
    status: result.status,
    meanVolume,
    maxVolume,
    silenceSeconds,
    error:
      result.status === 0
        ? undefined
        : (result.error?.message ?? output.trim().slice(-500)),
  };
}

for (const speaker of speakers) {
  for (const word of words) {
    const relative = path.join(speaker.assetDirectory, `${word}.mp3`);
    const desktop = path.join(desktopRoot, relative);
    const browser = path.join(browserRoot, relative);
    let desktopStat;
    let browserStat;
    try {
      [desktopStat, browserStat] = await Promise.all([
        stat(desktop),
        stat(browser),
      ]);
    } catch {
      failures.push(`${speaker.id}/${word}: missing on one or both platforms`);
      continue;
    }
    if (desktopStat.size === 0 || browserStat.size === 0) {
      failures.push(`${speaker.id}/${word}: empty file`);
      continue;
    }
    const [desktopHash, browserHash] = await Promise.all([
      sha256(desktop),
      sha256(browser),
    ]);
    if (desktopHash !== browserHash) {
      failures.push(`${speaker.id}/${word}: desktop/browser hash mismatch`);
      continue;
    }

    const durationResult = probeDuration(desktop);
    const levels = analyzeLevels(desktop);
    const duration = durationResult.duration;
    const silenceRatio =
      Number.isFinite(duration) && duration > 0
        ? levels.silenceSeconds / duration
        : Number.POSITIVE_INFINITY;
    const measurement = {
      speakerId: speaker.id,
      word,
      bytes: desktopStat.size,
      sha256: desktopHash,
      duration,
      meanVolume: levels.meanVolume,
      maxVolume: levels.maxVolume,
      silenceRatio,
    };
    measurements.push(measurement);

    if (!Number.isFinite(duration) || duration < 0.15 || duration > 4) {
      failures.push(`${speaker.id}/${word}: invalid duration ${duration}`);
    }
    if (
      !Number.isFinite(levels.meanVolume) ||
      levels.meanVolume < -45 ||
      levels.meanVolume > -2
    ) {
      failures.push(
        `${speaker.id}/${word}: suspicious mean volume ${levels.meanVolume} dB`,
      );
    }
    if (
      !Number.isFinite(levels.maxVolume) ||
      levels.maxVolume < -12 ||
      levels.maxVolume > 0.5
    ) {
      failures.push(
        `${speaker.id}/${word}: suspicious peak ${levels.maxVolume} dB`,
      );
    }
    if (silenceRatio > 0.8) {
      failures.push(
        `${speaker.id}/${word}: silence ratio ${silenceRatio.toFixed(2)}`,
      );
    }
    if (durationResult.error || levels.error) {
      failures.push(
        `${speaker.id}/${word}: decode failed ${durationResult.error ?? levels.error}`,
      );
    }
  }
}

const outputDir = path.join(root, "outputs");
await mkdir(outputDir, { recursive: true });
const reportPath = path.join(outputDir, "training-audio-audit.json");
await writeFile(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      includePending,
      speakerIds: speakers.map((speaker) => speaker.id),
      wordCount: words.length,
      fileCount: measurements.length,
      failures,
      measurements,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(
    `Training audio audit failed with ${failures.length} issue(s). Report: ${reportPath}`,
  );
  for (const issue of failures.slice(0, 30)) console.error(`- ${issue}`);
  if (failures.length > 30) {
    console.error(`- ...and ${failures.length - 30} more`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Training audio audit passed: ${speakers.length} speakers × ${words.length} words. Report: ${reportPath}`,
  );
}
