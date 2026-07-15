import path from "node:path";
import {
  assertFormalAudioPaths,
  digestJson,
  finiteNumber,
  normalizeRelativePath,
  PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT,
} from "./promoted-audio-loudness-v2-core.mjs";

export const SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA =
  "4382cb361a1a3b204562852700b7246fe0d04c949bb9c7337286a53893349d87";
export const SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA =
  "e7e00d22315bb7728834123d2706692650f435c15cf5ea14cfca8cfc635ca177";
export const LOUDNESS_RETEST_V2_VERSION = 2;
export const LOUDNESS_RETEST_V2_POLICY_VERSION =
  "safe-loudness-v2-whisper-azure-scribe-blind-v2";
export const LOUDNESS_PROMOTION_V2_POLICY_VERSION =
  "safe-loudness-v2-three-listener-promotion-v1";
export const LOUDNESS_RETEST_V2_EXPECTED_COUNT =
  PROMOTED_LOUDNESS_V2_EXPECTED_ASSET_COUNT;
export const LOUDNESS_RETEST_V2_CONCURRENCY = 2;
export const LOUDNESS_RETEST_V2_MAX_ATTEMPTS = 4;

export const LOUDNESS_RETEST_V2_PROVIDERS = Object.freeze([
  "whisper-large-v3",
  "azure-stt",
  "elevenlabs-scribe-v2",
]);

const PROMOTION_PASS_OUTCOMES = new Set(["exact", "accepted-homophone"]);
const SAFE_V2_OUTPUT_PREFIX =
  "outputs/phoneme-word-auditory-audit-2026-07-14/loudness-normalization-v2/";
const CHECKPOINT_FILES = Object.freeze({
  "whisper-large-v3": "checkpoints/whisper-large-v3.jsonl",
  "azure-stt": "checkpoints/azure-stt.jsonl",
  "elevenlabs-scribe-v2": "checkpoints/elevenlabs-scribe-v2.jsonl",
});

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertSha(value, label) {
  const sha = assertString(value, label);
  if (!/^[a-f0-9]{64}$/u.test(sha)) {
    throw new Error(`${label} must be a SHA-256 digest`);
  }
  return sha;
}

function assertCount(values, label) {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  if (values.length !== LOUDNESS_RETEST_V2_EXPECTED_COUNT) {
    throw new Error(
      `${label}: expected ${LOUDNESS_RETEST_V2_EXPECTED_COUNT}, received ${values.length}`,
    );
  }
  return values;
}

function uniqueMap(values, selector, label) {
  const result = new Map();
  for (const value of values) {
    const key = assertString(selector(value), `${label} key`);
    if (result.has(key)) throw new Error(`${label}: duplicate key ${key}`);
    result.set(key, value);
  }
  return result;
}

function assertSafeV2CandidatePath(value, sourcePlanSha, label) {
  const candidatePath = normalizeRelativePath(value, label);
  const requiredPrefix = `${SAFE_V2_OUTPUT_PREFIX}${sourcePlanSha.slice(0, 16)}/assets/`;
  if (
    !candidatePath.startsWith(requiredPrefix) ||
    !candidatePath.endsWith(".delivery-candidate.mp3")
  ) {
    throw new Error(
      `${label} is not a delivery candidate from the safe v2 plan`,
    );
  }
  if (candidatePath.includes("loudness-normalization-candidates")) {
    throw new Error(
      `${label} references the forbidden lossy v1 candidate tree`,
    );
  }
  return candidatePath;
}

function assertGenerationReport(generationReport, sourcePlanSha) {
  if (generationReport?.version !== 2) {
    throw new Error("Unsupported safe v2 generation report version");
  }
  if (generationReport.planSha256 !== sourcePlanSha) {
    throw new Error("Generation report is bound to a different source plan");
  }
  if (
    generationReport.assetCount !== LOUDNESS_RETEST_V2_EXPECTED_COUNT ||
    generationReport.passedCount !== LOUDNESS_RETEST_V2_EXPECTED_COUNT ||
    generationReport.failedCount !== 0
  ) {
    throw new Error(
      "All 28 safe v2 candidates must pass before retest planning",
    );
  }
  if (
    generationReport.formalAssetsModified !== false ||
    generationReport.networkCallsPerformed !== false
  ) {
    throw new Error(
      "Unexpected mutation/network state in safe v2 generation report",
    );
  }
  return assertCount(generationReport.results, "generationReport.results");
}

export function computeGenerationReportSha(generationReport) {
  const { reportSha256, ...reportCore } = generationReport ?? {};
  const actual = digestJson(reportCore);
  if (reportSha256 !== actual) {
    throw new Error("Safe v2 generation report digest mismatch");
  }
  return actual;
}

