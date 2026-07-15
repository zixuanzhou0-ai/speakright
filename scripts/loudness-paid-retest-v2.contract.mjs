import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertAnonymousRetestWavFilename,
  assertPromotionV2Authorization,
  buildBlindRetestProviderRequest,
  buildLoudnessPromotionV2Plan,
  buildLoudnessRetestV2Plan,
  buildPromotionTransactionEntries,
  isPromotionPassingOutcome,
  isRetestV2CheckpointReusable,
  LOUDNESS_RETEST_V2_EXPECTED_COUNT,
  LOUDNESS_RETEST_V2_POLICY_VERSION,
  LOUDNESS_RETEST_V2_PROVIDERS,
  LOUDNESS_RETEST_V2_VERSION,
  SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
  SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
  verifyLoudnessRetestV2Plan,
} from "./lib/loudness-paid-retest-v2-core.mjs";
import { digestJson } from "./lib/promoted-audio-loudness-v2-core.mjs";

const root =
  "outputs/phoneme-word-auditory-audit-2026-07-14/loudness-normalization-v2/" +
  SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA.slice(0, 16);
const sourcePlan = JSON.parse(
  readFileSync(`${root}/immutable-plan.json`, "utf8"),
);
const generationReport = JSON.parse(
  readFileSync(`${root}/generation-report.json`, "utf8"),
);
const cliSource = readFileSync("scripts/loudness-paid-retest-v2.mjs", "utf8");
const whisperSource = readFileSync(
  "scripts/loudness_whisper_blind_v2.py",
  "utf8",
);

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function rejects(callback, pattern, message) {
  assert.throws(callback, pattern, message);
  assertions += 1;
}

function clone(value) {
  return structuredClone(value);
}

function buildReviewedPlan() {
  return buildLoudnessRetestV2Plan({
    sourcePlan,
    generationReport,
    sourcePlanSha256: SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
    generationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
  });
}

function currentStates(plan) {
  return {
    candidateStates: plan.candidates.map((candidate) => ({
      assetId: candidate.assetId,
      sha256: candidate.blindInput.sha256,
    })),
    sourceStates: plan.candidates.map((candidate) => ({
      assetId: candidate.assetId,
      desktopSha256: candidate.formalSource.sha256,
      browserSha256: candidate.formalSource.sha256,
    })),
  };
}

function checkpoint(candidate, planSha256, provider, outcome = "exact") {
  return {
    version: LOUDNESS_RETEST_V2_VERSION,
    policyVersion: LOUDNESS_RETEST_V2_POLICY_VERSION,
    provider,
    assetId: candidate.assetId,
    planSha256,
    candidateSha256: candidate.blindInput.sha256,
    languageId: candidate.languageId,
    heardText: candidate.comparisonAfterBlindResponse.expectedText,
    outcome,
    requestPolicy: {
      anonymousWavFilename: true,
      expectedTextIncluded: false,
      ipaIncluded: false,
      targetUnitIncluded: false,
    },
  };
}

const plan = buildReviewedPlan();
check(plan.candidateCount === 28, "safe v2 retest must contain 28 candidates");
check(
  plan.candidateCount === LOUDNESS_RETEST_V2_EXPECTED_COUNT,
  "candidate count must match the shared invariant",
);
check(
  plan.totalProviderRequestCount === 84,
  "three listeners require 84 requests",
);
check(
  plan.paidProviderRequestCount === 56,
  "Azure and Scribe require 56 paid requests",
);
check(
  plan.paidBillableAudioSeconds ===
    Number((plan.totalCandidateDurationSeconds * 2).toFixed(6)),
  "paid duration must count Azure and Scribe exactly once each",
);
check(
  verifyLoudnessRetestV2Plan(plan) === plan.planSha256,
  "immutable retest plan digest must verify",
);
check(
  plan.candidates.every(
    (candidate) =>
      candidate.blindInput.path.includes("/loudness-normalization-v2/") &&
      candidate.blindInput.path.endsWith(".delivery-candidate.mp3") &&
      !candidate.blindInput.path.includes("loudness-normalization-candidates"),
  ),
  "all blind inputs must come from the safe v2 delivery tree",
);

