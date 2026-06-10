#!/usr/bin/env node

/**
 * Batch generate word audio files using ElevenLabs TTS API.
 * Generates two versions per word: blue (Max) and pink (Nichalia).
 *
 * Usage:
 *   node scripts/generate-word-audio.mjs --key <API_KEY> [--model <MODEL_ID>]
 *
 * Or via environment variables:
 *   ELEVENLABS_API_KEY=xxx node scripts/generate-word-audio.mjs
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUTPUT_DIR = resolve(ROOT, "public/audio/words");
const PHONEME_DATA_PATH = resolve(ROOT, "src/lib/phoneme-data.ts");
const WORD_BANK_PATH = resolve(ROOT, "src/lib/word-bank.ts");
const MANIFEST_PATH = resolve(OUTPUT_DIR, "manifest.json");

// Two voices for example words
const VOICES = [
  { id: "Gfpl8Yo74Is0W6cPUWWT", name: "Max", dir: "blue" },
  { id: "XfNU2rGpBa01ckF309OY", name: "Nichalia", dir: "pink" },
];

// --- Parse CLI args ---
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) parsed.key = args[++i];
    else if (args[i] === "--model" && args[i + 1]) parsed.model = args[++i];
    else if (args[i] === "--manifest-only") parsed.manifestOnly = true;
  }
  return {
    key: parsed.key || process.env.ELEVENLABS_API_KEY,
    model:
      parsed.model || process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
    manifestOnly: parsed.manifestOnly === true,
  };
}

function extractBlocksBySlug(source) {
  const blocks = new Map();
  const regex = /(?:^|\n)\s{2}([a-z0-9]+):\s*\[([\s\S]*?)\n\s{2}\]/g;
  let match = regex.exec(source);
  while (match !== null) {
    blocks.set(match[1], match[2]);
    match = regex.exec(source);
  }
  return blocks;
}

function extractWordsFromBlock(block) {
  return [...block.matchAll(/word:\s*"([^"]+)"/g)].map((match) =>
    match[1].toLowerCase(),
  );
}

// --- Extract unique words from phoneme-data.ts + word-bank.ts ---
function extractWords() {
  const phonemeSource = readFileSync(PHONEME_DATA_PATH, "utf-8");
  const wordBankSource = readFileSync(WORD_BANK_PATH, "utf-8");
  const extendedBlocks = extractBlocksBySlug(wordBankSource);
  const wordSet = new Set();

  const phonemeRegex = /slug:\s*"([^"]+)"[\s\S]*?keywords:\s*\[([\s\S]*?)\]/g;
  let match = phonemeRegex.exec(phonemeSource);
  while (match !== null) {
    for (const word of extractWordsFromBlock(match[2])) {
      wordSet.add(word);
    }
    const extendedBlock = extendedBlocks.get(match[1]);
    if (extendedBlock) {
      for (const word of extractWordsFromBlock(extendedBlock)) {
        wordSet.add(word);
      }
    }
    match = phonemeRegex.exec(phonemeSource);
  }
  return [...wordSet].sort();
}

function writeCoverageManifest(words) {
  const files = {};
  for (const voice of VOICES) {
    files[voice.dir] = {};
    for (const word of words) {
      const filePath = resolve(OUTPUT_DIR, voice.dir, `${word}.mp3`);
      const exists = existsSync(filePath);
      files[voice.dir][word] = {
        path: `/audio/words/${voice.dir}/${word}.mp3`,
        exists,
        bytes: exists ? statSync(filePath).size : 0,
      };
    }
  }

  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        words,
        voices: VOICES,
        files,
      },
      null,
      2,
    )}\n`,
  );
}

// --- Call ElevenLabs TTS API ---
async function generateAudio(apiKey, voiceId, modelId, text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.85,
        similarity_boost: 0.85,
        style: 0,
        speed: 0.9,
        use_speaker_boost: true,
      },
    }),
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs error (${res.status}): ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Main ---
async function main() {
  const { key, model, manifestOnly } = parseArgs();

  if (!key && !manifestOnly) {
    console.error("Error: Missing API key.");
    console.error("Usage: node scripts/generate-word-audio.mjs --key <KEY>");
    console.error("Or set ELEVENLABS_API_KEY env var.");
    process.exit(1);
  }

  // Ensure output directories
  for (const voice of VOICES) {
    const dir = resolve(OUTPUT_DIR, voice.dir);
    mkdirSync(dir, { recursive: true });
  }

  const words = extractWords();
  const totalTasks = words.length * VOICES.length;
  writeCoverageManifest(words);
  if (manifestOnly) {
    console.log(`Manifest written: ${MANIFEST_PATH}`);
    console.log(`Tracked ${words.length} unique words x ${VOICES.length} voices.`);
    return;
  }

  console.log(
    `Found ${words.length} unique words x ${VOICES.length} voices = ${totalTasks} files to generate.`,
  );
  console.log(`Output: ${OUTPUT_DIR}/{blue,pink}/`);
  console.log(`Model: ${model} | Speed: 0.9x\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let taskIndex = 0;

  for (const voice of VOICES) {
    console.log(`\n--- Voice: ${voice.name} (${voice.dir}) ---\n`);

    for (let i = 0; i < words.length; i++) {
      taskIndex++;
      const word = words[i];
      const outPath = resolve(OUTPUT_DIR, voice.dir, `${word}.mp3`);

      if (existsSync(outPath)) {
        skipped++;
        console.log(
          `[${taskIndex}/${totalTasks}] Skipped (exists): ${voice.dir}/${word}`,
        );
        continue;
      }

      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        try {
          const audio = await generateAudio(key, voice.id, model, word);
          writeFileSync(outPath, audio);
          generated++;
          console.log(
            `[${taskIndex}/${totalTasks}] Generated: ${voice.dir}/${word} (${audio.length} bytes)`,
          );
          break;
        } catch (err) {
          if (err.message === "RATE_LIMITED" && retries < maxRetries) {
            retries++;
            const delay = 1000 * 2 ** retries;
            console.log(
              `[${taskIndex}/${totalTasks}] Rate limited, retrying in ${delay}ms...`,
            );
            await sleep(delay);
          } else {
            failed++;
            console.error(
              `[${taskIndex}/${totalTasks}] FAILED: ${voice.dir}/${word} — ${err.message}`,
            );
            break;
          }
        }
      }

      await sleep(200);
    }
  }

  console.log(
    `\nDone! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`,
  );
  writeCoverageManifest(words);
}

main();
