import { createHash } from "node:crypto";
import path from "node:path";

export const RUSSIAN_NOUN_LEXICON_PUBLISHER_ID = "russian-noun-lexicon";
export const RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP =
  "russian-noun-lexicon-datr";
export const RUSSIAN_NOUN_LEXICON_PROJECT_ID = 14256370;
export const RUSSIAN_NOUN_LEXICON_COMMIT =
  "e52bd61e2da8c0a1d81f19aed862d399ab7c627b";
export const RUSSIAN_NOUN_LEXICON_DOI = "10.5281/zenodo.3428591";
export const RUSSIAN_NOUN_LEXICON_LICENSE = Object.freeze({
  id: "GPL-3.0-only",
  name: "GNU General Public License v3.0 only",
  url: "https://www.gnu.org/licenses/gpl-3.0.html",
});

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_OUTPUT_ROOT = path.join(AUDIT_ROOT, "reference-sources");

const RAW_API_ROOT = `https://gitlab.com/api/v4/projects/${RUSSIAN_NOUN_LEXICON_PROJECT_ID}/repository/files`;
function officialRawApiUrl(fileName) {
  return `${RAW_API_ROOT}/${encodeURIComponent(fileName)}/raw?ref=${RUSSIAN_NOUN_LEXICON_COMMIT}`;
}
export const RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES = Object.freeze([
  Object.freeze({
    id: "dataset",
    fileName: "RussianNouns.csv",
    url: officialRawApiUrl("RussianNouns.csv"),
    maxBytes: 8 * 1024 * 1024,
  }),
  Object.freeze({
    id: "license",
    fileName: "LICENSE",
    url: officialRawApiUrl("LICENSE"),
    maxBytes: 256 * 1024,
  }),
  Object.freeze({
    id: "readme",
    fileName: "README.md",
    url: officialRawApiUrl("README.md"),
    maxBytes: 256 * 1024,
  }),
]);

const CYRILLIC_CONSONANTS = Object.freeze({
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ж: "ʒ",
  з: "z",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ф: "f",
  х: "x",
  ц: "ʦ",
  ч: "ʨ",
  ш: "ʃ",
  щ: "ɕː",
});

const HARD_CONSONANTS = new Set(["ж", "ц", "ш"]);
const PALATALIZING_VOWELS = Object.freeze({
  е: "e",
  ё: "o",
  и: "i",
  ю: "u",
  я: "a",
});
const PLAIN_VOWELS = Object.freeze({
  а: "a",
  о: "o",
  у: "u",
  ы: "i",
  э: "e",
});

function uniqueSorted(values, locale = "en") {
  return [
    ...new Set(
      values.filter(
        (value) => value !== undefined && value !== null && value !== "",
      ),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b), locale));
}

function sourceMetadata(fileDigests = null) {
  return {
    publisherId: RUSSIAN_NOUN_LEXICON_PUBLISHER_ID,
    name: "RussianNounLexicon",
    projectId: RUSSIAN_NOUN_LEXICON_PROJECT_ID,
    version: RUSSIAN_NOUN_LEXICON_COMMIT,
    doi: RUSSIAN_NOUN_LEXICON_DOI,
    license: RUSSIAN_NOUN_LEXICON_LICENSE,
    independenceGroup: RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
    sourceUrl: "https://gitlab.com/sbeniamine/russiannounlexicon",
    fileDigests,
    datasetScope: "russian-nouns-only",
    transcriptionGranularity: "broad-phonemic-ipa-based",
    transcriptionMethod:
      "Automatically transcribed from the Brown et al. DATR Russian nominal system, with documented manual corrections",
    limitations: [
      "The lexicon contains nouns only and cannot validate verbs, numerals, particles, conjunctions, or isolated letter names.",
      "A matching spelling may be a cross-part-of-speech homograph; project context must confirm that the noun reading is intended.",
      "The broad phonemic notation does not directly encode every ru-RU surface process used by SpeakRight, including predictable vowel reduction and final devoicing.",
    ],
  };
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"));
    return `{${entries
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertPathUnder(root, value, message) {
  const resolved = path.resolve(value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${message}: ${resolved}`);
  }
  return resolved;
}

export function assertSafeRussianNounReferenceOutputDir(value) {
  return assertPathUnder(
    REFERENCE_OUTPUT_ROOT,
    value,
    `Russian noun reference output must remain under ${REFERENCE_OUTPUT_ROOT}`,
  );
}

