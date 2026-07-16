import { execFile } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { recognizeAzureWordBlind } from "./lib/azure-stt-client.mjs";
import { classifyBlindTranscript } from "./lib/phoneme-word-audit-core.mjs";
import { readSpeakRightCredential } from "./lib/secure-credentials.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const vertexRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates/vertex-gemini-3.1-tts",
);
const smokePath = path.join(vertexRoot, "smoke-report.json");
const outputPath = path.join(vertexRoot, "smoke-azure.json");
const wavRoot = path.join(vertexRoot, "smoke-wav");

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  rmSync(filePath, { force: true });
  renameSync(temporary, filePath);
}

async function convertToWav(relativePath, candidateId) {
  mkdirSync(wavRoot, { recursive: true });
  const wavPath = path.join(wavRoot, `${candidateId}.wav`);
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.resolve(root, relativePath),
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ],
    { windowsHide: true },
  );
  return wavPath;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error("Azure smoke validation requires --confirm");
  }
  const smoke = JSON.parse(readFileSync(smokePath, "utf8"));
  const { value: azure, source: credentialSource } =
    await readSpeakRightCredential("azure");
  if (!azure?.subscriptionKey || !azure?.region) {
    throw new Error("Azure credential is unavailable");
  }
  const rows = [];
  for (const item of smoke.results) {
    const wavPath = await convertToWav(item.relativePath, item.candidateId);
    const heard = await recognizeAzureWordBlind({
      subscriptionKey: azure.subscriptionKey,
      region: azure.region,
      languageId: item.languageId,
      wavPath,
    });
    rows.push({
      candidateId: item.candidateId,
      languageId: item.languageId,
      voiceGender: item.voiceGender,
      expected: item.text,
      heard: heard.recognizedText,
      confidence: heard.confidence,
      outcome: classifyBlindTranscript({
        expected: item.text,
        actual: heard.recognizedText,
        languageId: item.languageId,
      }),
      referenceTextSent: false,
      credentialSource,
    });
    console.log(`Azure smoke ${rows.length}/${smoke.results.length}`);
  }
  writeJson(outputPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    rows,
  });
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
