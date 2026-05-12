#!/usr/bin/env node

/**
 * Download Microsoft Fluent Emoji 3D PNGs for IPA chart cards.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const IMAGE_DIR = resolve(ROOT, "public/images/ipa");

mkdirSync(IMAGE_DIR, { recursive: true });

const BASE =
  "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

// chartWord -> [Emoji Folder Name, file_name_prefix]
const MAPPING = {
  // Consonants
  pig: ["Pig face", "pig_face"],
  bear: ["Bear", "bear"],
  turtle: ["Turtle", "turtle"],
  dog: ["Dog face", "dog_face"],
  cat: ["Cat face", "cat_face"],
  goat: ["Goat", "goat"],
  panther: ["Leopard", "leopard"],
  frog: ["Frog", "frog"],
  feather: ["Feather", "feather"],
  beaver: ["Beaver", "beaver"],
  snake: ["Snake", "snake"],
  zebra: ["Zebra", "zebra"],
  sheep: ["Ewe", "ewe"],
  television: ["Television", "television"],
  chicken: ["Chicken", "chicken"],
  giraffe: ["Giraffe", "giraffe"],
  wolf: ["Wolf", "wolf"],
  lion: ["Lion", "lion"],
  mouse: ["Mouse face", "mouse_face"],
  dinosaur: ["Sauropod", "sauropod"],
  penguin: ["Penguin", "penguin"],
  rabbit: ["Rabbit face", "rabbit_face"],
  yak: ["Ox", "ox"],
  horse: ["Horse face", "horse_face"],
  // Vowels
  green: ["Green circle", "green_circle"],
  blue: ["Blue circle", "blue_circle"],
  pink: ["Pink heart", "pink_heart"],
  wood: ["Wood", "wood"],
  dust: ["Desert", "desert"],
  red: ["Red circle", "red_circle"],
  purple: ["Purple circle", "purple_circle"],
  mauve: ["Purple heart", "purple_heart"],
  sand: ["Beach with umbrella", "beach_with_umbrella"],
  coffee: ["Hot beverage", "hot_beverage"],
  // Diphthongs
  jade: ["Ring", "ring"],
  lime: ["Lime", "lime"],
  brown: ["Brown circle", "brown_circle"],
  gold: ["Trophy", "trophy"],
  turquoise: ["Droplet", "droplet"],
  // Extra
  cup: ["Hot beverage", "hot_beverage"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const entries = Object.entries(MAPPING);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const [word, [folder, filePrefix]] = entries[i];
    const outPath = resolve(IMAGE_DIR, `${word}.png`);

    if (existsSync(outPath)) {
      skipped++;
      console.log(`[${i + 1}/${entries.length}] Skipped: ${word}.png`);
      continue;
    }

    const url = `${BASE}/${encodeURIComponent(folder)}/3D/${filePrefix}_3d.png`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(outPath, buf);
      downloaded++;
      console.log(
        `[${i + 1}/${entries.length}] Downloaded: ${word}.png (${buf.length} bytes)`,
      );
    } catch (err) {
      failed++;
      console.error(
        `[${i + 1}/${entries.length}] FAILED: ${word}.png — ${err.message} — ${url}`,
      );
    }
    await sleep(100);
  }

  console.log(
    `\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`,
  );
}

main();