export function assertSafeRussianNounAuditInputPath(value) {
  return assertPathUnder(
    AUDIT_ROOT,
    value,
    `Audit plan input must remain under ${AUDIT_ROOT}`,
  );
}

export function getDefaultRussianNounReferenceOutputDir() {
  return path.join(REFERENCE_OUTPUT_ROOT, "russian-noun-lexicon");
}

export function assertRussianNounFetchConfirmed(confirmed) {
  if (!confirmed) {
    throw new Error("Network fetch refused: pass --confirm explicitly");
  }
}

export function assertOfficialRussianNounLexiconUrl(value) {
  const url = new URL(value);
  const allowed = new Set(
    RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES.map((file) => file.url),
  );
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !allowed.has(url.href)
  ) {
    throw new Error(
      `Unsafe or unofficial RussianNounLexicon URL rejected: ${value}`,
    );
  }
  return url.href;
}

export function normalizeRussianReferenceWord(value) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("ru-RU");
  const hasControl = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (!normalized || hasControl) {
    throw new Error(
      "Russian reference word must be non-empty and contain no control characters",
    );
  }
  return normalized;
}

function isCyrillicVowel(character) {
  return (
    Object.hasOwn(PLAIN_VOWELS, character) ||
    Object.hasOwn(PALATALIZING_VOWELS, character)
  );
}

function isPalatalizableConsonant(character) {
  return (
    Object.hasOwn(CYRILLIC_CONSONANTS, character) &&
    !HARD_CONSONANTS.has(character) &&
    character !== "щ" &&
    character !== "ч"
  );
}

/**
 * Converts Russian orthography into the broad notation used for dictionary
 * lookup by RussianNounLexicon. This is only an index key; it is not emitted
 * as a pronunciation decision.
 */
export function russianOrthographyToNounLexiconKey(value) {
  const word = normalizeRussianReferenceWord(value);
  const characters = Array.from(word);
  let output = "";
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (Object.hasOwn(CYRILLIC_CONSONANTS, character)) {
      const next = characters[index + 1];
      const palatalizedByNext =
        isPalatalizableConsonant(character) &&
        (Object.hasOwn(PALATALIZING_VOWELS, next) || next === "ь");
      output += CYRILLIC_CONSONANTS[character];
      if (palatalizedByNext) output += "ʲ";
      continue;
    }
    if (Object.hasOwn(PLAIN_VOWELS, character)) {
      output += PLAIN_VOWELS[character];
      continue;
    }
    if (Object.hasOwn(PALATALIZING_VOWELS, character)) {
      const previous = characters[index - 1];
      const needsJot =
        character !== "и" &&
        (index === 0 ||
          isCyrillicVowel(previous) ||
          previous === "ъ" ||
          previous === "ь");
      if (needsJot) output += "j";
      output += PALATALIZING_VOWELS[character];
      continue;
    }
    if (character === "й") {
      output += "j";
      continue;
    }
    if (character === "ь" || character === "ъ" || character === "-") {
      continue;
    }
    throw new Error(
      `Unsupported character in Russian noun lookup key: ${character}`,
    );
  }
  return output.normalize("NFC");
}

export function normalizeRussianNounLexiconForm(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, "")
    .trim()
    .normalize("NFC");
}

function stressNucleusIndex(value) {
  const decomposed = String(value ?? "").normalize("NFD");
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  let nucleus = -1;
  for (const character of decomposed) {
    if (vowels.has(character)) nucleus += 1;
    if (character === "\u0301") return nucleus;
  }
  return null;
}

