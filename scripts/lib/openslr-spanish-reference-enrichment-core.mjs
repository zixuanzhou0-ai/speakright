import { createHash } from "node:crypto";
import path from "node:path";
import { gunzipSync } from "node:zlib";

export const OPENSLR_RESOURCE_ID = 34;
export const OPENSLR_PUBLISHER_ID = "openslr";
export const OPENSLR_INDEPENDENCE_GROUP =
  "santiago-spanish-lexicon-resource-34";
export const OPENSLR_DATASET_VERSION = "SLR34";
export const OPENSLR_LICENSE = Object.freeze({
  id: "Apache-2.0",
  name: "Apache License 2.0",
  url: "https://www.apache.org/licenses/LICENSE-2.0",
});
export const OPENSLR_OFFICIAL_SOURCE_URLS = Object.freeze([
  "https://www.openslr.org/resources/34/santiago.tar.gz",
  "https://openslr.org/resources/34/santiago.tar.gz",
  "https://openslr.elda.org/resources/34/santiago.tar.gz",
]);
export const OPENSLR_LOCALE_BOUNDARY = Object.freeze({
  documentedLocale: "Santiago, Chile",
  sourceLanguageId: "es-CL",
  targetLanguageId: "es-ES",
  localeMatchStatus: "cross-locale-variant-risk",
  reliableForTargetLocaleConfirmation: false,
  note: "Santiago/Chilean Spanish evidence is not equivalent to peninsular es-ES evidence. Every match remains an observation requiring es-ES review.",
});

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_OUTPUT_ROOT = path.join(AUDIT_ROOT, "reference-sources");
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".dic",
  ".dict",
  ".lex",
  ".lexicon",
  ".tab",
  ".tsv",
  ".txt",
]);
const DOCUMENT_BASENAMES = new Set([
  "authors",
  "changelog",
  "copying",
  "license",
  "notice",
  "readme",
]);
const WORD_HEADERS = new Set([
  "entry",
  "grapheme",
  "orthography",
  "palabra",
  "token",
  "word",
]);
const PRONUNCIATION_HEADERS = new Set([
  "ipa",
  "phon",
  "phoneme",
  "phonemes",
  "phones",
  "pron",
  "pronunciation",
  "sampa",
  "xsampa",
]);

const SPANISH_PHONEME_TO_IPA = Object.freeze({
  "%": "ˌ",
  '"': "ˈ",
  "'": "ˈ",
  ".": ".",
  4: "ɾ",
  B: "β",
  D: "ð",
  G: "ɣ",
  J: "ɲ",
  L: "ʎ",
  N: "ŋ",
  R: "ɾ",
  S: "ʃ",
  T: "θ",
  X: "χ",
  Z: "ʒ",
  a: "a",
  b: "b",
  beta: "β",
  ch: "tʃ",
  d: "d",
  delta: "ð",
  dh: "ð",
  e: "e",
  f: "f",
  g: "g",
  gamma: "ɣ",
  h: "h",
  i: "i",
  j: "j",
  "j\\": "ʝ",
  k: "k",
  l: "l",
  ll: "ʎ",
  m: "m",
  n: "n",
  o: "o",
  p: "p",
  r: "r",
  rr: "r",
  s: "s",
  sh: "ʃ",
  t: "t",
  tS: "tʃ",
  th: "θ",
  u: "u",
  v: "v",
  w: "w",
  x: "x",
  y: "ʝ",
  z: "s",
  β: "β",
  ð: "ð",
  ŋ: "ŋ",
  ɲ: "ɲ",
  ɾ: "ɾ",
  ʃ: "ʃ",
  ʎ: "ʎ",
  ʝ: "ʝ",
  θ: "θ",
  χ: "χ",
});

