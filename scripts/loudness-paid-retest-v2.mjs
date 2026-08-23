#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import {
  assertPromotionV2Authorization,
  buildBlindRetestProviderRequest,
  buildLoudnessPromotionV2Plan,
  buildLoudnessRetestV2Plan,
  buildPromotionTransactionEntries,
  computeGenerationReportSha,
  isRetestV2CheckpointReusable,
  LOUDNESS_RETEST_V2_PROVIDERS,
  SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
  SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
  verifyLoudnessRetestV2Plan,
} from "./lib/loudness-paid-retest-v2-core.mjs";
import { classifyBlindTranscript } from "./lib/phoneme-word-audit-core.mjs";

import {
  digestJson,
  resolveWithin,
  verifyImmutablePlan,
} from "./lib/promoted-audio-loudness-v2-core.mjs";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const auditRelative =
  "outputs/phoneme-word-auditory-audit-2026-07-14/loudness-normalization-v2";
const auditRoot = resolveWithin(root, auditRelative, "safe loudness v2 root");
const sourcePlanRoot = resolveWithin(
  auditRoot,
  SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA.slice(0, 16),
  "reviewed source plan root",
);
const sourcePlanPath = path.join(sourcePlanRoot, "immutable-plan.json");
const generationReportPath = path.join(
  sourcePlanRoot,
  "generation-report.json",
);
const retestBundlesRoot = path.join(sourcePlanRoot, "blind-retest-v2");

