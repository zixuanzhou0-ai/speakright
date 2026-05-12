#!/usr/bin/env node

/**
 * Download audio files from americanipachart.com's S3 bucket
 * and extract SVG illustrations from the chart.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AUDIO_DIR = resolve(ROOT, "public/audio/ipa");
const _IMAGE_DIR = resolve(ROOT, "public/images/ipa");

const AUDIO_BASE =
  "https://bilingueanglaismedia.s3.amazonaws.com/blog/infographics/api/mp3";

const WORDS = [
  "BEAR",
  "BEAVER",
  "BLUE",
  "BROWN",
  "CAT",
  "CHICKEN",
  "COFFEE",
  "DINOSAUR",
  "DOG",
  "DUST",
  "FEATHER",
  "FROG",
  "GIRAFFE",
  "GOAT",
  "GOLD",
  "GREEN",
  "HORSE",
  "JADE",
  "LIME",
  "LION",
  "MAUVE",
  "MOUSE",
  "PANTHER",
  "PENGUIN",
  "PIG",
  "PINK",
  "PURPLE",
  "RABBIT",
  "RED",
  "SAND",
  "SHEEP",
  "SNAKE",
  "TELEVISION",
  "TURQUOISE",
  "TURTLE",
  "WOLF",
  "WOOD",
  "YAK",
  "ZEBRA",
];

const TYPES = ["PHONEME", "NORMAL", "SLOW"];
const TYPE_DIRS = { PHONEME: "phoneme", NORMAL: "normal", SLOW: "slow" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function downloadAudio() {
  for (const dir of Object.values(TYPE_DIRS)) {
    mkdirSync(resolve(AUDIO_DIR, dir), { recursive: true });
  }

  const total = WORDS.length * TYPES.length;
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const word of WORDS) {
    for (const type of TYPES) {
      done++;
      const dir = TYPE_DIRS[type];
      const outPath = resolve(AUDIO_DIR, dir, `${word.toLowerCase()}.mp3`);

      if (existsSync(outPath)) {
        skipped++;
        console.log(
          `[${done}/${total}] Skipped: ${dir}/${word.toLowerCase()}.mp3`,
        );
        continue;
      }

      const url = `${AUDIO_BASE}/${type}-${word}.mp3`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(outPath, buf);
        console.log(
          `[${done}/${total}] Downloaded: ${dir}/${word.toLowerCase()}.mp3 (${buf.length} bytes)`,
        );
      } catch (err) {
        failed++;
        console.error(
          `[${done}/${total}] FAILED: ${dir}/${word.toLowerCase()}.mp3 — ${err.message}`,
        );
      }
      await sleep(50);
    }
  }

  console.log(
    `\nAudio done! Downloaded: ${done - skipped - failed}, Skipped: ${skipped}, Failed: ${failed}`,
  );
}

async function main() {
  console.log("=== Downloading IPA audio files ===\n");
  await downloadAudio();
  console.log("\nDone! SVG illustrations need to be extracted separately.");
}

main();
