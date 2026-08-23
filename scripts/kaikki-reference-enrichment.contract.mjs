#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import {
  assertFetchConfirmed,
  assertSafeKaikkiUrl,
  assertSafeReferenceOutputDir,
  buildKaikkiReferencePlan,
  buildKaikkiWordUrl,
  buildReferenceOutputs,
  getDefaultKaikkiOutputDir,
  parseKaikkiHtml,
  rebaseKaikkiCheckpoint,
} from "./lib/kaikki-reference-enrichment-core.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const spanishUrl = buildKaikkiWordUrl("es-ES", "pañí");
assert.equal(
  spanishUrl,
  "https://kaikki.org/dictionary/Spanish/meaning/p/pa/pa%C3%B1%C3%AD.html",
);
assertions += 1;
const russianUrl = buildKaikkiWordUrl("ru-RU", "пятьдесят");
check(
  russianUrl.includes("/%D0%BF/%D0%BF%D1%8F/"),
  "Cyrillic buckets must be UTF-8 encoded",
);
const apostropheUrl = buildKaikkiWordUrl("fr-FR", "l'heure");
check(
  apostropheUrl.endsWith("/l%27heure.html"),
  "Apostrophes must be encoded in path segments",
);

assert.throws(
  () =>
    assertSafeKaikkiUrl(
      "https://evil.example/dictionary/English/meaning/a/ab/able.html",
      "en-US",
    ),
  /Unsafe Kaikki URL/,
);
assertions += 1;
assert.throws(
  () =>
    assertSafeKaikkiUrl(
      "https://kaikki.org/dictionary/English/meaning/a/ab/able.html?q=x",
      "en-US",
    ),
  /Unsafe Kaikki URL/,
);
assertions += 1;
assert.throws(() => assertFetchConfirmed(false), /--confirm/);
assertions += 1;
assert.doesNotThrow(() => assertFetchConfirmed(true));
assertions += 1;
assert.equal(
  assertSafeReferenceOutputDir(getDefaultKaikkiOutputDir()),
  getDefaultKaikkiOutputDir(),
);
assertions += 1;
assert.throws(
  () => assertSafeReferenceOutputDir(path.resolve("C:/temp/kaikki")),
  /Reference output must remain/,
);
assertions += 1;

const sourceAssets = [
  {
    sourceAssetId: "b",
    languageId: "fr-FR",
    text: "robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-r"],
    phonemePageIds: ["fr-r"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "a",
    languageId: "fr-FR",
    text: "robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-o-open"],
    phonemePageIds: ["fr-o-open"],
    relationshipIssues: ["example-risk"],
  },
  {
    sourceAssetId: "c",
    languageId: "en-US",
    text: "seven",
    canonicalIpa: "/ˈsevən/",
    targetUnits: ["/v/"],
    phonemePageIds: ["v"],
    relationshipIssues: [],
  },
];
const planA = buildKaikkiReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds: ["c", "b", "a"],
});
const planB = buildKaikkiReferencePlan({
  sourceAssets: [...sourceAssets].reverse(),
  unresolvedSourceAssetIds: ["a", "b", "c"],
});
assert.equal(planA.sourceAssetCount, 3);
assert.equal(planA.wordCount, 2);
assert.deepEqual(
  planA.items.find((item) => item.text === "robe").sourceAssetIds,
  ["a", "b"],
);
assert.equal(planA.planSha256, planB.planSha256);
assert.equal(planA.networkRequestsMade, 0);
assert.equal(
  planA.items.every((item) => item.independenceGroup === "wiktionary"),
  true,
);
assertions += 6;

const oldCheckpoint = {
  version: 1,
  planSha256: "old-plan",
  networkRequestsMade: 7,
  items: Object.fromEntries(
    planA.items.map((item, index) => [
      item.sourceUrl,
      {
        status: "fetched",
        htmlFile: `html/${index}.html`,
        observation: { htmlSha256: `sha-${index}` },
      },
    ]),
  ),
};
oldCheckpoint.items["https://kaikki.org/unused.html"] = {
  status: "fetched",
  htmlFile: "html/unused.html",
};
const rebasedCheckpoint = rebaseKaikkiCheckpoint(planA, oldCheckpoint);
assert.equal(rebasedCheckpoint.planSha256, planA.planSha256);
assert.equal(rebasedCheckpoint.lastOperation.operation, "rebase");
assert.equal(rebasedCheckpoint.lastOperation.mode, "offline");
assert.equal(rebasedCheckpoint.lastOperation.networkRequestsMade, 0);
assert.equal(rebasedCheckpoint.lastOperation.reusedItemCount, planA.wordCount);
assert.equal(rebasedCheckpoint.networkRequestsMade, 7);
assert.deepEqual(
  Object.keys(rebasedCheckpoint.items).sort(),
  planA.items.map((item) => item.sourceUrl).sort(),
);
assert.notEqual(
  rebasedCheckpoint.items[planA.items[0].sourceUrl],
  oldCheckpoint.items[planA.items[0].sourceUrl],
);
assertions += 8;

