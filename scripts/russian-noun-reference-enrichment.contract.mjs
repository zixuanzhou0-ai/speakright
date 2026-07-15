import assert from "node:assert/strict";
import path from "node:path";
import {
  assertOfficialRussianNounLexiconUrl,
  assertRussianNounFetchConfirmed,
  assertSafeRussianNounAuditInputPath,
  assertSafeRussianNounReferenceOutputDir,
  buildRussianNounReferenceOutputs,
  buildRussianNounReferencePlan,
  getDefaultRussianNounReferenceOutputDir,
  normalizeRussianNounLexiconForm,
  parseRussianNounLexiconDataset,
  RUSSIAN_NOUN_LEXICON_COMMIT,
  RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
  RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES,
  russianOrthographyToNounLexiconKey,
  validateRussianNounSourceFile,
} from "./lib/russian-noun-reference-enrichment-core.mjs";

let assertions = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}
function throws(callback, pattern, message) {
  assert.throws(callback, pattern, message);
  assertions += 1;
}

const officialDataset = RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES.find(
  (file) => file.id === "dataset",
);
equal(
  assertOfficialRussianNounLexiconUrl(officialDataset.url),
  officialDataset.url,
  "the immutable official raw dataset URL is allowed",
);
throws(
  () =>
    assertOfficialRussianNounLexiconUrl(
      "https://gitlab.com/sbeniamine/russiannounlexicon/-/raw/master/RussianNouns.csv",
    ),
  /Unsafe or unofficial/u,
  "a mutable branch URL is rejected",
);
throws(
  () =>
    assertOfficialRussianNounLexiconUrl(
      `${officialDataset.url}?private_token=secret`,
    ),
  /Unsafe or unofficial/u,
  "query parameters and credential-bearing variants are rejected",
);
throws(
  () => assertRussianNounFetchConfirmed(false),
  /pass --confirm/u,
  "network acquisition needs explicit confirmation",
);
assertRussianNounFetchConfirmed(true);
assertions += 1;

const outputDir = getDefaultRussianNounReferenceOutputDir();
equal(
  assertSafeRussianNounReferenceOutputDir(outputDir),
  outputDir,
  "the default output directory is accepted",
);
throws(
  () =>
    assertSafeRussianNounReferenceOutputDir(
      path.resolve(outputDir, "..", "..", "..", "escape"),
    ),
  /must remain under/u,
  "output traversal is rejected",
);
const safeAuditInput = path.resolve(outputDir, "..", "..", "inventory.json");
equal(
  assertSafeRussianNounAuditInputPath(safeAuditInput),
  safeAuditInput,
  "audit input inside the audit root is accepted",
);
throws(
  () => assertSafeRussianNounAuditInputPath("C:\\Windows\\win.ini"),
  /must remain under/u,
  "audit input outside the audit root is rejected",
);

deepEqual(
  [
    russianOrthographyToNounLexiconKey("вал"),
    russianOrthographyToNounLexiconKey("верх"),
    russianOrthographyToNounLexiconKey("пёс"),
    russianOrthographyToNounLexiconKey("тень"),
    russianOrthographyToNounLexiconKey("роща"),
    russianOrthographyToNounLexiconKey("цена"),
    russianOrthographyToNounLexiconKey("щи"),
    russianOrthographyToNounLexiconKey("юг"),
    russianOrthographyToNounLexiconKey("и"),
  ],
  ["val", "vʲerx", "pʲos", "tʲenʲ", "roɕːa", "ʦena", "ɕːi", "jug", "i"],
  "Russian orthography is converted only into deterministic noun-index keys",
);
equal(
  normalizeRussianNounLexiconForm("nogá"),
  "noga",
  "stress accents are removed only for lookup matching",
);
throws(
  () => russianOrthographyToNounLexiconKey("word"),
  /Unsupported character/u,
  "non-Russian lookup text is rejected",
);

