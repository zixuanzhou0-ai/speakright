#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { assessAzurePronunciation } from "./lib/azure-pronunciation-client.mjs";
import { recognizeAzureWordBlind } from "./lib/azure-stt-client.mjs";
import {
  loadCmuDictReference,
  normalizeComparableEnglishIpa,
} from "./lib/cmudict-reference.mjs";
import {
  createElevenLabsPronunciationDictionary,
  fetchElevenLabsModels,
  fetchElevenLabsSubscription,
  fetchElevenLabsVoice,
  synthesizeElevenLabsCandidate,
  transcribeElevenLabsScribe,
} from "./lib/elevenlabs-audio-clients.mjs";
import {
  classifyBlindTranscript,
  WORD_AUDIT_OUTPUT_NAME,
} from "./lib/phoneme-word-audit-core.mjs";
import {
  assertPromotionAllowed,
  assertRegenerationPlan,
  buildRegenerationPlan,
  buildThirdRoundCandidate,
  ELEVENLABS_SAFETY_RESERVE,
  EXPECTED_FIRST_ROUND_CANDIDATE_COUNT,
  EXPECTED_REGENERATION_ASSET_COUNT,
  evaluateCandidate,
  MAX_REGENERATION_CANDIDATE_COUNT,
  selectCandidateForAsset,
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

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value) ?? "unknown";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
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

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    }),
  );
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
  await runPool(voices, 2, async (source) => {
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

const candidateAudioPath = (candidateId) =>
  path.join(audioRoot, `${candidateId}.mp3`);
const generatedById = () =>
  new Map(readJsonl(generatedPath).map((row) => [row.candidateId, row]));

async function generateCandidates(candidates) {
  const { value: credential, source: credentialSource } =
    await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const existing = generatedById();
  const pending = candidates.filter((candidate) => {
    const cached = existing.get(candidate.candidateId);
    return (
      !cached ||
      cached.sourceSha256 !== candidate.sourceSha256 ||
      !existsSync(candidateAudioPath(candidate.candidateId))
    );
  });
  await runPool(pending, 2, async (candidate, index) => {
    let locators = [];
    if (candidate.generationRound === 3) {
      const dictionary = await withRetry(() =>
        createElevenLabsPronunciationDictionary({
          apiKey: credential.apiKey,
          candidate,
        }),
      );
      locators = [
        {
          pronunciation_dictionary_id: dictionary.id,
          version_id: dictionary.versionId,
        },
      ];
    }
    const result = await withRetry(() =>
      synthesizeElevenLabsCandidate({
        apiKey: credential.apiKey,
        candidate,
        pronunciationDictionaryLocators: locators,
      }),
    );
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
      credentialSource,
      generatedAt: new Date().toISOString(),
      status: "generated",
    };
    appendJsonl(generatedPath, row);
    existing.set(candidate.candidateId, row);
    if ((index + 1) % 20 === 0 || index + 1 === pending.length)
      console.log(`Generated ${index + 1}/${pending.length}`);
  });
}

async function generateCommand(parsed) {
  requireFlag(parsed, "--confirm", "Paid TTS generation requires --confirm");
  const plan = requirePlan(parsed);
  if (!plan.allVoicesAvailable)
    throw new Error("An original voice failed metadata checks");
  if (!plan.safetyReserveSatisfied)
    throw new Error("The 5,000-credit safety reserve is not satisfied");
  const round = Number(parsed.valueFor("--round", "1"));
  if (round === 1) {
    if (plan.candidates.length !== EXPECTED_FIRST_ROUND_CANDIDATE_COUNT)
      throw new Error("First round must contain 832 candidates");
    await generateCandidates(plan.candidates);
    return;
  }
  if (round !== 3) throw new Error("Only round 1 or 3 is allowed");
  const selection = requireJson(
    selectionPath,
    "Run A/B selection before the third round.",
  );
  const resultById = new Map(
    selection.results.map((result) => [result.candidateId, result]),
  );
  const candidates = [];
  const blocked = [];
  for (const source of plan.sourceAssets) {
    const pair = plan.candidates
      .filter((item) => item.sourceAssetId === source.sourceAssetId)
      .map((item) => ({
        ...item,
        status: resultById.get(item.candidateId)?.status,
      }));
    if (pair.some((item) => item.status === "machine-passed")) continue;
    try {
      candidates.push(buildThirdRoundCandidate(source, pair));
    } catch (error) {
      blocked.push({
        sourceAssetId: source.sourceAssetId,
        status: "blocked-reference-unresolved",
        reason: error.message,
      });
    }
  }
  if (
    plan.candidates.length + candidates.length >
    MAX_REGENERATION_CANDIDATE_COUNT
  )
    throw new Error("Candidate ceiling exceeded");
  writeJson(path.join(regenerationRoot, "third-round-plan.json"), {
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    characterCount: candidates.reduce(
      (sum, item) => sum + item.characterCount,
      0,
    ),
    blocked,
    candidates,
  });
  await generateCandidates(candidates);
}

function buildCandidateInventory() {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Regeneration plan is missing"),
  );
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const generated = [...generatedById().values()].filter((candidate) =>
    existsSync(candidateAudioPath(candidate.candidateId)),
  );
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
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
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
  const candidates = [...generatedById().values()];
  await runPool(candidates, 2, async (candidate, index) => {
    const wavPath = await convertToAzureWav(candidate);
    if (!existingBlind.has(candidate.candidateSha256)) {
      const blind = await withRetry(() =>
        recognizeAzureWordBlind({
          subscriptionKey: azure.subscriptionKey,
          region: fixedAzureRegion,
          languageId: candidate.languageId,
          wavPath,
        }),
      );
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
      const result = await withRetry(() =>
        assessAzurePronunciation({
          subscriptionKey: azure.subscriptionKey,
          region: fixedAzureRegion,
          languageId: candidate.languageId,
          referenceText: candidate.text,
          wavPath,
          role: "example-word",
        }),
      );
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
  requirePlan(parsed);
  const { value: credential, source: credentialSource } =
    await readSpeakRightCredential("elevenlabs");
  if (!credential?.apiKey) throw new Error("ElevenLabs credential is missing");
  const existing = new Map(
    readJsonl(scribeBlindPath).map((row) => [row.candidateSha256, row]),
  );
  const candidates = [...generatedById().values()].filter(
    (candidate) => !existing.has(candidate.candidateSha256),
  );
  await runPool(candidates, 2, async (candidate, index) => {
    const result = await withRetry(() =>
      transcribeElevenLabsScribe({
        apiKey: credential.apiKey,
        audioPath: candidateAudioPath(candidate.candidateId),
        languageCode: candidate.languageCode,
      }),
    );
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
  const rawById = new Map(
    readJsonl(path.join(analysisRoot, "whisper.jsonl")).map((row) => [
      row.assetId,
      row,
    ]),
  );
  return new Map(
    candidates.map((candidate) => {
      const raw = rawById.get(candidate.candidateId);
      const heardText = raw?.whisper?.transcript ?? "";
      return [
        candidate.candidateId,
        {
          candidateId: candidate.candidateId,
          candidateSha256: candidate.candidateSha256,
          listener: "whisper-large-v3",
          heardText,
          outcome: raw
            ? classify(candidate.text, heardText, candidate.languageId)
            : "missing",
          promptSent: false,
          expectedWordSent: false,
          answerLeakage: false,
        },
      ];
    }),
  );
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

function selectCommand() {
  const plan = assertRegenerationPlan(
    requireJson(planPath, "Regeneration plan is missing"),
  );
  const candidates = [...generatedById().values()];
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const signalById = new Map(
    readJsonl(path.join(analysisRoot, "signal.jsonl")).map((row) => [
      row.assetId,
      row.signal,
    ]),
  );
  const whisperById = buildWhisperBlindRows(candidates);
  const azureById = new Map(
    readJsonl(azureBlindPath).map((row) => [row.candidateId, row]),
  );
  const scribeById = new Map(
    readJsonl(scribeBlindPath).map((row) => [row.candidateId, row]),
  );
  const pronunciationById = new Map(
    readJsonl(azurePronunciationPath).map((row) => [row.candidateId, row.gate]),
  );
  const medians = voiceMedians(plan);
  const results = candidates.map((candidate) => {
    const source = sourceById.get(candidate.sourceAssetId);
    const signal = signalById.get(candidate.candidateId);
    const result = evaluateCandidate({
      candidate,
      signal: signal
        ? {
            ...signal,
            distanceFromVoiceMedian: signalDistance(source, signal, medians),
          }
        : null,
      whisper: whisperById.get(candidate.candidateId),
      azure: azureById.get(candidate.candidateId),
      scribe: scribeById.get(candidate.candidateId),
      azurePronunciation: pronunciationById.get(candidate.candidateId),
    });
    if ((source.relationshipIssues?.length ?? 0) > 0) {
      result.status = "machine-failed";
      result.reasons.push(
        ...source.relationshipIssues.map((issue) => `relationship-${issue}`),
      );
    }
    return { ...candidate, ...result };
  });
  const selected = plan.sourceAssets.flatMap((source) => {
    const choice = selectCandidateForAsset(
      results.filter((result) => result.sourceAssetId === source.sourceAssetId),
    );
    return choice ? [choice] : [];
  });
  writeJson(selectionPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    generatedCandidateCount: candidates.length,
    passedCandidateCount: results.filter(
      (item) => item.status === "machine-passed",
    ).length,
    failedCandidateCount: results.filter(
      (item) => item.status === "machine-failed",
    ).length,
    selectedAssetCount: selected.length,
    unresolvedAssetCount: plan.sourceAssetCount - selected.length,
    resultCounts: countBy(results, (item) => item.status),
    results,
    selected,
  });
  console.log(
    `Selected ${selected.length}/${plan.sourceAssetCount}; unresolved ${plan.sourceAssetCount - selected.length}`,
  );
}

function atomicReplace(filePath, bytes) {
  const temporary = `${filePath}.regen.tmp`;
  writeFileSync(temporary, bytes);
  rmSync(filePath, { force: true });
  renameSync(temporary, filePath);
}

function promoteCommand(parsed) {
  requireFlag(parsed, "--confirm", "Formal promotion requires --confirm");
  const plan = requirePlan(parsed);
  const selection = requireJson(
    selectionPath,
    "Run candidate selection first.",
  );
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const generated = generatedById();
  const rows = [];
  for (const selected of selection.selected) {
    const source = sourceById.get(selected.sourceAssetId);
    const candidate = { ...generated.get(selected.candidateId), ...selected };
    const desktopPath = path.resolve(root, source.desktopPath);
    const browserPath = path.resolve(root, source.browserPath);
    const currentSha = sha256File(desktopPath);
    assertPromotionAllowed({
      source,
      candidate,
      currentSourceSha256: currentSha,
    });
    if (sha256File(browserPath) !== currentSha)
      throw new Error(`Source parity changed for ${source.sourceAssetId}`);
    const candidatePath = candidateAudioPath(candidate.candidateId);
    const bytes = readFileSync(candidatePath);
    const candidateSha = sha256File(candidatePath);
    if (candidateSha !== candidate.candidateSha256)
      throw new Error(`Candidate SHA changed for ${candidate.candidateId}`);
    atomicReplace(desktopPath, bytes);
    atomicReplace(browserPath, bytes);
    if (
      sha256File(desktopPath) !== candidateSha ||
      sha256File(browserPath) !== candidateSha
    ) {
      throw new Error(
        `Post-promotion parity failed for ${source.sourceAssetId}`,
      );
    }
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
      status: "machine-replaced-pending-human",
      promotedAt: new Date().toISOString(),
    });
  }
  writeJson(promotionPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    replacementCount: rows.length,
    warning:
      "Machine-replaced candidates still require human auditory confirmation.",
    replacements: rows,
  });
  console.log(`Promoted ${rows.length} machine-validated candidates.`);
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
  const generated = [...generatedById().values()];
  if (generated.length > MAX_REGENERATION_CANDIDATE_COUNT)
    issues.push("candidate-ceiling-exceeded");
  if (existsSync(selectionPath)) {
    const selection = readJson(selectionPath);
    const selectedIds = new Set(
      selection.selected.map((item) => item.candidateId),
    );
    for (const item of selection.results) {
      if (selectedIds.has(item.candidateId) && item.status !== "machine-passed")
        issues.push(`selected-unpassed:${item.candidateId}`);
    }
  }
  if (existsSync(promotionPath)) {
    const sourceById = new Map(
      plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
    );
    for (const replacement of readJson(promotionPath).replacements) {
      if (replacement.status !== "machine-replaced-pending-human")
        issues.push(`invalid-status:${replacement.sourceAssetId}`);
      const source = sourceById.get(replacement.sourceAssetId);
      if (!source) {
        issues.push(`promotion-source-missing:${replacement.sourceAssetId}`);
        continue;
      }
      for (const [platform, relativePath] of [
        ["desktop", source.desktopPath],
        ["browser", source.browserPath],
      ]) {
        const absolutePath = path.resolve(root, relativePath);
        if (!existsSync(absolutePath)) {
          issues.push(
            `promoted-file-missing:${platform}:${replacement.sourceAssetId}`,
          );
        } else if (sha256File(absolutePath) !== replacement.newSha256) {
          issues.push(
            `promoted-sha-mismatch:${platform}:${replacement.sourceAssetId}`,
          );
        }
      }
    }
  }
  const serialized = [planPath, generatedPath, selectionPath, promotionPath]
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
    generatedCandidateCount: generated.length,
    promotionCount: existsSync(promotionPath)
      ? readJson(promotionPath).replacementCount
      : 0,
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
        "Usage: phoneme-word-regeneration.mjs <plan|generate|signal|whisper|azure|scribe|select|promote|gate>",
      );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