rejects(
  () =>
    buildLoudnessRetestV2Plan({
      sourcePlan,
      generationReport,
      sourcePlanSha256: "a".repeat(64),
      generationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
    }),
  /pinned to the reviewed safe v2 source plan/u,
  "unreviewed source plans must be rejected",
);

const staleReport = clone(generationReport);
staleReport.results[0].validation.passed = false;
rejects(
  () =>
    buildLoudnessRetestV2Plan({
      sourcePlan,
      generationReport: staleReport,
      sourcePlanSha256: SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
      generationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
    }),
  /digest mismatch/u,
  "mutated generation reports must fail their immutable digest",
);

const badPathReport = clone(generationReport);
badPathReport.results[0].artifacts.deliveryCandidateMp3.path =
  "outputs/phoneme-word-auditory-audit-2026-07-14/loudness-normalization-candidates/legacy.mp3";
delete badPathReport.reportSha256;
rejects(
  () =>
    buildLoudnessRetestV2Plan({
      sourcePlan,
      generationReport: {
        ...badPathReport,
        reportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
      },
      sourcePlanSha256: SAFE_LOUDNESS_V2_SOURCE_PLAN_SHA,
      generationReportSha256: SAFE_LOUDNESS_V2_GENERATION_REPORT_SHA,
    }),
  /digest mismatch|pinned/u,
  "legacy q2 candidate trees cannot be substituted for reviewed v2 evidence",
);

for (const provider of LOUDNESS_RETEST_V2_PROVIDERS) {
  const request = buildBlindRetestProviderRequest({
    provider,
    languageId: "fr-FR",
    anonymousWavPath: "6ba7b810-9dad-4b86-8fd0-143971df7cf8.wav",
  });
  const serialized = JSON.stringify(request);
  check(
    !serialized.includes("bonjour"),
    `${provider} blind payload must hide text`,
  );
  check(
    !serialized.includes("expected"),
    `${provider} blind payload must hide expected fields`,
  );
  check(!serialized.includes("ipa"), `${provider} blind payload must hide IPA`);
}
check(
  assertAnonymousRetestWavFilename(
    "6ba7b810-9dad-4b86-8fd0-143971df7cf8.wav",
  ) === "6ba7b810-9dad-4b86-8fd0-143971df7cf8.wav",
  "UUID-v4 WAV names must pass",
);
rejects(
  () => assertAnonymousRetestWavFilename("bonjour.wav"),
  /random UUID v4/u,
  "answer-bearing WAV filenames must be rejected",
);

const firstCandidate = plan.candidates[0];
const reusable = checkpoint(firstCandidate, plan.planSha256, "azure-stt");
check(
  isRetestV2CheckpointReusable({
    row: reusable,
    provider: "azure-stt",
    planSha256: plan.planSha256,
    candidateSha256: firstCandidate.blindInput.sha256,
    languageId: firstCandidate.languageId,
  }),
  "checkpoint with exact evidence binding must be reusable",
);
check(
  !isRetestV2CheckpointReusable({
    row: reusable,
    provider: "azure-stt",
    planSha256: "b".repeat(64),
    candidateSha256: firstCandidate.blindInput.sha256,
    languageId: firstCandidate.languageId,
  }),
  "checkpoint from another immutable plan must be stale",
);
check(isPromotionPassingOutcome("exact"), "exact must pass promotion");
check(
  isPromotionPassingOutcome("accepted-homophone"),
  "accepted homophone must pass promotion",
);
check(
  !isPromotionPassingOutcome("orthographic-variant"),
  "unreviewed orthographic variants must not pass promotion",
);
check(
  !isPromotionPassingOutcome("different-word"),
  "different words must not pass promotion",
);

const states = currentStates(plan);
const emptyPromotion = buildLoudnessPromotionV2Plan({
  retestPlan: plan,
  checkpoints: [],
  ...states,
});
check(
  emptyPromotion.eligibleCount === 0,
  "missing listeners must block all candidates",
);
check(
  emptyPromotion.blockedCount === 28,
  "all 28 candidates must remain blocked",
);
check(
  emptyPromotion.rows.every((row) => row.reasons.length === 3),
  "each candidate must report all three missing listeners",
);

