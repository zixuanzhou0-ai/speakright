import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { recognizeAzureWordBlind } from "./lib/azure-stt-client.mjs";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import { classifyBlindTranscript } from "./lib/phoneme-word-audit-core.mjs";
import { readSpeakRightCredential } from "./lib/secure-credentials.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const vertexRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates/vertex-gemini-3.1-tts",
);
const inventoryPath = path.join(vertexRoot, "candidate-inventory.json");
const analysisRoot = path.join(vertexRoot, "analysis");
const wavRoot = path.join(analysisRoot, "azure-wav-cache");
const observationsPath = path.join(analysisRoot, "azure-blind.jsonl");
const summaryPath = path.join(analysisRoot, "azure-blind-summary.json");
const homophonesPath = path.resolve(
  root,
  "scripts/data/phoneme-word-audit-homophones.json",
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function convertToWav(asset) {
  mkdirSync(wavRoot, { recursive: true });
  const wavPath = path.join(wavRoot, `${asset.sha256}.wav`);
  if (existsSync(wavPath)) return wavPath;
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.resolve(root, asset.desktopPath),
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ],
    { windowsHide: true, timeout: 30_000 },
  );
  return wavPath;
}

async function withRetry(worker) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout|abort/i.test(String(error?.message ?? error));
      if (!retryable || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw new Error("Azure retry loop exhausted");
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  let fatal;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!fatal) {
        const current = index;
        index += 1;
        if (current >= items.length) return;
        try {
          await worker(items[current], current);
        } catch (error) {
          fatal = error;
        }
      }
    },
  );
  await Promise.all(runners);
  if (fatal) throw fatal;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("Azure candidate blind validation requires --confirm");
  }
  const inventory = readJson(inventoryPath);
  const homophoneGroups = readJson(homophonesPath).groups;
  const cmuReference = loadCmuDictReference();
  const { value: azure, source: credentialSource } =
    await readSpeakRightCredential("azure");
  if (!azure?.subscriptionKey || !azure?.region) {
    throw new Error("Azure credential is unavailable");
  }
  const existing = new Map(
    readJsonl(observationsPath).map((row) => [row.candidateSha256, row]),
  );
  const pending = inventory.assets.filter(
    (asset) => !existing.has(asset.sha256),
  );
  let completed = 0;
  await runPool(pending, 2, async (asset) => {
    const wavPath = await convertToWav(asset);
    const heard = await withRetry(() =>
      recognizeAzureWordBlind({
        subscriptionKey: azure.subscriptionKey,
        region: azure.region,
        languageId: asset.languageId,
        wavPath,
      }),
    );
    const row = {
      version: 1,
      candidateId: asset.assetId,
      sourceAssetId: asset.sourceAssetId,
      candidateSha256: asset.sha256,
      listener: "azure-standard-stt",
      heardText: heard.recognizedText,
      confidence: heard.confidence,
      recognitionStatus: heard.recognitionStatus,
      outcome: classifyBlindTranscript({
        expected: asset.text,
        actual: heard.recognizedText,
        languageId: asset.languageId,
        homophoneGroups,
        cmuReference,
      }),
      referenceTextSent: false,
      answerLeakage: false,
      credentialSource,
      createdAt: new Date().toISOString(),
    };
    appendFileSync(observationsPath, `${JSON.stringify(row)}\n`, "utf8");
    existing.set(asset.sha256, row);
    completed += 1;
    if (completed % 20 === 0 || completed === pending.length) {
      console.log(`Azure blind ${completed}/${pending.length}`);
    }
  });

  const currentRows = inventory.assets
    .map((asset) => existing.get(asset.sha256))
    .filter(Boolean);
  const outcomes = Object.groupBy(currentRows, (row) => row.outcome);
  writeJson(summaryPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    inventoryAssetCount: inventory.assetCount,
    observationCount: currentRows.length,
    outcomes: Object.fromEntries(
      Object.entries(outcomes).map(([key, rows]) => [key, rows.length]),
    ),
    referenceTextSent: false,
    credentialSource,
  });
  console.log(readFileSync(summaryPath, "utf8"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