export function buildRussianNounReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
}) {
  const byAssetId = new Map(
    sourceAssets.map((asset) => [asset.sourceAssetId, asset]),
  );
  const unresolvedAssets = uniqueSorted(unresolvedSourceAssetIds).map(
    (assetId) => {
      const asset = byAssetId.get(assetId);
      if (!asset) {
        throw new Error(
          `Unresolved source asset is missing from base plan: ${assetId}`,
        );
      }
      return asset;
    },
  );
  const russianAssets = unresolvedAssets.filter(
    (asset) => asset.languageId === "ru-RU",
  );
  const groups = new Map();
  for (const asset of russianAssets) {
    const text = normalizeRussianReferenceWord(asset.text);
    const lookupKey = russianOrthographyToNounLexiconKey(text);
    const group = groups.get(text) ?? {
      languageId: "ru-RU",
      text,
      lookupKey,
      sourceAssetIds: [],
      currentCanonicalIpas: [],
      targetUnits: [],
      phonemePageIds: [],
      relationshipIssues: [],
    };
    if (group.lookupKey !== lookupKey) {
      throw new Error(`Russian lookup key changed within word group: ${text}`);
    }
    group.sourceAssetIds.push(asset.sourceAssetId);
    group.currentCanonicalIpas.push(asset.canonicalIpa);
    group.targetUnits.push(...(asset.targetUnits ?? []));
    group.phonemePageIds.push(...(asset.phonemePageIds ?? []));
    group.relationshipIssues.push(...(asset.relationshipIssues ?? []));
    groups.set(text, group);
  }
  const items = [...groups.values()]
    .map((group) => ({
      ...group,
      sourceAssetIds: uniqueSorted(group.sourceAssetIds),
      currentCanonicalIpas: uniqueSorted(group.currentCanonicalIpas),
      targetUnits: uniqueSorted(group.targetUnits),
      phonemePageIds: uniqueSorted(group.phonemePageIds),
      relationshipIssues: uniqueSorted(group.relationshipIssues),
      publisherId: RUSSIAN_NOUN_LEXICON_PUBLISHER_ID,
      independenceGroup: RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
      datasetScope: "nouns-only",
      applicabilityPolicy:
        "Only an exact nominative noun-form match is reported; project part of speech remains unconfirmed.",
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "ru-RU"));
  const deterministic = {
    version: 1,
    tool: "russian-noun-reference-enrichment",
    ...sourceMetadata(),
    strictQueueSourceAssetCount: unresolvedAssets.length,
    sourceAssetCount: russianAssets.length,
    wordCount: items.length,
    byLanguage: {
      "ru-RU": {
        sourceAssetCount: russianAssets.length,
        wordCount: items.length,
      },
    },
    items,
  };
  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
  };
}

function parseCsv(value) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = String(value).replace(/^\uFEFF/u, "");
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("Russian noun CSV has an unterminated quote");
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows;
}

export function validateRussianNounSourceFile(fileId, buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const descriptor = RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES.find(
    (file) => file.id === fileId,
  );
  if (!descriptor) throw new Error(`Unknown source file ID: ${fileId}`);
  if (bytes.length === 0) throw new Error(`${fileId} source file is empty`);
  if (bytes.length > descriptor.maxBytes) {
    throw new Error(`${fileId} source file exceeds its size limit`);
  }
  const text = bytes.toString("utf8");
  if (/^\s*<(?:!doctype|html)/iu.test(text)) {
    throw new Error(`${fileId} source unexpectedly contains HTML`);
  }
  if (fileId === "dataset") {
    const header = text.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0];
    for (const required of [
      "lexeme",
      "sg.nom",
      "pl.nom",
      "translation",
      "gender",
      "animacy",
    ]) {
      if (!header.split(",").includes(required)) {
        throw new Error(
          `Russian noun dataset is missing required column: ${required}`,
        );
      }
    }
  } else if (
    fileId === "license" &&
    !/GNU GENERAL PUBLIC LICENSE[\s\S]{0,200}Version 3/iu.test(text)
  ) {
    throw new Error("Russian noun source license is not GPL version 3");
  } else if (
    fileId === "readme" &&
    !/Inflected lexicon of Russian Nouns in IPA notation/iu.test(text)
  ) {
    throw new Error("Russian noun source README identity check failed");
  }
  return {
    id: descriptor.id,
    fileName: descriptor.fileName,
    url: descriptor.url,
    bytes: bytes.length,
    sha256: sha256(bytes),
  };
}

