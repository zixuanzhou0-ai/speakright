import { normalizeComparableFrenchIpa } from "./french-reference-decision-proposal-core.mjs";
import {
  sha256,
  stableStringify,
} from "./lexique-reference-enrichment-core.mjs";

export const FRENCH_REFERENCE_LEDGER_PLAN_POLICY_VERSION =
  "french-reference-ledger-plan-v1";

function requireString(value, label) {
  const normalized = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (
    !normalized ||
    Array.from(normalized).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint <= 31 || codePoint === 127;
    })
  ) {
    throw new Error(label + " must be a non-empty string without controls");
  }
  return normalized;
}

function requireSha(value, label) {
  const normalized = requireString(value, label);
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new Error(label + " must be 64 lowercase hex characters");
  }
  return normalized;
}

function uniqueSorted(values, locale = "en") {
  return [
    ...new Set(
      (values ?? []).filter(
        (value) => value !== undefined && value !== null && value !== "",
      ),
    ),
  ].sort((left, right) => String(left).localeCompare(String(right), locale));
}

function wordKey(languageId, text) {
  return (
    requireString(languageId, "Language ID") +
    "\u0000" +
    requireString(text, "Decision text").toLocaleLowerCase(languageId)
  );
}

function buildUniqueMap(entries, keyBuilder, label) {
  if (!Array.isArray(entries)) {
    throw new Error(label + " must be an array");
  }
  const map = new Map();
  for (const entry of entries) {
    const key = keyBuilder(entry);
    if (map.has(key)) {
      throw new Error(label + " contains duplicate key: " + key);
    }
    map.set(key, entry);
  }
  return map;
}

export function validateFrenchReferenceProposalBundle({
  summary,
  proposals,
  blocked,
  expectedProposalSha256,
}) {
  const expected = requireSha(
    expectedProposalSha256,
    "Expected French proposal SHA-256",
  );
  for (const [label, document] of [
    ["summary", summary],
    ["proposals", proposals],
    ["blocked", blocked],
  ]) {
    if (document?.version !== 1 || document?.languageId !== "fr-FR") {
      throw new Error("French proposal " + label + " has invalid identity");
    }
    if (document.proposalSha256 !== expected) {
      throw new Error(
        "French proposal " + label + " is not bound to the expected SHA",
      );
    }
  }
  if (summary.invariant !== true || proposals.effect !== "proposal-only") {
    throw new Error("French proposal bundle is not an invariant proposal");
  }
  const proposedWords = proposals.wordEntries ?? [];
  const proposedAssets = proposals.assetEntries ?? [];
  const blockedWords = blocked.wordEntries ?? [];
  const blockedAssets = blocked.assetEntries ?? [];
  if (
    summary.proposedWordCount !== proposedWords.length ||
    summary.proposedAssetCount !== proposedAssets.length ||
    summary.blockedWordCount !== blockedWords.length ||
    summary.blockedAssetCount !== blockedAssets.length ||
    proposals.proposedWordCount !== proposedWords.length ||
    proposals.proposedAssetCount !== proposedAssets.length ||
    blocked.blockedWordCount !== blockedWords.length ||
    blocked.blockedAssetCount !== blockedAssets.length
  ) {
    throw new Error("French proposal bundle counts do not match its entries");
  }
  const {
    proposalSha256: _proposalSha256,
    invariant: _invariant,
    ...deterministicSummary
  } = summary;
  const recomputed = sha256(
    stableStringify({
      summary: deterministicSummary,
      proposedWords,
      blockedWords,
    }),
  );
  if (recomputed !== expected) {
    throw new Error(
      "French proposal SHA-256 does not match its immutable bundle",
    );
  }

  const wordsByKey = buildUniqueMap(
    proposedWords,
    (entry) => wordKey(entry.languageId, entry.text),
    "French proposed words",
  );
  const assetsById = buildUniqueMap(
    proposedAssets,
    (entry) => requireString(entry.sourceAssetId, "Proposal source asset ID"),
    "French proposed assets",
  );
  const expectedAssetIds = [];
  for (const word of wordsByKey.values()) {
    if (
      word.proposedReferenceStatus !== "two-source-confirmed" ||
      word.proposalEffect !== "proposal-only" ||
      word.requiresHumanApplication !== true ||
      word.relationshipCheck !== "clear"
    ) {
      throw new Error(
        "French proposed word is not eligible for formalization: " + word.text,
      );
    }
    if (
      !Array.isArray(word.sourceAssetIds) ||
      word.sourceAssetIds.length === 0 ||
      word.assetCount !== word.sourceAssetIds.length
    ) {
      throw new Error(
        "French proposed word has invalid source asset scope: " + word.text,
      );
    }
    for (const sourceAssetId of word.sourceAssetIds) {
      const asset = assetsById.get(sourceAssetId);
      if (
        !asset ||
        asset.text !== word.text ||
        asset.proposalId !== word.proposalId ||
        asset.normalizedIpa !== word.normalizedIpa
      ) {
        throw new Error(
          "French proposal asset does not match its word: " + sourceAssetId,
        );
      }
      expectedAssetIds.push(sourceAssetId);
    }
  }
  if (
    uniqueSorted(expectedAssetIds).length !== expectedAssetIds.length ||
    assetsById.size !== expectedAssetIds.length
  ) {
    throw new Error("French proposal assets are duplicated or unreferenced");
  }
  return {
    proposalSha256: expected,
    proposedWords,
    proposedAssets,
    proposedWordCount: proposedWords.length,
    proposedAssetCount: proposedAssets.length,
  };
}

