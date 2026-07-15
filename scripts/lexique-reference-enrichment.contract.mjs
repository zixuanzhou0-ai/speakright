#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import {
  assertFetchConfirmed,
  assertSafeAuditInputPath,
  assertSafeLexiqueUrl,
  assertSafeReferenceOutputDir,
  buildLexiqueReferenceOutputs,
  buildLexiqueReferencePlan,
  getDefaultLexiqueOutputDir,
  LEXIQUE_DATASET_VERSION,
  LEXIQUE_INDEPENDENCE_GROUP,
  LEXIQUE_LICENSE,
  LEXIQUE_OFFICIAL_DATA_URLS,
  LEXIQUE_PUBLISHER_ID,
  mapLexiquePhonologyToIpa,
  parseLexiqueDataset,
} from "./lib/lexique-reference-enrichment-core.mjs";

let assertions = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function throws(callback, pattern, message) {
  assert.throws(callback, pattern, message);
  assertions += 1;
}

equal(LEXIQUE_PUBLISHER_ID, "lexique");
equal(LEXIQUE_INDEPENDENCE_GROUP, "lexique");
equal(LEXIQUE_DATASET_VERSION, "4.00");
equal(
  LEXIQUE_OFFICIAL_DATA_URLS[0],
  "https://lexique.org/databases/Lexique400/Lexique400.tsv",
);
equal(LEXIQUE_LICENSE.id, "CC-BY-SA-4.0");
equal(
  assertSafeLexiqueUrl(LEXIQUE_OFFICIAL_DATA_URLS[0]),
  LEXIQUE_OFFICIAL_DATA_URLS[0],
);
throws(
  () =>
    assertSafeLexiqueUrl(
      "https://evil.example/databases/Lexique400/Lexique400.tsv",
    ),
  /Unsafe or unofficial/,
);
throws(
  () =>
    assertSafeLexiqueUrl(
      "https://www.lexique.org/databases/Lexique400/Lexique400.tsv?mirror=1",
    ),
  /Unsafe or unofficial/,
);
throws(
  () =>
    assertSafeLexiqueUrl(
      "http://www.lexique.org/databases/Lexique400/Lexique400.tsv",
    ),
  /Unsafe or unofficial/,
);
throws(() => assertFetchConfirmed(false), /--confirm/);
assert.doesNotThrow(() => assertFetchConfirmed(true));
assertions += 1;
equal(
  assertSafeReferenceOutputDir(getDefaultLexiqueOutputDir()),
  getDefaultLexiqueOutputDir(),
);
throws(
  () => assertSafeReferenceOutputDir(path.resolve("C:/temp/lexique")),
  /must remain under/,
);
throws(
  () => assertSafeAuditInputPath(path.resolve("C:/temp/third-plan.json")),
  /must remain under/,
);

const sourceAssets = [
  {
    sourceAssetId: "fr-a",
    languageId: "fr-FR",
    text: "robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-r"],
    phonemePageIds: ["fr-r"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "fr-b",
    languageId: "fr-FR",
    text: "Robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-o-open"],
    phonemePageIds: ["fr-o-open"],
    relationshipIssues: ["fixture-risk"],
  },
  {
    sourceAssetId: "fr-c",
    languageId: "fr-FR",
    text: "fichier",
    canonicalIpa: "/fiʃje/",
    targetUnits: ["fr-sh"],
    phonemePageIds: ["fr-sh"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "fr-d",
    languageId: "fr-FR",
    text: "inconnu",
    canonicalIpa: "/ɛ̃kɔny/",
    targetUnits: ["fr-in"],
    phonemePageIds: ["fr-in"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-a",
    languageId: "es-ES",
    text: "casa",
    canonicalIpa: "/kasa/",
    targetUnits: ["es-a"],
    phonemePageIds: ["es-a"],
    relationshipIssues: [],
  },
];
const unresolvedSourceAssetIds = ["fr-d", "es-a", "fr-c", "fr-b", "fr-a"];
const planA = buildLexiqueReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
});
const planB = buildLexiqueReferencePlan({
  sourceAssets: [...sourceAssets].reverse(),
  unresolvedSourceAssetIds: [...unresolvedSourceAssetIds].reverse(),
});
equal(planA.strictQueueSourceAssetCount, 5);
equal(planA.sourceAssetCount, 4);
equal(planA.wordCount, 3);
equal(planA.byLanguage["fr-FR"].sourceAssetCount, 4);
equal(planA.publisherId, "lexique");
equal(planA.independenceGroup, "lexique");
equal(planA.version, "4.00");
equal(planA.networkRequestsMade, 0);
equal(planA.planSha256, planB.planSha256);
deepEqual(
  planA.items.find((item) => item.lookupKey === "robe").sourceAssetIds,
  ["fr-a", "fr-b"],
);
check(
  planA.items.every(
    (item) =>
      item.publisherId === "lexique" && item.independenceGroup === "lexique",
  ),
  "Every planned item must retain Lexique publisher and independence IDs",
);

const fichierMapping = mapLexiquePhonologyToIpa("fiSje");
equal(fichierMapping.normalizedIpa, "fiʃje");
equal(fichierMapping.mappingStatus, "mapped-lexique-phonology");
equal(mapLexiquePhonologyToIpa("b§").normalizedIpa, "bɔ̃");
equal(mapLexiquePhonologyToIpa("l8i").normalizedIpa, "lɥi");
const unmapped = mapLexiquePhonologyToIpa("fi?je");
equal(unmapped.normalizedIpa, null);
equal(unmapped.mappingStatus, "manual-mapping-required");
deepEqual(unmapped.unmappedSymbols, ["?"]);
const providedIpa = mapLexiquePhonologyToIpa("/fi.ʃje/", {
  providedIpa: true,
});
equal(providedIpa.normalizedIpa, "fi.ʃje");
equal(providedIpa.mappingStatus, "provided-ipa");