const incompleteCheckpoint = structuredClone(oldCheckpoint);
delete incompleteCheckpoint.items[planA.items[0].sourceUrl];
assert.throws(
  () => rebaseKaikkiCheckpoint(planA, incompleteCheckpoint),
  /requires fetched HTML or a terminal fetch-failed record.*unavailable/u,
);
assertions += 1;
const missingHtmlCheckpoint = structuredClone(oldCheckpoint);
delete missingHtmlCheckpoint.items[planA.items[0].sourceUrl].htmlFile;
assert.throws(
  () => rebaseKaikkiCheckpoint(planA, missingHtmlCheckpoint),
  /requires fetched HTML or a terminal fetch-failed record.*unavailable/u,
);
assertions += 1;

const fixtureUrl = buildKaikkiWordUrl("fr-FR", "fichier");
const fixtureHtml = `<!doctype html>
<html><head><title>fichier in French</title></head><body>
<span class="info"><span class="infolabel">IPA</span>: /fi.ʃje/</span>
<div class="hideable">
<label>[Show JSON for postprocessed kaikki.org data shown on this page ▼]</label>
<pre>{&quot;word&quot;:&quot;fichier&quot;,&quot;sounds&quot;:[{&quot;ipa&quot;:&quot;/fi.ʃje/&quot;},{&quot;ipa&quot;:&quot;[fi.ʃje]&quot;}]}</pre>
</div>
<p>This dictionary is based on structured data extracted on 2026-07-09 from the enwiktionary dump dated 2026-07-06 using
<a href="https://github.com/tatuylonen/wiktextract/commit/e62056b1f7954ce7b17730606bfa7707b63af3cd">wiktextract</a>
and <a href="https://github.com/tatuylonen/wikitextprocessor/commit/e7887d54f58ea8a33318dbecb8317bba5e62b933">wikitextprocessor</a>.</p>
</body></html>`;
const observation = parseKaikkiHtml(fixtureHtml, {
  languageId: "fr-FR",
  text: "fichier",
  sourceUrl: fixtureUrl,
});
assert.deepEqual(observation.ipas, ["[fi.ʃje]", "/fi.ʃje/"]);
assert.equal(observation.source.dumpDate, "2026-07-06");
assert.equal(
  observation.source.wiktextractRevision,
  "e62056b1f7954ce7b17730606bfa7707b63af3cd",
);
assert.deepEqual(observation.source.license, ["CC-BY-SA", "GFDL"]);
assert.equal(observation.source.independenceGroup, "wiktionary");
assert.equal(observation.status, "structured-ipa-observed");
assert.equal(observation.confirmationEffect, "observation-only");
assertions += 7;

const checkpoint = {
  items: {
    [fixtureUrl]: { status: "fetched", observation },
  },
};
const outputs = buildReferenceOutputs(
  {
    planSha256: "fixture-plan",
    items: [
      {
        languageId: "fr-FR",
        text: "fichier",
        sourceUrl: fixtureUrl,
        sourceAssetIds: ["fixture"],
        currentCanonicalIpas: ["/fi.ʃje/"],
        targetUnits: ["fr-sh"],
        phonemePageIds: ["fr-sh"],
        relationshipIssues: [],
      },
      {
        languageId: "en-US",
        text: "seven",
        sourceUrl: buildKaikkiWordUrl("en-US", "seven"),
        sourceAssetIds: ["missing"],
        currentCanonicalIpas: ["/ˈsevən/"],
        targetUnits: ["/v/"],
        phonemePageIds: ["v"],
        relationshipIssues: [],
      },
    ],
  },
  checkpoint,
);
assert.equal(outputs.observations.observationCount, 1);
assert.equal(outputs.unresolved.unresolvedCount, 1);
check(
  outputs.observations.warning.includes("never establish"),
  "Output must warn against fake independence",
);
check(
  !JSON.stringify(outputs).includes("two-source-confirmed"),
  "Kaikki observations must never auto-confirm a second source",
);

console.log(
  `Kaikki reference enrichment contract passed (${assertions} assertions).`,
);
