#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  assertFrenchReferenceProposalCommand,
  buildFrenchReferenceDecisionProposal,
  normalizeComparableFrenchIpa,
  normalizeFrenchIpaSet,
} from "./lib/french-reference-decision-proposal-core.mjs";

let assertions = 0;
function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function throws(worker, expected, message) {
  assertions += 1;
  assert.throws(worker, expected, message);
}

equal(normalizeComparableFrenchIpa(" /pa.ˈʁi/ "), "paʁi");
equal(normalizeComparableFrenchIpa("[ɡa]"), "ga");
equal(normalizeComparableFrenchIpa("/e/"), "e");
equal(normalizeComparableFrenchIpa("/ɛ/"), "ɛ");
check(
  normalizeComparableFrenchIpa("/e/") !== normalizeComparableFrenchIpa("/ɛ/"),
  "close vowels must not be conflated",
);
check(
  normalizeComparableFrenchIpa("/r/") !== normalizeComparableFrenchIpa("/ʁ/"),
  "rhotic variants must not be conflated",
);
check(
  normalizeComparableFrenchIpa("/ɑ̃/") !== normalizeComparableFrenchIpa("/ã/"),
  "nasal vowel qualities must not be conflated",
);
check(
  normalizeComparableFrenchIpa("/u/") !== normalizeComparableFrenchIpa("/uː/"),
  "length must not be erased",
);
equal(normalizeComparableFrenchIpa("a‿b"), null);
equal(normalizeComparableFrenchIpa("[Quebec]"), null);
equal(normalizeComparableFrenchIpa("p(a)"), null);
equal(normalizeComparableFrenchIpa("/a,b/"), null);
equal(normalizeFrenchIpaSet(["/pa.ʁi/", "[ˈpaʁi]"]).normalized, ["paʁi"]);

function strictItem(
  text,
  ipa,
  {
    relationshipIssues = [],
    relationshipKinds = ["target-example"],
    referenceStatuses = ["needs-native-review"],
  } = {},
) {
  const sourceAssetId = `asset-${text}`;
  return {
    languageId: "fr-FR",
    text,
    sourceAssetIds: [sourceAssetId],
    currentCanonicalIpas: [ipa],
    targetUnits: ["fr-test"],
    phonemePageIds: ["fr-test"],
    relationshipIssues,
    relationshipKinds,
    referenceStatuses,
  };
}

function lexiqueObservation(item, ipa, overrides = {}) {
  return {
    version: 1,
    languageId: "fr-FR",
    text: item.text,
    sourceAssetIds: item.sourceAssetIds,
    status: "mapped-ipa-observed",
    normalizedIpa: Array.isArray(ipa) ? ipa : [ipa],
    mappings: [{ sourceRow: 1 }],
    source: {
      publisherId: "lexique",
      independenceGroup: "lexique",
      version: "4.00",
      license: { id: "CC-BY-SA-4.0" },
      sourceUrl: "https://lexique.org/databases/Lexique400/Lexique400.tsv",
      datasetSha256: "a".repeat(64),
      ...overrides.source,
    },
    ...overrides,
  };
}

function kaikkiObservation(item, ipas, overrides = {}) {
  return {
    version: 1,
    languageId: "fr-FR",
    text: item.text,
    sourceAssetIds: item.sourceAssetIds,
    status: "structured-ipa-observed",
    ipas: Array.isArray(ipas) ? ipas : [ipas],
    htmlSha256: "b".repeat(64),
    source: {
      publisherId: "kaikki-wiktionary",
      independenceGroup: "wiktionary",
      sourceUrl: "https://kaikki.org/dictionary/French/meaning/t/te/test.html",
      dumpDate: "2026-07-06",
      ...overrides.source,
    },
    ...overrides,
  };
}

const good = strictItem("paris", "/pa.ʁi/");
const disagreement = strictItem("bebe", "/bebe/");
const variants = strictItem("variante", "/vaʁjɑ̃t/");
const missing = strictItem("absent", "/apsɑ̃/");
const relationship = strictItem("relation", "/ʁəlasjɔ̃/", {
  relationshipIssues: ["target-missing:fr-test:/x/"],
  relationshipKinds: ["contrast-member"],
});
const conflict = strictItem("conflit", "/kɔ̃fli/", {
  referenceStatuses: ["conflict"],
});
const polluted = strictItem("pollue", "/pɔlye/");
const invalidIndependence = strictItem("source", "/suʁs/");
const strictItems = [
  good,
  disagreement,
  variants,
  missing,
  relationship,
  conflict,
  polluted,
  invalidIndependence,
];

