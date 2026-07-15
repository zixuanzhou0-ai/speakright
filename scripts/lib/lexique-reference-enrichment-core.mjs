import { createHash } from "node:crypto";
import path from "node:path";

export const LEXIQUE_PUBLISHER_ID = "lexique";
export const LEXIQUE_INDEPENDENCE_GROUP = "lexique";
export const LEXIQUE_DATASET_VERSION = "4.00";
export const LEXIQUE_LICENSE = Object.freeze({
  id: "CC-BY-SA-4.0",
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
});

export const LEXIQUE_OFFICIAL_DATA_URLS = Object.freeze([
  "https://lexique.org/databases/Lexique400/Lexique400.tsv",
  "https://www.lexique.org/databases/Lexique400/Lexique400.tsv",
]);

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_OUTPUT_ROOT = path.join(AUDIT_ROOT, "reference-sources");

const ORTHOGRAPHY_HEADERS = new Set([
  "ortho",
  "orthography",
  "orthographe",
  "graphie",
  "mot",
  "word",
  "wordform",
  "forme",
]);
const PHONOLOGY_HEADERS = new Set([
  "phon",
  "phono",
  "phonoipa",
  "phonology",
  "phonologie",
  "pronunciation",
  "prononciation",
  "ipa",
]);
const LEMMA_HEADERS = new Set(["lemme", "lemma"]);
const POS_HEADERS = new Set([
  "cgram",
  "pos",
  "partofspeech",
  "grammaticalcategory",
  "categoriegrammaticale",
]);

const LEXIQUE_PHONOLOGY_TO_IPA = Object.freeze({
  1: "œ̃",
  2: "ø",
  5: "ɛ̃",
  8: "ɥ",
  9: "œ",
  "@": "ə",
  A: "ɑ̃",
  E: "ɛ",
  G: "ŋ",
  H: "ɥ",
  N: "ɲ",
  O: "ɔ",
  R: "ʁ",
  S: "ʃ",
  Z: "ʒ",
  a: "a",
  b: "b",
  d: "d",
  e: "e",
  f: "f",
  g: "g",
  h: "h",
  i: "i",
  j: "j",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  o: "o",
  p: "p",
  r: "r",
  s: "s",
  t: "t",
  u: "u",
  v: "v",
  w: "w",
  x: "x",
  y: "y",
  z: "z",
  "§": "ɔ̃",
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

function sourceMetadata({ datasetSha256 = null, sourceUrl = null } = {}) {
  return {
    publisherId: LEXIQUE_PUBLISHER_ID,
    name: "Lexique",
    version: LEXIQUE_DATASET_VERSION,
    license: LEXIQUE_LICENSE,
    independenceGroup: LEXIQUE_INDEPENDENCE_GROUP,
    sourceUrl: sourceUrl ?? LEXIQUE_OFFICIAL_DATA_URLS[0],
    datasetSha256,
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

export function normalizeReferenceWord(value) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || codePoint === 127;
  });
  if (!normalized || hasControlCharacter) {
    throw new Error(
      "Reference word must be non-empty and contain no control characters",
    );
  }
  return normalized;
}

function wordKey(value) {
  return normalizeReferenceWord(value).toLocaleLowerCase("fr-FR");
}

export function assertSafeLexiqueUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !LEXIQUE_OFFICIAL_DATA_URLS.includes(url.href)
  ) {
    throw new Error(`Unsafe or unofficial Lexique URL rejected: ${value}`);
  }
  return url.href;
}

export function assertFetchConfirmed(confirmed) {
  if (!confirmed) {
    throw new Error("Network fetch refused: pass --confirm explicitly");
  }
}