const allPassingCheckpoints = plan.candidates.flatMap((candidate, index) =>
  LOUDNESS_RETEST_V2_PROVIDERS.map((provider) =>
    checkpoint(
      candidate,
      plan.planSha256,
      provider,
      index === 0 && provider === "elevenlabs-scribe-v2"
        ? "accepted-homophone"
        : "exact",
    ),
  ),
);
const passingPromotion = buildLoudnessPromotionV2Plan({
  retestPlan: plan,
  checkpoints: allPassingCheckpoints,
  ...states,
});
check(
  passingPromotion.eligibleCount === 28,
  "three passing listeners must admit all 28",
);
check(
  passingPromotion.blockedCount === 0,
  "no passing candidate may remain blocked",
);

const nonExactCheckpoints = clone(allPassingCheckpoints);
nonExactCheckpoints[0].outcome = "orthographic-variant";
const nonExactPromotion = buildLoudnessPromotionV2Plan({
  retestPlan: plan,
  checkpoints: nonExactCheckpoints,
  ...states,
});
check(
  nonExactPromotion.eligibleCount === 27,
  "one non-exact listener must block one asset",
);
check(
  nonExactPromotion.rows.some((row) =>
    row.reasons.includes("whisper-large-v3-outcome-not-exact-or-homophone"),
  ),
  "blocked listener outcome must be explicit",
);

const staleCandidateStates = clone(states.candidateStates);
staleCandidateStates[0].sha256 = "c".repeat(64);
const staleCandidatePromotion = buildLoudnessPromotionV2Plan({
  retestPlan: plan,
  checkpoints: allPassingCheckpoints,
  candidateStates: staleCandidateStates,
  sourceStates: states.sourceStates,
});
check(
  staleCandidatePromotion.rows[0].reasons.includes("candidate-sha-changed"),
  "changed candidate bytes must block promotion",
);

const staleSourceStates = clone(states.sourceStates);
staleSourceStates[0].browserSha256 = "d".repeat(64);
const staleSourcePromotion = buildLoudnessPromotionV2Plan({
  retestPlan: plan,
  checkpoints: allPassingCheckpoints,
  candidateStates: states.candidateStates,
  sourceStates: staleSourceStates,
});
check(
  staleSourcePromotion.rows[0].reasons.includes(
    "formal-source-sha-or-platform-parity-changed",
  ),
  "changed formal source or platform drift must block promotion",
);

const badSignalPlan = clone(plan);
badSignalPlan.candidates[0].signalGate.status = "failed";
const badSignalCore = { ...badSignalPlan };
delete badSignalCore.planSha256;
badSignalPlan.planSha256 = digestJson(badSignalCore);
const badSignalPromotion = buildLoudnessPromotionV2Plan({
  retestPlan: badSignalPlan,
  checkpoints: allPassingCheckpoints.map((row) => ({
    ...row,
    planSha256: badSignalPlan.planSha256,
  })),
  ...states,
});
check(
  badSignalPromotion.rows[0].reasons.includes("safe-v2-signal-gate-not-passed"),
  "failed safe v2 signal evidence must block promotion",
);

rejects(
  () =>
    assertPromotionV2Authorization({
      confirmed: false,
      reviewedRetestPlanSha256: plan.planSha256,
      currentRetestPlanSha256: plan.planSha256,
      reviewedPromotionPlanSha256: passingPromotion.promotionPlanSha256,
      currentPromotionPlanSha256: passingPromotion.promotionPlanSha256,
    }),
  /requires --confirm/u,
  "promotion must be dry-run by default",
);
rejects(
  () =>
    assertPromotionV2Authorization({
      confirmed: true,
      reviewedRetestPlanSha256: "e".repeat(64),
      currentRetestPlanSha256: plan.planSha256,
      reviewedPromotionPlanSha256: passingPromotion.promotionPlanSha256,
      currentPromotionPlanSha256: passingPromotion.promotionPlanSha256,
    }),
  /exact reviewed retest/u,
  "promotion requires the exact reviewed retest plan SHA",
);
rejects(
  () =>
    assertPromotionV2Authorization({
      confirmed: true,
      reviewedRetestPlanSha256: plan.planSha256,
      currentRetestPlanSha256: plan.planSha256,
      reviewedPromotionPlanSha256: "f".repeat(64),
      currentPromotionPlanSha256: passingPromotion.promotionPlanSha256,
    }),
  /exact reviewed --promotion-plan-sha/u,
  "promotion requires the exact reviewed promotion plan SHA",
);