export function buildLoudnessRetestV2Plan({
  sourcePlan,
  generationReport,
  sourcePlanSha256,
  generationReportSha256,
}) {
  if (sourcePlanSha256 !== SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA) {
    throw new Error(
      "Retest planning is pinned to the reviewed safe v2 source plan",
    );
  }
  if (
    generationReportSha256 !== SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA ||
    computeGenerationReportSha(generationReport) !== generationReportSha256
  ) {
    throw new Error(
      "Retest planning is pinned to the reviewed safe v2 generation report",
    );
  }
  if (
    sourcePlan?.planSha256 !== sourcePlanSha256 ||
    sourcePlan.assetCount !== LOUDNESS_RETEST_V2_EXPECTED_COUNT
  ) {
    throw new Error(
      "Safe v2 source plan is incomplete or has the wrong digest",
    );
  }
  const sourceById = uniqueMap(
    assertCount(sourcePlan.assets, "sourcePlan.assets"),
    (asset) => asset.assetId,
    "source plan assets",
  );
  const generationRows = assertGenerationReport(
    generationReport,
    sourcePlanSha256,
  );
  const candidates = generationRows
    .map((row) => {
      const source = sourceById.get(row.assetId);
      if (!source)
        throw new Error(`${row.assetId}: source plan row is missing`);
      if (
        row.status !== "candidate-passed" ||
        row.validation?.passed !== true ||
        (row.validation.reasons?.length ?? 0) !== 0
      ) {
        throw new Error(`${row.assetId}: signal/quality gate did not pass`);
      }
      if (row.sourceSha256 !== source.source.sha256) {
        throw new Error(`${row.assetId}: formal source SHA evidence mismatch`);
      }
      const candidate = row.artifacts?.deliveryCandidateMp3;
      const candidatePath = assertSafeV2CandidatePath(
        candidate?.path,
        sourcePlanSha256,
        `${row.assetId}.deliveryCandidateMp3.path`,
      );
      const candidateSha256 = assertSha(
        candidate?.sha256,
        `${row.assetId}.deliveryCandidateMp3.sha256`,
      );
      const sourcePaths = assertFormalAudioPaths(source.source);
      const durationSeconds = finiteNumber(
        row.analyses?.delivery?.probe?.durationSeconds,
        `${row.assetId}.durationSeconds`,
      );
      return {
        assetId: row.assetId,
        candidateAssetId: `${row.assetId}-safe-loudness-v2`,
        languageId: row.languageId,
        blindInput: {
          path: candidatePath,
          sha256: candidateSha256,
          durationSeconds,
        },
        formalSource: {
          ...sourcePaths,
          sha256: source.source.sha256,
        },
        signalGate: {
          policyVersion: sourcePlan.policyVersion,
          generationReportSha256,
          status: "passed",
          validationReasonCount: 0,
        },
        requiredProviders: [...LOUDNESS_RETEST_V2_PROVIDERS],
        comparisonAfterBlindResponse: {
          expectedText: row.text,
          acceptedOutcomes: [...PROMOTION_PASS_OUTCOMES],
        },
      };
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
  if (new Set(candidates.map((row) => row.blindInput.sha256)).size !== 28) {
    throw new Error(
      "Safe v2 retest candidates contain duplicate audio SHA values",
    );
  }
  const totalDurationSeconds = Number(
    candidates
      .reduce(
        (total, candidate) => total + candidate.blindInput.durationSeconds,
        0,
      )
      .toFixed(6),
  );
  const planCore = {
    version: LOUDNESS_RETEST_V2_VERSION,
    policyVersion: LOUDNESS_RETEST_V2_POLICY_VERSION,
    immutable: true,
    candidateOnly: true,
    formalAssetsModified: false,
    networkCallsPerformed: false,
    sourcePlanSha256,
    sourceGenerationReportSha256: generationReportSha256,
    candidateCount: candidates.length,
    totalCandidateDurationSeconds: totalDurationSeconds,
    providerPlan: {
      whisperLargeV3: {
        provider: "whisper-large-v3",
        requestCount: candidates.length,
        totalDurationSeconds,
        localOnly: true,
        modelPath: "D:/AI/models/whisper/faster-whisper-large-v3",
        promptIncluded: false,
        expectedTextIncluded: false,
      },
      azureStt: {
        provider: "azure-stt",
        requestCount: candidates.length,
        totalDurationSeconds,
        referenceTextIncluded: false,
        pronunciationAssessmentEnabled: false,
      },
      elevenLabsScribeV2: {
        provider: "elevenlabs-scribe-v2",
        requestCount: candidates.length,
        totalDurationSeconds,
        expectedTextIncluded: false,
        keytermsIncluded: false,
        modelId: "scribe_v2",
      },
    },
    totalProviderRequestCount: candidates.length * 3,
    paidProviderRequestCount: candidates.length * 2,
    paidBillableAudioSeconds: Number((totalDurationSeconds * 2).toFixed(6)),
    checkpoints: CHECKPOINT_FILES,
    candidates,
  };
  return { ...planCore, planSha256: digestJson(planCore) };
}

export function verifyLoudnessRetestV2Plan(document) {
  const { planSha256, ...planCore } = document ?? {};
  assertSha(planSha256, "retest plan SHA");
  if (digestJson(planCore) !== planSha256) {
    throw new Error("Immutable retest plan digest mismatch");
  }
  if (
    planCore.version !== LOUDNESS_RETEST_V2_VERSION ||
    planCore.policyVersion !== LOUDNESS_RETEST_V2_POLICY_VERSION
  ) {
    throw new Error("Unsupported immutable retest plan policy");
  }
  if (
    planCore.sourcePlanSha256 !== SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA ||
    planCore.sourceGenerationReportSha256 !==
      SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA
  ) {
    throw new Error(
      "Retest plan is not bound to the reviewed safe v2 artifacts",
    );
  }
  assertCount(planCore.candidates, "retestPlan.candidates");
  return planSha256;
}

export function buildBlindRetestProviderRequest({
  provider,
  languageId,
  anonymousWavPath,
}) {
  if (!LOUDNESS_RETEST_V2_PROVIDERS.includes(provider)) {
    throw new Error(`Unknown retest provider: ${provider}`);
  }
  assertString(languageId, "languageId");
  const wavPath = assertString(anonymousWavPath, "anonymousWavPath");
  if (path.extname(wavPath).toLocaleLowerCase("en-US") !== ".wav") {
    throw new Error("Blind provider input must be an anonymous WAV file");
  }
  if (provider === "whisper-large-v3") {
    return { languageCode: languageId.split("-")[0], audioPath: wavPath };
  }
  if (provider === "azure-stt") return { languageId, wavPath };
  return { languageCode: languageId.split("-")[0], audioPath: wavPath };
}

export function assertAnonymousRetestWavFilename(filePath) {
  const filename = path.basename(filePath);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.wav$/iu.test(
      filename,
    )
  ) {
    throw new Error("Blind WAV filename must be a random UUID v4");
  }
  return filename;
}

export function isRetestV2CheckpointReusable({
  row,
  provider,
  planSha256,
  candidateSha256,
  languageId,
}) {
  return (
    row?.version === LOUDNESS_RETEST_V2_VERSION &&
    row?.policyVersion === LOUDNESS_RETEST_V2_POLICY_VERSION &&
    row?.provider === provider &&
    row?.planSha256 === planSha256 &&
    row?.candidateSha256 === candidateSha256 &&
    row?.languageId === languageId &&
    typeof row?.heardText === "string" &&
    typeof row?.outcome === "string" &&
    row?.requestPolicy?.anonymousWavFilename === true &&
    row?.requestPolicy?.expectedTextIncluded === false &&
    row?.requestPolicy?.ipaIncluded === false &&
    row?.requestPolicy?.targetUnitIncluded === false
  );
}

export function isPromotionPassingOutcome(outcome) {
  return PROMOTION_PASS_OUTCOMES.has(outcome);
}

export function buildLoudnessPromotionV2Plan({
  retestPlan,
  checkpoints,
  candidateStates,
  sourceStates,
}) {
  const retestPlanSha256 = verifyLoudnessRetestV2Plan(retestPlan);
  const candidates = assertCount(
    retestPlan.candidates,
    "retestPlan.candidates",
  );
  const candidateStateById = uniqueMap(
    assertCount(candidateStates, "candidateStates"),
    (row) => row.assetId,
    "candidate states",
  );
  const sourceStateById = uniqueMap(
    assertCount(sourceStates, "sourceStates"),
    (row) => row.assetId,
    "source states",
  );
  const checkpointByKey = new Map();
  for (const row of checkpoints) {
    const key = `${row.provider}\0${row.assetId}`;
    if (checkpointByKey.has(key)) {
      throw new Error(
        `Duplicate checkpoint for ${row.provider}/${row.assetId}`,
      );
    }
    checkpointByKey.set(key, row);
  }
  const rows = candidates.map((candidate) => {
    const reasons = [];
    const candidateState = candidateStateById.get(candidate.assetId);
    const sourceState = sourceStateById.get(candidate.assetId);
    if (
      !candidateState ||
      candidateState.sha256 !== candidate.blindInput.sha256
    ) {
      reasons.push("candidate-sha-changed");
    }
    if (
      !sourceState ||
      sourceState.desktopSha256 !== candidate.formalSource.sha256 ||
      sourceState.browserSha256 !== candidate.formalSource.sha256 ||
      sourceState.desktopSha256 !== sourceState.browserSha256
    ) {
      reasons.push("formal-source-sha-or-platform-parity-changed");
    }
    if (
      candidate.signalGate.status !== "passed" ||
      candidate.signalGate.validationReasonCount !== 0 ||
      candidate.signalGate.generationReportSha256 !==
        SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA
    ) {
      reasons.push("safe-v2-signal-gate-not-passed");
    }
    const providerResults = {};
    for (const provider of LOUDNESS_RETEST_V2_PROVIDERS) {
      const checkpoint = checkpointByKey.get(
        `${provider}\0${candidate.assetId}`,
      );
      const reusable = isRetestV2CheckpointReusable({
        row: checkpoint,
        provider,
        planSha256: retestPlanSha256,
        candidateSha256: candidate.blindInput.sha256,
        languageId: candidate.languageId,
      });
      const passing = reusable && isPromotionPassingOutcome(checkpoint.outcome);
      providerResults[provider] = checkpoint
        ? {
            checkpointSha256: digestJson(checkpoint),
            heardText: checkpoint.heardText,
            outcome: checkpoint.outcome,
            reusable,
            passing,
          }
        : null;
      if (!checkpoint) reasons.push(`${provider}-checkpoint-missing`);
      else if (!reusable)
        reasons.push(`${provider}-checkpoint-stale-or-invalid`);
      else if (!passing)
        reasons.push(`${provider}-outcome-not-exact-or-homophone`);
    }
    return {
      assetId: candidate.assetId,
      languageId: candidate.languageId,
      expectedText: candidate.comparisonAfterBlindResponse.expectedText,
      source: candidate.formalSource,
      candidate: candidate.blindInput,
      providerResults,
      eligible: reasons.length === 0,
      reasons,
    };
  });
  const planCore = {
    version: 1,
    policyVersion: LOUDNESS_PROMOTION_V2_POLICY_VERSION,
    immutable: true,
    dryRun: true,
    formalAssetsModified: false,
    retestPlanSha256,
    sourcePlanSha256: SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
    sourceGenerationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
    assetCount: rows.length,
    eligibleCount: rows.filter((row) => row.eligible).length,
    blockedCount: rows.filter((row) => !row.eligible).length,
    rows,
  };
  return { ...planCore, promotionPlanSha256: digestJson(planCore) };
}

export function assertPromotionV2Authorization({
  confirmed,
  reviewedRetestPlanSha256,
  currentRetestPlanSha256,
  reviewedPromotionPlanSha256,
  currentPromotionPlanSha256,
}) {
  if (!confirmed) throw new Error("Formal promotion requires --confirm");
  if (
    reviewedRetestPlanSha256 !== currentRetestPlanSha256 ||
    reviewedRetestPlanSha256 === undefined
  ) {
    throw new Error("The exact reviewed retest --plan-sha is required");
  }
  if (
    reviewedPromotionPlanSha256 !== currentPromotionPlanSha256 ||
    reviewedPromotionPlanSha256 === undefined
  ) {
    throw new Error("The exact reviewed --promotion-plan-sha is required");
  }
  return true;
}

export function buildPromotionTransactionEntries(promotionPlan, transactionId) {
  if (!/^[0-9a-f-]{36}$/iu.test(transactionId ?? "")) {
    throw new Error("Promotion transaction ID must be a UUID");
  }
  if (
    promotionPlan?.eligibleCount !== LOUDNESS_RETEST_V2_EXPECTED_COUNT ||
    promotionPlan?.blockedCount !== 0 ||
    promotionPlan.rows?.some((row) => !row.eligible)
  ) {
    throw new Error(
      "All 28 candidates must be eligible before formal promotion",
    );
  }
  return promotionPlan.rows.map((row) => {
    const formal = assertFormalAudioPaths({
      desktopPath: row.source.desktopPath,
      browserPath: row.source.browserPath,
    });
    const candidatePath = assertSafeV2CandidatePath(
      row.candidate.path,
      SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
      `${row.assetId}.candidatePath`,
    );
    return {
      assetId: row.assetId,
      candidatePath,
      candidateSha256: row.candidate.sha256,
      sourceSha256: row.source.sha256,
      desktop: {
        targetPath: formal.desktopPath,
        temporaryPath: `${formal.desktopPath}.speakright-${transactionId}.partial`,
        backupPath: `${formal.desktopPath}.speakright-${transactionId}.backup`,
      },
      browser: {
        targetPath: formal.browserPath,
        temporaryPath: `${formal.browserPath}.speakright-${transactionId}.partial`,
        backupPath: `${formal.browserPath}.speakright-${transactionId}.backup`,
      },
    };
  });
}
