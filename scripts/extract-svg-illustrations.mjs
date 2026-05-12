#!/usr/bin/env node

/**
 * Extract individual illustrations from the americanipachart SVG.
 * Uses browser-computed bounding boxes for accurate viewBox values.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const IMAGE_DIR = resolve(ROOT, "public/images/ipa");
const SVG_PATH = resolve(__dirname, "ipa-chart.svg");

mkdirSync(IMAGE_DIR, { recursive: true });

const svg = readFileSync(SVG_PATH, "utf-8");

const styleMatch = svg.match(/<style[^>]*>[\s\S]*?<\/style>/);
const styles = styleMatch ? styleMatch[0] : "";

const defsMatch = svg.match(/<defs>[\s\S]*?<\/defs>/);
const defs = defsMatch ? defsMatch[0] : "";

// Browser-computed getBBox() values for each sound group
const BBOXES = {
  consonant_pig: [53, 481, 109, 82],
  consonant_bear: [53, 590, 117, 83],
  consonant_turtle: [278, 481, 95, 82],
  consonant_dog: [275, 587, 98, 86],
  consonant_cat: [491, 470, 89, 93],
  consonant_goat: [490, 579, 94, 94],
  consonant_panther: [169, 761, 129, 95],
  consonant_frog: [389, 779, 94, 77],
  consonant_feather: [167, 879, 115, 77],
  consonant_beaver: [387, 888, 99, 68],
  consonant_snake: [56, 1059, 103, 77],
  consonant_zebra: [56, 1151, 106, 95],
  consonant_sheep: [279, 1059, 92, 77],
  consonant_television: [278, 1168, 124, 78],
  consonant_chicken: [484, 1057, 102, 79],
  consonant_giraffe: [476, 1145, 106, 100],
  consonant_wolf: [168, 1340, 108, 81],
  consonant_lion: [387, 1328, 98, 93],
  consonant_mouse: [49, 1530, 114, 78],
  consonant_dinosaur: [276, 1505, 117, 103],
  consonant_penguin: [488, 1522, 113, 85],
  consonant_rabbit: [57, 1711, 104, 82],
  consonant_yak: [280, 1696, 98, 96],
  consonant_horse: [488, 1694, 96, 99],
  vowel_green: [25, 2058, 67, 68],
  vowel_blue: [522, 2058, 72, 68],
  vowel_pink: [192, 2120, 69, 68],
  vowel_wood: [418, 2120, 75, 68],
  vowel_dust: [335, 2236, 72, 68],
  vowel_red: [188, 2307, 70, 68],
  vowel_purple: [353, 2308, 89, 68],
  vowel_mauve: [526, 2308, 70, 68],
  vowel_sand: [227, 2372, 82, 68],
  vowel_coffee: [524, 2431, 79, 68],
  diphthong_jade: [89, 2852, 149, 107],
  diphthong_lime: [235, 2852, 87, 359],
  diphthong_brown: [322, 2852, 147, 359],
  diphthong_gold: [469, 2852, 137, 107],
  diphthong_turquoise: [238, 2852, 377, 234],
};

const entries = Object.keys(BBOXES).map((id) => ({
  id,
  name: id.replace(/^(consonant|vowel|diphthong)_/, ""),
}));

function extractGroup(svgSource, groupId) {
  const startTag = `id="${groupId}"`;
  const startIdx = svgSource.indexOf(startTag);
  if (startIdx === -1) return null;
  const gStart = svgSource.lastIndexOf("<g ", startIdx);
  if (gStart === -1) return null;
  let depth = 0;
  let i = gStart;
  while (i < svgSource.length) {
    if (svgSource.startsWith("<g ", i) || svgSource.startsWith("<g>", i))
      depth++;
    else if (svgSource.startsWith("</g>", i)) {
      depth--;
      if (depth === 0) return svgSource.substring(gStart, i + 4);
    }
    i++;
  }
  return null;
}

let extracted = 0;

for (const entry of entries) {
  const group = extractGroup(svg, entry.id);
  if (!group) {
    console.error(`MISSING: ${entry.id}`);
    continue;
  }

  const [bx, by, bw, bh] = BBOXES[entry.id];
  const pad = 8;
  const vx = bx - pad;
  const vy = by - pad;
  const vw = bw + pad * 2;
  const vh = bh + pad * 2;

  const standaloneSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="${vx} ${vy} ${vw} ${vh}">
${styles}
${defs}
${group}
</svg>`;

  const outPath = resolve(IMAGE_DIR, `${entry.name}.svg`);
  writeFileSync(outPath, standaloneSvg);
  extracted++;
  console.log(
    `[${extracted}/${entries.length}] ${entry.name}.svg — viewBox: ${vx} ${vy} ${vw} ${vh}`,
  );
}

console.log(`\nDone! Extracted ${extracted}/${entries.length}`);