const lexiqueEntries = [
  lexiqueObservation(good, "paʁi"),
  lexiqueObservation(disagreement, "bebe"),
  lexiqueObservation(variants, "vaʁjɑ̃t"),
  lexiqueObservation(relationship, "ʁəlasjɔ̃"),
  lexiqueObservation(conflict, "kɔ̃fli"),
  lexiqueObservation(polluted, "pɔlye"),
  lexiqueObservation(invalidIndependence, "suʁs", {
    source: { independenceGroup: "wiktionary" },
  }),
];
const kaikkiEntries = [
  kaikkiObservation(good, "[paˈʁi]"),
  kaikkiObservation(disagreement, "/bɛbɛ/"),
  kaikkiObservation(variants, ["/vaʁjɑ̃t/", "/vaʁiɑ̃t/"]),
  kaikkiObservation(relationship, "/ʁəlasjɔ̃/"),
  kaikkiObservation(conflict, "/kɔ̃fli/"),
  kaikkiObservation(polluted, ["/pɔlye/", "[Quebec]"]),
  kaikkiObservation(invalidIndependence, "/suʁs/"),
];

const input = {
  strictQueueSourceAssetCount: strictItems.length,
  strictItems,
  lexiqueObservations: { entries: lexiqueEntries },
  kaikkiObservations: { entries: kaikkiEntries },
  inputDigests: {
    basePlanSha256: "c".repeat(64),
    lexiqueDatasetSha256: "a".repeat(64),
  },
};
const result = buildFrenchReferenceDecisionProposal(input);
const repeated = buildFrenchReferenceDecisionProposal(input);

equal(result.summary.frenchWordCount, 8);
equal(result.summary.frenchSourceAssetCount, 8);
equal(result.summary.proposedWordCount, 1);
equal(result.summary.proposedAssetCount, 1);
equal(result.summary.blockedWordCount, 7);
equal(result.summary.blockedAssetCount, 7);
equal(result.proposals.wordEntries[0].text, "paris");
equal(
  result.proposals.wordEntries[0].proposedReferenceStatus,
  "two-source-confirmed",
);
equal(result.proposals.wordEntries[0].proposalEffect, "proposal-only");
equal(result.proposals.wordEntries[0].requiresHumanApplication, true);
equal(result.proposals.assetEntries[0].proposalEffect, "proposal-only");
equal(result.summary.effect, "proposal-only");
equal(result.summary.networkRequestsMade, 0);
equal(result.summary.paidCallsMade, 0);
equal(result.summary.formalLedgerWrites, 0);
equal(result.summary.formalAudioWrites, 0);
equal(result.summary.invariant, true);
equal(result.summary.proposalSha256, repeated.summary.proposalSha256);

const blockedByText = new Map(
  result.blocked.wordEntries.map((entry) => [entry.text, entry]),
);
check(
  blockedByText.get("bebe").reasons.includes("independent-sources-disagree"),
);
check(
  blockedByText.get("variante").reasons.includes("kaikki-variants-or-conflict"),
);
check(blockedByText.get("absent").reasons.includes("lexique-not-found"));
check(blockedByText.get("absent").reasons.includes("kaikki-not-found"));
check(blockedByText.get("relation").reasons.includes("relationship-issues"));
check(
  blockedByText.get("conflit").reasons.includes("reference-status-conflict"),
);
check(
  blockedByText
    .get("pollue")
    .reasons.includes("kaikki-ipa-missing-or-unmappable"),
);
check(
  blockedByText
    .get("source")
    .reasons.includes("lexique-scope-or-independence-invalid"),
);
equal(result.wordSummary.entries.length, 8);
check(
  !JSON.stringify(result).includes("decision-ledger-patch"),
  "proposal must not masquerade as a formal ledger patch",
);

equal(assertFrenchReferenceProposalCommand("build"), "build");
throws(
  () => assertFrenchReferenceProposalCommand("apply"),
  /Only the offline build command is supported/u,
  "formal apply must remain unavailable",
);

console.log(
  `French reference decision proposal contract passed (${assertions} assertions).`,
);
