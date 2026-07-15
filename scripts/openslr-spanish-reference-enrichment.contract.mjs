#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  assertFetchConfirmed,
  assertSafeAuditInputPath,
  assertSafeOpenSlrUrl,
  assertSafeReferenceOutputDir,
  buildOpenSlrCheckpoint,
  buildOpenSlrPlanReport,
  buildOpenSlrReferenceOutputs,
  buildOpenSlrReferencePlan,
  detectOpenSlrSourceFormat,
  extractOpenSlrLexiconMembers,
  getDefaultOpenSlrOutputDir,
  mapSantiagoPhonemesToIpa,
  OPENSLR_DATASET_VERSION,
  OPENSLR_INDEPENDENCE_GROUP,
  OPENSLR_LICENSE,
  OPENSLR_LOCALE_BOUNDARY,
  OPENSLR_OFFICIAL_SOURCE_URLS,
  OPENSLR_PUBLISHER_ID,
  OPENSLR_RESOURCE_ID,
  parseOpenSlrLexiconSources,
  sourceBufferToLexiconSources,
  validateOpenSlrSourceBuffer,
} from "./lib/openslr-spanish-reference-enrichment-core.mjs";

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

equal(OPENSLR_RESOURCE_ID, 34);
equal(OPENSLR_PUBLISHER_ID, "openslr");
equal(OPENSLR_INDEPENDENCE_GROUP, "santiago-spanish-lexicon-resource-34");
equal(OPENSLR_DATASET_VERSION, "SLR34");
equal(OPENSLR_LICENSE.id, "Apache-2.0");
equal(OPENSLR_LOCALE_BOUNDARY.sourceLanguageId, "es-CL");
equal(OPENSLR_LOCALE_BOUNDARY.targetLanguageId, "es-ES");
equal(OPENSLR_LOCALE_BOUNDARY.localeMatchStatus, "cross-locale-variant-risk");
equal(OPENSLR_LOCALE_BOUNDARY.reliableForTargetLocaleConfirmation, false);

for (const url of OPENSLR_OFFICIAL_SOURCE_URLS) {
  equal(assertSafeOpenSlrUrl(url), url);
}
throws(
  () =>
    assertSafeOpenSlrUrl("https://evil.example/resources/34/santiago.tar.gz"),
  /Unsafe or unofficial/,
);
throws(
  () =>
    assertSafeOpenSlrUrl(
      "https://www.openslr.org/resources/34/santiago.tar.gz?mirror=1",
    ),
  /Unsafe or unofficial/,
);
throws(
  () =>
    assertSafeOpenSlrUrl("http://www.openslr.org/resources/34/santiago.tar.gz"),
  /Unsafe or unofficial/,
);
throws(
  () =>
    assertSafeOpenSlrUrl(
      "https://www.openslr.org/resources/33/santiago.tar.gz",
    ),
  /Unsafe or unofficial/,
);
throws(() => assertFetchConfirmed(false), /--confirm/);
assert.doesNotThrow(() => assertFetchConfirmed(true));
assertions += 1;
equal(
  assertSafeReferenceOutputDir(getDefaultOpenSlrOutputDir()),
  getDefaultOpenSlrOutputDir(),
);
throws(
  () => assertSafeReferenceOutputDir(path.resolve("C:/temp/openslr-spanish")),
  /must remain under/,
);
throws(
  () => assertSafeAuditInputPath(path.resolve("C:/temp/third-plan.json")),
  /must remain under/,
);

