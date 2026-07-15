#!/usr/bin/env node

import assert from "node:assert/strict";
import { buildFrenchReferenceDecisionProposal } from "./lib/french-reference-decision-proposal-core.mjs";
import {
  buildFrenchReferenceLedgerPlan,
  validateFrenchReferenceProposalBundle,
} from "./lib/french-reference-ledger-plan-core.mjs";
import { buildReferenceLedgerApplication } from "./lib/reference-decision-ledger-apply-core.mjs";

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

const lexiquePlanSha256 = "1".repeat(64);
const lexiqueObservationsSha256 = "2".repeat(64);
const kaikkiPlanSha256 = "3".repeat(64);
const kaikkiObservationsSha256 = "4".repeat(64);
const sourceAssetIds = ["asset-paris-blue", "asset-paris-pink"];
const strictItem = {
  languageId: "fr-FR",
  text: "paris",
  sourceAssetIds,
  currentCanonicalIpas: ["/pa.ʁi/"],
  targetUnits: ["fr-r"],
  phonemePageIds: ["fr-r"],
  relationshipIssues: [],
  relationshipKinds: ["target-example"],
  referenceStatuses: ["needs-native-review"],
};
const proposal = buildFrenchReferenceDecisionProposal({
  strictQueueSourceAssetCount: 2,
  strictItems: [strictItem],
  lexiqueObservations: {
    entries: [
      {
        languageId: "fr-FR",
        text: "paris",
        sourceAssetIds,
        status: "mapped-ipa-observed",
        normalizedIpa: ["paʁi"],
        mappings: [{ sourceRow: 42 }],
        source: {
          publisherId: "lexique",
          independenceGroup: "lexique",
          version: "4.00",
          license: { id: "CC-BY-SA-4.0" },
          sourceUrl: "https://lexique.org/databases/Lexique400/Lexique400.tsv",
          datasetSha256: "5".repeat(64),
        },
      },
    ],
  },
  kaikkiObservations: {
    entries: [
      {
        languageId: "fr-FR",
        text: "paris",
        sourceAssetIds,
        status: "structured-ipa-observed",
        ipas: ["/paˈʁi/"],
        htmlSha256: "6".repeat(64),
        source: {
          publisherId: "wikimedia-wiktionary",
          independenceGroup: "wiktionary",
          sourceUrl:
            "https://kaikki.org/dictionary/French/meaning/p/pa/paris.html",
          dumpDate: "2026-07-06",
          extractedAt: "2026-07-09",
          wiktextractRevision: "e62056b1f7954ce7b17730606bfa7707b63af3cd",
        },
      },
    ],
  },
  inputDigests: {
    basePlanSha256: "7".repeat(64),
    inventoryFileSha256: "8".repeat(64),
    lexiquePlanFileSha256: lexiquePlanSha256,
    lexiqueObservationsFileSha256: lexiqueObservationsSha256,
    kaikkiPlanFileSha256: kaikkiPlanSha256,
    kaikkiObservationsFileSha256: kaikkiObservationsSha256,
  },
});

function ledgerSource(publisherId, independenceGroup) {
  return {
    name: publisherId,
    publisherId,
    independenceGroup,
    revisionOrDate: "2026-07-15",
    value: "test",
  };
}

const englishEntry = {
  languageId: "en-US",
  text: "alpha",
  canonicalIpa: "ælfə",
  acceptedVariants: [],
  homophones: [],
  status: "two-source-confirmed",
  sources: [
    ledgerSource("cmudict", "cmudict"),
    ledgerSource("kaikki", "wiktionary"),
  ],
  notes: "Existing English fixture.",
};
const ledger = {
  version: 1,
  revision: "reference-decisions-existing",
  warning: "Only confirmed two-source decisions belong here.",
  entries: [englishEntry],
};
const sourceShaById = new Map([
  ["asset-paris-blue", "9".repeat(64)],
  ["asset-paris-pink", "a".repeat(64)],
]);
const basePlan = {
  version: 1,
  planSha256: "b".repeat(64),
  sourceAssetCount: 2,
  sourceAssets: sourceAssetIds.map((sourceAssetId) => ({
    sourceAssetId,
    sourceSha256: sourceShaById.get(sourceAssetId),
    languageId: "fr-FR",
    text: "paris",
    canonicalIpa: "/pa.ʁi/",
    targetUnits: ["fr-r"],
    phonemePageIds: ["fr-r"],
    relationshipIssues: [],
  })),
};
const inventory = {
  version: 1,
  assets: sourceAssetIds.map((assetId) => ({
    assetId,
    sha256: sourceShaById.get(assetId),
    languageId: "fr-FR",
    text: "paris",
    currentIpa: "/pa.ʁi/",
    relationshipIssues: [],
    pageRelations: [
      {
        pageId: "fr-r",
        relationshipKind: "target-example",
      },
    ],
  })),
};
const fileDigests = {
  reviewedSummaryFileSha256: "c".repeat(64),
  reviewedProposalsFileSha256: "d".repeat(64),
  reviewedBlockedFileSha256: "e".repeat(64),
  currentBasePlanFileSha256: "f".repeat(64),
  currentInputManifestSha256: "0".repeat(64),
  currentLexiquePlanFileSha256: lexiquePlanSha256,
  currentLexiqueObservationsFileSha256: lexiqueObservationsSha256,
  currentKaikkiPlanFileSha256: kaikkiPlanSha256,
  currentKaikkiObservationsFileSha256: kaikkiObservationsSha256,
  currentLedgerFileSha256: "a1".repeat(32),
};