function assertPathUnder(root, value, message) {
  const resolved = path.resolve(value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${message}: ${resolved}`);
  }
  return resolved;
}

export function assertSafeReferenceOutputDir(value) {
  return assertPathUnder(
    REFERENCE_OUTPUT_ROOT,
    value,
    `Lexique reference output must remain under ${REFERENCE_OUTPUT_ROOT}`,
  );
}

export function assertSafeAuditInputPath(value) {
  return assertPathUnder(
    AUDIT_ROOT,
    value,
    `Audit plan input must remain under ${AUDIT_ROOT}`,
  );
}

export function getDefaultLexiqueOutputDir() {
  return path.join(REFERENCE_OUTPUT_ROOT, "lexique");
}

export function buildLexiqueReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
}) {
  const byAssetId = new Map(
    sourceAssets.map((asset) => [asset.sourceAssetId, asset]),
  );
  const uniqueUnresolvedIds = uniqueSorted(unresolvedSourceAssetIds);
  const unresolvedAssets = uniqueUnresolvedIds.map((assetId) => {
    const asset = byAssetId.get(assetId);
    if (!asset) {
      throw new Error(
        `Unresolved source asset is missing from base plan: ${assetId}`,
      );
    }
    return asset;
  });
  const frenchAssets = unresolvedAssets.filter(
    (asset) => asset.languageId === "fr-FR",
  );

  const groups = new Map();
  for (const asset of frenchAssets) {
    const text = normalizeReferenceWord(asset.text);
    const key = wordKey(text);
    const group = groups.get(key) ?? {
      languageId: "fr-FR",
      text,
      lookupKey: key,
      sourceAssetIds: [],
      currentCanonicalIpas: [],
      targetUnits: [],
      phonemePageIds: [],
      relationshipIssues: [],
    };
    group.sourceAssetIds.push(asset.sourceAssetId);
    group.currentCanonicalIpas.push(asset.canonicalIpa);
    group.targetUnits.push(...(asset.targetUnits ?? []));
    group.phonemePageIds.push(...(asset.phonemePageIds ?? []));
    group.relationshipIssues.push(...(asset.relationshipIssues ?? []));
    groups.set(key, group);
  }

  const items = [...groups.values()]
    .map((group) => ({
      ...group,
      sourceAssetIds: uniqueSorted(group.sourceAssetIds),
      currentCanonicalIpas: uniqueSorted(group.currentCanonicalIpas),
      targetUnits: uniqueSorted(group.targetUnits),
      phonemePageIds: uniqueSorted(group.phonemePageIds),
      relationshipIssues: uniqueSorted(group.relationshipIssues),
      publisherId: LEXIQUE_PUBLISHER_ID,
      independenceGroup: LEXIQUE_INDEPENDENCE_GROUP,
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "fr-FR"));

  const deterministic = {
    version: 1,
    tool: "lexique-reference-enrichment",
    ...sourceMetadata(),
    strictQueueSourceAssetCount: unresolvedAssets.length,
    sourceAssetCount: frenchAssets.length,
    wordCount: items.length,
    byLanguage: {
      "fr-FR": {
        sourceAssetCount: frenchAssets.length,
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

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/u, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]/gu, "")
    .replace(/^\d+/u, "");
}

function findHeaderIndex(headers, candidates) {
  return headers.findIndex((header) => candidates.has(normalizeHeader(header)));
}

function findPreferredPhonologyHeaderIndex(headers) {
  const normalized = headers.map(normalizeHeader);
  for (const preferred of ["phonoipa", "ipa"]) {
    const index = normalized.indexOf(preferred);
    if (index >= 0) return index;
  }
  return normalized.findIndex((header) => PHONOLOGY_HEADERS.has(header));
}

function detectDelimiter(headerLine) {
  const candidates = ["\t", ";", ","];
  const best = candidates
    .map((delimiter) => ({
      delimiter,
      count: headerLine.split(delimiter).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0];
  if (!best || best.count === 0) {
    throw new Error("Lexique source header has no supported delimiter");
  }
  return best.delimiter;
}

function parseDelimitedRows(value, delimiter) {
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
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted)
    throw new Error("Lexique source has an unterminated quoted field");
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows;
}

function stripPairedIpaDelimiters(value) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (
    (normalized.startsWith("/") && normalized.endsWith("/")) ||
    (normalized.startsWith("[") && normalized.endsWith("]"))
  ) {
    return normalized.slice(1, -1).trim();
  }
  return normalized;
}

export function mapLexiquePhonologyToIpa(value, { providedIpa = false } = {}) {
  const rawPhonology = String(value ?? "");
  const normalizedPhonology = rawPhonology.normalize("NFC").trim();
  if (!normalizedPhonology) {
    return {
      rawPhonology,
      normalizedPhonology,
      normalizedIpa: null,
      mappingStatus: "missing-phonology",
      unmappedSymbols: [],
    };
  }
  if (providedIpa) {
    return {
      rawPhonology,
      normalizedPhonology,
      normalizedIpa: stripPairedIpaDelimiters(normalizedPhonology),
      mappingStatus: "provided-ipa",
      unmappedSymbols: [],
    };
  }

  let normalizedIpa = "";
  const unmappedSymbols = [];
  for (const symbol of Array.from(
    stripPairedIpaDelimiters(normalizedPhonology),
  )) {
    if (Object.hasOwn(LEXIQUE_PHONOLOGY_TO_IPA, symbol)) {
      normalizedIpa += LEXIQUE_PHONOLOGY_TO_IPA[symbol];
    } else if (symbol === "." || symbol === "ˈ" || symbol === "ˌ") {
      normalizedIpa += symbol;
    } else if (/\p{M}/u.test(symbol)) {
      normalizedIpa += symbol;
    } else {
      unmappedSymbols.push(symbol);
    }
  }
  const uniqueUnmappedSymbols = uniqueSorted(unmappedSymbols);
  return {
    rawPhonology,
    normalizedPhonology,
    normalizedIpa:
      uniqueUnmappedSymbols.length === 0 && normalizedIpa
        ? normalizedIpa.normalize("NFC")
        : null,
    mappingStatus:
      uniqueUnmappedSymbols.length === 0
        ? "mapped-lexique-phonology"
        : "manual-mapping-required",
    unmappedSymbols: uniqueUnmappedSymbols,
  };
}

export function parseLexiqueDataset(
  datasetText,
  { items, datasetSha256 = null, sourceUrl = null },
) {
  const text = String(datasetText);
  const headerLine = text.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0];
  const delimiter = detectDelimiter(headerLine);
  const rows = parseDelimitedRows(text, delimiter);
  if (rows.length === 0) throw new Error("Lexique source is empty");
  const headers = rows[0];
  const orthographyIndex = findHeaderIndex(headers, ORTHOGRAPHY_HEADERS);
  const phonologyIndex = findPreferredPhonologyHeaderIndex(headers);
  const lemmaIndex = findHeaderIndex(headers, LEMMA_HEADERS);
  const posIndex = findHeaderIndex(headers, POS_HEADERS);
  if (orthographyIndex < 0 || phonologyIndex < 0) {
    throw new Error(
      "Lexique source must contain an orthography column and a phonology/IPA column",
    );
  }
  const phonologyHeader = normalizeHeader(headers[phonologyIndex]);
  const providedIpa =
    phonologyHeader === "ipa" || phonologyHeader === "phonoipa";
  const wanted = new Map(items.map((item) => [item.lookupKey, item]));
  const matches = new Map(items.map((item) => [item.lookupKey, []]));
  let malformedRowCount = 0;
  let sourceRowCount = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.every((field) => !String(field).trim())) continue;
    sourceRowCount += 1;
    if (row.length !== headers.length) {
      malformedRowCount += 1;
      continue;
    }
    let orthography;
    try {
      orthography = normalizeReferenceWord(row[orthographyIndex]);
    } catch {
      malformedRowCount += 1;
      continue;
    }
    const key = wordKey(orthography);
    if (!wanted.has(key)) continue;
    const mapping = mapLexiquePhonologyToIpa(row[phonologyIndex], {
      providedIpa,
    });
    matches.get(key).push({
      sourceRow: index + 1,
      orthography,
      lemma:
        lemmaIndex >= 0 ? String(row[lemmaIndex] ?? "").normalize("NFC") : null,
      partOfSpeech:
        posIndex >= 0 ? String(row[posIndex] ?? "").normalize("NFC") : null,
      ...mapping,
    });
  }

  const entries = items.map((item) => {
    const wordMatches = matches.get(item.lookupKey) ?? [];
    const withPhonology = wordMatches.filter(
      (match) => match.mappingStatus !== "missing-phonology",
    );
    const mapped = withPhonology.filter((match) => match.normalizedIpa);
    const manualMapping = withPhonology.filter(
      (match) => match.mappingStatus === "manual-mapping-required",
    );
    let status = "not-found";
    if (withPhonology.length === 0 && wordMatches.length > 0) {
      status = "matched-without-phonology";
    } else if (mapped.length === 0 && manualMapping.length > 0) {
      status = "phonology-observed-manual-mapping-required";
    } else if (manualMapping.length > 0) {
      status = "partial-ipa-mapping-observed";
    } else if (mapped.length > 0) {
      status = "mapped-ipa-observed";
    }
    return {
      version: 1,
      languageId: "fr-FR",
      text: item.text,
      source: sourceMetadata({ datasetSha256, sourceUrl }),
      sourceAssetIds: item.sourceAssetIds,
      currentCanonicalIpas: item.currentCanonicalIpas,
      targetUnits: item.targetUnits,
      phonemePageIds: item.phonemePageIds,
      relationshipIssues: item.relationshipIssues,
      status,
      rawPhonology: uniqueSorted(
        withPhonology.map((match) => match.rawPhonology),
        "fr-FR",
      ),
      normalizedPhonology: uniqueSorted(
        withPhonology.map((match) => match.normalizedPhonology),
        "fr-FR",
      ),
      normalizedIpa: uniqueSorted(
        mapped.map((match) => match.normalizedIpa),
        "fr-FR",
      ),
      mappings: wordMatches,
      confirmationEffect: "observation-only",
      autoConfirmationAllowed: false,
      reviewRequired: true,
    };
  });

  return {
    version: 1,
    source: sourceMetadata({ datasetSha256, sourceUrl }),
    delimiter: delimiter === "\t" ? "tab" : delimiter,
    headers,
    orthographyColumn: headers[orthographyIndex],
    phonologyColumn: headers[phonologyIndex],
    phonologyEncoding: providedIpa ? "ipa" : "lexique-phonology",
    sourceRowCount,
    malformedRowCount,
    entries,
  };
}

export function buildLexiqueReferenceOutputs(plan, parsed) {
  const entries = parsed.entries ?? [];
  const byText = new Map(entries.map((entry) => [wordKey(entry.text), entry]));
  const observations = [];
  const unresolved = [];
  for (const item of plan.items) {
    const entry = byText.get(item.lookupKey);
    if (!entry) {
      unresolved.push({
        languageId: "fr-FR",
        text: item.text,
        sourceAssetIds: item.sourceAssetIds,
        reason: "parse-result-missing",
      });
      continue;
    }
    if (
      entry.status !== "not-found" &&
      entry.status !== "matched-without-phonology"
    ) {
      observations.push(entry);
    }
    if (entry.status !== "mapped-ipa-observed") {
      unresolved.push({
        languageId: "fr-FR",
        text: item.text,
        sourceAssetIds: item.sourceAssetIds,
        reason: entry.status,
        rawPhonology: entry.rawPhonology,
        unmappedSymbols: uniqueSorted(
          entry.mappings.flatMap((mapping) => mapping.unmappedSymbols ?? []),
        ),
      });
    }
  }

  const fullyMappedIpaWordCount = entries.filter(
    (entry) => entry.status === "mapped-ipa-observed",
  ).length;
  const partialMappedIpaWordCount = entries.filter(
    (entry) => entry.status === "partial-ipa-mapping-observed",
  ).length;
  const manualMappingRequiredWordCount = entries.filter((entry) =>
    [
      "phonology-observed-manual-mapping-required",
      "partial-ipa-mapping-observed",
    ].includes(entry.status),
  ).length;
  const notFoundWordCount = entries.filter(
    (entry) => entry.status === "not-found",
  ).length;
  const matchedWithoutPhonologyWordCount = entries.filter(
    (entry) => entry.status === "matched-without-phonology",
  ).length;

  return {
    observations: {
      version: 1,
      planSha256: plan.planSha256,
      publisherId: LEXIQUE_PUBLISHER_ID,
      independenceGroup: LEXIQUE_INDEPENDENCE_GROUP,
      warning:
        "Lexique observations are an independent reference source, not an automatic confirmation. Every match remains review-required; unmapped or ambiguous phonology must never be confirmed automatically.",
      coverage: {
        targetWordCount: plan.wordCount,
        observationCount: observations.length,
        fullyMappedIpaWordCount,
        partialMappedIpaWordCount,
        manualMappingRequiredWordCount,
        notFoundWordCount,
        matchedWithoutPhonologyWordCount,
      },
      entries: observations,
    },
    unresolved: {
      version: 1,
      planSha256: plan.planSha256,
      unresolvedCount: unresolved.length,
      entries: unresolved,
    },
  };
}

export const LEXIQUE_AUDIT_ROOT = AUDIT_ROOT;
export const LEXIQUE_REFERENCE_OUTPUT_ROOT = REFERENCE_OUTPUT_ROOT;