const sourceAssets = [
  {
    sourceAssetId: "es-a",
    languageId: "es-ES",
    role: "example-word",
    text: "casa",
    canonicalIpa: "/ˈkasa/",
    targetUnits: ["es-k"],
    phonemePageIds: ["es-k"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-b",
    languageId: "es-ES",
    role: "minimal-pair",
    text: "Casa",
    canonicalIpa: "/ˈkasa/",
    targetUnits: ["es-a"],
    phonemePageIds: ["es-a"],
    relationshipIssues: ["fixture-risk"],
  },
  {
    sourceAssetId: "es-c",
    languageId: "es-ES",
    role: "example-word",
    text: "pero",
    canonicalIpa: "/ˈpeɾo/",
    targetUnits: ["es-r-tap"],
    phonemePageIds: ["es-r-tap"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-d",
    languageId: "es-ES",
    role: "example-word",
    text: "desconocido",
    canonicalIpa: "/deskonoˈθiðo/",
    targetUnits: ["es-th"],
    phonemePageIds: ["es-th"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "fr-a",
    languageId: "fr-FR",
    role: "example-word",
    text: "robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-r"],
    phonemePageIds: ["fr-r"],
    relationshipIssues: [],
  },
];
const unresolvedSourceAssetIds = ["es-d", "fr-a", "es-c", "es-b", "es-a"];
const planA = buildOpenSlrReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
});
const planB = buildOpenSlrReferencePlan({
  sourceAssets: [...sourceAssets].reverse(),
  unresolvedSourceAssetIds: [...unresolvedSourceAssetIds].reverse(),
});
equal(planA.strictQueueSourceAssetCount, 5);
equal(planA.sourceAssetCount, 4);
equal(planA.wordCount, 3);
equal(planA.byLanguage["es-ES"].sourceAssetCount, 4);
equal(planA.publisherId, "openslr");
equal(planA.independenceGroup, "santiago-spanish-lexicon-resource-34");
equal(planA.datasetVersion, "SLR34");
equal(planA.license.id, "Apache-2.0");
equal(planA.networkRequestsMade, 0);
equal(planA.planSha256, planB.planSha256);
deepEqual(
  planA.items.find((item) => item.lookupKey === "casa").sourceAssetIds,
  ["es-a", "es-b"],
);
check(
  planA.items.every(
    (item) =>
      item.publisherId === "openslr" &&
      item.independenceGroup === "santiago-spanish-lexicon-resource-34" &&
      item.localeMatchStatus === "cross-locale-variant-risk",
  ),
  "Every planned item must preserve source identity and locale risk",
);
equal(planA.safety.autoConfirmationAllowed, false);
equal(planA.safety.formalAudioMutationAllowed, false);

const planReport = buildOpenSlrPlanReport(planA);
equal(planReport.queueCoverage.targetSourceAssetCount, 4);
equal(planReport.queueCoverage.targetWordCount, 3);
equal(planReport.confirmationCoverage.eligibleWordCount, 0);
equal(planReport.confirmationCoverage.eligibleSourceAssetCount, 0);
equal(planReport.safety.networkRequestsMade, 0);
equal(planReport.safety.formalAudioMutationCount, 0);

const casaMapping = mapSantiagoPhonemesToIpa("k a s a");
equal(casaMapping.rawPhonemes, "k a s a");
equal(casaMapping.normalizedPhonemes, "k a s a");
equal(casaMapping.normalizedIpa, "kasa");
equal(casaMapping.mappingStatus, "mapped-conservative-phonemes");
deepEqual(casaMapping.unmappedSymbols, []);
equal(mapSantiagoPhonemesToIpa("tS i k o").normalizedIpa, "tʃiko");
equal(mapSantiagoPhonemesToIpa("n i J o").normalizedIpa, "niɲo");
equal(mapSantiagoPhonemesToIpa("kasa").normalizedIpa, "kasa");
const rhoticMapping = mapSantiagoPhonemesToIpa("p e r o");
equal(rhoticMapping.normalizedIpa, "pero");
equal(rhoticMapping.mappingStatus, "mapped-with-review-warnings");
check(
  rhoticMapping.mappingWarnings.includes(
    "rhotic-symbol-inventory-review-required",
  ),
  "Ambiguous source rhotics must carry a mapping warning",
);
const stressMapping = mapSantiagoPhonemesToIpa("k a1 s a");
equal(stressMapping.normalizedIpa, "kasa");
check(
  stressMapping.mappingWarnings.includes(
    "numeric-stress-position-review-required",
  ),
  "Numeric stress must never be silently positioned",
);
const unmapped = mapSantiagoPhonemesToIpa("k a ? a");
equal(unmapped.normalizedIpa, null);
equal(unmapped.mappingStatus, "manual-mapping-required");
deepEqual(unmapped.unmappedSymbols, ["?"]);
const providedIpa = mapSantiagoPhonemesToIpa("/ˈkasa/", {
  providedIpa: true,
});
equal(providedIpa.rawIpa, "/ˈkasa/");
equal(providedIpa.normalizedIpa, "ˈkasa");
equal(providedIpa.mappingStatus, "provided-ipa");