const result = buildFrenchReferenceLedgerPlan({
  reviewedSummary: proposal.summary,
  reviewedProposals: proposal.proposals,
  reviewedBlocked: proposal.blocked,
  expectedProposalSha256: proposal.summary.proposalSha256,
  currentBasePlan: basePlan,
  currentInventory: inventory,
  currentLedger: ledger,
  fileDigests,
});
equal(result.plan.sourceProposalSha256, proposal.summary.proposalSha256);
equal(result.plan.expectedLedgerSha256, fileDigests.currentLedgerFileSha256);
equal(result.plan.inputManifestSha256, fileDigests.currentInputManifestSha256);
equal(result.plan.proposedWordCount, 1);
equal(result.plan.proposedAssetCount, 2);
equal(result.plan.existingLedgerEntryCount, 1);
equal(result.plan.existingLedgerLanguageCounts, { "en-US": 1 });
equal(result.plan.addedWordCount, 1);
equal(result.plan.expectedMergedEntryCount, 2);
equal(result.patch.entries.length, 1);
equal(result.patch.expectedLedgerSha256, result.plan.expectedLedgerSha256);
equal(result.patch.inputManifestSha256, result.plan.inputManifestSha256);
equal(result.patch.sourceProposalSha256, result.plan.sourceProposalSha256);
equal(
  result.patch.entries[0].sources.map((source) => source.independenceGroup),
  ["lexique", "wiktionary"],
);
equal(result.patch.entries[0].canonicalIpa, "paʁi");
check(/^[0-9a-f]{64}$/u.test(result.plan.planSha256));
check(/^[0-9a-f]{64}$/u.test(result.scopedInputSha256));

const application = buildReferenceLedgerApplication({
  ledger,
  patch: result.patch,
  plan: result.plan,
  fileDigests: {
    planFileSha256: "1a".repeat(32),
    patchFileSha256: "2a".repeat(32),
    ledgerFileSha256: fileDigests.currentLedgerFileSha256,
    inputManifestFileSha256: fileDigests.currentInputManifestSha256,
  },
});
equal(application.existingEntryCount, 1);
equal(application.addedEntryCount, 1);
equal(application.mergedEntryCount, 2);
check(
  application.mergedLedger.entries.some(
    (entry) => entry.languageId === "en-US" && entry.text === "alpha",
  ),
  "existing English decision must be preserved",
);

throws(
  () =>
    validateFrenchReferenceProposalBundle({
      summary: proposal.summary,
      proposals: proposal.proposals,
      blocked: proposal.blocked,
      expectedProposalSha256: "ff".repeat(32),
    }),
  /not bound to the expected SHA/u,
);
const tamperedProposals = structuredClone(proposal.proposals);
tamperedProposals.wordEntries[0].normalizedIpa = "pari";
throws(
  () =>
    validateFrenchReferenceProposalBundle({
      summary: proposal.summary,
      proposals: tamperedProposals,
      blocked: proposal.blocked,
      expectedProposalSha256: proposal.summary.proposalSha256,
    }),
  /does not match its immutable bundle/u,
);
throws(
  () =>
    buildFrenchReferenceLedgerPlan({
      reviewedSummary: proposal.summary,
      reviewedProposals: proposal.proposals,
      reviewedBlocked: proposal.blocked,
      expectedProposalSha256: proposal.summary.proposalSha256,
      currentBasePlan: basePlan,
      currentInventory: inventory,
      currentLedger: ledger,
      fileDigests: {
        ...fileDigests,
        currentKaikkiObservationsFileSha256: "3a".repeat(32),
      },
    }),
  /Kaikki observations changed/u,
);
const changedInventory = structuredClone(inventory);
changedInventory.assets[0].sha256 = "4a".repeat(32);
throws(
  () =>
    buildFrenchReferenceLedgerPlan({
      reviewedSummary: proposal.summary,
      reviewedProposals: proposal.proposals,
      reviewedBlocked: proposal.blocked,
      expectedProposalSha256: proposal.summary.proposalSha256,
      currentBasePlan: basePlan,
      currentInventory: changedInventory,
      currentLedger: ledger,
      fileDigests,
    }),
  /asset bytes changed/u,
);
const contrastOnlyInventory = structuredClone(inventory);
contrastOnlyInventory.assets[0].pageRelations[0].relationshipKind =
  "contrast-member";
throws(
  () =>
    buildFrenchReferenceLedgerPlan({
      reviewedSummary: proposal.summary,
      reviewedProposals: proposal.proposals,
      reviewedBlocked: proposal.blocked,
      expectedProposalSha256: proposal.summary.proposalSha256,
      currentBasePlan: basePlan,
      currentInventory: contrastOnlyInventory,
      currentLedger: ledger,
      fileDigests,
    }),
  /target relationship changed/u,
);
const conflictingLedger = {
  ...ledger,
  entries: [
    englishEntry,
    {
      ...result.patch.entries[0],
      canonicalIpa: "different",
    },
  ],
};
throws(
  () =>
    buildFrenchReferenceLedgerPlan({
      reviewedSummary: proposal.summary,
      reviewedProposals: proposal.proposals,
      reviewedBlocked: proposal.blocked,
      expectedProposalSha256: proposal.summary.proposalSha256,
      currentBasePlan: basePlan,
      currentInventory: inventory,
      currentLedger: conflictingLedger,
      fileDigests,
    }),
  /conflicts with French proposal/u,
);

console.log(
  "French reference ledger plan contract passed (" +
    assertions +
    " assertions).",
);
