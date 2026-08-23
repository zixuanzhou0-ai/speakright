#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { atomicPromoteBatch } from "./lib/atomic-audio-promotion.mjs";
import { assessAzurePronunciation } from "./lib/azure-pronunciation-client.mjs";
import { recognizeAzureWordBlind } from "./lib/azure-stt-client.mjs";
import {
  loadCmuDictReference,
  normalizeComparableEnglishIpa,
} from "./lib/cmudict-reference.mjs";
import {
  archiveElevenLabsPronunciationDictionary,
  createElevenLabsPronunciationDictionary,
  fetchElevenLabsModels,
  fetchElevenLabsSubscription,
  fetchElevenLabsVoice,
  listElevenLabsPronunciationDictionaries,
  synthesizeElevenLabsCandidate,
  transcribeElevenLabsScribe,
} from "./lib/elevenlabs-audio-clients.mjs";
import {
  assertDictionaryLifecycleClear,
  assertGeneratedDictionaryBinding,
  assertThirdRoundDictionaryPlan,
  buildThirdRoundDictionaryPlan,
} from "./lib/elevenlabs-dictionary-lifecycle-core.mjs";
import {
  cleanupTemporaryDictionaries,
  withTemporaryPronunciationDictionaries,
} from "./lib/elevenlabs-dictionary-lifecycle-workflow.mjs";
import {
  classifyBlindTranscript,
  WORD_AUDIT_OUTPUT_NAME,
} from "./lib/phoneme-word-audit-core.mjs";
import {
  assertPromotionAllowed,
  assertRegenerationPlan,
  assertSelectionRecord,
  assertThirdRoundPlan,
  bindCandidateObservations,
  bindGeneratedCandidateHistories,
  buildRegenerationPlan,
  buildSelectionRecord,
  buildThirdRoundPlan,
  computeObservationDigest,
  ELEVENLABS_SAFETY_RESERVE,
  EXPECTED_FIRST_ROUND_CANDIDATE_COUNT,
  EXPECTED_REGENERATION_ASSET_COUNT,
  evaluateCandidate,
  MAX_REGENERATION_CANDIDATE_COUNT,
  overlayCurrentReference,
  runFailStopPool,
  selectCandidateForAsset,
  THIRD_ROUND_STRATEGY_DICTIONARY,
  THIRD_ROUND_STRATEGY_TEXT_ONLY,
  validatePromotionLedger,
  withCurrentCandidateAuditContext,
} from "./lib/phoneme-word-regeneration-core.mjs";
import {
  redactSecrets,
  sha256Bytes,
  sha256File,
} from "./lib/pronunciation-audit-core.mjs";
import { readSpeakRightCredential } from "./lib/secure-credentials.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const auditRoot = path.resolve(root, "outputs", WORD_AUDIT_OUTPUT_NAME);
const regenerationRoot = path.join(auditRoot, "regenerated-candidates");
const audioRoot = path.join(regenerationRoot, "audio");
const analysisRoot = path.join(regenerationRoot, "analysis");
const planPath = path.join(regenerationRoot, "regeneration-plan.json");
const generatedPath = path.join(regenerationRoot, "generated.jsonl");
const candidateInventoryPath = path.join(
  regenerationRoot,
  "candidate-inventory.json",
);
const azureBlindPath = path.join(analysisRoot, "azure-stt.jsonl");
const azurePronunciationPath = path.join(
  analysisRoot,
  "azure-pronunciation.jsonl",
);
const scribeBlindPath = path.join(analysisRoot, "scribe-v2.jsonl");
const selectionPath = path.join(regenerationRoot, "candidate-selection.json");
const promotionPath = path.join(regenerationRoot, "promotion-ledger.json");
const thirdRoundPlanPath = path.join(regenerationRoot, "third-round-plan.json");
const dictionaryPlanPath = path.join(regenerationRoot, "dictionary-plan.json");
const dictionaryLifecyclePath = path.join(
  regenerationRoot,
  "dictionary-lifecycle.json",
);
const dictionaryLifecycleEventsPath = path.join(
  regenerationRoot,
  "dictionary-lifecycle-events.jsonl",
);
const fixedAzureRegion = "switzerlandnorth";

function parseArgs(values) {
  const flags = new Set(
    values
      .slice(1)
      .filter((value) => value.startsWith("--") && !value.includes("=")),
  );
  const valueFor = (name, fallback = null) =>
    values
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? fallback;
  return { command: values[0], flags, valueFor };
}

function requireFlag(parsed, flag, message) {
  if (!parsed.flags.has(flag)) throw new Error(message);
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(
    temporary,
    `${JSON.stringify(redactSecrets(value), null, 2)}\n`,
    "utf8",
  );
  rmSync(filePath, { force: true });
  renameSync(temporary, filePath);
}