const fixture = [
  "# Santiago fixture",
  "word\tphonemes",
  "casa\tk a s a",
  "pero\tp e r o",
  "otro\to t r o",
  "malformed",
  "",
].join("\n");
const parsed = parseOpenSlrLexiconSources(
  [{ name: "santiago/lexicon.txt", text: fixture, encoding: "utf8" }],
  {
    items: planA.items,
    datasetSha256: "fixture-sha",
    sourceUrl: OPENSLR_OFFICIAL_SOURCE_URLS[0],
  },
);
equal(parsed.source.publisherId, "openslr");
equal(parsed.source.independenceGroup, "santiago-spanish-lexicon-resource-34");
equal(parsed.source.datasetVersion, "SLR34");
equal(parsed.source.license.id, "Apache-2.0");
equal(parsed.source.datasetSha256, "fixture-sha");
deepEqual(parsed.source.sourceMembers, ["santiago/lexicon.txt"]);
equal(parsed.source.localeBoundary.sourceLanguageId, "es-CL");
equal(parsed.source.localeBoundary.targetLanguageId, "es-ES");
equal(parsed.malformedRowCount, 1);
const casa = parsed.entries.find((entry) => entry.text === "casa");
equal(casa.status, "mapped-ipa-observed");
deepEqual(casa.rawPhonemes, ["k a s a"]);
deepEqual(casa.normalizedPhonemes, ["k a s a"]);
deepEqual(casa.rawIpa, []);
deepEqual(casa.normalizedIpa, ["kasa"]);
equal(casa.confirmationEffect, "observation-only");
equal(casa.autoConfirmationAllowed, false);
equal(casa.reviewRequired, true);
equal(casa.variantRisk.status, "cross-locale-variant-risk");
const pero = parsed.entries.find((entry) => entry.text === "pero");
equal(pero.status, "mapped-ipa-observed-review-required");
check(
  pero.mappings[0].mappingWarnings.includes(
    "rhotic-symbol-inventory-review-required",
  ),
  "Parsed mappings must preserve symbol-level warnings",
);
equal(
  parsed.entries.find((entry) => entry.text === "desconocido").status,
  "not-found",
);

const directIpa = parseOpenSlrLexiconSources(
  [
    {
      name: "santiago/direct-ipa.tsv",
      text: "word\tipa\ncasa\t/ˈkasa/\n",
    },
  ],
  { items: [planA.items.find((item) => item.lookupKey === "casa")] },
);
deepEqual(directIpa.entries[0].rawIpa, ["/ˈkasa/"]);
deepEqual(directIpa.entries[0].normalizedIpa, ["ˈkasa"]);

const outputs = buildOpenSlrReferenceOutputs(planA, parsed, {
  acquisitionMode: "local-import",
  acquisitionNetworkRequests: 0,
});
equal(outputs.observations.coverage.targetSourceAssetCount, 4);
equal(outputs.observations.coverage.targetWordCount, 3);
equal(outputs.observations.coverage.observedSourceAssetCount, 3);
equal(outputs.observations.coverage.observationWordCount, 2);
equal(outputs.observations.coverage.mappedIpaSourceAssetCount, 3);
equal(outputs.observations.coverage.mappedIpaWordCount, 2);
equal(outputs.observations.coverage.variantRiskSourceAssetCount, 3);
equal(outputs.observations.coverage.variantRiskWordCount, 2);
equal(outputs.observations.coverage.targetLocaleConfirmedSourceAssetCount, 0);
equal(outputs.observations.coverage.targetLocaleConfirmedWordCount, 0);
equal(outputs.observations.coverage.targetLocaleConfirmationRate, 0);
equal(outputs.unresolved.unresolvedCount, 3);
equal(outputs.unresolved.unresolvedSourceAssetCount, 4);
equal(outputs.report.disposition.status, "observation-only-cross-locale");
equal(outputs.report.disposition.autoConfirmationAllowed, false);
equal(outputs.report.disposition.formalAudioMutationCount, 0);
check(
  outputs.unresolved.entries.some(
    (entry) =>
      entry.text === "casa" && entry.reason === "cross-locale-variant-risk",
  ),
  "Mapped Santiago observations must stay unresolved for es-ES",
);
check(
  outputs.unresolved.entries.some(
    (entry) => entry.text === "desconocido" && entry.reason === "not-found",
  ),
  "Missing words must stay unresolved",
);
check(
  outputs.observations.warning.includes(
    "cannot automatically confirm peninsular es-ES",
  ),
  "Derived output must state the locale boundary",
);
check(
  !JSON.stringify(outputs).includes("two-source-confirmed"),
  "OpenSLR outputs must never manufacture a confirmation status",
);