const transactionId = "6ba7b810-9dad-4b86-8fd0-143971df7cf8";
const entries = buildPromotionTransactionEntries(
  passingPromotion,
  transactionId,
);
check(
  entries.length === 28,
  "promotion transaction must remain all-or-nothing",
);
check(
  entries.every(
    (entry) =>
      entry.desktop.temporaryPath.includes(transactionId) &&
      entry.desktop.backupPath.includes(transactionId) &&
      entry.browser.temporaryPath.includes(transactionId) &&
      entry.browser.backupPath.includes(transactionId),
  ),
  "all transaction-owned paths must carry the unique transaction ID",
);
rejects(
  () => buildPromotionTransactionEntries(emptyPromotion, transactionId),
  /All 28 candidates must be eligible/u,
  "partial promotion transactions are forbidden",
);

check(
  !cliSource.includes("loudness-normalization-candidates"),
  "v2 CLI must not reference the lossy q2 tree",
);
check(
  !cliSource.includes("fetch("),
  "v2 planning CLI must not execute network fetches",
);
check(
  !cliSource.includes("https://"),
  "v2 planning CLI must not embed network endpoints",
);
check(
  !cliSource.includes("rmSync"),
  "v2 CLI must not perform recursive removal",
);
check(
  !/^import .*elevenlabs-audio-clients/mu.test(cliSource),
  "paid clients must not be imported during plan startup",
);
check(
  cliSource.includes(
    'else if (parsed.command === "run") await runRetestCommand(parsed);',
  ),
  "run command must be routed explicitly",
);
check(
  cliSource.includes('if (!parsed.flags.has("--confirm"))'),
  "run must remain dry-run without explicit confirmation",
);
check(
  cliSource.includes('parsed.valueFor("--plan-sha") !== planSha256'),
  "run must require the exact immutable plan SHA",
);
check(
  whisperSource.includes("initial_prompt=None") &&
    whisperSource.includes("condition_on_previous_text=False"),
  "Whisper inference must explicitly disable prompts and prior-text conditioning",
);
check(
  !whisperSource.includes('asset.get("text")') &&
    !whisperSource.includes('asset["text"]'),
  "Whisper inference must never read inventory.text",
);
check(
  whisperSource.includes("FORBIDDEN_MANIFEST_KEYS"),
  "Whisper manifest must reject answer-bearing fields",
);
check(
  cliSource.includes("anonymousWavSha256: sha256File(wavPath)"),
  "Whisper manifest must bind the rendered anonymous WAV bytes",
);
check(
  whisperSource.includes('"anonymousWavSha256"') &&
    whisperSource.includes(
      'sha256_file(audio_path) != asset["anonymousWavSha256"]',
    ),
  "Whisper must require and verify the anonymous WAV SHA",
);
check(
  !whisperSource.includes(
    'sha256_file(audio_path) != asset["candidateSha256"]',
  ),
  "candidate SHA must remain a candidate binding, not a WAV digest",
);
check(
  cliSource.includes("writeJournalSnapshot"),
  "promotion journaling must use append-only immutable snapshots",
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      assertions,
      candidateCount: plan.candidateCount,
      totalProviderRequestCount: plan.totalProviderRequestCount,
      paidProviderRequestCount: plan.paidProviderRequestCount,
      retestPlanSha256: plan.planSha256,
    },
    null,
    2,
  ),
);