const AMBIGUOUS_SOURCE_SYMBOLS = Object.freeze({
  R: "rhotic-symbol-inventory-review-required",
  r: "rhotic-symbol-inventory-review-required",
  rr: "rhotic-symbol-inventory-review-required",
  z: "seseo-source-variant-risk",
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

function roundRatio(numerator, denominator) {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(6));
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
    return (
      "{" +
      entries
        .map(
          ([key, entryValue]) =>
            `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
        )
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function sourceMetadata({
  datasetSha256 = null,
  sourceUrl = null,
  sourceMembers = [],
} = {}) {
  return {
    publisherId: OPENSLR_PUBLISHER_ID,
    name: "OpenSLR Santiago Spanish Lexicon",
    resourceId: OPENSLR_RESOURCE_ID,
    datasetVersion: OPENSLR_DATASET_VERSION,
    license: OPENSLR_LICENSE,
    independenceGroup: OPENSLR_INDEPENDENCE_GROUP,
    sourceUrl: sourceUrl ?? OPENSLR_OFFICIAL_SOURCE_URLS[0],
    datasetSha256,
    sourceMembers: uniqueSorted(sourceMembers, "es"),
    localeBoundary: OPENSLR_LOCALE_BOUNDARY,
  };
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
  return normalizeReferenceWord(value).toLocaleLowerCase("es-ES");
}

export function assertSafeOpenSlrUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !OPENSLR_OFFICIAL_SOURCE_URLS.includes(url.href)
  ) {
    throw new Error(`Unsafe or unofficial OpenSLR URL rejected: ${value}`);
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
    `OpenSLR reference output must remain under ${REFERENCE_OUTPUT_ROOT}`,
  );
}

export function assertSafeAuditInputPath(value) {
  return assertPathUnder(
    AUDIT_ROOT,
    value,
    `Audit plan input must remain under ${AUDIT_ROOT}`,
  );
}

export function getDefaultOpenSlrOutputDir() {
  return path.join(REFERENCE_OUTPUT_ROOT, "openslr-santiago-spanish");
}

export function buildOpenSlrReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
}) {
  const byAssetId = new Map();
  for (const asset of sourceAssets) {
    if (!asset?.sourceAssetId) {
      throw new Error("Every source asset must have a sourceAssetId");
    }
    if (byAssetId.has(asset.sourceAssetId)) {
      throw new Error(`Duplicate source asset ID: ${asset.sourceAssetId}`);
    }
    byAssetId.set(asset.sourceAssetId, asset);
  }

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
  const spanishAssets = unresolvedAssets.filter(
    (asset) => asset.languageId === "es-ES",
  );

  const groups = new Map();
  for (const asset of spanishAssets) {
    const text = normalizeReferenceWord(asset.text);
    const key = wordKey(text);
    const group = groups.get(key) ?? {
      languageId: "es-ES",
      text,
      lookupKey: key,
      sourceAssetIds: [],
      currentCanonicalIpas: [],
      targetUnits: [],
      phonemePageIds: [],
      relationshipIssues: [],
      roles: [],
    };
    group.sourceAssetIds.push(asset.sourceAssetId);
    group.currentCanonicalIpas.push(asset.canonicalIpa);
    group.targetUnits.push(...(asset.targetUnits ?? []));
    group.phonemePageIds.push(...(asset.phonemePageIds ?? []));
    group.relationshipIssues.push(...(asset.relationshipIssues ?? []));
    group.roles.push(asset.role);
    groups.set(key, group);
  }

  const items = [...groups.values()]
    .map((group) => ({
      ...group,
      sourceAssetIds: uniqueSorted(group.sourceAssetIds),
      currentCanonicalIpas: uniqueSorted(group.currentCanonicalIpas, "es"),
      targetUnits: uniqueSorted(group.targetUnits),
      phonemePageIds: uniqueSorted(group.phonemePageIds),
      relationshipIssues: uniqueSorted(group.relationshipIssues),
      roles: uniqueSorted(group.roles),
      publisherId: OPENSLR_PUBLISHER_ID,
      independenceGroup: OPENSLR_INDEPENDENCE_GROUP,
      localeMatchStatus: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "es-ES"));

  const deterministic = {
    version: 1,
    tool: "openslr-spanish-reference-enrichment",
    ...sourceMetadata(),
    strictQueueSourceAssetCount: unresolvedAssets.length,
    sourceAssetCount: spanishAssets.length,
    wordCount: items.length,
    byLanguage: {
      "es-ES": {
        sourceAssetCount: spanishAssets.length,
        wordCount: items.length,
      },
    },
    safety: {
      confirmationEffect: "observation-only",
      autoConfirmationAllowed: false,
      formalAudioMutationAllowed: false,
    },
    items,
  };

  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
  };
}

export function buildOpenSlrPlanReport(plan) {
  return {
    version: 1,
    planSha256: plan.planSha256,
    source: sourceMetadata(),
    queueCoverage: {
      strictQueueSourceAssetCount: plan.strictQueueSourceAssetCount,
      targetSourceAssetCount: plan.sourceAssetCount,
      targetWordCount: plan.wordCount,
      targetAssetRatio: roundRatio(
        plan.sourceAssetCount,
        plan.strictQueueSourceAssetCount,
      ),
    },
    confirmationCoverage: {
      eligibleSourceAssetCount: 0,
      eligibleWordCount: 0,
      reason: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
    },
    safety: {
      networkRequestsMade: 0,
      formalAudioMutationCount: 0,
      autoConfirmationAllowed: false,
    },
  };
}

function stripPairedDelimiters(value) {
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

function looksLikeDirectIpa(value) {
  const normalized = String(value ?? "").trim();
  return (
    (/^\/.*\/$/u.test(normalized) || /^\[.*\]$/u.test(normalized)) &&
    normalized.length > 2
  );
}

function tokenizeCompactPhonemes(value) {
  const symbols = Object.keys(SPANISH_PHONEME_TO_IPA).sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "en"),
  );
  const tokens = [];
  let offset = 0;
  while (offset < value.length) {
    const match = symbols.find((symbol) => value.startsWith(symbol, offset));
    if (!match) {
      const codePoint = String.fromCodePoint(value.codePointAt(offset));
      tokens.push(codePoint);
      offset += codePoint.length;
      continue;
    }
    tokens.push(match);
    offset += match.length;
  }
  return tokens;
}

function normalizePhonemeTokens(value) {
  const stripped = stripPairedDelimiters(value).replace(/\s+/gu, " ").trim();
  if (!stripped) return [];
  if (/\s/u.test(stripped)) return stripped.split(" ");
  return tokenizeCompactPhonemes(stripped);
}

export function mapSantiagoPhonemesToIpa(value, { providedIpa = false } = {}) {
  const rawPhonemes = String(value ?? "");
  const normalizedPhonemes = stripPairedDelimiters(rawPhonemes)
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalizedPhonemes) {
    return {
      rawPhonemes,
      normalizedPhonemes,
      rawIpa: null,
      normalizedIpa: null,
      mappingStatus: "missing-phonemes",
      mappingScheme: "santiago-spanish-conservative-v1",
      unmappedSymbols: [],
      mappingWarnings: [],
    };
  }

  if (providedIpa || looksLikeDirectIpa(rawPhonemes)) {
    const normalizedIpa = stripPairedDelimiters(rawPhonemes)
      .replace(/\s+/gu, "")
      .normalize("NFC");
    return {
      rawPhonemes,
      normalizedPhonemes,
      rawIpa: rawPhonemes.normalize("NFC").trim(),
      normalizedIpa,
      mappingStatus: "provided-ipa",
      mappingScheme: "source-provided-ipa",
      unmappedSymbols: [],
      mappingWarnings: [],
    };
  }

  const tokens = normalizePhonemeTokens(rawPhonemes);
  const unmappedSymbols = [];
  const mappingWarnings = [];
  const mapped = [];
  for (const token of tokens) {
    const stressMatch = token.match(/^(.+?)([012])$/u);
    const baseToken = stressMatch ? stressMatch[1] : token;
    if (stressMatch) {
      mappingWarnings.push("numeric-stress-position-review-required");
    }
    if (!Object.hasOwn(SPANISH_PHONEME_TO_IPA, baseToken)) {
      unmappedSymbols.push(baseToken);
      continue;
    }
    mapped.push(SPANISH_PHONEME_TO_IPA[baseToken]);
    if (Object.hasOwn(AMBIGUOUS_SOURCE_SYMBOLS, baseToken)) {
      mappingWarnings.push(AMBIGUOUS_SOURCE_SYMBOLS[baseToken]);
    }
  }
  const uniqueUnmappedSymbols = uniqueSorted(unmappedSymbols, "es");
  const uniqueWarnings = uniqueSorted(mappingWarnings);
  const normalizedIpa =
    uniqueUnmappedSymbols.length === 0 && mapped.length > 0
      ? mapped.join("").normalize("NFC")
      : null;
  let mappingStatus = "mapped-conservative-phonemes";
  if (uniqueUnmappedSymbols.length > 0) {
    mappingStatus = "manual-mapping-required";
  } else if (uniqueWarnings.length > 0) {
    mappingStatus = "mapped-with-review-warnings";
  }
  return {
    rawPhonemes,
    normalizedPhonemes,
    rawIpa: null,
    normalizedIpa,
    mappingStatus,
    mappingScheme: "santiago-spanish-conservative-v1",
    unmappedSymbols: uniqueUnmappedSymbols,
    mappingWarnings: uniqueWarnings,
  };
}

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/u, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-ES")
    .replace(/[^a-z0-9]/gu, "");
}

function splitLexiconLine(line) {
  const trimmed = String(line).trim();
  if (trimmed.includes("\t")) {
    return {
      delimiter: "tab",
      fields: trimmed.split("\t").map((x) => x.trim()),
    };
  }
  if (trimmed.includes(";")) {
    return {
      delimiter: "semicolon",
      fields: trimmed.split(";").map((x) => x.trim()),
    };
  }
  if (trimmed.includes(",")) {
    return {
      delimiter: "comma",
      fields: trimmed.split(",").map((x) => x.trim()),
    };
  }
  return {
    delimiter: "whitespace",
    fields: trimmed.split(/\s+/u),
  };
}

function normalizeLexiconWord(value) {
  return normalizeReferenceWord(
    String(value ?? "")
      .replace(/^["']|["']$/gu, "")
      .replace(/\(\d+\)$/u, ""),
  );
}

function parseSourceRows(source, wanted, matches) {
  const lines = String(source.text)
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u);
  let wordIndex = 0;
  let pronunciationIndex = 1;
  let providedIpa = false;
  let headerDetected = false;
  let sourceRowCount = 0;
  let malformedRowCount = 0;
  let ignoredRowCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || /^(?:#|\/\/)/u.test(line)) {
      ignoredRowCount += 1;
      continue;
    }
    const split = splitLexiconLine(line);
    if (!headerDetected) {
      const normalizedHeaders = split.fields.map(normalizeHeader);
      const candidateWordIndex = normalizedHeaders.findIndex((header) =>
        WORD_HEADERS.has(header),
      );
      const candidatePronunciationIndex = normalizedHeaders.findIndex(
        (header) => PRONUNCIATION_HEADERS.has(header),
      );
      if (candidateWordIndex >= 0 && candidatePronunciationIndex >= 0) {
        wordIndex = candidateWordIndex;
        pronunciationIndex = candidatePronunciationIndex;
        providedIpa = normalizedHeaders[candidatePronunciationIndex] === "ipa";
        headerDetected = true;
        ignoredRowCount += 1;
        continue;
      }
      headerDetected = true;
    }

    sourceRowCount += 1;
    if (
      split.fields.length < 2 ||
      wordIndex >= split.fields.length ||
      pronunciationIndex >= split.fields.length
    ) {
      malformedRowCount += 1;
      continue;
    }
    let orthography;
    try {
      orthography = normalizeLexiconWord(split.fields[wordIndex]);
    } catch {
      malformedRowCount += 1;
      continue;
    }
    const key = wordKey(orthography);
    if (!wanted.has(key)) continue;

    let pronunciation = split.fields[pronunciationIndex];
    if (
      split.delimiter === "whitespace" &&
      pronunciationIndex === split.fields.length - 1
    ) {
      pronunciation = split.fields.slice(pronunciationIndex).join(" ");
    } else if (split.delimiter === "whitespace" && pronunciationIndex === 1) {
      pronunciation = split.fields.slice(1).join(" ");
    }
    const mapping = mapSantiagoPhonemesToIpa(pronunciation, { providedIpa });
    matches.get(key).push({
      sourceMember: source.name,
      sourceLine: index + 1,
      sourceEncoding: source.encoding ?? "utf8",
      rawWord: split.fields[wordIndex],
      orthography,
      ...mapping,
    });
  }

  return {
    sourceMember: source.name,
    encoding: source.encoding ?? "utf8",
    sourceRowCount,
    malformedRowCount,
    ignoredRowCount,
  };
}

function entryStatus(wordMatches) {
  if (wordMatches.length === 0) return "not-found";
  const withPhonemes = wordMatches.filter(
    (match) => match.mappingStatus !== "missing-phonemes",
  );
  if (withPhonemes.length === 0) return "matched-without-phonemes";
  const mapped = withPhonemes.filter((match) => match.normalizedIpa);
  const manual = withPhonemes.filter(
    (match) => match.mappingStatus === "manual-mapping-required",
  );
  if (mapped.length === 0 && manual.length > 0) {
    return "phonemes-observed-manual-mapping-required";
  }
  if (mapped.length > 0 && manual.length > 0) {
    return "partial-ipa-mapping-observed";
  }
  if (
    mapped.some(
      (match) => match.mappingStatus === "mapped-with-review-warnings",
    )
  ) {
    return "mapped-ipa-observed-review-required";
  }
  return "mapped-ipa-observed";
}

export function parseOpenSlrLexiconSources(
  sources,
  { items, datasetSha256 = null, sourceUrl = null },
) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("OpenSLR parse requires at least one lexicon source");
  }
  const wanted = new Map(items.map((item) => [item.lookupKey, item]));
  const matches = new Map(items.map((item) => [item.lookupKey, []]));
  const sourceStats = sources.map((source) =>
    parseSourceRows(source, wanted, matches),
  );
  const sourceMembers = sourceStats.map((stat) => stat.sourceMember);
  const metadata = sourceMetadata({
    datasetSha256,
    sourceUrl,
    sourceMembers,
  });

  const entries = items.map((item) => {
    const wordMatches = matches.get(item.lookupKey) ?? [];
    const status = entryStatus(wordMatches);
    const mapped = wordMatches.filter((match) => match.normalizedIpa);
    return {
      version: 1,
      languageId: "es-ES",
      text: item.text,
      source: metadata,
      sourceAssetIds: item.sourceAssetIds,
      currentCanonicalIpas: item.currentCanonicalIpas,
      targetUnits: item.targetUnits,
      phonemePageIds: item.phonemePageIds,
      relationshipIssues: item.relationshipIssues,
      status,
      rawPhonemes: uniqueSorted(
        wordMatches.map((match) => match.rawPhonemes),
        "es",
      ),
      normalizedPhonemes: uniqueSorted(
        wordMatches.map((match) => match.normalizedPhonemes),
        "es",
      ),
      rawIpa: uniqueSorted(
        wordMatches.map((match) => match.rawIpa),
        "es",
      ),
      normalizedIpa: uniqueSorted(
        mapped.map((match) => match.normalizedIpa),
        "es",
      ),
      mappings: wordMatches,
      variantRisk: {
        status: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
        sourceLanguageId: OPENSLR_LOCALE_BOUNDARY.sourceLanguageId,
        targetLanguageId: OPENSLR_LOCALE_BOUNDARY.targetLanguageId,
        reasons: [
          "source-is-santiago-chile",
          "target-is-peninsular-spanish",
          "dialect-equivalence-not-established",
        ],
      },
      confirmationEffect: "observation-only",
      autoConfirmationAllowed: false,
      reviewRequired: true,
    };
  });

  return {
    version: 1,
    source: metadata,
    sourceStats,
    sourceRowCount: sourceStats.reduce(
      (sum, stat) => sum + stat.sourceRowCount,
      0,
    ),
    malformedRowCount: sourceStats.reduce(
      (sum, stat) => sum + stat.malformedRowCount,
      0,
    ),
    ignoredRowCount: sourceStats.reduce(
      (sum, stat) => sum + stat.ignoredRowCount,
      0,
    ),
    entries,
  };
}

export function buildOpenSlrReferenceOutputs(
  plan,
  parsed,
  { acquisitionMode = null, acquisitionNetworkRequests = 0 } = {},
) {
  const entries = parsed.entries ?? [];
  const byText = new Map(entries.map((entry) => [wordKey(entry.text), entry]));
  const observations = [];
  const unresolved = [];

  for (const item of plan.items) {
    const entry = byText.get(item.lookupKey);
    if (!entry) {
      unresolved.push({
        languageId: "es-ES",
        text: item.text,
        sourceAssetIds: item.sourceAssetIds,
        reason: "parse-result-missing",
      });
      continue;
    }
    if (
      entry.status !== "not-found" &&
      entry.status !== "matched-without-phonemes"
    ) {
      observations.push(entry);
    }
    const mappingIncomplete = ![
      "mapped-ipa-observed",
      "mapped-ipa-observed-review-required",
    ].includes(entry.status);
    unresolved.push({
      languageId: "es-ES",
      text: item.text,
      sourceAssetIds: item.sourceAssetIds,
      reason: mappingIncomplete
        ? entry.status
        : OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
      localeMatchStatus: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
      rawPhonemes: entry.rawPhonemes,
      normalizedPhonemes: entry.normalizedPhonemes,
      rawIpa: entry.rawIpa,
      normalizedIpa: entry.normalizedIpa,
      unmappedSymbols: uniqueSorted(
        entry.mappings.flatMap((mapping) => mapping.unmappedSymbols ?? []),
        "es",
      ),
      mappingWarnings: uniqueSorted(
        entry.mappings.flatMap((mapping) => mapping.mappingWarnings ?? []),
      ),
    });
  }

  const observedAssetIds = new Set(
    observations.flatMap((entry) => entry.sourceAssetIds),
  );
  const mappedEntries = entries.filter((entry) =>
    ["mapped-ipa-observed", "mapped-ipa-observed-review-required"].includes(
      entry.status,
    ),
  );
  const mappedAssetIds = new Set(
    mappedEntries.flatMap((entry) => entry.sourceAssetIds),
  );
  const partialMappedIpaWordCount = entries.filter(
    (entry) => entry.status === "partial-ipa-mapping-observed",
  ).length;
  const manualMappingRequiredWordCount = entries.filter((entry) =>
    [
      "phonemes-observed-manual-mapping-required",
      "partial-ipa-mapping-observed",
    ].includes(entry.status),
  ).length;
  const notFoundWordCount = entries.filter(
    (entry) => entry.status === "not-found",
  ).length;
  const matchedWithoutPhonemesWordCount = entries.filter(
    (entry) => entry.status === "matched-without-phonemes",
  ).length;
  const coverage = {
    targetSourceAssetCount: plan.sourceAssetCount,
    targetWordCount: plan.wordCount,
    observedSourceAssetCount: observedAssetIds.size,
    observationWordCount: observations.length,
    mappedIpaSourceAssetCount: mappedAssetIds.size,
    mappedIpaWordCount: mappedEntries.length,
    partialMappedIpaWordCount,
    manualMappingRequiredWordCount,
    notFoundWordCount,
    matchedWithoutPhonemesWordCount,
    variantRiskSourceAssetCount: observedAssetIds.size,
    variantRiskWordCount: observations.length,
    targetLocaleConfirmedSourceAssetCount: 0,
    targetLocaleConfirmedWordCount: 0,
    sourceAssetObservationRate: roundRatio(
      observedAssetIds.size,
      plan.sourceAssetCount,
    ),
    wordObservationRate: roundRatio(observations.length, plan.wordCount),
    targetLocaleConfirmationRate: 0,
  };

  return {
    observations: {
      version: 1,
      planSha256: plan.planSha256,
      publisherId: OPENSLR_PUBLISHER_ID,
      independenceGroup: OPENSLR_INDEPENDENCE_GROUP,
      warning:
        "OpenSLR SLR34 is a Santiago/Chilean Spanish observation source. It is independent evidence, but it cannot automatically confirm peninsular es-ES pronunciation.",
      localeBoundary: OPENSLR_LOCALE_BOUNDARY,
      coverage,
      entries: observations,
    },
    unresolved: {
      version: 1,
      planSha256: plan.planSha256,
      unresolvedCount: unresolved.length,
      unresolvedSourceAssetCount: new Set(
        unresolved.flatMap((entry) => entry.sourceAssetIds),
      ).size,
      entries: unresolved,
    },
    report: {
      version: 1,
      planSha256: plan.planSha256,
      source: parsed.source,
      acquisition: {
        mode: acquisitionMode,
        networkRequestsMade: acquisitionNetworkRequests,
      },
      parse: {
        sourceRowCount: parsed.sourceRowCount,
        malformedRowCount: parsed.malformedRowCount,
        sourceMembers: parsed.source.sourceMembers,
      },
      coverage,
      disposition: {
        status: "observation-only-cross-locale",
        autoConfirmationAllowed: false,
        allObservedEntriesRequireVariantReview: true,
        formalAudioMutationCount: 0,
      },
    },
  };
}

function readTarString(buffer, start, length) {
  const end = buffer.indexOf(0, start);
  const safeEnd = end >= start && end < start + length ? end : start + length;
  return buffer.subarray(start, safeEnd).toString("utf8").trim();
}

function parseTarNumber(buffer, start, length) {
  const raw = readTarString(buffer, start, length).replace(/\s+/gu, "");
  if (!raw) return 0;
  if (!/^[0-7]+$/u.test(raw)) {
    throw new Error("OpenSLR tar contains an invalid octal number");
  }
  return Number.parseInt(raw, 8);
}

function assertSafeTarMemberName(value) {
  const normalized = String(value).replace(/\\/gu, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/iu.test(normalized)
  ) {
    throw new Error(`Unsafe OpenSLR tar member path: ${value}`);
  }
  const resolved = path.posix.normalize(normalized);
  if (resolved === ".." || resolved.startsWith("../")) {
    throw new Error(`Unsafe OpenSLR tar member path: ${value}`);
  }
  return resolved;
}

function validateTarChecksum(header) {
  const expected = parseTarNumber(header, 148, 8);
  if (expected === 0) return;
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : header[index];
  }
  if (actual !== expected) {
    throw new Error("OpenSLR tar header checksum mismatch");
  }
}

function parseTarEntries(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    validateTarChecksum(header);
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const memberName = assertSafeTarMemberName(
      prefix ? `${prefix}/${name}` : name,
    );
    const size = parseTarNumber(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > buffer.length) {
      throw new Error("OpenSLR tar member exceeds archive bounds");
    }
    if (type === "0" || type === "\u0000") {
      entries.push({
        name: memberName,
        buffer: buffer.subarray(contentStart, contentEnd),
      });
    }
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function lexiconMemberScore(memberName) {
  const normalized = memberName.replace(/\\/gu, "/");
  const extension = path.posix.extname(normalized).toLocaleLowerCase("en-US");
  if (!TEXT_EXTENSIONS.has(extension)) return -1;
  const basename = path.posix
    .basename(normalized, extension)
    .toLocaleLowerCase("en-US");
  if (DOCUMENT_BASENAMES.has(basename)) return -1;
  let score = 10;
  if ([".dic", ".dict", ".lex", ".lexicon"].includes(extension)) score += 40;
  if (/lexicon|lexico|diccionario/iu.test(normalized)) score += 100;
  if (/santiago/iu.test(normalized)) score += 60;
  if (/phone(?:me)?s?|symbols?|inventory/iu.test(normalized)) score -= 30;
  return score;
}

function decodeLexiconBuffer(buffer) {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return { text: utf8, encoding: "utf8" };
  return { text: buffer.toString("latin1"), encoding: "latin1-fallback" };
}

export function extractOpenSlrLexiconMembers(archiveBuffer) {
  if (!Buffer.isBuffer(archiveBuffer)) {
    throw new Error("OpenSLR archive must be a Buffer");
  }
  if (
    archiveBuffer.length < 2 ||
    archiveBuffer[0] !== 0x1f ||
    archiveBuffer[1] !== 0x8b
  ) {
    throw new Error("OpenSLR archive must be gzip-compressed tar data");
  }
  let expanded;
  try {
    expanded = gunzipSync(archiveBuffer, {
      maxOutputLength: MAX_EXPANDED_BYTES,
    });
  } catch (error) {
    throw new Error(
      "OpenSLR archive decompression failed: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  const candidates = parseTarEntries(expanded)
    .map((entry) => ({ ...entry, score: lexiconMemberScore(entry.name) }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.name.localeCompare(b.name, "en", { numeric: true }),
    );
  if (candidates.length === 0) {
    throw new Error(
      "OpenSLR archive contains no supported lexicon text member",
    );
  }
  const highestScore = candidates[0].score;
  return candidates
    .filter((entry) => entry.score === highestScore)
    .map((entry) => ({
      name: entry.name,
      ...decodeLexiconBuffer(entry.buffer),
    }));
}

export function detectOpenSlrSourceFormat(buffer, fileName = "") {
  if (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 2 &&
    buffer[0] === 0x1f &&
    buffer[1] === 0x8b
  ) {
    return "tar-gzip";
  }
  const lowerName = String(fileName).toLocaleLowerCase("en-US");
  if (
    lowerName.endsWith(".tar.gz") ||
    lowerName.endsWith(".tgz") ||
    TEXT_EXTENSIONS.has(path.extname(lowerName))
  ) {
    return lowerName.endsWith(".tar.gz") || lowerName.endsWith(".tgz")
      ? "tar-gzip"
      : "lexicon-text";
  }
  throw new Error(
    "OpenSLR source must be a .tar.gz/.tgz archive or an extracted lexicon text file",
  );
}

export function validateOpenSlrSourceBuffer(buffer, sourceFormat) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("OpenSLR source is empty");
  }
  if (buffer.length > MAX_ARCHIVE_BYTES) {
    throw new Error("OpenSLR source exceeds the 64 MiB safety limit");
  }
  if (sourceFormat === "tar-gzip") {
    extractOpenSlrLexiconMembers(buffer);
    return;
  }
  if (sourceFormat !== "lexicon-text") {
    throw new Error(`Unsupported OpenSLR source format: ${sourceFormat}`);
  }
  const prefix = buffer
    .subarray(0, Math.min(buffer.length, 16_384))
    .toString("utf8");
  if (/^\s*<(?:!doctype|html)/iu.test(prefix)) {
    throw new Error("OpenSLR source unexpectedly contains HTML");
  }
  if (prefix.includes("\u0000")) {
    throw new Error("OpenSLR lexicon text contains binary NUL bytes");
  }
  const plausibleRows = prefix
    .split(/\r?\n/u)
    .filter(
      (line) =>
        line.trim() &&
        !/^(?:#|\/\/)/u.test(line.trim()) &&
        splitLexiconLine(line).fields.length >= 2,
    );
  if (plausibleRows.length === 0) {
    throw new Error("OpenSLR lexicon text has no plausible pronunciation rows");
  }
}

export function sourceBufferToLexiconSources(
  buffer,
  { sourceFormat, memberName = "imported-lexicon.txt" },
) {
  validateOpenSlrSourceBuffer(buffer, sourceFormat);
  if (sourceFormat === "tar-gzip") {
    return extractOpenSlrLexiconMembers(buffer);
  }
  return [{ name: memberName, ...decodeLexiconBuffer(buffer) }];
}

export function buildOpenSlrCheckpoint(plan, source) {
  return {
    version: 1,
    planSha256: plan.planSha256,
    publisherId: OPENSLR_PUBLISHER_ID,
    independenceGroup: OPENSLR_INDEPENDENCE_GROUP,
    resourceId: OPENSLR_RESOURCE_ID,
    datasetVersion: OPENSLR_DATASET_VERSION,
    license: OPENSLR_LICENSE,
    localeBoundary: OPENSLR_LOCALE_BOUNDARY,
    source,
  };
}

export const OPENSLR_AUDIT_ROOT = AUDIT_ROOT;
export const OPENSLR_REFERENCE_OUTPUT_ROOT = REFERENCE_OUTPUT_ROOT;
export const OPENSLR_MAX_SOURCE_BYTES = MAX_ARCHIVE_BYTES;