function assertCurrentEvidenceFiles(reviewedInputDigests, fileDigests) {
  const checks = [
    [
      "lexiqueObservationsFileSha256",
      "currentLexiqueObservationsFileSha256",
      "Lexique observations",
    ],
    [
      "kaikkiObservationsFileSha256",
      "currentKaikkiObservationsFileSha256",
      "Kaikki observations",
    ],
    ["lexiquePlanFileSha256", "currentLexiquePlanFileSha256", "Lexique plan"],
    ["kaikkiPlanFileSha256", "currentKaikkiPlanFileSha256", "Kaikki plan"],
  ];
  for (const [reviewedKey, currentKey, label] of checks) {
    const reviewed = requireSha(
      reviewedInputDigests?.[reviewedKey],
      "Reviewed " + label + " SHA-256",
    );
    const current = requireSha(
      fileDigests?.[currentKey],
      "Current " + label + " SHA-256",
    );
    if (reviewed !== current) {
      throw new Error(label + " changed after the reviewed French proposal");
    }
  }
}

function buildCurrentScope({
  proposedWords,
  proposedAssets,
  currentBasePlan,
  currentInventory,
}) {
  if (
    !Array.isArray(currentBasePlan?.sourceAssets) ||
    currentBasePlan.sourceAssets.length !== currentBasePlan.sourceAssetCount
  ) {
    throw new Error("Current base plan source asset manifest is invalid");
  }
  if (!Array.isArray(currentInventory?.assets)) {
    throw new Error("Current pronunciation inventory is invalid");
  }
  const sourceById = buildUniqueMap(
    currentBasePlan.sourceAssets,
    (entry) => requireString(entry.sourceAssetId, "Base source asset ID"),
    "Current base source assets",
  );
  const inventoryById = buildUniqueMap(
    currentInventory.assets,
    (entry) => requireString(entry.assetId, "Inventory asset ID"),
    "Current inventory assets",
  );
  const proposalAssetById = new Map(
    proposedAssets.map((entry) => [entry.sourceAssetId, entry]),
  );
  const scoped = [];
  for (const word of proposedWords) {
    const normalizedIpa = requireString(
      word.normalizedIpa,
      "French normalized IPA",
    );
    if (normalizeComparableFrenchIpa(normalizedIpa) !== normalizedIpa) {
      throw new Error("French proposal IPA is not canonical: " + word.text);
    }
    for (const sourceAssetId of word.sourceAssetIds) {
      const proposedAsset = proposalAssetById.get(sourceAssetId);
      const source = sourceById.get(sourceAssetId);
      const inventory = inventoryById.get(sourceAssetId);
      if (!proposedAsset || !source || !inventory) {
        throw new Error(
          "Current manifest is missing French proposal asset: " + sourceAssetId,
        );
      }
      if (
        source.languageId !== "fr-FR" ||
        inventory.languageId !== "fr-FR" ||
        source.text !== word.text ||
        inventory.text !== word.text ||
        normalizeComparableFrenchIpa(source.canonicalIpa) !== normalizedIpa ||
        normalizeComparableFrenchIpa(inventory.currentIpa) !== normalizedIpa
      ) {
        throw new Error(
          "Current French asset identity or IPA changed: " + sourceAssetId,
        );
      }
      if (
        requireSha(source.sourceSha256, "Base source SHA-256") !==
        requireSha(inventory.sha256, "Inventory asset SHA-256")
      ) {
        throw new Error("Current French asset bytes changed: " + sourceAssetId);
      }
      if (
        (source.relationshipIssues ?? []).length > 0 ||
        (inventory.relationshipIssues ?? []).length > 0 ||
        !(inventory.pageRelations ?? []).some(
          (relation) => relation.relationshipKind === "target-example",
        )
      ) {
        throw new Error(
          "Current French target relationship changed: " + sourceAssetId,
        );
      }
      scoped.push({
        sourceAssetId,
        sourceSha256: source.sourceSha256,
        languageId: source.languageId,
        text: source.text,
        canonicalIpa: normalizedIpa,
        targetUnits: uniqueSorted(source.targetUnits ?? []),
        phonemePageIds: uniqueSorted(source.phonemePageIds ?? []),
        relationshipKinds: uniqueSorted(
          (inventory.pageRelations ?? []).map(
            (relation) => relation.relationshipKind,
          ),
        ),
      });
    }
  }
  scoped.sort((left, right) =>
    left.sourceAssetId.localeCompare(right.sourceAssetId, "en"),
  );
  return {
    scoped,
    scopedInputSha256: sha256(stableStringify(scoped)),
  };
}

