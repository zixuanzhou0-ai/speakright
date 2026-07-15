import {
  sha256,
  stableStringify,
} from "./lexique-reference-enrichment-core.mjs";

export const FRENCH_REFERENCE_PROPOSAL_VERSION = 1;

export function assertFrenchReferenceProposalCommand(command) {
  if (command !== "build") {
    throw new Error("Only the offline build command is supported");
  }
  return command;
}

function uniqueSorted(values, locale = "en") {
  return [
    ...new Set(
      values.filter(
        (value) => value !== undefined && value !== null && value !== "",
      ),
    ),
  ].sort((a, b) => String(a).localeCompare(String(b), locale));
}

function wordKey(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("fr-FR");
}

function stripPairedDelimiters(value) {
  if (
    (value.startsWith("/") && value.endsWith("/")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function normalizeComparableFrenchIpa(value) {
  let normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (!normalized) return null;
  normalized = stripPairedDelimiters(normalized).trim();
  if (
    !normalized ||
    /[A-Z~～(){}<>|,;=?\\_\-‿]/u.test(normalized) ||
    /[/[\]]/u.test(normalized) ||
    Array.from(normalized).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    return null;
  }
  normalized = normalized
    .replace(/[\s.·ˈˌ]/gu, "")
    .replace(/ɡ/gu, "g")
    .normalize("NFC");
  return normalized || null;
}

export function normalizeFrenchIpaSet(values) {
  const raw = uniqueSorted((values ?? []).map((value) => String(value)));
  const normalized = [];
  const rejected = [];
  for (const value of raw) {
    const comparable = normalizeComparableFrenchIpa(value);
    if (comparable) normalized.push(comparable);
    else rejected.push(value);
  }
  return {
    raw,
    normalized: uniqueSorted(normalized, "fr-FR"),
    rejected: uniqueSorted(rejected, "fr-FR"),
  };
}

function buildUniqueIndex(entries) {
  const index = new Map();
  for (const entry of entries ?? []) {
    if (entry.languageId !== "fr-FR") continue;
    const key = wordKey(entry.text);
    const group = index.get(key) ?? [];
    group.push(entry);
    index.set(key, group);
  }
  return index;
}

function sameStrings(left, right) {
  const a = uniqueSorted(left);
  const b = uniqueSorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function evidenceForLexique(entry, ipaSet) {
  return {
    publisherId: entry?.source?.publisherId ?? null,
    independenceGroup: entry?.source?.independenceGroup ?? null,
    version: entry?.source?.version ?? null,
    license: entry?.source?.license ?? null,
    sourceUrl: entry?.source?.sourceUrl ?? null,
    datasetSha256: entry?.source?.datasetSha256 ?? null,
    rawIpas: ipaSet.raw,
    normalizedIpas: ipaSet.normalized,
    rejectedIpas: ipaSet.rejected,
    sourceRows: uniqueSorted(
      (entry?.mappings ?? []).map((mapping) => mapping.sourceRow),
    ),
  };
}

function evidenceForKaikki(entry, ipaSet) {
  return {
    publisherId: entry?.source?.publisherId ?? "wikimedia-wiktionary",
    independenceGroup: entry?.source?.independenceGroup ?? null,
    sourceUrl: entry?.source?.sourceUrl ?? null,
    htmlSha256: entry?.htmlSha256 ?? null,
    dumpDate: entry?.source?.dumpDate ?? null,
    extractedAt: entry?.source?.extractedAt ?? null,
    wiktextractRevision: entry?.source?.wiktextractRevision ?? null,
    rawIpas: ipaSet.raw,
    normalizedIpas: ipaSet.normalized,
    rejectedIpas: ipaSet.rejected,
  };
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function evaluateWord(item, lexiqueEntries, kaikkiEntries) {
  const reasons = [];
  const projectIpas = normalizeFrenchIpaSet(item.currentCanonicalIpas);
  const lexiqueEntry = lexiqueEntries.length === 1 ? lexiqueEntries[0] : null;
  const kaikkiEntry = kaikkiEntries.length === 1 ? kaikkiEntries[0] : null;
  const lexiqueIpas = normalizeFrenchIpaSet(lexiqueEntry?.normalizedIpa ?? []);
  const kaikkiIpas = normalizeFrenchIpaSet(kaikkiEntry?.ipas ?? []);

  if (
    (item.targetUnits ?? []).length === 0 ||
    (item.phonemePageIds ?? []).length === 0
  ) {
    addReason(reasons, "relationship-context-missing");
  }
  if ((item.relationshipIssues ?? []).length > 0) {
    addReason(reasons, "relationship-issues");
  }
  if (!(item.relationshipKinds ?? []).includes("target-example")) {
    addReason(reasons, "target-example-relationship-missing");
  }
  if ((item.referenceStatuses ?? []).includes("conflict")) {
    addReason(reasons, "reference-status-conflict");
  }

  if (lexiqueEntries.length === 0) addReason(reasons, "lexique-not-found");
  else if (lexiqueEntries.length > 1)
    addReason(reasons, "lexique-duplicate-observations");
  if (kaikkiEntries.length === 0) addReason(reasons, "kaikki-not-found");
  else if (kaikkiEntries.length > 1)
    addReason(reasons, "kaikki-duplicate-observations");

  if (
    lexiqueEntry &&
    (!sameStrings(lexiqueEntry.sourceAssetIds, item.sourceAssetIds) ||
      lexiqueEntry.source?.publisherId !== "lexique" ||
      lexiqueEntry.source?.independenceGroup !== "lexique")
  ) {
    addReason(reasons, "lexique-scope-or-independence-invalid");
  }
  if (
    kaikkiEntry &&
    (!sameStrings(kaikkiEntry.sourceAssetIds, item.sourceAssetIds) ||
      kaikkiEntry.source?.independenceGroup !== "wiktionary")
  ) {
    addReason(reasons, "kaikki-scope-or-independence-invalid");
  }
  if (lexiqueEntry && lexiqueEntry.status !== "mapped-ipa-observed") {
    addReason(reasons, "lexique-observation-status-invalid");
  }
  if (kaikkiEntry && kaikkiEntry.status !== "structured-ipa-observed") {
    addReason(reasons, "kaikki-observation-status-invalid");
  }

  if (projectIpas.rejected.length > 0 || projectIpas.normalized.length !== 1) {
    addReason(reasons, "project-ipa-ambiguous-or-unmappable");
  }
  if (lexiqueEntry) {
    if (
      lexiqueIpas.rejected.length > 0 ||
      lexiqueIpas.normalized.length === 0
    ) {
      addReason(reasons, "lexique-ipa-missing-or-unmappable");
    } else if (lexiqueIpas.normalized.length > 1) {
      addReason(reasons, "lexique-variants-or-conflict");
    }
  }
  if (kaikkiEntry) {
    if (kaikkiIpas.rejected.length > 0 || kaikkiIpas.normalized.length === 0) {
      addReason(reasons, "kaikki-ipa-missing-or-unmappable");
    } else if (kaikkiIpas.normalized.length > 1) {
      addReason(reasons, "kaikki-variants-or-conflict");
    }
  }

  const projectIpa =
    projectIpas.normalized.length === 1 ? projectIpas.normalized[0] : null;
  const lexiqueIpa =
    lexiqueIpas.normalized.length === 1 ? lexiqueIpas.normalized[0] : null;
  const kaikkiIpa =
    kaikkiIpas.normalized.length === 1 ? kaikkiIpas.normalized[0] : null;
  if (projectIpa && lexiqueIpa && projectIpa !== lexiqueIpa) {
    addReason(reasons, "lexique-project-mismatch");
  }
  if (projectIpa && kaikkiIpa && projectIpa !== kaikkiIpa) {
    addReason(reasons, "kaikki-project-mismatch");
  }
  if (lexiqueIpa && kaikkiIpa && lexiqueIpa !== kaikkiIpa) {
    addReason(reasons, "independent-sources-disagree");
  }

  const common = {
    languageId: "fr-FR",
    text: item.text,
    sourceAssetIds: uniqueSorted(item.sourceAssetIds),
    assetCount: item.sourceAssetIds.length,
    currentCanonicalIpas: uniqueSorted(item.currentCanonicalIpas, "fr-FR"),
    normalizedProjectIpas: projectIpas.normalized,
    referenceStatuses: uniqueSorted(item.referenceStatuses ?? []),
    targetUnits: uniqueSorted(item.targetUnits),
    phonemePageIds: uniqueSorted(item.phonemePageIds),
    relationshipIssues: uniqueSorted(item.relationshipIssues),
    relationshipKinds: uniqueSorted(item.relationshipKinds ?? []),
    relationshipCheck:
      (item.relationshipIssues ?? []).length === 0 &&
      (item.relationshipKinds ?? []).includes("target-example") &&
      (item.targetUnits ?? []).length > 0 &&
      (item.phonemePageIds ?? []).length > 0
        ? "clear"
        : "blocked",
    evidence: {
      project: {
        rawIpas: projectIpas.raw,
        normalizedIpas: projectIpas.normalized,
        rejectedIpas: projectIpas.rejected,
      },
      lexique: evidenceForLexique(lexiqueEntry, lexiqueIpas),
      kaikki: evidenceForKaikki(kaikkiEntry, kaikkiIpas),
    },
  };

  if (reasons.length > 0) {
    return {
      outcome: "blocked",
      entry: {
        ...common,
        reasons: uniqueSorted(reasons),
        proposalEffect: "none",
      },
    };
  }

  const normalizedIpa = projectIpa;
  const proposalIdentity = {
    languageId: "fr-FR",
    text: item.text,
    sourceAssetIds: common.sourceAssetIds,
    normalizedIpa,
    lexiqueDatasetSha256: common.evidence.lexique.datasetSha256,
    kaikkiHtmlSha256: common.evidence.kaikki.htmlSha256,
  };
  return {
    outcome: "proposed",
    entry: {
      proposalId: sha256(stableStringify(proposalIdentity)).slice(0, 20),
      ...common,
      normalizedIpa,
      proposedReferenceStatus: "two-source-confirmed",
      proposalEffect: "proposal-only",
      requiresHumanApplication: true,
      rationale:
        "Project IPA, Lexique 4.00, and Kaikki/Wiktionary each reduce to one identical IPA under formatting-only normalization; relationship checks are clear.",
    },
  };
}

function buildReasonCounts(blockedWords) {
  const counts = new Map();
  for (const entry of blockedWords) {
    for (const reason of entry.reasons) {
      const count = counts.get(reason) ?? { wordCount: 0, assetCount: 0 };
      count.wordCount += 1;
      count.assetCount += entry.assetCount;
      counts.set(reason, count);
    }
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "en")),
  );
}

export function buildFrenchReferenceDecisionProposal({
  strictQueueSourceAssetCount,
  strictItems,
  lexiqueObservations,
  kaikkiObservations,
  inputDigests,
}) {
  const lexiqueIndex = buildUniqueIndex(lexiqueObservations.entries);
  const kaikkiIndex = buildUniqueIndex(kaikkiObservations.entries);
  const sortedItems = [...strictItems].sort((a, b) =>
    a.text.localeCompare(b.text, "fr-FR"),
  );
  const proposedWords = [];
  const blockedWords = [];
  const wordEntries = [];

  for (const item of sortedItems) {
    const key = wordKey(item.text);
    const evaluation = evaluateWord(
      item,
      lexiqueIndex.get(key) ?? [],
      kaikkiIndex.get(key) ?? [],
    );
    if (evaluation.outcome === "proposed") proposedWords.push(evaluation.entry);
    else blockedWords.push(evaluation.entry);
    wordEntries.push({
      text: item.text,
      sourceAssetIds: evaluation.entry.sourceAssetIds,
      assetCount: evaluation.entry.assetCount,
      outcome: evaluation.outcome,
      proposedReferenceStatus: evaluation.entry.proposedReferenceStatus ?? null,
      referenceStatuses: evaluation.entry.referenceStatuses,
      relationshipKinds: evaluation.entry.relationshipKinds,
      normalizedProjectIpas: evaluation.entry.normalizedProjectIpas,
      lexiqueNormalizedIpas: evaluation.entry.evidence.lexique.normalizedIpas,
      kaikkiNormalizedIpas: evaluation.entry.evidence.kaikki.normalizedIpas,
      relationshipCheck: evaluation.entry.relationshipCheck,
      reasons: evaluation.entry.reasons ?? [],
    });
  }

  const proposedAssets = proposedWords.flatMap((entry) =>
    entry.sourceAssetIds.map((sourceAssetId) => ({
      sourceAssetId,
      text: entry.text,
      proposalId: entry.proposalId,
      normalizedIpa: entry.normalizedIpa,
      proposedReferenceStatus: entry.proposedReferenceStatus,
      proposalEffect: "proposal-only",
    })),
  );
  const blockedAssets = blockedWords.flatMap((entry) =>
    entry.sourceAssetIds.map((sourceAssetId) => ({
      sourceAssetId,
      text: entry.text,
      reasons: entry.reasons,
    })),
  );
  const frenchAssetCount = sortedItems.reduce(
    (total, item) => total + item.sourceAssetIds.length,
    0,
  );
  const deterministicSummary = {
    version: FRENCH_REFERENCE_PROPOSAL_VERSION,
    languageId: "fr-FR",
    inputDigests,
    strictQueueSourceAssetCount,
    frenchSourceAssetCount: frenchAssetCount,
    frenchWordCount: sortedItems.length,
    proposedWordCount: proposedWords.length,
    proposedAssetCount: proposedAssets.length,
    blockedWordCount: blockedWords.length,
    blockedAssetCount: blockedAssets.length,
    byBlockedReason: buildReasonCounts(blockedWords),
    networkRequestsMade: 0,
    paidCallsMade: 0,
    formalLedgerWrites: 0,
    formalAudioWrites: 0,
    effect: "proposal-only",
  };
  const proposalSha256 = sha256(
    stableStringify({
      summary: deterministicSummary,
      proposedWords,
      blockedWords,
    }),
  );
  const commonDocument = {
    version: FRENCH_REFERENCE_PROPOSAL_VERSION,
    languageId: "fr-FR",
    proposalSha256,
    inputDigests,
    effect: "proposal-only",
  };
  return {
    summary: {
      ...deterministicSummary,
      proposalSha256,
      invariant:
        proposedAssets.length + blockedAssets.length === frenchAssetCount &&
        proposedWords.length + blockedWords.length === sortedItems.length,
    },
    proposals: {
      ...commonDocument,
      warning:
        "These are reviewable proposals only. This file does not update the formal reference ledger or authorize audio generation/promotion.",
      proposedWordCount: proposedWords.length,
      proposedAssetCount: proposedAssets.length,
      wordEntries: proposedWords,
      assetEntries: proposedAssets,
    },
    blocked: {
      ...commonDocument,
      blockedWordCount: blockedWords.length,
      blockedAssetCount: blockedAssets.length,
      wordEntries: blockedWords,
      assetEntries: blockedAssets,
    },
    wordSummary: {
      ...commonDocument,
      wordCount: wordEntries.length,
      entries: wordEntries,
    },
  };
}
