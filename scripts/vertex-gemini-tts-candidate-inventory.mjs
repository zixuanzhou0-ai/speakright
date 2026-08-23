import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256File } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const vertexRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates/vertex-gemini-3.1-tts",
);
const planPath = path.join(vertexRoot, "vertex-plan.json");
const generatedPath = path.join(vertexRoot, "generated.jsonl");
const inventoryPath = path.join(vertexRoot, "candidate-inventory.json");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

if (!existsSync(planPath) || !existsSync(generatedPath)) {
  throw new Error("Vertex plan and generated candidate log are required");
}

const plan = readJson(planPath);
const plannedById = new Map(
  plan.candidates.map((candidate) => [candidate.candidateId, candidate]),
);
const latestById = new Map();
for (const row of readJsonl(generatedPath))
  latestById.set(row.candidateId, row);

const assets = [];
for (const [candidateId, row] of latestById) {
  const planned = plannedById.get(candidateId);
  if (!planned || row.promptPolicyVersion !== plan.promptPolicyVersion)
    continue;
  const absolutePath = path.resolve(root, row.relativePath);
  if (!existsSync(absolutePath)) continue;
  const actualSha = sha256File(absolutePath);
  if (actualSha !== row.candidateSha256) {
    throw new Error(`Candidate SHA mismatch: ${candidateId}`);
  }
  assets.push({
    assetId: candidateId,
    sourceAssetId: row.sourceAssetId,
    sha256: actualSha,
    languageId: row.languageId,
    role: "example-word",
    text: row.text,
    expectedIpa: row.canonicalIpa,
    targetUnits: row.targetUnits ?? [],
    speakerId: row.vertexVoiceName,
    voiceGender: row.voiceGender,
    voiceSlot: row.voiceSlot,
    provider: row.provider,
    modelId: row.modelId,
    promptPolicyVersion: row.promptPolicyVersion,
    referenceStatus: row.referenceStatus,
    sourceSha256: row.sourceSha256,
    variant: row.variant,
    desktopPath: row.relativePath,
    browserPath: row.relativePath,
  });
}
assets.sort((left, right) => left.assetId.localeCompare(right.assetId));

const coveredSources = new Set(assets.map((asset) => asset.sourceAssetId));
const inventory = {
  version: 1,
  generatedAt: new Date().toISOString(),
  provider: plan.provider,
  modelId: plan.modelId,
  promptPolicyVersion: plan.promptPolicyVersion,
  planSha256: plan.planSha256,
  assetCount: assets.length,
  sourceAssetCount: coveredSources.size,
  missingSourceAssetIds: [
    ...new Set(plan.candidates.map((candidate) => candidate.sourceAssetId)),
  ].filter((sourceAssetId) => !coveredSources.has(sourceAssetId)),
  assets,
};

writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      inventoryPath: path.relative(root, inventoryPath).replaceAll("\\", "/"),
      assetCount: inventory.assetCount,
      sourceAssetCount: inventory.sourceAssetCount,
      missingSourceAssetCount: inventory.missingSourceAssetIds.length,
    },
    null,
    2,
  ),
);