export function parseRussianNounLexiconDataset(value) {
  const rows = parseCsv(value);
  if (rows.length < 2) throw new Error("Russian noun dataset has no data rows");
  const headers = rows[0];
  const required = [
    "lexeme",
    "sg.nom",
    "pl.nom",
    "translation",
    "gender",
    "animacy",
  ];
  const indices = Object.fromEntries(
    required.map((header) => [header, headers.indexOf(header)]),
  );
  for (const [header, index] of Object.entries(indices)) {
    if (index < 0) throw new Error(`Missing Russian noun column: ${header}`);
  }
  const byNominalKey = new Map();
  let malformedRowCount = 0;
  for (const columns of rows.slice(1)) {
    if (columns.length === 1 && !columns[0]) continue;
    if (columns.length !== headers.length) {
      malformedRowCount += 1;
      continue;
    }
    const row = {
      lexeme: columns[indices.lexeme],
      translation: columns[indices.translation],
      gender: columns[indices.gender],
      animacy: columns[indices.animacy],
    };
    for (const [number, header] of [
      ["singular", "sg.nom"],
      ["plural", "pl.nom"],
    ]) {
      const rawForm = columns[indices[header]];
      if (!rawForm || rawForm === "#DEF#") continue;
      const lookupKey = normalizeRussianNounLexiconForm(rawForm);
      const matches = byNominalKey.get(lookupKey) ?? [];
      matches.push({
        ...row,
        number,
        rawForm,
        lookupKey,
        stressNucleusIndex: stressNucleusIndex(rawForm),
      });
      byNominalKey.set(lookupKey, matches);
    }
  }
  return {
    sourceRowCount: rows.length - 1,
    malformedRowCount,
    byNominalKey,
  };
}

function dedupeDatasetMatches(matches) {
  const byKey = new Map();
  for (const match of matches) {
    const key = stableStringify(match);
    byKey.set(key, match);
  }
  return [...byKey.values()].sort((a, b) =>
    stableStringify(a).localeCompare(stableStringify(b), "en"),
  );
}

export function buildRussianNounReferenceOutputs({
  plan,
  parsed,
  fileDigests,
}) {
  const entries = [];
  const unresolvedEntries = [];
  for (const item of plan.items) {
    const matches = dedupeDatasetMatches(
      parsed.byNominalKey.get(item.lookupKey) ?? [],
    );
    if (matches.length === 0) {
      unresolvedEntries.push({
        languageId: item.languageId,
        text: item.text,
        lookupKey: item.lookupKey,
        sourceAssetIds: item.sourceAssetIds,
        reason: "outside-noun-lexicon-nominative-coverage",
        explanation:
          "No exact singular/plural nominative noun reading was found. This source must not be used to infer a pronunciation for another part of speech.",
      });
      continue;
    }
    entries.push({
      version: 1,
      languageId: "ru-RU",
      text: item.text,
      source: sourceMetadata(fileDigests),
      sourceAssetIds: item.sourceAssetIds,
      currentCanonicalIpas: item.currentCanonicalIpas,
      targetUnits: item.targetUnits,
      phonemePageIds: item.phonemePageIds,
      relationshipIssues: item.relationshipIssues,
      nounReadings: matches,
      status: "noun-reading-observed-pos-unconfirmed",
      applicability:
        "Observation applies only if the product context intends the noun reading; no project part-of-speech metadata was used.",
      confirmationEffect: "observation-only",
      canWriteDecisionLedger: false,
    });
  }
  const matchedSourceAssetCount = entries.reduce(
    (total, entry) => total + entry.sourceAssetIds.length,
    0,
  );
  const unmatchedSourceAssetCount = unresolvedEntries.reduce(
    (total, entry) => total + entry.sourceAssetIds.length,
    0,
  );
  const coverage = {
    strictQueueSourceAssetCount: plan.strictQueueSourceAssetCount,
    russianSourceAssetCount: plan.sourceAssetCount,
    russianWordCount: plan.wordCount,
    nounReadingWordCount: entries.length,
    nounReadingSourceAssetCount: matchedSourceAssetCount,
    outsideNounCoverageWordCount: unresolvedEntries.length,
    outsideNounCoverageSourceAssetCount: unmatchedSourceAssetCount,
    malformedDatasetRowCount: parsed.malformedRowCount,
  };
  if (
    matchedSourceAssetCount + unmatchedSourceAssetCount !==
    plan.sourceAssetCount
  ) {
    throw new Error("Russian noun reference coverage does not balance");
  }
  return {
    observations: {
      version: 1,
      planSha256: plan.planSha256,
      source: sourceMetadata(fileDigests),
      warning:
        "RussianNounLexicon is independent noun-only broad phonemic evidence. Every match remains observation-only until project context confirms the noun reading and surface ru-RU processes are reconciled.",
      observationCount: entries.length,
      coverage,
      entries,
    },
    unresolved: {
      version: 1,
      planSha256: plan.planSha256,
      unresolvedCount: unresolvedEntries.length,
      coverage,
      entries: unresolvedEntries,
    },
  };
}