function appendJsonl(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(redactSecrets(value))}\n`, "utf8");
}

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}
function requireJson(filePath, instruction) {
  if (!existsSync(filePath)) throw new Error(instruction);
  return readJson(filePath);
}

function loadDictionaryLifecycleRegistry() {
  return existsSync(dictionaryLifecyclePath)
    ? readJson(dictionaryLifecyclePath)
    : null;
}

const persistDictionaryLifecycleRegistry = (registry) =>
  writeJson(dictionaryLifecyclePath, registry);
const appendDictionaryLifecycleEvent = (event) =>
  appendJsonl(dictionaryLifecycleEventsPath, event);
function readManifests() {
  return Object.fromEntries(
    ["es-ES", "fr-FR", "ru-RU"].map((languageId) => [
      languageId,
      readJson(
        path.resolve(
          root,
          `public/audio/language-packs/${languageId}/manifest.json`,
        ),
      ),
    ]),
  );
}

function loadSignalBySha() {
  const filePath = path.resolve(
    root,
    "outputs/pronunciation-audit-2026-07-14/signal.jsonl",
  );
  return new Map(readJsonl(filePath).map((row) => [row.sha256, row.signal]));
}

async function withRetry(worker) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout|abort/i.test(String(error?.message ?? error));
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw new Error("Retry loop exhausted");
}

function normalizeLabel(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-US")
    .trim();
}

function inspectVoiceMetadata(source, metadata, modelIds) {
  const labels = Object.fromEntries(
    Object.entries(metadata.labels ?? {}).map(([key, value]) => [
      normalizeLabel(key),
      normalizeLabel(value),
    ]),
  );
  const gender = labels.gender ?? labels.sex ?? null;
  const expectedGender = source.voiceGender === "masculine" ? "male" : "female";
  const identityMatched = metadata.voiceId === source.voiceId;
  const nameMatched =
    normalizeLabel(metadata.name).includes(normalizeLabel(source.voiceName)) ||
    normalizeLabel(source.voiceName).includes(normalizeLabel(metadata.name));
  const genderCompatible =
    !gender ||
    gender === expectedGender ||
    gender === normalizeLabel(source.voiceGender);
  const modelAvailable = modelIds.has(source.modelId);
  const language = labels.language ?? labels.locale ?? null;
  const localeCompatible =
    language === source.languageCode ||
    language === normalizeLabel(source.languageId);
  return {
    voiceId: source.voiceId,
    expectedName: source.voiceName,
    apiName: metadata.name,
    nameMatched,
    expectedGender: source.voiceGender,
    apiGender: gender,
    expectedLocale: source.languageId,
    apiLanguageOrLocale: language,
    apiAccent: labels.accent ?? null,
    localeEvidence: language ?? "existing-language-pack-manifest",
    localeCompatible,
    modelId: source.modelId,
    identityMatched,
    genderCompatible,
    modelAvailable,
    passed:
      identityMatched && genderCompatible && localeCompatible && modelAvailable,
  };
}

function offlinePlanCommand() {
  const plan = buildRegenerationPlan({
    inventory: requireJson(
      path.join(auditRoot, "inventory.json"),
      "Run the word audit inventory first.",
    ),
    consensus: requireJson(
      path.join(auditRoot, "machine-consensus.json"),
      "Run machine consensus first.",
    ),
    gold: requireJson(
      path.join(auditRoot, "gold-pronunciations.json"),
      "Run pronunciation references first.",
    ),
    manifests: readManifests(),
    signalBySha: loadSignalBySha(),
  });
  const offlinePlan = {
    ...plan,
    credentialSource: "not-read-offline",
    subscription: null,
    voiceChecks: [],
    allVoicesAvailable: false,
    thirdRoundModelAvailable: false,
    estimatedScribeMinutesFirstRound: Number(
      ((plan.sourceDurationSeconds * 2) / 60).toFixed(3),
    ),
    estimatedScribeMinutesMaximum: Number(
      ((plan.sourceDurationSeconds * 3) / 60).toFixed(3),
    ),
    remainingAfterFirstRound: null,
    safetyReserveSatisfied: false,
    paidCallsMade: false,
    networkRequestsMade: 0,
    generationLocked: true,
  };
  writeJson(planPath, offlinePlan);
  console.log(
    JSON.stringify(
      {
        planPath: path.relative(root, planPath),
        planSha256: offlinePlan.planSha256,
        sourceAssets: offlinePlan.sourceAssetCount,
        firstRoundCandidates: offlinePlan.firstRoundCandidateCount,
        byLanguage: offlinePlan.byLanguage,
        byVoice: offlinePlan.byVoice,
        allVoicesAvailable: false,
        thirdRoundModelAvailable: false,
        safetyReserveSatisfied: false,
        generationLocked: true,
        networkRequestsMade: 0,
        paidCallsMade: false,
      },
      null,
      2,
    ),
  );
}

async function planCommand() {
  const plan = buildRegenerationPlan({
    inventory: requireJson(
      path.join(auditRoot, "inventory.json"),
      "Run the word audit inventory first.",
    ),
    consensus: requireJson(
      path.join(auditRoot, "machine-consensus.json"),
      "Run machine consensus first.",
    ),
    gold: requireJson(
      path.join(auditRoot, "gold-pronunciations.json"),
      "Run pronunciation references first.",
    ),
    manifests: readManifests(),
    signalBySha: loadSignalBySha(),
  });
  const { value: credential, source: credentialSource } =
    await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const [subscription, models] = await Promise.all([
    fetchElevenLabsSubscription(credential.apiKey),
    fetchElevenLabsModels(credential.apiKey),
  ]);
  const modelIds = new Set(
    models
      .filter((model) => model.canDoTextToSpeech)
      .map((model) => model.modelId),
  );
  const voices = [
    ...new Map(
      plan.sourceAssets.map((source) => [source.voiceId, source]),
    ).values(),
  ];
  const voiceChecks = [];
  await runFailStopPool(voices, 2, async (source) => {
    const metadata = await withRetry(() =>
      fetchElevenLabsVoice(credential.apiKey, source.voiceId),
    );
    voiceChecks.push(inspectVoiceMetadata(source, metadata, modelIds));
  });
  voiceChecks.sort((left, right) =>
    left.expectedName.localeCompare(right.expectedName),
  );
  const remainingAfterFirstRound =
    typeof subscription.remaining === "number"
      ? subscription.remaining - plan.firstRoundCharacters
      : null;
  const dryRun = {
    ...plan,
    credentialSource,
    subscription,
    voiceChecks,
    allVoicesAvailable: voiceChecks.every((check) => check.passed),
    thirdRoundModelAvailable: modelIds.has("eleven_v3"),
    estimatedScribeMinutesFirstRound: Number(
      ((plan.sourceDurationSeconds * 2) / 60).toFixed(3),
    ),
    estimatedScribeMinutesMaximum: Number(
      ((plan.sourceDurationSeconds * 3) / 60).toFixed(3),
    ),
    remainingAfterFirstRound,
    safetyReserveSatisfied:
      remainingAfterFirstRound !== null &&
      remainingAfterFirstRound >= ELEVENLABS_SAFETY_RESERVE,
    paidCallsMade: false,
  };
  writeJson(planPath, dryRun);
  console.log(
    JSON.stringify(
      redactSecrets({
        planPath: path.relative(root, planPath),
        planSha256: dryRun.planSha256,
        sourceAssets: dryRun.sourceAssetCount,
        firstRoundCandidates: dryRun.firstRoundCandidateCount,
        firstRoundCharacters: dryRun.firstRoundCharacters,
        maximumCharacters: dryRun.maximumCharacters,
        byLanguage: dryRun.byLanguage,
        byVoice: dryRun.byVoice,
        subscription,
        remainingAfterFirstRound,
        safetyReserve: dryRun.safetyReserve,
        safetyReserveSatisfied: dryRun.safetyReserveSatisfied,
        estimatedScribeMinutesFirstRound:
          dryRun.estimatedScribeMinutesFirstRound,
        allVoicesAvailable: dryRun.allVoicesAvailable,
        thirdRoundModelAvailable: dryRun.thirdRoundModelAvailable,
        voiceChecks,
        paidCallsMade: false,
      }),
      null,
      2,
    ),
  );
}

function requirePlan(parsed) {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Run regeneration dry-run first."),
  );
  const expectedSha = parsed.valueFor("--plan-sha");
  if (!expectedSha || expectedSha !== plan.planSha256) {
    throw new Error(
      "The exact --plan-sha from the reviewed dry-run is required",
    );
  }
  return plan;
}

function loadCurrentThirdPlanInputs(plan) {
  const inventory = requireJson(
    path.join(auditRoot, "inventory.json"),
    "Run the current word-audio inventory before third-round planning.",
  );
  const gold = requireJson(
    path.join(auditRoot, "gold-pronunciations.json"),
    "Run the current pronunciation reference audit before third-round planning.",
  );
  const currentAssetById = new Map(
    inventory.assets.map((asset) => [asset.assetId, asset]),
  );
  const currentShaByPath = new Map();
  for (const source of plan.sourceAssets) {
    for (const relativePath of [source.desktopPath, source.browserPath]) {
      if (currentShaByPath.has(relativePath)) continue;
      const absolutePath = path.resolve(root, relativePath);
      currentShaByPath.set(
        relativePath,
        existsSync(absolutePath) ? sha256File(absolutePath) : null,
      );
    }
  }
  return { gold, currentAssetById, currentShaByPath };
}

const candidateAudioPath = (candidateId) =>
  path.join(audioRoot, `${candidateId}.mp3`);
const generatedHistoryRows = () => readJsonl(generatedPath);

function actualCandidateShaById(candidateIds) {
  return new Map(
    [...candidateIds].map((candidateId) => {
      const audioPath = candidateAudioPath(candidateId);
      return [
        candidateId,
        existsSync(audioPath) ? sha256File(audioPath) : null,
      ];
    }),
  );
}

function formalShaByPath(plan) {
  return new Map(
    plan.sourceAssets.flatMap((source) =>
      [source.desktopPath, source.browserPath].map((relativePath) => {
        const absolutePath = path.resolve(root, relativePath);
        return [
          relativePath,
          existsSync(absolutePath) ? sha256File(absolutePath) : null,
        ];
      }),
    ),
  );
}

function loadPostProcessingLineage() {
  const lineageRoot = path.join(auditRoot, "loudness-normalization-v2");
  const result = new Map();
  if (!existsSync(lineageRoot)) return result;
  const pending = [lineageRoot];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }
      if (!/^journal-completed-[a-f0-9]+\.json$/u.test(entry.name)) continue;
      const journal = readJson(absolutePath);
      if (
        journal.status !== "completed" ||
        journal.formalAssetsModified !== true
      )
        continue;
      for (const item of journal.entries ?? []) {
        const candidatePath = path.resolve(root, item.candidatePath);
        if (
          !existsSync(candidatePath) ||
          sha256File(candidatePath) !== item.candidateSha256
        ) {
          throw new Error(
            `Completed post-processing lineage candidate changed: ${item.assetId}`,
          );
        }
        const value = {
          sourceSha256: item.sourceSha256,
          candidateSha256: item.candidateSha256,
          desktopPath: item.desktop.targetPath.replaceAll("\\", "/"),
          browserPath: item.browser.targetPath.replaceAll("\\", "/"),
        };
        const prior = result.get(item.assetId);
        if (prior && JSON.stringify(prior) !== JSON.stringify(value)) {
          throw new Error(
            `Conflicting post-processing lineage: ${item.assetId}`,
          );
        }
        result.set(item.assetId, value);
      }
    }
  }
  return result;
}

function loadPromotionState(plan, additionalPlannedCandidates = []) {
  const historyRows = generatedHistoryRows();
  const candidateIds = new Set(
    [...plan.candidates, ...additionalPlannedCandidates].map(
      (item) => item.candidateId,
    ),
  );
  return validatePromotionLedger({
    plan,
    ledger: existsSync(promotionPath) ? readJson(promotionPath) : null,
    generatedHistory: historyRows,
    actualAudioShaByCandidateId: actualCandidateShaById(candidateIds),
    formalShaByPath: formalShaByPath(plan),
    postProcessingLineageBySourceAssetId: loadPostProcessingLineage(),
    additionalPlannedCandidates,
  });
}

function currentSourceById(
  plan,
  currentInputs = loadCurrentThirdPlanInputs(plan),
) {
  const goldByKey = new Map(
    (currentInputs.gold.entries ?? []).map((entry) => [
      `${entry.languageId}\u0000${String(entry.text)
        .normalize("NFKC")
        .toLocaleLowerCase(entry.languageId)}`,
      entry,
    ]),
  );
  return new Map(
    plan.sourceAssets.map((source) => [
      source.sourceAssetId,
      overlayCurrentReference(
        source,
        goldByKey.get(
          `${source.languageId}\u0000${String(source.text)
            .normalize("NFKC")
            .toLocaleLowerCase(source.languageId)}`,
        ),
        currentInputs.currentAssetById.get(source.sourceAssetId),
      ),
    ]),
  );
}

function bindActiveGeneratedCandidates({ plan, thirdPlan = null }) {
  const sources = currentSourceById(plan);
  const promotion = loadPromotionState(plan, thirdPlan?.candidates ?? []);
  const promotedSourceAssetIds = new Set(
    promotion.replacements.map((item) => item.sourceAssetId),
  );
  const firstRound = plan.candidates.map((candidate) =>
    withCurrentCandidateAuditContext(
      candidate,
      sources.get(candidate.sourceAssetId),
    ),
  );
  const thirdRound = (thirdPlan?.candidates ?? []).map((candidate) =>
    withCurrentCandidateAuditContext(
      candidate,
      sources.get(candidate.sourceAssetId),
    ),
  );
  const plannedCandidates = [...firstRound, ...thirdRound];
  const bound = bindGeneratedCandidateHistories({
    plannedCandidates,
    historyRows: generatedHistoryRows(),
    actualAudioShaByCandidateId: actualCandidateShaById(
      new Set(plannedCandidates.map((item) => item.candidateId)),
    ),
    excludedSourceAssetIds: promotedSourceAssetIds,
  });
  return {
    ...bound,
    sources,
    promotion,
    promotedSourceAssetIds,
    plannedCandidates,
  };
}

function loadValidatedThirdPlan(plan) {
  if (!existsSync(thirdRoundPlanPath)) return null;
  const selection = requireJson(
    selectionPath,
    "Candidate selection is required to validate the third-round plan.",
  );
  const thirdPlan = requireJson(
    thirdRoundPlanPath,
    "Third-round plan is missing.",
  );
  const promotion = loadPromotionState(plan, thirdPlan.candidates ?? []);
  assertSelectionRecord(selection, {
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: selection.thirdPlanSha256 ?? null,
    promotedSourceAssetIds: selection.promotedSourceAssetIds ?? [],
  });
  const currentlyPromoted = new Set(
    promotion.replacements.map((item) => item.sourceAssetId),
  );
  if (
    (selection.promotedSourceAssetIds ?? []).some(
      (sourceAssetId) => !currentlyPromoted.has(sourceAssetId),
    )
  ) {
    throw new Error("Selection references a promotion absent from the ledger");
  }
  return assertThirdRoundPlan(thirdPlan, {
    plan,
    selection,
    ...loadCurrentThirdPlanInputs(plan),
  });
}

const EXPECTED_THIRD_ROUND_RULES = Object.freeze({
  "en-US": 11,
  "fr-FR": 96,
});

function loadValidatedDictionaryPlan(thirdPlan) {
  return assertThirdRoundDictionaryPlan(
    requireJson(
      dictionaryPlanPath,
      "Run the pure third-plan command and review its dictionary plan before round-C generation.",
    ),
    thirdPlan,
    { expectedRulesByLanguage: EXPECTED_THIRD_ROUND_RULES },
  );
}

function pendingGeneratedCandidates(candidates) {
  const binding = bindGeneratedCandidateHistories({
    plannedCandidates: candidates,
    historyRows: generatedHistoryRows(),
    actualAudioShaByCandidateId: actualCandidateShaById(
      new Set(candidates.map((item) => item.candidateId)),
    ),
  });
  const existing = new Set(
    binding.bound.flatMap((candidate) =>
      candidate.generationRound === 3 &&
      candidate.generationStrategy === THIRD_ROUND_STRATEGY_DICTIONARY &&
      !candidate.pronunciationDictionaryLifecycle
        ? []
        : [candidate.candidateId],
    ),
  );
  return candidates.filter((candidate) => !existing.has(candidate.candidateId));
}

async function generateCandidates(
  candidates,
  { dictionaryBindingByLanguage = null } = {},
) {
  const { value: credential, source: credentialSource } =
    await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const pending = pendingGeneratedCandidates(candidates);
  await runFailStopPool(pending, 2, async (candidate, index) => {
    const lifecycleBinding =
      candidate.generationRound === 3 &&
      candidate.generationStrategy === THIRD_ROUND_STRATEGY_DICTIONARY
        ? dictionaryBindingByLanguage?.get(candidate.languageId)
        : null;
    if (
      candidate.generationRound === 3 &&
      candidate.generationStrategy === THIRD_ROUND_STRATEGY_DICTIONARY &&
      !lifecycleBinding
    ) {
      throw new Error(
        `Round-C candidate has no shared dictionary binding: ${candidate.candidateId}`,
      );
    }
    if (
      candidate.generationStrategy === THIRD_ROUND_STRATEGY_TEXT_ONLY &&
      (lifecycleBinding || candidate.pronunciationDictionary)
    ) {
      throw new Error(
        `Text-only round-C candidate unexpectedly has a dictionary binding: ${candidate.candidateId}`,
      );
    }
    const locators = lifecycleBinding ? [lifecycleBinding.locator] : [];
    const result = await synthesizeElevenLabsCandidate({
      apiKey: credential.apiKey,
      candidate,
      pronunciationDictionaryLocators: locators,
    });
    const outputPath = candidateAudioPath(candidate.candidateId);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const temporary = `${outputPath}.tmp`;
    writeFileSync(temporary, result.audio);
    rmSync(outputPath, { force: true });
    renameSync(temporary, outputPath);
    const row = {
      ...candidate,
      candidateSha256: sha256File(outputPath),
      relativePath: path.relative(root, outputPath).replaceAll("\\", "/"),
      characterCost: result.characterCost,
      requestIdFingerprint: result.requestId
        ? sha256Bytes(result.requestId)
        : null,
      pronunciationDictionaryLocators: locators,
      ...(lifecycleBinding
        ? { pronunciationDictionaryLifecycle: lifecycleBinding }
        : {}),
      credentialSource,
      generatedAt: new Date().toISOString(),
      status: "generated",
    };
    appendJsonl(generatedPath, row);
    if ((index + 1) % 20 === 0 || index + 1 === pending.length)
      console.log(`Generated ${index + 1}/${pending.length}`);
  });
}

function thirdPlanCommand(parsed) {
  const generationStrategy = parsed.valueFor(
    "--strategy",
    THIRD_ROUND_STRATEGY_DICTIONARY,
  );
  if (
    ![THIRD_ROUND_STRATEGY_DICTIONARY, THIRD_ROUND_STRATEGY_TEXT_ONLY].includes(
      generationStrategy,
    )
  ) {
    throw new Error(`Unsupported third-round strategy: ${generationStrategy}`);
  }
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Run regeneration dry-run first."),
  );
  const selection = requireJson(
    selectionPath,
    "Run A/B selection before planning the third round.",
  );
  const promotion = loadPromotionState(plan);
  assertSelectionRecord(selection, {
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: null,
    promotedSourceAssetIds: promotion.replacements.map(
      (item) => item.sourceAssetId,
    ),
  });
  const currentInputs = loadCurrentThirdPlanInputs(plan);
  const thirdPlan = buildThirdRoundPlan({
    plan,
    selection,
    ...currentInputs,
    generationStrategy,
  });
  const dictionaryPlan =
    generationStrategy === THIRD_ROUND_STRATEGY_DICTIONARY
      ? assertThirdRoundDictionaryPlan(
          buildThirdRoundDictionaryPlan(thirdPlan),
          thirdPlan,
          { expectedRulesByLanguage: EXPECTED_THIRD_ROUND_RULES },
        )
      : null;
  writeJson(thirdRoundPlanPath, thirdPlan);
  if (dictionaryPlan) writeJson(dictionaryPlanPath, dictionaryPlan);
  else rmSync(dictionaryPlanPath, { force: true });
  console.log(
    JSON.stringify(
      {
        thirdRoundPlanPath: path.relative(root, thirdRoundPlanPath),
        generationStrategy,
        dictionaryPlanPath: dictionaryPlan
          ? path.relative(root, dictionaryPlanPath)
          : null,
        basePlanSha256: thirdPlan.basePlanSha256,
        thirdPlanSha256: thirdPlan.thirdPlanSha256,
        candidateCount: thirdPlan.candidateCount,
        blockedCount: thirdPlan.blockedCount,
        characterCount: thirdPlan.characterCount,
        sourceDurationSeconds: thirdPlan.sourceDurationSeconds,
        dictionaryCount: dictionaryPlan?.dictionaryCount ?? 0,
        dictionaryRuleCounts: dictionaryPlan
          ? Object.fromEntries(
              dictionaryPlan.dictionaries.map((dictionary) => [
                dictionary.languageId,
                dictionary.ruleCount,
              ]),
            )
          : {},
        dictionaryPlanSha256: dictionaryPlan?.dictionaryPlanSha256 ?? null,
        safetyReserve: thirdPlan.safetyReserve,
        paidCallsMade: false,
      },
      null,
      2,
    ),
  );
}

async function generateCommand(parsed) {
  requireFlag(parsed, "--confirm", "Paid TTS generation requires --confirm");
  const plan = requirePlan(parsed);
  if (!plan.allVoicesAvailable)
    throw new Error("An original voice failed metadata checks");
  const round = Number(parsed.valueFor("--round", "1"));
  if (round === 1) {
    if (!plan.safetyReserveSatisfied)
      throw new Error("The 5,000-credit safety reserve is not satisfied");
    if (plan.candidates.length !== EXPECTED_FIRST_ROUND_CANDIDATE_COUNT)
      throw new Error("First round must contain 832 candidates");
    const promotion = loadPromotionState(plan);
    const promoted = new Set(
      promotion.replacements.map((item) => item.sourceAssetId),
    );
    await generateCandidates(
      plan.candidates.filter(
        (candidate) => !promoted.has(candidate.sourceAssetId),
      ),
    );
    return;
  }
  if (round !== 3) throw new Error("Only round 1 or 3 is allowed");
  if (plan.thirdRoundModelAvailable !== true) {
    throw new Error(
      "Round-C generation requires a reviewed network plan with eleven_v3 available",
    );
  }
  const selection = requireJson(
    selectionPath,
    "Run A/B selection before the third round.",
  );
  const promotion = loadPromotionState(plan);
  assertSelectionRecord(selection, {
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: null,
    promotedSourceAssetIds: promotion.replacements.map(
      (item) => item.sourceAssetId,
    ),
  });
  const currentInputs = loadCurrentThirdPlanInputs(plan);
  const thirdPlan = assertThirdRoundPlan(
    requireJson(
      thirdRoundPlanPath,
      "Run the pure third-plan command and review it before generation.",
    ),
    { plan, selection, ...currentInputs },
  );
  const expectedGenerationStrategy = parsed.valueFor("--strategy");
  if (
    !expectedGenerationStrategy ||
    expectedGenerationStrategy !== thirdPlan.generationStrategy
  ) {
    throw new Error(
      "The exact --strategy from the reviewed third-round plan is required",
    );
  }
  const dictionaryPlan =
    thirdPlan.generationStrategy === THIRD_ROUND_STRATEGY_DICTIONARY
      ? loadValidatedDictionaryPlan(thirdPlan)
      : null;
  const expectedThirdPlanSha = parsed.valueFor("--third-plan-sha");
  if (
    !expectedThirdPlanSha ||
    expectedThirdPlanSha !== thirdPlan.thirdPlanSha256
  ) {
    throw new Error(
      "The exact --third-plan-sha from the reviewed third-round plan is required",
    );
  }
  const { value: credential } = await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const subscription = await fetchElevenLabsSubscription(credential.apiKey);
  const remainingAfterThirdRound =
    typeof subscription.remaining === "number"
      ? subscription.remaining - thirdPlan.characterCount
      : null;
  if (
    remainingAfterThirdRound === null ||
    remainingAfterThirdRound < thirdPlan.safetyReserve
  ) {
    throw new Error(
      "The exact third-round cost would violate the 5,000-credit safety reserve",
    );
  }
  const pending = pendingGeneratedCandidates(thirdPlan.candidates);
  const lifecycleClients = {
    createDictionary: createElevenLabsPronunciationDictionary,
    listDictionaries: listElevenLabsPronunciationDictionaries,
    archiveDictionary: archiveElevenLabsPronunciationDictionary,
  };
  const registry = loadDictionaryLifecycleRegistry();
  if (thirdPlan.generationStrategy === THIRD_ROUND_STRATEGY_TEXT_ONLY) {
    assertDictionaryLifecycleClear(registry);
    await generateCandidates(pending);
    return;
  }
  if (pending.length === 0) {
    try {
      assertDictionaryLifecycleClear(registry);
    } catch {
      const cleaned = await cleanupTemporaryDictionaries({
        registry,
        dictionaryPlan,
        apiKey: credential.apiKey,
        listDictionaries: lifecycleClients.listDictionaries,
        archiveDictionary: lifecycleClients.archiveDictionary,
        persistRegistry: persistDictionaryLifecycleRegistry,
        appendEvent: appendDictionaryLifecycleEvent,
        discoverPlannedNames: false,
      });
      persistDictionaryLifecycleRegistry(cleaned);
      assertDictionaryLifecycleClear(cleaned);
    }
    return;
  }
  const lifecycle = await withTemporaryPronunciationDictionaries({
    registry,
    dictionaryPlan,
    sessionId: randomUUID(),
    apiKey: credential.apiKey,
    clients: lifecycleClients,
    persistRegistry: persistDictionaryLifecycleRegistry,
    appendEvent: appendDictionaryLifecycleEvent,
    worker: ({ bindingByLanguage }) =>
      generateCandidates(pending, {
        dictionaryBindingByLanguage: bindingByLanguage,
      }),
  });
  persistDictionaryLifecycleRegistry(lifecycle.registry);
}

function buildCandidateInventory() {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Regeneration plan is missing"),
  );
  const thirdPlan = loadValidatedThirdPlan(plan);
  const state = bindActiveGeneratedCandidates({ plan, thirdPlan });
  if (state.issues.length > 0) {
    throw new Error(`Stale generated candidates: ${state.issues.join(", ")}`);
  }
  const sourceById = state.sources;
  const generated = state.bound;
  const assets = generated.map((candidate) => {
    const source = sourceById.get(candidate.sourceAssetId);
    const audioPath = candidateAudioPath(candidate.candidateId);
    return {
      assetId: candidate.candidateId,
      sha256: sha256File(audioPath),
      languageId: candidate.languageId,
      role: "example-word",
      text: candidate.text,
      expectedIpa: candidate.canonicalIpa,
      targetUnits: source.targetUnits,
      speakerId: candidate.voiceId,
      voiceSlot: candidate.voiceSlot,
      desktopPath: path.relative(root, audioPath).replaceAll("\\", "/"),
      browserPath: path.relative(root, audioPath).replaceAll("\\", "/"),
    };
  });
  const inventory = {
    version: 1,
    generatedAt: new Date().toISOString(),
    assetCount: assets.length,
    assets,
  };
  writeJson(candidateInventoryPath, inventory);
  return inventory;
}

async function offlineCommand(signalOnly) {
  buildCandidateInventory();
  const args = [
    "scripts/pronunciation_audit.py",
    "offline",
    "--root",
    root,
    "--inventory",
    candidateInventoryPath,
    "--output",
    analysisRoot,
  ];
  if (signalOnly) args.push("--signal-only");
  const result = await execFileAsync("python", args, {
    cwd: root,
    windowsHide: true,
    timeout: signalOnly ? 30 * 60_000 : 8 * 60 * 60_000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      HF_HOME: "D:\\AI\\cache\\huggingface",
      HUGGINGFACE_HUB_CACHE: "D:\\AI\\cache\\huggingface\\hub",
      TORCH_HOME: "D:\\AI\\cache\\torch",
    },
  });
  if (result.stdout) console.log(result.stdout.trim());
}

async function convertToAzureWav(candidate) {
  const wavPath = path.join(
    analysisRoot,
    "wav-cache",
    `${candidate.candidateSha256}.wav`,
  );
  if (existsSync(wavPath)) return wavPath;
  mkdirSync(path.dirname(wavPath), { recursive: true });
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      candidateAudioPath(candidate.candidateId),
      "-ac",
      "1",
      "-ar",
      "16000",
      "-sample_fmt",
      "s16",
      wavPath,
    ],
    { windowsHide: true, timeout: 30_000 },
  );
  return wavPath;
}

let cachedHomophoneGroups = null;
let cachedCmuReference = null;
function classify(expected, actual, languageId) {
  cachedHomophoneGroups ??= readJson(
    path.resolve(root, "scripts/data/phoneme-word-audit-homophones.json"),
  ).groups;
  cachedCmuReference ??= loadCmuDictReference();
  return classifyBlindTranscript({
    expected,
    actual,
    languageId,
    homophoneGroups: cachedHomophoneGroups,
    cmuReference: cachedCmuReference,
  });
}

function englishPronunciationSummary(source, result) {
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
  const syllableCountAligned =
    Number.isInteger(source.syllableCount) && actualSyllableCount > 0
      ? source.syllableCount === actualSyllableCount
      : false;
  return {
    ok: result.ok,
    wordAccuracy:
      result.words[0]?.accuracyScore ?? result.accuracyScore ?? null,
    actualPhonemeSequence: actualPhonemes || null,
    targetUnitAligned:
      targets.length > 0 && targets.every((target) => actual.includes(target)),
    expectedSyllableCount: source.syllableCount,
    actualSyllableCount,
    syllableCountAligned,
    expectedPrimaryStress: source.primaryStress,
    stressAligned: source.syllableCount === 1 ? true : null,
    stressEvidence:
      source.syllableCount === 1
        ? "monosyllabic-by-reference"
        : "not-observable-from-azure-phoneme-output",
  };
}

async function azureCommand(parsed) {
  requireFlag(
    parsed,
    "--confirm",
    "Azure candidate validation requires --confirm",
  );
  const plan = requirePlan(parsed);
  const thirdPlan = loadValidatedThirdPlan(plan);
  const state = bindActiveGeneratedCandidates({ plan, thirdPlan });
  if (state.issues.length > 0) {
    throw new Error(`Stale generated candidates: ${state.issues.join(", ")}`);
  }
  const sourceById = state.sources;
  const { value: azure, source: credentialSource } =
    await readSpeakRightCredential("azure");
  if (
    !azure?.subscriptionKey ||
    normalizeLabel(azure.region) !== fixedAzureRegion
  ) {
    throw new Error(`Azure credential must use ${fixedAzureRegion}`);
  }
  const existingBlind = new Map(
    readJsonl(azureBlindPath).map((row) => [row.candidateSha256, row]),
  );
  const existingPronunciation = new Map(
    readJsonl(azurePronunciationPath).map((row) => [row.candidateSha256, row]),
  );
  const candidates = state.bound;
  await runFailStopPool(candidates, 2, async (candidate, index) => {
    const wavPath = await convertToAzureWav(candidate);
    if (!existingBlind.has(candidate.candidateSha256)) {
      const blind = await recognizeAzureWordBlind({
        subscriptionKey: azure.subscriptionKey,
        region: fixedAzureRegion,
        languageId: candidate.languageId,
        wavPath,
      });
      appendJsonl(azureBlindPath, {
        version: 1,
        candidateId: candidate.candidateId,
        candidateSha256: candidate.candidateSha256,
        listener: "azure-standard-stt",
        heardText: blind.recognizedText,
        confidence: blind.confidence,
        outcome: classify(
          candidate.text,
          blind.recognizedText,
          candidate.languageId,
        ),
        referenceTextSent: false,
        answerLeakage: false,
        credentialSource,
        createdAt: new Date().toISOString(),
      });
    }
    if (
      candidate.languageId === "en-US" &&
      !existingPronunciation.has(candidate.candidateSha256)
    ) {
      const result = await assessAzurePronunciation({
        subscriptionKey: azure.subscriptionKey,
        region: fixedAzureRegion,
        languageId: candidate.languageId,
        referenceText: candidate.text,
        wavPath,
        role: "example-word",
      });
      const { rawResponse: _rawResponse, ...safeResult } = result;
      appendJsonl(azurePronunciationPath, {
        version: 1,
        candidateId: candidate.candidateId,
        candidateSha256: candidate.candidateSha256,
        supportingEvidenceOnly: true,
        result: safeResult,
        gate: englishPronunciationSummary(
          sourceById.get(candidate.sourceAssetId),
          safeResult,
        ),
        credentialSource,
        createdAt: new Date().toISOString(),
      });
    }
    if ((index + 1) % 20 === 0 || index + 1 === candidates.length)
      console.log(`Azure validated ${index + 1}/${candidates.length}`);
  });
}

async function scribeCommand(parsed) {
  requireFlag(
    parsed,
    "--confirm",
    "ElevenLabs Scribe validation requires --confirm",
  );
  const plan = requirePlan(parsed);
  const { value: credential, source: credentialSource } =
    await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const existing = new Map(
    readJsonl(scribeBlindPath).map((row) => [row.candidateSha256, row]),
  );
  const thirdPlan = loadValidatedThirdPlan(
    assertRegenerationPlan(
      requireJson(planPath, "Regeneration plan is missing"),
    ),
  );
  const state = bindActiveGeneratedCandidates({ plan, thirdPlan });
  if (state.issues.length > 0) {
    throw new Error(`Stale generated candidates: ${state.issues.join(", ")}`);
  }
  const candidates = state.bound.filter(
    (candidate) => !existing.has(candidate.candidateSha256),
  );
  await runFailStopPool(candidates, 2, async (candidate, index) => {
    const result = await transcribeElevenLabsScribe({
      apiKey: credential.apiKey,
      audioPath: candidateAudioPath(candidate.candidateId),
      languageCode: candidate.languageCode,
    });
    appendJsonl(scribeBlindPath, {
      version: 1,
      candidateId: candidate.candidateId,
      candidateSha256: candidate.candidateSha256,
      listener: "elevenlabs-scribe-v2",
      heardText: result.text,
      detectedLanguage: result.languageCode,
      languageProbability: result.languageProbability,
      requestIdFingerprint: result.requestId
        ? sha256Bytes(result.requestId)
        : null,
      outcome: classify(candidate.text, result.text, candidate.languageId),
      keytermsSent: false,
      expectedWordSent: false,
      answerLeakage: false,
      credentialSource,
      createdAt: new Date().toISOString(),
    });
    if ((index + 1) % 20 === 0 || index + 1 === candidates.length)
      console.log(`Scribe validated ${index + 1}/${candidates.length}`);
  });
}

function buildWhisperBlindRows(candidates) {
  const binding = bindCandidateObservations({
    candidates,
    rows: readJsonl(path.join(analysisRoot, "whisper.jsonl")),
    idField: "assetId",
    shaField: "sha256",
  });
  return {
    issues: binding.issues,
    byCandidateId: new Map(
      candidates.flatMap((candidate) => {
        const raw = binding.byCandidateId.get(candidate.candidateId);
        if (!raw) return [];
        const heardText = raw.whisper?.transcript ?? "";
        return [
          [
            candidate.candidateId,
            {
              candidateId: candidate.candidateId,
              candidateSha256: candidate.candidateSha256,
              listener: "whisper-large-v3",
              heardText,
              outcome: classify(
                candidate.text,
                heardText,
                candidate.languageId,
              ),
              promptSent: false,
              expectedWordSent: false,
              answerLeakage: false,
              rawObservation: raw,
            },
          ],
        ];
      }),
    ),
  };
}
function median(values) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function voiceMedians(plan) {
  const grouped = new Map();
  for (const source of plan.sourceAssets) {
    const values = grouped.get(source.voiceName) ?? [];
    if (source.sourceSignal) values.push(source.sourceSignal);
    grouped.set(source.voiceName, values);
  }
  return new Map(
    [...grouped].map(([voiceName, values]) => [
      voiceName,
      {
        meanDb: median(values.map((value) => value.meanDb)),
        durationSeconds: median(values.map((value) => value.durationSeconds)),
      },
    ]),
  );
}

function signalDistance(source, signal, medians) {
  const reference = medians.get(source.voiceName);
  if (!reference || !signal || !Number.isFinite(reference.durationSeconds))
    return Number.POSITIVE_INFINITY;
  const loudness =
    Math.abs((signal.meanDb ?? reference.meanDb) - reference.meanDb) / 6;
  const duration =
    Math.abs(
      (signal.durationSeconds ?? reference.durationSeconds) -
        reference.durationSeconds,
    ) / Math.max(reference.durationSeconds, 0.1);
  return Number((loudness + duration).toFixed(6));
}

function loadThirdPlanForActiveCandidates(plan) {
  const hasThirdRoundAudio = generatedHistoryRows().some(
    (row) =>
      row.generationRound === 3 &&
      existsSync(candidateAudioPath(row.candidateId)),
  );
  return hasThirdRoundAudio ? loadValidatedThirdPlan(plan) : null;
}

function assertCurrentDictionaryLifecycle({ thirdPlan, state }) {
  const registry = loadDictionaryLifecycleRegistry();
  assertDictionaryLifecycleClear(registry);
  const roundThreeCandidates = state.bound.filter(
    (candidate) => candidate.generationRound === 3,
  );
  if (roundThreeCandidates.length === 0) return true;
  if (!thirdPlan) {
    throw new Error(
      "Bound round-C candidates require a validated third-round plan",
    );
  }
  if (thirdPlan.generationStrategy === THIRD_ROUND_STRATEGY_TEXT_ONLY) {
    for (const candidate of roundThreeCandidates) {
      if (
        candidate.generationStrategy !== THIRD_ROUND_STRATEGY_TEXT_ONLY ||
        candidate.pronunciationDictionary ||
        candidate.pronunciationDictionaryLifecycle ||
        (candidate.pronunciationDictionaryLocators ?? []).length > 0
      ) {
        throw new Error(
          `Text-only round-C candidate has stale dictionary metadata: ${candidate.candidateId}`,
        );
      }
    }
    return true;
  }
  if (thirdPlan.generationStrategy !== THIRD_ROUND_STRATEGY_DICTIONARY) {
    throw new Error(
      `Unsupported active third-round strategy: ${thirdPlan.generationStrategy}`,
    );
  }
  const dictionaryPlan = loadValidatedDictionaryPlan(thirdPlan);
  for (const candidate of roundThreeCandidates) {
    assertGeneratedDictionaryBinding({
      candidate,
      generated: candidate,
      dictionaryPlan,
      registry,
    });
  }
  return true;
}
function buildCurrentSelection(plan) {
  const thirdPlan = loadThirdPlanForActiveCandidates(plan);
  const state = bindActiveGeneratedCandidates({ plan, thirdPlan });
  assertCurrentDictionaryLifecycle({ thirdPlan, state });
  if (state.issues.length > 0) {
    throw new Error(`Stale generated candidates: ${state.issues.join(", ")}`);
  }
  const candidates = state.bound;
  const signalBinding = bindCandidateObservations({
    candidates,
    rows: readJsonl(path.join(analysisRoot, "signal.jsonl")),
    idField: "assetId",
    shaField: "sha256",
  });
  const whisperBinding = buildWhisperBlindRows(candidates);
  const azureBinding = bindCandidateObservations({
    candidates,
    rows: readJsonl(azureBlindPath),
  });
  const scribeBinding = bindCandidateObservations({
    candidates,
    rows: readJsonl(scribeBlindPath),
  });
  const pronunciationBinding = bindCandidateObservations({
    candidates: candidates.filter(
      (candidate) => candidate.languageId === "en-US",
    ),
    rows: readJsonl(azurePronunciationPath),
  });
  const staleEvidenceIssues = [
    ...signalBinding.issues,
    ...whisperBinding.issues,
    ...azureBinding.issues,
    ...scribeBinding.issues,
    ...pronunciationBinding.issues,
  ];
  if (staleEvidenceIssues.length > 0) {
    throw new Error(
      `Stale candidate observations: ${staleEvidenceIssues.join(", ")}`,
    );
  }
  const medians = voiceMedians(plan);
  const results = candidates.map((candidate) => {
    const source = state.sources.get(candidate.sourceAssetId);
    const signalRow = signalBinding.byCandidateId.get(candidate.candidateId);
    const whisper = whisperBinding.byCandidateId.get(candidate.candidateId);
    const azure = azureBinding.byCandidateId.get(candidate.candidateId);
    const scribe = scribeBinding.byCandidateId.get(candidate.candidateId);
    const pronunciationRow = pronunciationBinding.byCandidateId.get(
      candidate.candidateId,
    );
    const azurePronunciation = pronunciationRow?.result
      ? englishPronunciationSummary(source, pronunciationRow.result)
      : null;
    const result = evaluateCandidate({
      candidate,
      source,
      signal: signalRow?.signal
        ? {
            ...signalRow.signal,
            distanceFromVoiceMedian: signalDistance(
              source,
              signalRow.signal,
              medians,
            ),
          }
        : null,
      whisper,
      azure,
      scribe,
      azurePronunciation,
    });
    return {
      ...candidate,
      ...result,
      evidenceSha256: {
        signalSha256: computeObservationDigest(signalRow),
        whisperSha256: computeObservationDigest(whisper?.rawObservation),
        azureSha256: computeObservationDigest(azure),
        scribeSha256: computeObservationDigest(scribe),
        azurePronunciationSha256: computeObservationDigest(pronunciationRow),
      },
    };
  });
  const selected = [...state.sources.values()].flatMap((source) => {
    if (state.promotedSourceAssetIds.has(source.sourceAssetId)) return [];
    const choice = selectCandidateForAsset(
      results.filter((result) => result.sourceAssetId === source.sourceAssetId),
    );
    return choice ? [choice] : [];
  });
  const selection = buildSelectionRecord({
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: thirdPlan?.thirdPlanSha256 ?? null,
    thirdPlanInputSelectionSha256: thirdPlan?.selectionSha256 ?? null,
    promotedSourceAssetIds: [...state.promotedSourceAssetIds],
    totalSourceAssetCount: plan.sourceAssetCount,
    results,
    selected,
  });
  return { selection, state, thirdPlan };
}

function selectCommand() {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Regeneration plan is missing"),
  );
  const { selection, state } = buildCurrentSelection(plan);
  writeJson(promotionPath, state.promotion);
  writeJson(selectionPath, selection);
  console.log(
    `Selected ${selection.selectedAssetCount}/${plan.sourceAssetCount - selection.promotedSourceAssetIds.length} active assets; promoted exceptions ${selection.promotedSourceAssetIds.length}; unresolved ${selection.unresolvedAssetCount}`,
  );
}
function promoteCommand(parsed) {
  requireFlag(parsed, "--confirm", "Formal promotion requires --confirm");
  const plan = requirePlan(parsed);
  const storedSelection = requireJson(
    selectionPath,
    "Run candidate selection first.",
  );
  const rebuilt = buildCurrentSelection(plan);
  assertSelectionRecord(storedSelection, {
    basePlanSha256: plan.planSha256,
    thirdPlanSha256: rebuilt.thirdPlan?.thirdPlanSha256 ?? null,
    promotedSourceAssetIds: rebuilt.state.promotion.replacements.map(
      (item) => item.sourceAssetId,
    ),
  });
  if (storedSelection.selectionSha256 !== rebuilt.selection.selectionSha256) {
    throw new Error("Selection is stale; rerun select before promotion");
  }
  const sourceById = rebuilt.state.sources;
  const generated = new Map(
    rebuilt.state.bound.map((candidate) => [candidate.candidateId, candidate]),
  );
  const existingRows = rebuilt.state.promotion.replacements;
  const alreadyPromoted = new Set(
    existingRows.map((replacement) => replacement.sourceAssetId),
  );
  const rows = [...existingRows];
  const promotionOperations = [];
  for (const selected of storedSelection.selected) {
    if (alreadyPromoted.has(selected.sourceAssetId)) continue;
    const source = sourceById.get(selected.sourceAssetId);
    const generatedCandidate = generated.get(selected.candidateId);
    if (!source || !generatedCandidate) {
      throw new Error(
        `Selected candidate is not current: ${selected.candidateId}`,
      );
    }
    const candidate = { ...generatedCandidate, ...selected };
    const desktopPath = path.resolve(root, source.desktopPath);
    const browserPath = path.resolve(root, source.browserPath);
    assertPromotionAllowed({
      source,
      candidate,
      currentSourceSha256: sha256File(desktopPath),
    });
    if (sha256File(browserPath) !== source.sourceSha256) {
      throw new Error(`Source parity changed for ${source.sourceAssetId}`);
    }
    const candidatePath = candidateAudioPath(candidate.candidateId);
    const bytes = readFileSync(candidatePath);
    const candidateSha = sha256File(candidatePath);
    if (candidateSha !== candidate.candidateSha256) {
      throw new Error(`Candidate SHA changed for ${candidate.candidateId}`);
    }
    promotionOperations.push({
      desktopPath,
      browserPath,
      bytes,
      candidateSha256: candidateSha,
      expectedOldSha256: source.sourceSha256,
    });
    rows.push({
      sourceAssetId: source.sourceAssetId,
      candidateId: candidate.candidateId,
      languageId: source.languageId,
      text: source.text,
      oldSha256: source.sourceSha256,
      newSha256: candidateSha,
      voiceId: candidate.voiceId,
      modelId: candidate.modelId,
      seed: candidate.seed,
      generationRound: candidate.generationRound,
      referenceDigest: candidate.referenceDigest,
      configDigest: candidate.configDigest,
      ttsConfigDigest: candidate.ttsConfigDigest,
      status: "already-promoted-pending-human",
      promotedAt: new Date().toISOString(),
    });
  }
  const nextLedger = {
    version: 2,
    generatedAt: new Date().toISOString(),
    replacementCount: rows.length,
    warning:
      "Machine-replaced candidates still require human auditory confirmation.",
    replacements: rows,
  };
  atomicPromoteBatch({
    operations: promotionOperations,
    ledgerPath: promotionPath,
    ledgerBytes: Buffer.from(
      `${JSON.stringify(redactSecrets(nextLedger), null, 2)}\n`,
      "utf8",
    ),
  });
  console.log(
    `Promoted ${rows.length - existingRows.length} new candidates; preserved ${existingRows.length} already-promoted exceptions.`,
  );
}
function gateCommand() {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Regeneration plan is missing"),
  );
  const issues = [];
  if (plan.sourceAssetCount !== EXPECTED_REGENERATION_ASSET_COUNT)
    issues.push("scope-not-416");
  if (plan.firstRoundCandidateCount !== EXPECTED_FIRST_ROUND_CANDIDATE_COUNT)
    issues.push("first-round-not-832");
  const history = generatedHistoryRows();
  if (
    new Set(history.map((row) => row.candidateId)).size >
    MAX_REGENERATION_CANDIDATE_COUNT
  )
    issues.push("candidate-ceiling-exceeded");
  let current = null;
  try {
    current = buildCurrentSelection(plan);
    if (current.state.issues.length > 0) issues.push(...current.state.issues);
    if (existsSync(selectionPath)) {
      const stored = readJson(selectionPath);
      try {
        assertSelectionRecord(stored, {
          basePlanSha256: plan.planSha256,
          thirdPlanSha256: current.thirdPlan?.thirdPlanSha256 ?? null,
          promotedSourceAssetIds: current.state.promotion.replacements.map(
            (item) => item.sourceAssetId,
          ),
        });
        if (stored.selectionSha256 !== current.selection.selectionSha256) {
          issues.push("stale-selection-evidence-or-candidate-sha");
        }
      } catch (error) {
        issues.push(
          `invalid-selection:${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      issues.push("selection-missing");
    }
    for (const replacement of current.state.promotion.replacements) {
      if (replacement.status !== "already-promoted-pending-human") {
        issues.push(`invalid-promoted-exception:${replacement.sourceAssetId}`);
      }
    }
  } catch (error) {
    issues.push(
      `binding-or-promotion-validation:${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const serialized = [
    planPath,
    generatedPath,
    selectionPath,
    promotionPath,
    thirdRoundPlanPath,
    dictionaryPlanPath,
    dictionaryLifecyclePath,
    dictionaryLifecycleEventsPath,
  ]
    .filter(existsSync)
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");
  if (
    /xi-api-key|ocp-apim-subscription-key|subscriptionKey"\s*:\s*"(?!\[REDACTED)/iu.test(
      serialized,
    )
  ) {
    issues.push("secret-like-material-in-report");
  }
  const report = {
    passed: issues.length === 0,
    issues,
    sourceAssetCount: plan.sourceAssetCount,
    generatedHistoryCount: history.length,
    activeBoundCandidateCount: current?.state.bound.length ?? 0,
    promotedExceptionCount:
      current?.state.promotion.replacementCount ??
      (existsSync(promotionPath)
        ? readJson(promotionPath).replacementCount
        : 0),
  };
  writeJson(path.join(regenerationRoot, "candidate-gate.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}
async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.command) {
    case "plan":
      await planCommand();
      break;
    case "plan-offline":
      offlinePlanCommand();
      break;
    case "third-plan":
      thirdPlanCommand(parsed);
      break;
    case "generate":
      await generateCommand(parsed);
      break;
    case "signal":
      await offlineCommand(true);
      break;
    case "whisper":
      await offlineCommand(false);
      break;
    case "azure":
      await azureCommand(parsed);
      break;
    case "scribe":
      await scribeCommand(parsed);
      break;
    case "select":
      selectCommand();
      break;
    case "promote":
      promoteCommand(parsed);
      break;
    case "gate":
      gateCommand();
      break;
    default:
      throw new Error(
        "Usage: phoneme-word-regeneration.mjs <plan|plan-offline|third-plan|generate|signal|whisper|azure|scribe|select|promote|gate>",
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