const checkpoint = buildOpenSlrCheckpoint(planA, {
  status: "ready",
  acquisitionMode: "local-import",
  sourceFormat: "lexicon-text",
  cachedFile: "source/santiago-lexicon.txt",
  sha256: "fixture-sha",
  networkRequestsMade: 0,
});
equal(checkpoint.publisherId, "openslr");
equal(checkpoint.independenceGroup, "santiago-spanish-lexicon-resource-34");
equal(checkpoint.resourceId, 34);
equal(checkpoint.datasetVersion, "SLR34");
equal(checkpoint.license.id, "Apache-2.0");
equal(checkpoint.localeBoundary.localeMatchStatus, "cross-locale-variant-risk");
equal(checkpoint.localeBoundary.reliableForTargetLocaleConfirmation, false);

const textBuffer = Buffer.from(fixture, "utf8");
equal(
  detectOpenSlrSourceFormat(textBuffer, "santiago.lexicon"),
  "lexicon-text",
);
assert.doesNotThrow(() =>
  validateOpenSlrSourceBuffer(textBuffer, "lexicon-text"),
);
assertions += 1;
throws(
  () =>
    validateOpenSlrSourceBuffer(
      Buffer.from("<html>not a lexicon</html>", "utf8"),
      "lexicon-text",
    ),
  /HTML/,
);
throws(
  () =>
    validateOpenSlrSourceBuffer(
      Buffer.from("not-a-pronunciation-row", "utf8"),
      "lexicon-text",
    ),
  /no plausible/,
);

function writeTarString(header, value, offset, length) {
  Buffer.from(value, "utf8").copy(header, offset, 0, length);
}

function writeTarOctal(header, value, offset, length) {
  const encoded = `${value.toString(8).padStart(length - 1, "0")}\0`;
  writeTarString(header, encoded, offset, length);
}

function buildTar(entries) {
  const chunks = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content, "utf8");
    const header = Buffer.alloc(512);
    writeTarString(header, entry.name, 0, 100);
    writeTarOctal(header, 0o644, 100, 8);
    writeTarOctal(header, 0, 108, 8);
    writeTarOctal(header, 0, 116, 8);
    writeTarOctal(header, content.length, 124, 12);
    writeTarOctal(header, 0, 136, 12);
    header.fill(32, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeTarString(header, "ustar\0", 257, 6);
    writeTarString(header, "00", 263, 2);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const encodedChecksum = `${checksum.toString(8).padStart(6, "0")}\0 `;
    writeTarString(header, encodedChecksum, 148, 8);
    chunks.push(header, content);
    const padding = (512 - (content.length % 512)) % 512;
    if (padding > 0) chunks.push(Buffer.alloc(padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

const archive = gzipSync(
  buildTar([
    { name: "santiago/README.txt", content: "fixture documentation" },
    { name: "santiago/lexicon.txt", content: fixture },
  ]),
);
equal(detectOpenSlrSourceFormat(archive, "santiago.tar.gz"), "tar-gzip");
assert.doesNotThrow(() => validateOpenSlrSourceBuffer(archive, "tar-gzip"));
assertions += 1;
const archiveMembers = extractOpenSlrLexiconMembers(archive);
equal(archiveMembers.length, 1);
equal(archiveMembers[0].name, "santiago/lexicon.txt");
check(
  archiveMembers[0].text.includes("casa\tk a s a"),
  "Archive extraction must return the lexicon member",
);
deepEqual(
  sourceBufferToLexiconSources(archive, {
    sourceFormat: "tar-gzip",
  }).map((source) => source.name),
  ["santiago/lexicon.txt"],
);

const traversalArchive = gzipSync(
  buildTar([{ name: "../escape.lexicon", content: fixture }]),
);
throws(
  () => extractOpenSlrLexiconMembers(traversalArchive),
  /Unsafe OpenSLR tar member path/,
);
const corruptTar = buildTar([
  { name: "santiago/lexicon.txt", content: fixture },
]);
corruptTar[0] ^= 1;
throws(
  () => extractOpenSlrLexiconMembers(gzipSync(corruptTar)),
  /checksum mismatch/,
);

console.log(
  "OpenSLR Spanish reference enrichment contract passed (" +
    assertions +
    " assertions).",
);
