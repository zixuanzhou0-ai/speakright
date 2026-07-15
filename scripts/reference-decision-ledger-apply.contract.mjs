#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  assertReferenceLedgerApplyAuthorization,
  buildReferenceLedgerApplication,
  sha256,
  stableStringify,
} from "./lib/reference-decision-ledger-apply-core.mjs";

let assertions = 0;
function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function throws(worker, expected, message) {
  assertions += 1;
  assert.throws(worker, expected, message);
}

function source(publisherId, independenceGroup) {
  return {
    name: publisherId,
    publisherId,
    independenceGroup,
    revisionOrDate: "2026-07-15",
    value: "/test/",
  };
}

function decision(text, canonicalIpa = "test") {
  return {
    languageId: "en-US",
    text,
    canonicalIpa,
    acceptedVariants: [],
    homophones: [],
    primaryStress: 0,
    syllableCount: 1,
    status: "two-source-confirmed",
    sources: [source("cmudict", "cmudict"), source("kaikki", "wiktionary")],
    notes: "Reviewed decision fixture.",
  };
}

function makePlan(decisions) {
  const deterministic = {
    version: 1,
    languageId: "en-US",
    policyVersion: "test-policy",
    inputDigests: { fixture: "a".repeat(64) },
    strictQueueAssetCount: decisions.length,
    strictQueueWordCount: decisions.length,
    confirmedAssetCount: decisions.length,
    confirmedWordCount: decisions.length,
    blockedAssetCount: 0,
    blockedWordCount: 0,
    confirmedAssetIds: decisions.map((entry) => `asset-${entry.text}`),
    blockedAssetIds: [],
    decisions,
    blocked: [],
    auditEntries: decisions.map((entry) => ({
      languageId: entry.languageId,
      text: entry.text,
      outcome: "two-source-confirmed",
    })),
  };
  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
    paidCallsMade: 0,
  };
}

function makePatch(plan) {
  return {
    version: 1,
    revision: `english-reference-decisions-${plan.planSha256.slice(0, 12)}`,
    warning: "Generated patch fixture.",
    entries: plan.decisions,
  };
}

function bindPlan(plan, expectedLedgerSha256, inputManifestSha256) {
  const {
    planSha256: _planSha256,
    networkRequestsMade: _networkRequestsMade,
    paidCallsMade: _paidCallsMade,
    ...base
  } = plan;
  const deterministic = {
    ...base,
    sourceProposalSha256: "f".repeat(64),
    expectedLedgerSha256,
    inputManifestSha256,
  };
  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
    paidCallsMade: 0,
  };
}

function makeBoundPatch(plan) {
  return {
    ...makePatch(plan),
    sourceProposalSha256: plan.sourceProposalSha256,
    expectedLedgerSha256: plan.expectedLedgerSha256,
    inputManifestSha256: plan.inputManifestSha256,
  };
}

const decisions = [decision("alpha", "ælfə"), decision("beta", "beɪtə")];
const plan = makePlan(decisions);
const patch = makePatch(plan);
const ledger = {
  version: 1,
  revision: "reference-ledger-empty",
  warning: "Only confirmed two-source decisions belong here.",
  entries: [],
};
const digests = {
  planFileSha256: "1".repeat(64),
  patchFileSha256: "2".repeat(64),
  ledgerFileSha256: "3".repeat(64),
};
const application = buildReferenceLedgerApplication({
  ledger,
  patch,
  plan,
  fileDigests: digests,
});

equal(application.planSha256, plan.planSha256);
equal(application.existingEntryCount, 0);
equal(application.patchEntryCount, 2);
equal(application.addedEntryCount, 2);
equal(application.unchangedEntryCount, 0);
equal(application.mergedEntryCount, 2);
equal(
  application.mergedLedger.entries.map((entry) => entry.text),
  ["alpha", "beta"],
);
equal(application.networkRequestsMade, 0);
equal(application.paidCallsMade, 0);
check(/^[0-9a-f]{64}$/u.test(application.applicationSha256));
equal(
  buildReferenceLedgerApplication({ ledger, patch, plan, fileDigests: digests })
    .applicationSha256,
  application.applicationSha256,
);