function observedValue(evidence, normalizedIpa, label) {
  const values = uniqueSorted(evidence?.rawIpas ?? [], "fr-FR");
  if (values.length === 0) {
    throw new Error(label + " has no observed IPA value");
  }
  const normalized = uniqueSorted(evidence?.normalizedIpas ?? [], "fr-FR");
  if (normalized.length !== 1 || normalized[0] !== normalizedIpa) {
    throw new Error(label + " does not match the confirmed French IPA");
  }
  return values.join(" | ");
}

function buildLedgerDecision(word) {
  const normalizedIpa = requireString(
    word.normalizedIpa,
    "French decision IPA",
  );
  const lexique = word.evidence?.lexique;
  const kaikki = word.evidence?.kaikki;
  if (
    lexique?.publisherId !== "lexique" ||
    lexique?.independenceGroup !== "lexique" ||
    kaikki?.independenceGroup !== "wiktionary"
  ) {
    throw new Error(
      "French proposal lacks two independent source groups: " + word.text,
    );
  }
  const lexiqueSource = {
    name: "Lexique 4.00",
    publisherId: "lexique",
    independenceGroup: "lexique",
    revisionOrDate: requireString(lexique.version, "Lexique version"),
    value: observedValue(lexique, normalizedIpa, "Lexique evidence"),
    sourceUrl: requireString(lexique.sourceUrl, "Lexique source URL"),
    datasetSha256: requireSha(lexique.datasetSha256, "Lexique dataset SHA-256"),
    license: lexique.license,
    sourceRows: uniqueSorted(lexique.sourceRows ?? []),
  };
  const kaikkiSource = {
    name: "Kaikki.org structured Wiktionary extract",
    publisherId: requireString(
      kaikki.publisherId,
      "Kaikki/Wiktionary publisher ID",
    ),
    independenceGroup: "wiktionary",
    revisionOrDate: requireString(
      kaikki.dumpDate,
      "Kaikki/Wiktionary dump date",
    ),
    value: observedValue(kaikki, normalizedIpa, "Kaikki/Wiktionary evidence"),
    sourceUrl: requireString(kaikki.sourceUrl, "Kaikki/Wiktionary source URL"),
    htmlSha256: requireSha(kaikki.htmlSha256, "Kaikki/Wiktionary HTML SHA-256"),
    wiktextractRevision: requireString(
      kaikki.wiktextractRevision,
      "Wiktextract revision",
    ),
    extractedAt: requireString(
      kaikki.extractedAt,
      "Kaikki/Wiktionary extraction date",
    ),
  };
  return {
    languageId: "fr-FR",
    text: requireString(word.text, "French decision text"),
    canonicalIpa: normalizedIpa,
    acceptedVariants: [],
    homophones: [],
    status: "two-source-confirmed",
    sources: [lexiqueSource, kaikkiSource],
    notes:
      "Conservative offline reference decision: the existing project IPA exactly normalizes to Lexique 4.00 and an independent Kaikki/Wiktionary observation, with a current target-example relationship. This confirms reference text only; it is not native-speaker verification of the audio.",
  };
}

