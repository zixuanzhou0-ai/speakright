import { createHash } from "node:crypto";
import path from "node:path";

const LANGUAGE_NAMES = Object.freeze({
  "en-US": "English",
  "es-ES": "Spanish",
  "fr-FR": "French",
  "ru-RU": "Russian",
});

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const REFERENCE_OUTPUT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
  "reference-sources",
);

function uniqueSorted(values) {
  return [
    ...new Set(values.filter((value) => value !== undefined && value !== null)),
  ].sort((a, b) => String(a).localeCompare(String(b), "en"));
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

export function encodeKaikkiPathSegment(value) {
  const bytes = Buffer.from(String(value).normalize("NFC"), "utf8");
  let encoded = "";
  for (const byte of bytes) {
    const char = String.fromCharCode(byte);
    if (/^[A-Za-z0-9._~-]$/.test(char)) {
      encoded += char;
    } else {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return encoded;
}

export function normalizeReferenceWord(text) {
  const normalized = String(text ?? "")
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

export function buildKaikkiWordUrl(languageId, text) {
  const languageName = LANGUAGE_NAMES[languageId];
  if (!languageName) {
    throw new Error(`Unsupported Kaikki language: ${languageId}`);
  }
  const word = normalizeReferenceWord(text);
  const characters = Array.from(word);
  const first = characters.slice(0, 1).join("");
  const firstTwo = characters.slice(0, 2).join("");
  const url = new URL(
    [
      "https://kaikki.org/dictionary",
      encodeKaikkiPathSegment(languageName),
      "meaning",
      encodeKaikkiPathSegment(first),
      encodeKaikkiPathSegment(firstTwo),
      `${encodeKaikkiPathSegment(word)}.html`,
    ].join("/"),
  );
  assertSafeKaikkiUrl(url.href, languageId);
  return url.href;
}

export function assertSafeKaikkiUrl(value, languageId) {
  const url = new URL(value);
  const languageName = LANGUAGE_NAMES[languageId];
  if (!languageName) {
    throw new Error(`Unsupported Kaikki language: ${languageId}`);
  }
  const expectedPrefix = `/dictionary/${encodeKaikkiPathSegment(languageName)}/meaning/`;
  if (
    url.protocol !== "https:" ||
    url.hostname !== "kaikki.org" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(expectedPrefix) ||
    !url.pathname.endsWith(".html") ||
    url.pathname.includes("..") ||
    url.pathname.includes("%2F") ||
    url.pathname.includes("%5C")
  ) {
    throw new Error(`Unsafe Kaikki URL rejected: ${value}`);
  }
  return url.href;
}

export function assertSafeReferenceOutputDir(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(REFERENCE_OUTPUT_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Reference output must remain under ${REFERENCE_OUTPUT_ROOT}`,
    );
  }
  return resolved;
}

export function getDefaultKaikkiOutputDir() {
  return path.join(REFERENCE_OUTPUT_ROOT, "kaikki");
}

export function assertFetchConfirmed(confirmed) {
  if (!confirmed) {
    throw new Error("Network fetch refused: pass --confirm explicitly");
  }
}

export function buildKaikkiReferencePlan({
  sourceAssets,
  unresolvedSourceAssetIds,
}) {
  const byAssetId = new Map(
    sourceAssets.map((asset) => [asset.sourceAssetId, asset]),
  );
  const selected = uniqueSorted(unresolvedSourceAssetIds).map((assetId) => {
    const asset = byAssetId.get(assetId);
    if (!asset) {
      throw new Error(
        `Unresolved source asset is missing from base plan: ${assetId}`,
      );
    }
    if (!LANGUAGE_NAMES[asset.languageId]) {
      throw new Error(`Unsupported source language: ${asset.languageId}`);
    }
    return asset;
  });

  const groups = new Map();
  for (const asset of selected) {
    const text = normalizeReferenceWord(asset.text);
    const key = `${asset.languageId}\u0000${text.toLocaleLowerCase(asset.languageId)}`;
    const group = groups.get(key) ?? {
      languageId: asset.languageId,
      text,
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
      sourceUrl: buildKaikkiWordUrl(group.languageId, group.text),
      independenceGroup: "wiktionary",
    }))
    .sort(
      (a, b) =>
        a.languageId.localeCompare(b.languageId, "en") ||
        a.text.localeCompare(b.text, a.languageId),
    );

  const byLanguage = Object.fromEntries(
    Object.keys(LANGUAGE_NAMES).map((languageId) => [
      languageId,
      {
        sourceAssetCount: selected.filter(
          (asset) => asset.languageId === languageId,
        ).length,
        wordCount: items.filter((item) => item.languageId === languageId)
          .length,
      },
    ]),
  );
  const deterministic = {
    version: 1,
    provider: "kaikki.org",
    independenceGroup: "wiktionary",
    sourceAssetCount: selected.length,
    wordCount: items.length,
    byLanguage,
    items,
  };
  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
  };
}

export function rebaseKaikkiCheckpoint(plan, previousCheckpoint) {
  if (
    !plan ||
    typeof plan.planSha256 !== "string" ||
    !plan.planSha256 ||
    !Array.isArray(plan.items)
  ) {
    throw new Error("Current Kaikki plan is invalid");
  }
  if (!previousCheckpoint || typeof previousCheckpoint !== "object") {
    throw new Error("Previous Kaikki checkpoint is invalid");
  }

  const items = {};
  const unavailable = [];
  let reusedFetchedItemCount = 0;
  let carriedForwardFailureCount = 0;
  for (const item of plan.items) {
    if (
      !item ||
      typeof item.sourceUrl !== "string" ||
      typeof item.languageId !== "string"
    ) {
      throw new Error("Current Kaikki plan contains an invalid item");
    }
    const sourceUrl = assertSafeKaikkiUrl(item.sourceUrl, item.languageId);
    if (items[sourceUrl]) {
      throw new Error(
        `Current Kaikki plan contains duplicate URL: ${sourceUrl}`,
      );
    }
    const record = previousCheckpoint.items?.[sourceUrl];
    const isFetchedCache =
      record?.status === "fetched" &&
      typeof record.htmlFile === "string" &&
      Boolean(record.htmlFile.trim());
    const isTerminalFailure =
      record?.status === "fetch-failed" &&
      typeof record.error === "string" &&
      Boolean(record.error.trim()) &&
      record.htmlFile == null &&
      record.observation == null;
    if (record?.status === "fetched" && !isFetchedCache) {
      unavailable.push(sourceUrl);
      continue;
    }
    if (!isFetchedCache && !isTerminalFailure) {
      unavailable.push(sourceUrl);
      continue;
    }
    if (isFetchedCache) reusedFetchedItemCount += 1;
    else carriedForwardFailureCount += 1;
    items[sourceUrl] = structuredClone(record);
  }

  if (unavailable.length > 0) {
    throw new Error(
      `Offline Kaikki checkpoint rebase requires fetched HTML or a terminal fetch-failed record for every current URL; unavailable: ${unavailable.join(", ")}`,
    );
  }

  return {
    ...structuredClone(previousCheckpoint),
    version: previousCheckpoint.version ?? 1,
    planSha256: plan.planSha256,
    items,
    lastOperation: {
      operation: "rebase",
      mode: "offline",
      sourcePlanSha256: previousCheckpoint.planSha256 ?? null,
      targetPlanSha256: plan.planSha256,
      reusedItemCount: plan.items.length,
      reusedFetchedItemCount,
      carriedForwardFailureCount,
      networkRequestsMade: 0,
    },
  };
}

export function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/giu, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/gu, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&quot;/gu, '"')
    .replace(/&apos;|&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/&nbsp;/gu, " ");
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeIpaValue(value) {
  return decodeHtmlEntities(String(value)).normalize("NFC").trim();
}

function collectIpasFromJson(value, output) {
  if (Array.isArray(value)) {
    for (const item of value) collectIpasFromJson(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value.sounds)) {
    for (const sound of value.sounds) {
      if (sound && typeof sound.ipa === "string" && sound.ipa.trim()) {
        output.push(normalizeIpaValue(sound.ipa));
      }
    }
  }
  for (const entryValue of Object.values(value)) {
    if (entryValue && typeof entryValue === "object")
      collectIpasFromJson(entryValue, output);
  }
}

function extractIpaTokens(text) {
  return [
    ...String(text).matchAll(/(\/[^/\n<>]{1,180}\/|\[[^\]\n<>]{1,180}\])/gu),
  ].map((match) => normalizeIpaValue(match[1]));
}

export function parseKaikkiHtml(html, { languageId, text, sourceUrl }) {
  assertSafeKaikkiUrl(sourceUrl, languageId);
  const embeddedIpas = [];
  let embeddedJsonCount = 0;
  let embeddedJsonParseFailures = 0;
  const prePattern =
    /<label[^>]*>\[Show JSON for postprocessed kaikki\.org data[\s\S]*?<pre>([\s\S]*?)<\/pre>/giu;
  for (const match of String(html).matchAll(prePattern)) {
    const decoded = decodeHtmlEntities(match[1]).trim();
    try {
      const parsed = JSON.parse(decoded);
      embeddedJsonCount += 1;
      collectIpasFromJson(parsed, embeddedIpas);
    } catch {
      embeddedJsonParseFailures += 1;
    }
  }

  const visibleIpas = [];
  const visiblePattern =
    /<span class="info"><span class="infolabel">IPA<\/span>:\s*([\s\S]*?)<\/span>/giu;
  for (const match of String(html).matchAll(visiblePattern)) {
    visibleIpas.push(...extractIpaTokens(stripHtml(match[1])));
  }

  const extractedAt =
    String(html).match(
      /structured data extracted on\s+(\d{4}-\d{2}-\d{2})/iu,
    )?.[1] ?? null;
  const dumpDate =
    String(html).match(
      /enwiktionary dump dated\s+(\d{4}-\d{2}-\d{2})/iu,
    )?.[1] ?? null;
  const wiktextractRevision =
    String(html).match(/wiktextract\/commit\/([0-9a-f]{7,40})/iu)?.[1] ?? null;
  const wikitextprocessorRevision =
    String(html).match(/wikitextprocessor\/commit\/([0-9a-f]{7,40})/iu)?.[1] ??
    null;
  const htmlTitle = stripHtml(
    String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] ?? "",
  );
  const ipas = uniqueSorted([...embeddedIpas, ...visibleIpas]);

  return {
    version: 1,
    languageId,
    text: normalizeReferenceWord(text),
    source: {
      name: "Kaikki.org structured Wiktionary extract",
      sourceUrl,
      extractedAt,
      dumpDate,
      wiktextractRevision,
      wikitextprocessorRevision,
      license: ["CC-BY-SA", "GFDL"],
      independenceGroup: "wiktionary",
    },
    htmlTitle,
    htmlSha256: sha256(String(html)),
    ipas,
    evidenceOrigins: {
      embeddedJson: uniqueSorted(embeddedIpas),
      visibleHtml: uniqueSorted(visibleIpas),
    },
    embeddedJsonCount,
    embeddedJsonParseFailures,
    status:
      ipas.length > 0
        ? "structured-ipa-observed"
        : "no-structured-ipa-observed",
    confirmationEffect: "observation-only",
  };
}

export function buildReferenceOutputs(plan, checkpoint) {
  const observations = [];
  const unresolved = [];
  for (const item of plan.items) {
    const result = checkpoint.items?.[item.sourceUrl];
    if (result?.status === "fetched" && result.observation) {
      observations.push({
        ...result.observation,
        sourceAssetIds: item.sourceAssetIds,
        currentCanonicalIpas: item.currentCanonicalIpas,
        targetUnits: item.targetUnits,
        phonemePageIds: item.phonemePageIds,
        relationshipIssues: item.relationshipIssues,
      });
      if (result.observation.status !== "structured-ipa-observed") {
        unresolved.push({
          languageId: item.languageId,
          text: item.text,
          sourceUrl: item.sourceUrl,
          reason: result.observation.status,
          sourceAssetIds: item.sourceAssetIds,
        });
      }
      continue;
    }
    unresolved.push({
      languageId: item.languageId,
      text: item.text,
      sourceUrl: item.sourceUrl,
      reason: result?.status ?? "not-fetched",
      detail: result?.error ?? null,
      sourceAssetIds: item.sourceAssetIds,
    });
  }
  return {
    observations: {
      version: 1,
      planSha256: plan.planSha256,
      warning:
        "Kaikki and Wiktionary share independenceGroup=wiktionary. These observations never establish an independent second source or two-source confirmation by themselves.",
      observationCount: observations.length,
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

export const KAIKKI_LANGUAGE_NAMES = LANGUAGE_NAMES;
export const KAIKKI_REFERENCE_OUTPUT_ROOT = REFERENCE_OUTPUT_ROOT;