const inputManifestSha256 = "4".repeat(64);
const boundPlan = bindPlan(
  makePlan([decision("gamma", "gamə")]),
  digests.ledgerFileSha256,
  inputManifestSha256,
);
const boundPatch = makeBoundPatch(boundPlan);
const boundApplication = buildReferenceLedgerApplication({
  ledger,
  patch: boundPatch,
  plan: boundPlan,
  fileDigests: {
    ...digests,
    inputManifestFileSha256: inputManifestSha256,
  },
});
equal(boundApplication.addedEntryCount, 1);
equal(boundApplication.mergedEntryCount, 1);
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: boundPatch,
      plan: boundPlan,
      fileDigests: {
        ...digests,
        ledgerFileSha256: "5".repeat(64),
        inputManifestFileSha256: inputManifestSha256,
      },
    }),
  /expected ledger SHA-256 does not match current input/u,
);
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: boundPatch,
      plan: boundPlan,
      fileDigests: {
        ...digests,
        inputManifestFileSha256: "6".repeat(64),
      },
    }),
  /input manifest SHA-256 does not match current input/u,
);
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: boundPatch,
      plan: boundPlan,
      fileDigests: digests,
    }),
  /input manifest SHA-256 does not match current input/u,
);
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: { ...boundPatch, expectedLedgerSha256: "7".repeat(64) },
      plan: boundPlan,
      fileDigests: {
        ...digests,
        inputManifestFileSha256: inputManifestSha256,
      },
    }),
  /expectedLedgerSha256 is not bound to the decision plan/u,
);

const idempotent = buildReferenceLedgerApplication({
  ledger: { ...ledger, entries: [decisions[0]] },
  patch: makePatch(makePlan([decisions[0]])),
  plan: makePlan([decisions[0]]),
});
equal(idempotent.addedEntryCount, 0);
equal(idempotent.unchangedEntryCount, 1);

throws(
  () =>
    buildReferenceLedgerApplication({
      ledger: { ...ledger, entries: [decision("alpha", "different")] },
      patch: makePatch(makePlan([decisions[0]])),
      plan: makePlan([decisions[0]]),
    }),
  /conflicting decision/u,
);

const tamperedPlan = { ...plan, confirmedWordCount: 99 };
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch,
      plan: tamperedPlan,
    }),
  /does not match its immutable payload/u,
);

throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: { ...patch, entries: [decisions[0]] },
      plan,
    }),
  /entry count does not match/u,
);

const dependentDecision = {
  ...decisions[0],
  sources: [source("one", "same"), source("two", "same")],
};
const dependentPlan = makePlan([dependentDecision]);
throws(
  () =>
    buildReferenceLedgerApplication({
      ledger,
      patch: makePatch(dependentPlan),
      plan: dependentPlan,
    }),
  /two independent source groups/u,
);

equal(
  assertReferenceLedgerApplyAuthorization({ command: "plan", confirm: false }),
  "plan",
);
throws(
  () =>
    assertReferenceLedgerApplyAuthorization({
      command: "plan",
      confirm: true,
    }),
  /invalid for the read-only plan/u,
);
throws(
  () =>
    assertReferenceLedgerApplyAuthorization({
      command: "apply",
      confirm: false,
    }),
  /requires --confirm/u,
);
throws(
  () =>
    assertReferenceLedgerApplyAuthorization({
      command: "apply",
      confirm: true,
      expectedPlanSha256: "0".repeat(64),
      expectedPatchSha256: digests.patchFileSha256,
      expectedLedgerSha256: digests.ledgerFileSha256,
      actualPlanSha256: plan.planSha256,
      actualPatchSha256: digests.patchFileSha256,
      actualLedgerSha256: digests.ledgerFileSha256,
    }),
  /--plan-sha does not match/u,
);
equal(
  assertReferenceLedgerApplyAuthorization({
    command: "apply",
    confirm: true,
    expectedPlanSha256: plan.planSha256,
    expectedPatchSha256: digests.patchFileSha256,
    expectedLedgerSha256: digests.ledgerFileSha256,
    actualPlanSha256: plan.planSha256,
    actualPatchSha256: digests.patchFileSha256,
    actualLedgerSha256: digests.ledgerFileSha256,
  }),
  "apply",
);

console.log(
  `Reference decision ledger apply contract passed (${assertions} assertions).`,
);
