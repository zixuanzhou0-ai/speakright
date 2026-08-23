import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { assessAzurePronunciation } from "./lib/azure-pronunciation-client.mjs";
import { normalizeComparableEnglishIpa } from "./lib/cmudict-reference.mjs";
import { readSpeakRightCredential } from "./lib/secure-credentials.mjs";

const root = process.cwd();
const regenerationRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates",
);
const vertexRoot = path.join(regenerationRoot, "vertex-gemini-3.1-tts");
const analysisRoot = path.join(vertexRoot, "analysis");
const sourcePlanPath = path.join(regenerationRoot, "regeneration-plan.json");
const thirdPlanPath = path.join(analysisRoot, "third-listener-plan.json");
const outputPath = path.join(analysisRoot, "azure-pronunciation-en-us.jsonl");
const summaryPath = path.join(
  analysisRoot,
  "azure-pronunciation-en-us-summary.json",
);
const wavRoot = path.join(analysisRoot, "azure-wav-cache");

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

function pronunciationGate(source, result) {
  const actualPhonemes = result.words
    .flatMap((word) => word.phonemes ?? [])
    .map((phoneme) => phoneme.phoneme)
    .join("");
  const actual = normalizeComparableEnglishIpa(actualPhonemes);
  const targets = source.targetUnits
    .map((target) => normalizeComparableEnglishIpa(target))
    .filter(Boolean);
  const actualSyllableCount = result.words.reduce(
    (sum, word) => sum + (word.syllables?.length ?? 0),
    0,
  );
  return {
    ok: result.ok,
    wordAccuracy:
      result.words[0]?.accuracyScore ?? result.accuracyScore ?? null,
    actualPhonemeSequence: actualPhonemes || null,
    targetUnitAligned:
      targets.length > 0 && targets.every((target) => actual.includes(target)),
    expectedSyllableCount: source.syllableCount,
    actualSyllableCount,
    syllableCountAligned:
      Number.isInteger(source.syllableCount) && actualSyllableCount > 0
        ? source.syllableCount === actualSyllableCount
        : false,
    expectedPrimaryStress: source.primaryStress,
    stressAligned: source.syllableCount === 1 ? true : null,
    stressEvidence:
      source.syllableCount === 1
        ? "monosyllabic-by-reference"
        : "not-observable-from-azure-phoneme-output",
  };
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    throw new Error(
      "English Azure pronunciation validation requires --confirm",
    );
  }
  const sourcePlan = readJson(sourcePlanPath);
  const thirdPlan = readJson(thirdPlanPath);
  const sourceById = new Map(
    sourcePlan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const candidates = thirdPlan.candidates.filter(
    (candidate) => candidate.languageId === "en-US",
  );
  const existing = new Map(
    readJsonl(outputPath).map((row) => [row.candidateSha256, row]),
  );
  const { value: azure, source: credentialSource } =
    await readSpeakRightCredential("azure");
  if (!azure?.subscriptionKey || !azure?.region) {
    throw new Error("Azure credential is unavailable");
  }
  let completed = 0;
  for (const candidate of candidates) {
    if (existing.has(candidate.candidateSha256)) continue;
    const wavPath = path.join(wavRoot, `${candidate.candidateSha256}.wav`);
    if (!existsSync(wavPath)) {
      throw new Error(`Azure WAV cache missing: ${candidate.candidateId}`);
    }
    const result = await assessAzurePronunciation({
      subscriptionKey: azure.subscriptionKey,
      region: azure.region,
      languageId: "en-US",
      referenceText: candidate.text,
      wavPath,
      role: "example-word",
    });
    const { rawResponse: _rawResponse, ...safeResult } = result;
    const row = {
      version: 1,
      candidateId: candidate.candidateId,
      sourceAssetId: candidate.sourceAssetId,
      candidateSha256: candidate.candidateSha256,
      supportingEvidenceOnly: true,
      result: safeResult,
      gate: pronunciationGate(
        sourceById.get(candidate.sourceAssetId),
        safeResult,
      ),
      credentialSource,
      createdAt: new Date().toISOString(),
    };
    appendFileSync(outputPath, `${JSON.stringify(row)}\n`, "utf8");
    existing.set(candidate.candidateSha256, row);
    completed += 1;
    console.log(`English pronunciation ${completed}/${candidates.length}`);
  }
  const rows = candidates
    .map((candidate) => existing.get(candidate.candidateSha256))
    .filter(Boolean);
  const passed = rows.filter(
    (row) =>
      row.gate.ok &&
      row.gate.targetUnitAligned &&
      row.gate.syllableCountAligned &&
      row.gate.stressAligned,
  );
  const summary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    observationCount: rows.length,
    passedCount: passed.length,
    blockedCount: rows.length - passed.length,
    supportingEvidenceOnly: true,
  };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