const sourceAssets = [
  {
    sourceAssetId: "ru-noun-a",
    languageId: "ru-RU",
    text: "нога",
    canonicalIpa: "/nɐˈga/",
    targetUnits: ["ru-n"],
    phonemePageIds: ["ru-n"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "ru-noun-b",
    languageId: "ru-RU",
    text: "нога",
    canonicalIpa: "/nɐˈga/",
    targetUnits: ["ru-n-nj"],
    phonemePageIds: ["ru-n-nj"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "ru-verb",
    languageId: "ru-RU",
    text: "пишу",
    canonicalIpa: "/pʲɪˈʂu/",
    targetUnits: ["ru-sh"],
    phonemePageIds: ["ru-sh"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "fr-ignored",
    languageId: "fr-FR",
    text: "chat",
    canonicalIpa: "/ʃa/",
    targetUnits: ["fr-sh"],
    phonemePageIds: ["fr-sh"],
    relationshipIssues: [],
  },
];
const plan = buildRussianNounReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds: ["fr-ignored", "ru-verb", "ru-noun-b", "ru-noun-a"],
});
equal(plan.strictQueueSourceAssetCount, 4, "the full strict queue is recorded");
equal(plan.sourceAssetCount, 3, "only Russian assets enter this source plan");
equal(plan.wordCount, 2, "duplicate voices collapse to unique Russian words");
equal(
  plan.version,
  RUSSIAN_NOUN_LEXICON_COMMIT,
  "the source plan is pinned to an immutable commit",
);
equal(
  plan.independenceGroup,
  RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
  "the independent DATR-derived source group is explicit",
);
equal(plan.networkRequestsMade, 0, "planning never accesses the network");
deepEqual(
  plan.items.find((item) => item.text === "нога").sourceAssetIds,
  ["ru-noun-a", "ru-noun-b"],
  "both voice assets remain traceable from one word",
);
equal(
  buildRussianNounReferencePlan({
    sourceAssets,
    unresolvedSourceAssetIds: [
      "ru-noun-a",
      "ru-noun-b",
      "ru-verb",
      "fr-ignored",
    ],
  }).planSha256,
  plan.planSha256,
  "plan hashes are independent of queue ordering",
);

const csv = Buffer.from(
  [
    "lexeme,sg.nom,sg.acc,sg.gen,sg.dat,sg.ins,sg.loc,sg.loc2,pl.nom,pl.acc,pl.gen,pl.dat,pl.ins,pl.loc,translation,gender,animacy,absolute rank,noun rank,DATR-node",
    'nogá,nogá,nógu,nogʲí,nogʲé,nogój,nogʲé,nogʲé,nógʲi,nógʲi,nóg,nogám,nogámʲi,nogáx,"leg, limb",fem,inanimate,214,55,Noga',
    "pisʲmó,pisʲmó,pisʲmó,pisʲmá,pisʲmú,pisʲmóm,pisʲmʲé,pisʲmʲé,písʲma,písʲma,písʲem,písʲmam,písʲmamʲi,písʲmax,letter,neut,inanimate,1,1,Pismo",
  ].join("\n"),
  "utf8",
);
const license = Buffer.from(
  "GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n",
  "utf8",
);
const readme = Buffer.from(
  "# Inflected lexicon of Russian Nouns in IPA notation\n",
  "utf8",
);
for (const [id, buffer] of [
  ["dataset", csv],
  ["license", license],
  ["readme", readme],
]) {
  equal(
    validateRussianNounSourceFile(id, buffer).id,
    id,
    `${id} identity and content checks pass`,
  );
}
throws(
  () =>
    validateRussianNounSourceFile(
      "dataset",
      Buffer.from("<html>login</html>", "utf8"),
    ),
  /HTML/u,
  "an HTML login/error response cannot masquerade as the dataset",
);
throws(
  () =>
    validateRussianNounSourceFile(
      "license",
      Buffer.from("MIT License", "utf8"),
    ),
  /not GPL/u,
  "an unexpected license blocks acquisition",
);

const parsed = parseRussianNounLexiconDataset(csv.toString("utf8"));
equal(parsed.sourceRowCount, 2, "all source rows are counted");
equal(parsed.malformedRowCount, 0, "well-formed rows remain intact");
equal(
  parsed.byNominalKey.get("noga")[0].translation,
  "leg, limb",
  "quoted commas are parsed correctly",
);
equal(
  parsed.byNominalKey.has("nogu"),
  false,
  "oblique forms are excluded so non-nominative words cannot be matched",
);

const outputs = buildRussianNounReferenceOutputs({
  plan,
  parsed,
  fileDigests: {
    dataset: { sha256: "a".repeat(64) },
    license: { sha256: "b".repeat(64) },
    readme: { sha256: "c".repeat(64) },
  },
});
equal(outputs.observations.observationCount, 1, "one noun reading is observed");
equal(
  outputs.observations.entries[0].status,
  "noun-reading-observed-pos-unconfirmed",
  "a noun dictionary match never claims the project POS is proven",
);
equal(
  outputs.observations.entries[0].canWriteDecisionLedger,
  false,
  "the source tool cannot write formal pronunciation decisions",
);
equal(
  outputs.unresolved.entries[0].text,
  "пишу",
  "a verb outside noun coverage is left unresolved",
);
equal(
  outputs.unresolved.entries[0].reason,
  "outside-noun-lexicon-nominative-coverage",
  "out-of-scope items are explicit rather than inferred from noun data",
);
equal(
  outputs.observations.coverage.nounReadingSourceAssetCount,
  2,
  "noun coverage counts both voice assets",
);
equal(
  outputs.observations.coverage.outsideNounCoverageSourceAssetCount,
  1,
  "out-of-scope coverage balances the Russian plan",
);

console.log(
  `Russian noun reference enrichment contract passed (${assertions} assertions).`,
);
