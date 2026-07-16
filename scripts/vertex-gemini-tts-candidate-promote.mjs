import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { atomicPromoteBatch } from "./lib/atomic-audio-promotion.mjs";
import { sha256Bytes, sha256File } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const regenerationRoot = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates",
);
const vertexRoot = path.join(regenerationRoot, "vertex-gemini-3.1-tts");
const analysisRoot = path.join(vertexRoot, "analysis");
const sourcePlanPath = path.join(regenerationRoot, "regeneration-plan.json");
const inventoryPath = path.join(vertexRoot, "candidate-inventory.json");
const evaluationPath = path.join(analysisRoot, "candidate-evaluation.json");
const thirdPlanPath = path.join(analysisRoot, "third-listener-plan.json");
const thirdObservationsPath = path.join(
  analysisRoot,
  "vertex-gemini-blind.jsonl",
);
const englishPronunciationPath = path.join(
  analysisRoot,
  "azure-pronunciation-en-us.jsonl",
);
const promotionPlanPath = path.join(analysisRoot, "promotion-plan.json");
const promotionLedgerPath = path.join(analysisRoot, "promotion-ledger.json");
const stableOutcomes = new Set([
  "exact",
  "accepted-homophone",
  "orthographic-variant",
]);

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

function stableSha(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(value), "utf8"));
}

function buildPromotionPlan() {
  const sourcePlan = readJson(sourcePlanPath);
  const inventory = readJson(inventoryPath);
  const evaluation = readJson(evaluationPath);
  const thirdPlan = readJson(thirdPlanPath);
  const sourceById = new Map(
    sourcePlan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const assetById = new Map(
    inventory.assets.map((asset) => [asset.assetId, asset]),
  );
  const evaluationById = new Map(
    evaluation.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const thirdBySha = new Map(
    readJsonl(thirdObservationsPath).map((row) => [row.candidateSha256, row]),
  );
  const englishPronunciationBySha = new Map(
    readJsonl(englishPronunciationPath).map((row) => [
      row.candidateSha256,
      row,
    ]),
  );
  const replacements = [];
  const blocked = [];
  for (const planned of thirdPlan.candidates) {
    const source = sourceById.get(planned.sourceAssetId);
    const asset = assetById.get(planned.candidateId);
    const evaluated = evaluationById.get(planned.candidateId);
    const third = thirdBySha.get(planned.candidateSha256);
    const englishPronunciation = englishPronunciationBySha.get(
      planned.candidateSha256,
    );
    const reasons = [];
    if (!source) reasons.push("source-missing");
    if (!asset) reasons.push("candidate-missing");
    if (!evaluated?.signalPassed) reasons.push("signal-failed");
    if (!evaluated?.whisperPassed) reasons.push("whisper-failed");
    if (!evaluated?.azurePassed) reasons.push("azure-failed");
    if (!evaluated?.referenceConfirmed) reasons.push("reference-unconfirmed");
    if (!third) reasons.push("third-listener-missing");
    else if (!stableOutcomes.has(third.outcome))
      reasons.push(`third-listener-${third.outcome}`);
    if (planned.languageId === "en-US") {
      if (!englishPronunciation) reasons.push("english-pronunciation-missing");
      else {
        if (!englishPronunciation.gate?.ok)
          reasons.push("english-pronunciation-invalid");
        if (englishPronunciation.gate?.targetUnitAligned !== true)
          reasons.push("english-target-unit-missing");
        if (englishPronunciation.gate?.syllableCountAligned !== true)
          reasons.push("english-syllable-count-mismatch");
        if (englishPronunciation.gate?.stressAligned !== true)
          reasons.push("english-stress-unverified");
      }
    }
    if (reasons.length > 0) {
      blocked.push({
        candidateId: planned.candidateId,
        sourceAssetId: planned.sourceAssetId,
        reasons,
      });
      continue;
    }
    replacements.push({
      sourceAssetId: source.sourceAssetId,
      candidateId: asset.assetId,
      languageId: source.languageId,
      text: source.text,
      canonicalIpa: source.canonicalIpa,
      targetUnits: source.targetUnits,
      desktopPath: source.desktopPath,
      browserPath: source.browserPath,
      expectedOldSha256: source.sourceSha256,
      candidatePath: asset.desktopPath,
      candidateSha256: asset.sha256,
      provider: asset.provider,
      modelId: asset.modelId,
      voiceGender: asset.voiceGender,
      vertexVoiceName: asset.speakerId,
      replacedVoiceId: source.voiceId,
      replacedVoiceName: source.voiceName,
      blindOutcomes: {
        whisper: evaluated.whisper.outcome,
        azure: evaluated.azure.outcome,
        vertexGemini: third.outcome,
      },
      status: "machine-replaced-pending-human",
    });
  }
  const plan = {
    version: 1,
    generatedAt: new Date().toISOString(),
    replacementCount: replacements.length,
    blockedCount: blocked.length,
    warning:
      "Vertex-generated replacements use prebuilt Charon/Kore voices and remain pending human auditory verification.",
    replacements,
    blocked,
  };
  plan.planSha256 = stableSha({
    ...plan,
    generatedAt: undefined,
    planSha256: undefined,
  });
  return plan;
}

function applyPromotion(expectedPlanSha) {
  const plan = readJson(promotionPlanPath);
  if (!expectedPlanSha || expectedPlanSha !== plan.planSha256) {
    throw new Error("Exact --plan-sha is required for promotion");
  }
  const operations = plan.replacements.map((replacement) => {
    const candidatePath = path.resolve(root, replacement.candidatePath);
    const desktopPath = path.resolve(root, replacement.desktopPath);
    const browserPath = path.resolve(root, replacement.browserPath);
    if (!existsSync(candidatePath)) {
      throw new Error(`Candidate missing: ${replacement.candidateId}`);
    }
    if (sha256File(candidatePath) !== replacement.candidateSha256) {
      throw new Error(`Candidate SHA changed: ${replacement.candidateId}`);
    }
    return {
      desktopPath,
      browserPath,
      expectedOldSha256: replacement.expectedOldSha256,
      candidateSha256: replacement.candidateSha256,
      bytes: readFileSync(candidatePath),
    };
  });
  const ledger = {
    version: 1,
    promotedAt: new Date().toISOString(),
    planSha256: plan.planSha256,
    replacementCount: plan.replacementCount,
    status: "machine-replaced-pending-human",
    warning:
      "These replacements passed three machine blind listeners but still require human auditory verification.",
    replacements: plan.replacements,
  };
  atomicPromoteBatch({
    operations,
    ledgerPath: promotionLedgerPath,
    ledgerBytes: Buffer.from(`${JSON.stringify(ledger, null, 2)}\n`, "utf8"),
  });
  console.log(`Promoted ${operations.length} Vertex candidates atomically.`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "plan") {
  const plan = buildPromotionPlan();
  writeFileSync(
    promotionPlanPath,
    `${JSON.stringify(plan, null, 2)}\n`,
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        planSha256: plan.planSha256,
        replacementCount: plan.replacementCount,
        blockedCount: plan.blockedCount,
      },
      null,
      2,
    ),
  );
} else if (command === "apply") {
  if (!args.includes("--confirm")) {
    throw new Error("Promotion requires --confirm");
  }
  const planSha = args
    .find((value) => value.startsWith("--plan-sha="))
    ?.slice("--plan-sha=".length);
  applyPromotion(planSha);
} else {
  throw new Error("Usage: vertex-gemini-tts-candidate-promote.mjs plan|apply");
}