function parseArgs(values) {
  const flags = new Set(
    values.filter((value) => value.startsWith("--") && !value.includes("=")),
  );
  const valueFor = (name) =>
    values
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null;
  return { command: values[0] ?? "plan", flags, valueFor };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function toRepoRelative(filePath) {
  const relative = path.relative(root, filePath).replaceAll("\\", "/");
  if (relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository: ${filePath}`);
  }
  return relative;
}

function assertWithin(candidatePath, allowedRoot, label) {
  const candidate = path.resolve(candidatePath);
  const base = path.resolve(allowedRoot);
  if (!candidate.startsWith(`${base}${path.sep}`)) {
    throw new Error(`${label} escapes its allowed root`);
  }
  return candidate;
}

function ownedTemporaryPath(targetPath) {
  const extension = path.extname(targetPath);
  return `${targetPath.slice(0, -extension.length)}.partial-${randomUUID()}${extension}`;
}

function publishOwnedTemporary(temporaryPath, targetPath, allowedRoot) {
  const temporary = assertWithin(temporaryPath, allowedRoot, "temporary path");
  const target = assertWithin(targetPath, allowedRoot, "target path");
  if (!path.basename(temporary).includes(".partial-")) {
    throw new Error("Refusing to remove a non-owned temporary file");
  }
  if (!existsSync(temporary))
    throw new Error(`Missing temporary file: ${temporary}`);
  if (existsSync(target)) {
    if (sha256File(temporary) !== sha256File(target)) {
      throw new Error(
        `Immutable file already exists with different bytes: ${target}`,
      );
    }
    unlinkSync(temporary);
    return;
  }
  linkSync(temporary, target);
  unlinkSync(temporary);
}

function writeImmutableText(targetPath, content, allowedRoot) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (existsSync(targetPath)) {
    if (readFileSync(targetPath, "utf8") !== content) {
      throw new Error(`Immutable file differs: ${targetPath}`);
    }
    return;
  }
  const temporaryPath = ownedTemporaryPath(targetPath);
  const descriptor = openSync(temporaryPath, "wx");
  try {
    writeFileSync(descriptor, content, "utf8");
  } finally {
    closeSync(descriptor);
  }
  publishOwnedTemporary(temporaryPath, targetPath, allowedRoot);
}

function writeJournalSnapshot(transactionRoot, value, allowedRoot) {
  const snapshotCore = { ...value };
  delete snapshotCore.journalSnapshotSha256;
  const journalSnapshotSha256 = digestJson(snapshotCore);
  const snapshot = { ...snapshotCore, journalSnapshotSha256 };
  const status = String(value.status ?? "unknown").replaceAll(
    /[^a-z0-9-]/giu,
    "-",
  );
  const targetPath = path.join(
    transactionRoot,
    `journal-${status}-${journalSnapshotSha256.slice(0, 16)}.json`,
  );
  writeImmutableText(
    targetPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    allowedRoot,
  );
  return targetPath;
}

function loadReviewedSafeV2() {
  if (!existsSync(sourcePlanPath) || !existsSync(generationReportPath)) {
    throw new Error("Reviewed safe v2 plan/report is missing");
  }
  const sourcePlan = readJson(sourcePlanPath);
  if (verifyImmutablePlan(sourcePlan) !== SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA) {
    throw new Error("Reviewed safe v2 source plan SHA changed");
  }
  const generationReport = readJson(generationReportPath);
  if (
    computeGenerationReportSha(generationReport) !==
      SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA ||
    generationReport.reportSha256 !== SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA
  ) {
    throw new Error("Reviewed safe v2 generation report SHA changed");
  }
  for (const row of generationReport.results) {
    const source = sourcePlan.assets.find(
      (asset) => asset.assetId === row.assetId,
    );
    if (!source) throw new Error(`${row.assetId}: source plan row missing`);
    const candidatePath = path.resolve(
      root,
      row.artifacts.deliveryCandidateMp3.path,
    );
    if (
      sha256File(candidatePath) !== row.artifacts.deliveryCandidateMp3.sha256
    ) {
      throw new Error(`${row.assetId}: safe v2 candidate SHA changed`);
    }
    for (const formalPath of [
      source.source.desktopPath,
      source.source.browserPath,
    ]) {
      if (sha256File(path.resolve(root, formalPath)) !== source.source.sha256) {
        throw new Error(`${row.assetId}: formal source SHA changed`);
      }
    }
  }
  return { sourcePlan, generationReport };
}

function createRetestPlan(parsed) {
  const requestedSourcePlanSha = parsed.valueFor("--source-plan-sha");
  if (requestedSourcePlanSha !== SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA) {
    throw new Error("plan requires the exact reviewed --source-plan-sha");
  }
  const { sourcePlan, generationReport } = loadReviewedSafeV2();
  const document = buildLoudnessRetestV2Plan({
    sourcePlan,
    generationReport,
    sourcePlanSha256: SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
    generationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
  });
  const bundleRoot = path.join(
    retestBundlesRoot,
    document.planSha256.slice(0, 16),
  );
  const planPath = path.join(bundleRoot, "immutable-retest-plan.json");
  writeImmutableText(
    planPath,
    `${JSON.stringify(document, null, 2)}\n`,
    retestBundlesRoot,
  );
  for (const checkpointPath of Object.values(document.checkpoints)) {
    const absolutePath = resolveWithin(
      bundleRoot,
      checkpointPath,
      "checkpoint path",
    );
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      const descriptor = openSync(absolutePath, "wx");
      closeSync(descriptor);
    }
  }
  const whisperInventory = {
    version: 1,
    promptIncluded: false,
    expectedTextIncluded: false,
    assets: document.candidates.map((candidate) => ({
      assetId: candidate.assetId,
      candidateSha256: candidate.blindInput.sha256,
      languageId: candidate.languageId,
      audioPath: candidate.blindInput.path,
    })),
  };
  writeImmutableText(
    path.join(bundleRoot, "whisper-blind-inventory.json"),
    `${JSON.stringify(whisperInventory, null, 2)}\n`,
    bundleRoot,
  );
  console.log(
    JSON.stringify(
      {
        mode: "immutable-three-listener-plan",
        planSha256: document.planSha256,
        planPath: toRepoRelative(planPath),
        candidateCount: document.candidateCount,
        totalCandidateDurationSeconds: document.totalCandidateDurationSeconds,
        providerRequestCount: document.totalProviderRequestCount,
        localWhisperRequestCount:
          document.providerPlan.whisperLargeV3.requestCount,
        paidProviderRequestCount: document.paidProviderRequestCount,
        paidBillableAudioSeconds: document.paidBillableAudioSeconds,
        checkpoints: Object.fromEntries(
          Object.entries(document.checkpoints).map(([provider, relative]) => [
            provider,
            toRepoRelative(path.join(bundleRoot, relative)),
          ]),
        ),
        networkCallsPerformed: false,
        formalAssetsModified: false,
      },
      null,
      2,
    ),
  );
}

function loadRetestPlan(planSha256) {
  if (!/^[a-f0-9]{64}$/u.test(planSha256 ?? "")) {
    throw new Error("The exact --plan-sha is required");
  }
  const bundleRoot = path.join(retestBundlesRoot, planSha256.slice(0, 16));
  const planPath = path.join(bundleRoot, "immutable-retest-plan.json");
  if (!existsSync(planPath))
    throw new Error(`Retest plan is missing: ${planPath}`);
  const plan = readJson(planPath);
  if (verifyLoudnessRetestV2Plan(plan) !== planSha256) {
    throw new Error("Requested retest plan SHA is not exact");
  }
  return { plan, planPath, bundleRoot };
}

function compactCheckpointRows(plan, bundleRoot) {
  const result = [];
  for (const provider of LOUDNESS_RETEST_V2_PROVIDERS) {
    const checkpointPath = resolveWithin(
      bundleRoot,
      plan.checkpoints[provider],
      `${provider} checkpoint`,
    );
    const latest = new Map();
    for (const row of readJsonl(checkpointPath)) {
      latest.set(`${row.provider}\0${row.assetId}`, row);
    }
    result.push(...latest.values());
  }
  return result;
}

function currentStates(plan) {
  const candidateStates = plan.candidates.map((candidate) => ({
    assetId: candidate.assetId,
    sha256: existsSync(path.resolve(root, candidate.blindInput.path))
      ? sha256File(path.resolve(root, candidate.blindInput.path))
      : null,
  }));
  const sourceStates = plan.candidates.map((candidate) => ({
    assetId: candidate.assetId,
    desktopSha256: existsSync(
      path.resolve(root, candidate.formalSource.desktopPath),
    )
      ? sha256File(path.resolve(root, candidate.formalSource.desktopPath))
      : null,
    browserSha256: existsSync(
      path.resolve(root, candidate.formalSource.browserPath),
    )
      ? sha256File(path.resolve(root, candidate.formalSource.browserPath))
      : null,
  }));
  return { candidateStates, sourceStates };
}

function buildPromotionDryRun(planSha256) {
  const loaded = loadRetestPlan(planSha256);
  loadReviewedSafeV2();
  const checkpoints = compactCheckpointRows(loaded.plan, loaded.bundleRoot);
  const states = currentStates(loaded.plan);
  const promotionPlan = buildLoudnessPromotionV2Plan({
    retestPlan: loaded.plan,
    checkpoints,
    ...states,
  });
  const promotionPlanRoot = path.join(loaded.bundleRoot, "promotion-plans");
  const promotionPlanPath = path.join(
    promotionPlanRoot,
    `${promotionPlan.promotionPlanSha256}.json`,
  );
  writeImmutableText(
    promotionPlanPath,
    `${JSON.stringify(promotionPlan, null, 2)}\n`,
    loaded.bundleRoot,
  );
  return { ...loaded, promotionPlan, promotionPlanPath };
}

function printPromotionDryRun(result) {
  const reasonCounts = {};
  for (const row of result.promotionPlan.rows) {
    for (const reason of row.reasons) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
  }
  console.log(
    JSON.stringify(
      {
        mode: "promotion-dry-run",
        retestPlanSha256: result.plan.planSha256,
        promotionPlanSha256: result.promotionPlan.promotionPlanSha256,
        promotionPlanPath: toRepoRelative(result.promotionPlanPath),
        eligibleCount: result.promotionPlan.eligibleCount,
        blockedCount: result.promotionPlan.blockedCount,
        reasonCounts,
        exactPromotionCommand: `node scripts/loudness-paid-retest-v2.mjs promote --confirm --plan-sha=${result.plan.planSha256} --promotion-plan-sha=${result.promotionPlan.promotionPlanSha256}`,
        formalAssetsModified: false,
      },
      null,
      2,
    ),
  );
}

function assertOwnedTransactionPath(filePath, targetPath, transactionId) {
  const resolved = path.resolve(filePath);
  const targetDirectory = path.dirname(path.resolve(targetPath));
  if (!resolved.startsWith(`${targetDirectory}${path.sep}`)) {
    throw new Error("Transaction path escapes the formal asset directory");
  }
  if (!path.basename(resolved).includes(`speakright-${transactionId}`)) {
    throw new Error("Transaction path does not carry the owned transaction ID");
  }
  return resolved;
}

function rollbackTransactions(entries, transactionId) {
  for (const entry of [...entries].reverse()) {
    for (const platform of [entry.browser, entry.desktop]) {
      const targetPath = path.resolve(root, platform.targetPath);
      const backupPath = assertOwnedTransactionPath(
        path.resolve(root, platform.backupPath),
        targetPath,
        transactionId,
      );
      const temporaryPath = assertOwnedTransactionPath(
        path.resolve(root, platform.temporaryPath),
        targetPath,
        transactionId,
      );
      if (existsSync(targetPath) && existsSync(backupPath)) {
        if (sha256File(targetPath) !== entry.candidateSha256) {
          throw new Error(
            `Rollback found unexpected target bytes: ${targetPath}`,
          );
        }
        unlinkSync(targetPath);
      }
      if (!existsSync(targetPath) && existsSync(backupPath)) {
        renameSync(backupPath, targetPath);
      }
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    }
  }
}

function applyPromotion(result, parsed) {
  const reviewedPromotionPlanSha = parsed.valueFor("--promotion-plan-sha");
  assertPromotionV2Authorization({
    confirmed: parsed.flags.has("--confirm"),
    reviewedRetestPlanSha256: parsed.valueFor("--plan-sha"),
    currentRetestPlanSha256: result.plan.planSha256,
    reviewedPromotionPlanSha256: reviewedPromotionPlanSha,
    currentPromotionPlanSha256: result.promotionPlan.promotionPlanSha256,
  });
  const transactionId = randomUUID();
  const entries = buildPromotionTransactionEntries(
    result.promotionPlan,
    transactionId,
  );
  const blocked = result.promotionPlan.rows
    .filter((row) => !row.eligible)
    .map((row) => ({
      assetId: row.assetId,
      languageId: row.languageId,
      sourceSha256: row.source.sha256,
      reasons: [...row.reasons],
    }));
  const transactionRoot = path.join(
    result.bundleRoot,
    "promotion-transactions",
    transactionId,
  );
  let journalPath;
  const journal = {
    version: 1,
    transactionId,
    retestPlanSha256: result.plan.planSha256,
    promotionPlanSha256: result.promotionPlan.promotionPlanSha256,
    status: "preparing",
    formalAssetsModified: false,
    entries,
    blocked,
  };
  journalPath = writeJournalSnapshot(
    transactionRoot,
    journal,
    result.bundleRoot,
  );
  try {
    for (const entry of entries) {
      const candidatePath = path.resolve(root, entry.candidatePath);
      if (sha256File(candidatePath) !== entry.candidateSha256) {
        throw new Error(
          `${entry.assetId}: candidate SHA changed before staging`,
        );
      }
      for (const platform of [entry.desktop, entry.browser]) {
        const targetPath = path.resolve(root, platform.targetPath);
        if (sha256File(targetPath) !== entry.sourceSha256) {
          throw new Error(
            `${entry.assetId}: formal source SHA changed before staging`,
          );
        }
        const temporaryPath = assertOwnedTransactionPath(
          path.resolve(root, platform.temporaryPath),
          targetPath,
          transactionId,
        );
        copyFileSync(candidatePath, temporaryPath, constants.COPYFILE_EXCL);
        if (sha256File(temporaryPath) !== entry.candidateSha256) {
          throw new Error(`${entry.assetId}: staged candidate SHA mismatch`);
        }
      }
    }
    journal.status = "staged";
    journalPath = writeJournalSnapshot(
      transactionRoot,
      journal,
      result.bundleRoot,
    );
    for (const entry of entries) {
      for (const platform of [entry.desktop, entry.browser]) {
        const targetPath = path.resolve(root, platform.targetPath);
        const temporaryPath = path.resolve(root, platform.temporaryPath);
        const backupPath = path.resolve(root, platform.backupPath);
        renameSync(targetPath, backupPath);
        renameSync(temporaryPath, targetPath);
        if (sha256File(targetPath) !== entry.candidateSha256) {
          throw new Error(`${entry.assetId}: promoted target SHA mismatch`);
        }
      }
    }
    journal.status = "promoted-verifying";
    journal.formalAssetsModified = true;
    journalPath = writeJournalSnapshot(
      transactionRoot,
      journal,
      result.bundleRoot,
    );
    for (const entry of entries) {
      const desktopPath = path.resolve(root, entry.desktop.targetPath);
      const browserPath = path.resolve(root, entry.browser.targetPath);
      if (
        sha256File(desktopPath) !== entry.candidateSha256 ||
        sha256File(browserPath) !== entry.candidateSha256
      ) {
        throw new Error(
          `${entry.assetId}: final desktop/browser parity failed`,
        );
      }
    }
    for (const entry of entries) {
      for (const platform of [entry.desktop, entry.browser]) {
        const backupPath = assertOwnedTransactionPath(
          path.resolve(root, platform.backupPath),
          path.resolve(root, platform.targetPath),
          transactionId,
        );
        if (existsSync(backupPath)) unlinkSync(backupPath);
      }
    }
    journal.status = "completed";
    journal.formalAssetsModified = true;
    journal.completedSourceCount = entries.length;
    journalPath = writeJournalSnapshot(
      transactionRoot,
      journal,
      result.bundleRoot,
    );
    console.log(
      JSON.stringify(
        {
          status: "completed",
          transactionId,
          replacementCount: entries.length,
          blockedCount: blocked.length,
          blocked,
          journalPath: toRepoRelative(journalPath),
          formalAssetsModified: true,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    rollbackTransactions(entries, transactionId);
    journal.status = "rolled-back";
    journal.formalAssetsModified = false;
    journal.errorFingerprint = digestJson({
      message: String(error?.message ?? error),
    });
    journalPath = writeJournalSnapshot(
      transactionRoot,
      journal,
      result.bundleRoot,
    );
    throw error;
  }
}

let homophoneGroups;
let cmuReference;

function classifyAfterBlindResponse(candidate, heardText) {
  homophoneGroups ??= readJson(
    path.resolve(root, "scripts/data/phoneme-word-audit-homophones.json"),
  ).groups;
  if (candidate.languageId === "en-US") {
    cmuReference ??= loadCmuDictReference();
  }
  return classifyBlindTranscript({
    expected: candidate.comparisonAfterBlindResponse.expectedText,
    actual: heardText,
    languageId: candidate.languageId,
    homophoneGroups,
    cmuReference,
  });
}

function appendCheckpoint(filePath, row) {
  appendFileSync(filePath, `${JSON.stringify(row)}\n`, {
    encoding: "utf8",
    flag: "a",
  });
}

function requireRunAuthorization(parsed, planSha256) {
  if (!parsed.flags.has("--confirm")) {
    return false;
  }
  if (parsed.valueFor("--plan-sha") !== planSha256) {
    throw new Error("Run requires the exact reviewed --plan-sha");
  }
  return true;
}

function providerCheckpointPath(loaded, provider) {
  return resolveWithin(
    loaded.bundleRoot,
    loaded.plan.checkpoints[provider],
    `${provider} checkpoint`,
  );
}

function pendingCandidates(loaded, provider) {
  const checkpointPath = providerCheckpointPath(loaded, provider);
  const latest = new Map(
    readJsonl(checkpointPath)
      .filter((row) => row.provider === provider)
      .map((row) => [row.assetId, row]),
  );
  return loaded.plan.candidates.filter(
    (candidate) =>
      !isRetestV2CheckpointReusable({
        row: latest.get(candidate.assetId),
        provider,
        planSha256: loaded.plan.planSha256,
        candidateSha256: candidate.blindInput.sha256,
        languageId: candidate.languageId,
      }),
  );
}

async function withRetry(worker) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await worker();
    } catch (error) {
      const retryable =
        error?.status === 429 ||
        (typeof error?.status === "number" && error.status >= 500) ||
        /fetch|network|timeout|abort|temporar/iu.test(
          String(error?.message ?? error),
        );
      if (!retryable || attempt === 4) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * 2 ** (attempt - 1)),
      );
    }
  }
  throw new Error("Retry loop exhausted");
}

async function createAnonymousWav(candidate, sessionRoot) {
  const wavPath = path.join(sessionRoot, `${randomUUID()}.wav`);
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      path.resolve(root, candidate.blindInput.path),
      "-map_metadata",
      "-1",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ],
    { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
  );
  if (!existsSync(wavPath)) throw new Error("Anonymous WAV conversion failed");
  return wavPath;
}

function cleanupSession(sessionRoot) {
  if (!existsSync(sessionRoot)) return;
  for (const entry of readdirSync(sessionRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      throw new Error("Blind session unexpectedly contains a nested directory");
    }
    unlinkSync(
      assertWithin(
        path.join(sessionRoot, entry.name),
        sessionRoot,
        "session file",
      ),
    );
  }
  rmdirSync(sessionRoot);
}

function checkpointRow({
  loaded,
  provider,
  candidate,
  heardText,
  providerEvidence,
}) {
  return {
    version: 2,
    policyVersion: "safe-loudness-v2-whisper-azure-scribe-blind-v2",
    provider,
    assetId: candidate.assetId,
    planSha256: loaded.plan.planSha256,
    candidateSha256: candidate.blindInput.sha256,
    languageId: candidate.languageId,
    heardText,
    outcome: classifyAfterBlindResponse(candidate, heardText),
    providerEvidence,
    requestPolicy: {
      anonymousWavFilename: true,
      expectedTextIncluded: false,
      ipaIncluded: false,
      targetUnitIncluded: false,
      keytermsIncluded: false,
      pronunciationAssessmentEnabled: false,
      promptIncluded: false,
    },
    createdAt: new Date().toISOString(),
  };
}

async function runWhisperProvider(loaded) {
  const provider = "whisper-large-v3";
  const pending = pendingCandidates(loaded, provider);
  if (pending.length === 0) return { provider, completed: 0, reused: 28 };
  const sessionRoot = path.join(
    loaded.bundleRoot,
    "blind-sessions",
    randomUUID(),
  );
  mkdirSync(sessionRoot, { recursive: true });
  try {
    const assets = [];
    for (const candidate of pending) {
      const wavPath = await createAnonymousWav(candidate, sessionRoot);
      assets.push({
        assetId: candidate.assetId,
        anonymousWavSha256: sha256File(wavPath),
        candidateSha256: candidate.blindInput.sha256,
        languageId: candidate.languageId,
        audioPath: wavPath,
      });
    }
    const manifest = {
      version: 1,
      promptIncluded: false,
      expectedTextIncluded: false,
      assets,
    };
    const manifestPath = path.join(sessionRoot, "blind-manifest.json");
    const rawPath = path.join(sessionRoot, "raw-whisper.jsonl");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await execFileAsync(
      "python",
      [
        "scripts/loudness_whisper_blind_v2.py",
        "--manifest",
        manifestPath,
        "--output",
        rawPath,
      ],
      {
        cwd: root,
        windowsHide: true,
        timeout: 30 * 60_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const rawById = new Map(
      readJsonl(rawPath).map((row) => [row.assetId, row]),
    );
    const checkpointPath = providerCheckpointPath(loaded, provider);
    for (const candidate of pending) {
      const raw = rawById.get(candidate.assetId);
      if (!raw || raw.candidateSha256 !== candidate.blindInput.sha256) {
        throw new Error(`${candidate.assetId}: missing bound Whisper response`);
      }
      appendCheckpoint(
        checkpointPath,
        checkpointRow({
          loaded,
          provider,
          candidate,
          heardText: String(raw.heardText ?? ""),
          providerEvidence: {
            detectedLanguage: raw.detectedLanguage ?? null,
            languageProbability: raw.languageProbability ?? null,
            averageLogProbability: raw.averageLogProbability ?? null,
            noSpeechProbability: raw.noSpeechProbability ?? null,
            computeType: raw.computeType ?? null,
            promptIncluded: false,
          },
        }),
      );
    }
    return { provider, completed: pending.length, reused: 28 - pending.length };
  } finally {
    cleanupSession(sessionRoot);
  }
}

async function loadPaidCredentials() {
  const { readSpeakRightCredential } = await import(
    "./lib/secure-credentials.mjs"
  );
  const { value: azure, source: azureSource } =
    await readSpeakRightCredential("azure");
  const { value: elevenlabs, source: elevenLabsSource } =
    await readSpeakRightCredential("elevenlabs");
  if (
    !azure?.subscriptionKey ||
    String(azure.region ?? "").toLocaleLowerCase("en-US") !== "switzerlandnorth"
  ) {
    throw new Error("Azure credential must use switzerlandnorth");
  }
  if (!elevenlabs?.apiKey) throw new Error("ElevenLabs credential is missing");
  if (
    azureSource !== "windows-credential-manager" ||
    elevenLabsSource !== "windows-credential-manager"
  ) {
    throw new Error(
      "Paid credentials must come from Windows Credential Manager",
    );
  }
  return { azure, elevenlabs };
}

async function runPaidProvider(loaded, provider, credentials) {
  const pending = pendingCandidates(loaded, provider);
  const checkpointPath = providerCheckpointPath(loaded, provider);
  const sessionRoot = path.join(
    loaded.bundleRoot,
    "blind-sessions",
    randomUUID(),
  );
  mkdirSync(sessionRoot, { recursive: true });
  try {
    const { recognizeAzureWordBlind } =
      provider === "azure-stt"
        ? await import("./lib/azure-stt-client.mjs")
        : { recognizeAzureWordBlind: null };
    const { transcribeElevenLabsScribe } =
      provider === "elevenlabs-scribe-v2"
        ? await import("./lib/elevenlabs-audio-clients.mjs")
        : { transcribeElevenLabsScribe: null };
    for (const candidate of pending) {
      const wavPath = await createAnonymousWav(candidate, sessionRoot);
      try {
        const request = buildBlindRetestProviderRequest({
          provider,
          languageId: candidate.languageId,
          anonymousWavPath: wavPath,
        });
        const result = await withRetry(() =>
          provider === "azure-stt"
            ? recognizeAzureWordBlind({
                ...request,
                subscriptionKey: credentials.azure.subscriptionKey,
                region: "switzerlandnorth",
              })
            : transcribeElevenLabsScribe({
                ...request,
                apiKey: credentials.elevenlabs.apiKey,
              }),
        );
        const heardText =
          provider === "azure-stt"
            ? String(result.recognizedText ?? "")
            : String(result.text ?? "");
        appendCheckpoint(
          checkpointPath,
          checkpointRow({
            loaded,
            provider,
            candidate,
            heardText,
            providerEvidence:
              provider === "azure-stt"
                ? {
                    recognitionStatus: result.recognitionStatus ?? null,
                    confidence: result.confidence ?? null,
                    lexicalText: result.lexicalText ?? null,
                  }
                : {
                    detectedLanguage: result.languageCode ?? null,
                    languageProbability: result.languageProbability ?? null,
                    requestIdFingerprint: result.requestId
                      ? createHash("sha256")
                          .update(result.requestId)
                          .digest("hex")
                      : null,
                  },
          }),
        );
      } finally {
        if (existsSync(wavPath)) unlinkSync(wavPath);
      }
    }
    return { provider, completed: pending.length, reused: 28 - pending.length };
  } finally {
    cleanupSession(sessionRoot);
  }
}

async function runRetestCommand(parsed) {
  const planSha256 = parsed.valueFor("--plan-sha");
  const loaded = loadRetestPlan(planSha256);
  loadReviewedSafeV2();
  const provider = parsed.valueFor("--provider");
  const selected =
    provider === "all" ? [...LOUDNESS_RETEST_V2_PROVIDERS] : [provider];
  if (selected.some((value) => !LOUDNESS_RETEST_V2_PROVIDERS.includes(value))) {
    throw new Error(
      "run requires --provider=whisper-large-v3|azure-stt|elevenlabs-scribe-v2|all",
    );
  }
  const pending = Object.fromEntries(
    selected.map((value) => [value, pendingCandidates(loaded, value).length]),
  );
  if (!requireRunAuthorization(parsed, loaded.plan.planSha256)) {
    console.log(
      JSON.stringify(
        {
          mode: "provider-run-dry-run",
          planSha256: loaded.plan.planSha256,
          selectedProviders: selected,
          pending,
          exactRunCommand:
            "node scripts/loudness-paid-retest-v2.mjs run --confirm --provider=" +
            provider +
            " --plan-sha=" +
            loaded.plan.planSha256,
          networkCallsPerformed: false,
          formalAssetsModified: false,
        },
        null,
        2,
      ),
    );
    return;
  }
  const paidSelected = selected.some((value) => value !== "whisper-large-v3");
  const credentials = paidSelected ? await loadPaidCredentials() : null;
  const results = [];
  for (const value of selected) {
    results.push(
      value === "whisper-large-v3"
        ? await runWhisperProvider(loaded)
        : await runPaidProvider(loaded, value, credentials),
    );
  }
  console.log(
    JSON.stringify({
      mode: "provider-run-completed",
      planSha256: loaded.plan.planSha256,
      results,
      formalAssetsModified: false,
    }),
  );
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.command === "plan") createRetestPlan(parsed);
else if (parsed.command === "run") await runRetestCommand(parsed);
else if (parsed.command === "promotion-plan") {
  printPromotionDryRun(buildPromotionDryRun(parsed.valueFor("--plan-sha")));
} else if (parsed.command === "promote") {
  const result = buildPromotionDryRun(parsed.valueFor("--plan-sha"));
  if (!parsed.flags.has("--confirm")) printPromotionDryRun(result);
  else applyPromotion(result, parsed);
} else {
  throw new Error(
    "Usage: loudness-paid-retest-v2.mjs <plan|run|promotion-plan|promote>",
  );
}
