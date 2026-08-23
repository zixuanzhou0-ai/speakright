#!/usr/bin/env node

import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(
    path.join(
      root,
      "packages/core/src/content/training-perception-catalog.json",
    ),
    "utf8",
  ),
);
const speakers = JSON.parse(
  await readFile(
    path.join(root, "packages/core/src/content/training-speaker-manifest.json"),
    "utf8",
  ),
);
const words = Array.from(
  new Set(
    catalog.flatMap((entry) =>
      entry.examples.flatMap((example) => [
        example.wordA.toLowerCase(),
        example.wordB.toLowerCase(),
      ]),
    ),
  ),
).sort();
const speakerArgument = process.argv.find((argument) =>
  argument.startsWith("--speakers="),
);
const requestedSpeakerIds = new Set(
  (speakerArgument?.slice("--speakers=".length) ?? "")
    .split(",")
    .map((speakerId) => speakerId.trim())
    .filter(Boolean),
);
const requestedSpeakers = requestedSpeakerIds.size
  ? speakers.filter((speaker) => requestedSpeakerIds.has(speaker.id))
  : speakers.filter((speaker) => speaker.reviewStatus === "needs-review");
const unknownSpeakerIds = [...requestedSpeakerIds].filter(
  (speakerId) => !speakers.some((speaker) => speaker.id === speakerId),
);
if (unknownSpeakerIds.length > 0) {
  throw new Error(`Unknown speaker ids: ${unknownSpeakerIds.join(", ")}`);
}
const execute = process.argv.includes("--execute");
const paidConfirmed = process.argv.includes("--confirm-paid-generation");
const apiKey = process.env.ELEVENLABS_API_KEY;
const model = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";
const roots = [
  path.join(root, "public/audio/words"),
  path.join(root, "apps/browser/public/audio/words"),
];

async function existsAndNonEmpty(filePath) {
  try {
    return (await stat(filePath)).size > 0;
  } catch {
    return false;
  }
}

const missing = [];
for (const speaker of requestedSpeakers) {
  for (const word of words) {
    const desktopPath = path.join(
      roots[0],
      speaker.assetDirectory,
      `${word}.mp3`,
    );
    const browserPath = path.join(
      roots[1],
      speaker.assetDirectory,
      `${word}.mp3`,
    );
    if (
      !(await existsAndNonEmpty(desktopPath)) ||
      !(await existsAndNonEmpty(browserPath))
    ) {
      missing.push({ speaker, word, desktopPath, browserPath });
    }
  }
}

const characters = missing.reduce((sum, task) => sum + task.word.length, 0);
console.log("SpeakRight four-speaker core audio plan");
console.log(`Catalog: ${catalog.length} packs, ${words.length} unique words`);
console.log(
  `Requested voices: ${requestedSpeakers
    .map((speaker) => speaker.id)
    .join(", ")}`,
);
console.log(`Missing generation tasks: ${missing.length}`);
console.log(
  `Estimated base ElevenLabs character credits: ${characters} (provider/model multipliers may apply)`,
);
console.log("Playback speeds reuse the same files at 0.85x, 1.0x, and 1.1x.");

if (!execute) {
  console.log(
    "Dry run only. Re-run with --execute --confirm-paid-generation after explicit approval.",
  );
  process.exit(0);
}
if (!paidConfirmed) {
  throw new Error(
    "Paid generation is blocked without --confirm-paid-generation.",
  );
}
if (!apiKey) {
  throw new Error("ELEVENLABS_API_KEY is required for paid generation.");
}

async function generate(task) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${task.speaker.voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: task.word,
        model_id: model,
        voice_settings: {
          stability: 0.85,
          similarity_boost: 0.85,
          style: 0,
          speed: 0.9,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `ElevenLabs generation failed for ${task.speaker.id}/${task.word}: HTTP ${response.status}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

let generated = 0;
for (const task of missing) {
  const audio = await generate(task);
  await mkdir(path.dirname(task.desktopPath), { recursive: true });
  await mkdir(path.dirname(task.browserPath), { recursive: true });
  await writeFile(task.desktopPath, audio);
  await copyFile(task.desktopPath, task.browserPath);
  generated += 1;
  console.log(
    `[${generated}/${missing.length}] ${task.speaker.id}/${task.word} (${audio.length} bytes)`,
  );
}

console.log(`Generated and mirrored ${generated} core audio files.`);