function languageCounts(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const languageId = requireString(entry.languageId, "Ledger language ID");
    counts.set(languageId, (counts.get(languageId) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right, "en"),
    ),
  );
}

export function buildFrenchReferenceLedgerPlan({
  reviewedSummary,
  reviewedProposals,
  reviewedBlocked,
  expectedProposalSha256,
  currentBasePlan,
  currentInventory,
  currentLedger,
  fileDigests,
}) {
  const bundle = validateFrenchReferenceProposalBundle({
    summary: reviewedSummary,
    proposals: reviewedProposals,
    blocked: reviewedBlocked,
    expectedProposalSha256,
  });
  const expectedLedgerSha256 = requireSha(
    fileDigests?.currentLedgerFileSha256,
    "Current formal ledger SHA-256",
  );
  const inputManifestSha256 = requireSha(
    fileDigests?.currentInputManifestSha256,
    "Current input manifest SHA-256",
  );
  assertCurrentEvidenceFiles(reviewedSummary.inputDigests, fileDigests);
  const scope = buildCurrentScope({
    proposedWords: bundle.proposedWords,
    proposedAssets: bundle.proposedAssets,
    currentBasePlan,
    currentInventory,
  });

  if (currentLedger?.version !== 1 || !Array.isArray(currentLedger.entries)) {
    throw new Error("Current formal reference ledger is invalid");
  }
  const ledgerByKey = buildUniqueMap(
    currentLedger.entries,
    (entry) => wordKey(entry.languageId, entry.text),
    "Current formal ledger",
  );
  const decisions = bundle.proposedWords
    .map((word) => buildLedgerDecision(word))
    .sort((left, right) => left.text.localeCompare(right.text, "fr-FR"));
  const addedKeys = [];
  const unchangedKeys = [];
  for (const decision of decisions) {
    const key = wordKey(decision.languageId, decision.text);
    const existing = ledgerByKey.get(key);
    if (!existing) {
      addedKeys.push(key);
    } else if (stableStringify(existing) === stableStringify(decision)) {
      unchangedKeys.push(key);
    } else {
      throw new Error(
        "Current formal ledger conflicts with French proposal: " +
          decision.text,
      );
    }
  }
  const confirmedAssetIds = uniqueSorted(
    bundle.proposedAssets.map((entry) => entry.sourceAssetId),
  );
  const deterministic = {
    version: 1,
    languageId: "fr-FR",
    policyVersion: FRENCH_REFERENCE_LEDGER_PLAN_POLICY_VERSION,
    effect: "formal-ledger-plan-only",
    sourceProposalSha256: bundle.proposalSha256,
    expectedLedgerSha256,
    inputManifestSha256,
    inputDigests: {
      reviewedSummaryFileSha256: requireSha(
        fileDigests?.reviewedSummaryFileSha256,
        "Reviewed proposal summary file SHA-256",
      ),
      reviewedProposalsFileSha256: requireSha(
        fileDigests?.reviewedProposalsFileSha256,
        "Reviewed proposal file SHA-256",
      ),
      reviewedBlockedFileSha256: requireSha(
        fileDigests?.reviewedBlockedFileSha256,
        "Reviewed blocked file SHA-256",
      ),
      reviewedProposalInputDigests: reviewedSummary.inputDigests,
      currentBasePlanSha256: requireSha(
        currentBasePlan?.planSha256,
        "Current base plan semantic SHA-256",
      ),
      currentBasePlanFileSha256: requireSha(
        fileDigests?.currentBasePlanFileSha256,
        "Current base plan file SHA-256",
      ),
      currentLexiquePlanFileSha256: fileDigests.currentLexiquePlanFileSha256,
      currentLexiqueObservationsFileSha256:
        fileDigests.currentLexiqueObservationsFileSha256,
      currentKaikkiPlanFileSha256: fileDigests.currentKaikkiPlanFileSha256,
      currentKaikkiObservationsFileSha256:
        fileDigests.currentKaikkiObservationsFileSha256,
      currentInputManifestSha256: inputManifestSha256,
      currentLedgerFileSha256: expectedLedgerSha256,
      scopedInputSha256: scope.scopedInputSha256,
    },
    existingLedgerEntryCount: currentLedger.entries.length,
    existingLedgerLanguageCounts: languageCounts(currentLedger.entries),
    preservedLedgerEntriesSha256: sha256(
      stableStringify(currentLedger.entries),
    ),
    proposedWordCount: bundle.proposedWordCount,
    proposedAssetCount: bundle.proposedAssetCount,
    addedWordCount: addedKeys.length,
    unchangedWordCount: unchangedKeys.length,
    expectedMergedEntryCount: currentLedger.entries.length + addedKeys.length,
    confirmedAssetIds,
    decisions,
    auditEntries: bundle.proposedWords.map((word) => ({
      proposalId: word.proposalId,
      languageId: word.languageId,
      text: word.text,
      canonicalIpa: word.normalizedIpa,
      sourceAssetIds: uniqueSorted(word.sourceAssetIds),
      relationshipCheck: word.relationshipCheck,
      outcome: "two-source-confirmed",
    })),
    formalLedgerWrites: 0,
    formalAudioWrites: 0,
  };
  const planSha256 = sha256(stableStringify(deterministic));
  const plan = {
    ...deterministic,
    planSha256,
    networkRequestsMade: 0,
    paidCallsMade: 0,
  };
  const patch = {
    version: 1,
    revision: "french-reference-decisions-" + planSha256.slice(0, 12),
    warning:
      "Generated French ledger patch only. Apply exclusively through the SHA-gated reference-decision-ledger-apply command after review.",
    languageId: "fr-FR",
    sourceProposalSha256: bundle.proposalSha256,
    expectedLedgerSha256,
    inputManifestSha256,
    scopedInputSha256: scope.scopedInputSha256,
    proposedWordCount: bundle.proposedWordCount,
    proposedAssetCount: bundle.proposedAssetCount,
    entries: decisions,
  };
  return {
    plan,
    patch,
    scopedInputSha256: scope.scopedInputSha256,
    preservedExistingEntryCount: currentLedger.entries.length,
    addedWordCount: addedKeys.length,
    unchangedWordCount: unchangedKeys.length,
  };
}
