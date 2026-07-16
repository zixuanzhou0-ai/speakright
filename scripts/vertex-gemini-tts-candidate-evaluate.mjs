import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import { classifyBlindTranscript } from "./lib/phoneme-word-audit-core.mjs";

const root = process.cwd();
const vertexRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates/vertex-gemini-3.1-tts",
);
const analysisRoot = path.join(vertexRoot, "analysis");
const inventoryPath = path.join(vertexRoot, "candidate-inventory.json");
const signalPath = path.join(analysisRoot, "signal.jsonl");
const whisperPath = path.join(analysisRoot, "whisper.jsonl");
const azurePath = path.join(analysisRoot, "azure-blind.jsonl");
const evaluationPath = path.join(analysisRoot, "candidate-evaluation.json");
const thirdPlanPath = path.join(analysisRoot, "third-listener-plan.json");
const homophonesPath = path.resolve(
  root,
  "scripts/data/phoneme-word-audit-homophones.json",
);
const stableOutcomes = new Set([
  "exact",
  "accepted-homophone",
  "orthographic-variant",
]);
const confirmedReferences = new Set([
  "two-source-confirmed",
  "variant-confirmed",
]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function countBy(items, selector) {
  const result = {};
  for (const item of items) {
    const key = selector(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

const inventory = readJson(inventoryPath);
const homophoneGroups = readJson(homophonesPath).groups;
const cmuReference = loadCmuDictReference();
const signalBySha = new Map(
  readJsonl(signalPath).map((row) => [row.sha256, row]),
);
const whisperBySha = new Map(
  readJsonl(whisperPath).map((row) => [row.sha256, row]),
);
const azureBySha = new Map(
  readJsonl(azurePath).map((row) => [row.candidateSha256, row]),
);

const candidates = inventory.assets.map((asset) => {
  const signal = signalBySha.get(asset.sha256)?.signal;
  const whisper = whisperBySha.get(asset.sha256)?.whisper;
  const azure = azureBySha.get(asset.sha256);
  const whisperOutcome = classifyBlindTranscript({
    expected: asset.text,
    actual: whisper?.transcript ?? "",
    languageId: asset.languageId,
    homophoneGroups,
    cmuReference,
  });
  return {
    candidateId: asset.assetId,
    sourceAssetId: asset.sourceAssetId,
    candidateSha256: asset.sha256,
    languageId: asset.languageId,
    text: asset.text,
    expectedIpa: asset.expectedIpa,
    targetUnits: asset.targetUnits,
    variant: asset.variant,
    referenceStatus: asset.referenceStatus,
    desktopPath: asset.desktopPath,
    signal,
    whisper: {
      heardText: whisper?.transcript ?? "",
      outcome: whisperOutcome,
    },
    azure: azure
      ? {
          heardText: azure.heardText,
          confidence: azure.confidence,
          outcome: azure.outcome,
        }
      : null,
    signalPassed: Boolean(signal?.ok),
    whisperPassed: stableOutcomes.has(whisperOutcome),
    azurePassed: stableOutcomes.has(azure?.outcome),
    referenceConfirmed: confirmedReferences.has(asset.referenceStatus),
  };
});

const eligible = candidates.filter(
  (candidate) =>
    candidate.signalPassed &&
    candidate.whisperPassed &&
    candidate.azurePassed &&
    candidate.referenceConfirmed,
);
const bySource = Map.groupBy(eligible, (candidate) => candidate.sourceAssetId);
const selected = [...bySource.values()].map(
  (options) =>
    options.toSorted((left, right) => {
      const exactDifference =
        Number(right.whisper.outcome === "exact") +
        Number(right.azure.outcome === "exact") -
        (Number(left.whisper.outcome === "exact") +
          Number(left.azure.outcome === "exact"));
      if (exactDifference) return exactDifference;
      const confidenceDifference =
        Number(right.azure.confidence ?? 0) -
        Number(left.azure.confidence ?? 0);
      if (confidenceDifference) return confidenceDifference;
      return left.variant.localeCompare(right.variant);
    })[0],
);

const allSources = new Set(
  candidates.map((candidate) => candidate.sourceAssetId),
);
const thirdPlan = {
  version: 1,
  generatedAt: new Date().toISOString(),
  listener: "vertex-gemini-3.1-pro-preview",
  answerLeakage: false,
  sourceAssetCount: allSources.size,
  selectedCandidateCount: selected.length,
  selectedSourceAssetCount: new Set(
    selected.map((candidate) => candidate.sourceAssetId),
  ).size,
  candidates: selected.map((candidate) => ({
    candidateId: candidate.candidateId,
    sourceAssetId: candidate.sourceAssetId,
    candidateSha256: candidate.candidateSha256,
    languageId: candidate.languageId,
    text: candidate.text,
    expectedIpa: candidate.expectedIpa,
    targetUnits: candidate.targetUnits,
    variant: candidate.variant,
    referenceStatus: candidate.referenceStatus,
    desktopPath: candidate.desktopPath,
  })),
};

const evaluation = {
  version: 1,
  generatedAt: new Date().toISOString(),
  candidateCount: candidates.length,
  sourceAssetCount: allSources.size,
  signalPassedCount: candidates.filter((item) => item.signalPassed).length,
  whisperOutcomes: countBy(candidates, (item) => item.whisper.outcome),
  azureOutcomes: countBy(
    candidates,
    (item) => item.azure?.outcome ?? "missing",
  ),
  referenceStatuses: countBy(candidates, (item) => item.referenceStatus),
  twoListenerEligibleCandidateCount: eligible.length,
  twoListenerEligibleSourceCount: bySource.size,
  unresolvedSourceCount: allSources.size - bySource.size,
  candidates,
};

writeFileSync(
  evaluationPath,
  `${JSON.stringify(evaluation, null, 2)}\n`,
  "utf8",
);
writeFileSync(thirdPlanPath, `${JSON.stringify(thirdPlan, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      candidateCount: evaluation.candidateCount,
      sourceAssetCount: evaluation.sourceAssetCount,
      signalPassedCount: evaluation.signalPassedCount,
      whisperOutcomes: evaluation.whisperOutcomes,
      azureOutcomes: evaluation.azureOutcomes,
      referenceStatuses: evaluation.referenceStatuses,
      twoListenerEligibleCandidateCount:
        evaluation.twoListenerEligibleCandidateCount,
      twoListenerEligibleSourceCount: evaluation.twoListenerEligibleSourceCount,
      unresolvedSourceCount: evaluation.unresolvedSourceCount,
      thirdListenerCandidateCount: thirdPlan.selectedCandidateCount,
    },
    null,
    2,
  ),
);