const fixture = `\uFEFFortho\tphon\tlemme\tcgram\tnote
robe\tROb\trobe\tNOM\t"plain"
fichier\tfiSje\tfichier\tNOM\t"quoted\tnote"
fichier\tfi?je\tfichier\tNOM\t"requires mapping"
vide\t\tvide\tADJ\t"no phonology"
malformed\trow
`;
const parsed = parseLexiqueDataset(fixture, {
  items: planA.items,
  datasetSha256: "fixture-sha",
  sourceUrl: LEXIQUE_OFFICIAL_DATA_URLS[0],
});
equal(parsed.delimiter, "tab");
equal(parsed.phonologyEncoding, "lexique-phonology");
equal(parsed.source.publisherId, "lexique");
equal(parsed.source.independenceGroup, "lexique");
equal(parsed.source.version, "4.00");
equal(parsed.source.license.id, "CC-BY-SA-4.0");
equal(parsed.source.datasetSha256, "fixture-sha");
equal(parsed.malformedRowCount, 1);
const robe = parsed.entries.find((entry) => entry.text === "robe");
equal(robe.status, "mapped-ipa-observed");
deepEqual(robe.rawPhonology, ["ROb"]);
deepEqual(robe.normalizedPhonology, ["ROb"]);
deepEqual(robe.normalizedIpa, ["ʁɔb"]);
equal(robe.confirmationEffect, "observation-only");
equal(robe.autoConfirmationAllowed, false);
const fichier = parsed.entries.find((entry) => entry.text === "fichier");
equal(fichier.status, "partial-ipa-mapping-observed");
deepEqual(fichier.rawPhonology, ["fi?je", "fiSje"]);
deepEqual(fichier.normalizedIpa, ["fiʃje"]);
check(
  fichier.mappings.some(
    (mapping) => mapping.mappingStatus === "manual-mapping-required",
  ),
  "Unmapped Lexique rows must remain explicitly review-required",
);
equal(
  parsed.entries.find((entry) => entry.text === "inconnu").status,
  "not-found",
);

const outputs = buildLexiqueReferenceOutputs(planA, parsed);
equal(outputs.observations.coverage.targetWordCount, 3);
equal(outputs.observations.coverage.observationCount, 2);
equal(outputs.observations.coverage.fullyMappedIpaWordCount, 1);
equal(outputs.observations.coverage.partialMappedIpaWordCount, 1);
equal(outputs.observations.coverage.manualMappingRequiredWordCount, 1);
equal(outputs.observations.coverage.notFoundWordCount, 1);
equal(outputs.unresolved.unresolvedCount, 2);
check(
  outputs.observations.warning.includes("not an automatic confirmation"),
  "Derived output must state that Lexique does not auto-confirm",
);
check(
  !JSON.stringify(outputs).includes("two-source-confirmed"),
  "Lexique outputs must never manufacture a confirmation status",
);
check(
  outputs.unresolved.entries.some(
    (entry) =>
      entry.text === "fichier" &&
      entry.reason === "partial-ipa-mapping-observed" &&
      entry.unmappedSymbols.includes("?"),
  ),
  "Partial mappings must be carried to unresolved output",
);

const officialHeaderFixture = `1_Mot\t2_Phono\t3_Phono_IPA\t4_Lemme\t5_Cgram
robe\tROb\tʁɔb\trobe\tNOM
`;
const officialHeader = parseLexiqueDataset(officialHeaderFixture, {
  items: [planA.items.find((item) => item.lookupKey === "robe")],
});
equal(officialHeader.orthographyColumn, "1_Mot");
equal(officialHeader.phonologyColumn, "3_Phono_IPA");
equal(officialHeader.phonologyEncoding, "ipa");
deepEqual(officialHeader.entries[0].rawPhonology, ["ʁɔb"]);
deepEqual(officialHeader.entries[0].normalizedIpa, ["ʁɔb"]);
equal(officialHeader.entries[0].mappings[0].lemma, "robe");
equal(officialHeader.entries[0].mappings[0].partOfSpeech, "NOM");

const numberedPhonoFallbackFixture = `1_Mot\t2_Phono\t4_Lemme\t5_Cgram
robe\tROb\trobe\tNOM
`;
const numberedPhonoFallback = parseLexiqueDataset(
  numberedPhonoFallbackFixture,
  {
    items: [planA.items.find((item) => item.lookupKey === "robe")],
  },
);
equal(numberedPhonoFallback.phonologyColumn, "2_Phono");
equal(numberedPhonoFallback.phonologyEncoding, "lexique-phonology");
deepEqual(numberedPhonoFallback.entries[0].normalizedIpa, ["ʁɔb"]);

const directIpaFixture = "ortho,ipa,lemme\nrobe,/ʁɔb/,robe\n";
const directIpa = parseLexiqueDataset(directIpaFixture, {
  items: [planA.items.find((item) => item.lookupKey === "robe")],
});
equal(directIpa.phonologyEncoding, "ipa");
deepEqual(directIpa.entries[0].normalizedIpa, ["ʁɔb"]);

console.log(
  `Lexique reference enrichment contract passed (${assertions} assertions).`,
);
