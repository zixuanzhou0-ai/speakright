import {
  arpabetPronunciationToIpa,
  lookupCmuPronunciations,
  normalizeComparableEnglishIpa,
} from "./cmudict-reference.mjs";
import {
  sha256,
  stableStringify,
} from "./kaikki-reference-enrichment-core.mjs";

const ENGLISH_LANGUAGE_ID = "en-US";
const KAIKKI_INDEPENDENCE_GROUP = "wiktionary";
const CMUDICT_INDEPENDENCE_GROUP = "cmudict";

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "en"),
  );
}

function normalizeWord(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US");
}

export function countIndependentReferenceGroups(sources) {
  return new Set(
    (sources ?? [])
      .map((source) =>
        String(
          source?.independenceGroup ??
            source?.publisherId ??
            source?.name ??
            "",
        )
          .trim()
          .toLocaleLowerCase("en-US"),
      )
      .filter(Boolean),
  ).size;
}

export function isPlausibleEnglishIpaToken(value) {
  const token = String(value ?? "")
    .normalize("NFC")
    .trim();
  const delimited =
    (token.startsWith("/") && token.endsWith("/")) ||
    (token.startsWith("[") && token.endsWith("]"));
  if (!delimited) return false;
  const inner = token.slice(1, -1).trim();
  if (!inner || /[A-Z]/u.test(inner)) {
    return false;
  }
  return /[a-zɐ-ʯ]/u.test(inner);
}

function pronunciationMetadata(arpabet) {
  let syllableCount = 0;
  let primaryStress = null;
  for (const symbol of String(arpabet).trim().split(/\s+/u)) {
    if (!/\d$/u.test(symbol)) continue;
    if (symbol.endsWith("1")) primaryStress = syllableCount;
    syllableCount += 1;
  }
  return { syllableCount, primaryStress };
}

function targetRelationshipIssues(canonicalIpa, targetUnits) {
  const normalizedCanonical = normalizeComparableEnglishIpa(canonicalIpa);
  return uniqueSorted(
    (targetUnits ?? [])
      .map((targetUnit) => ({
        targetUnit,
        normalized: normalizeComparableEnglishIpa(targetUnit),
      }))
      .filter(
        ({ normalized }) =>
          !normalized || !normalizedCanonical.includes(normalized),
      )
      .map(({ targetUnit }) => `target-not-in-canonical:${targetUnit}`),
  );
}

function buildWordGroups(basePlan, thirdPlan) {
  const byAssetId = new Map(
    (basePlan.sourceAssets ?? []).map((asset) => [asset.sourceAssetId, asset]),
  );
  const blocked = thirdPlan.blocked ?? [];
  if (blocked.length !== thirdPlan.blockedCount) {
    throw new Error("Third-round blocked count does not match blocked entries");
  }
  const blockedAssetIds = blocked.map((entry) => entry.sourceAssetId);
  if (new Set(blockedAssetIds).size !== blockedAssetIds.length) {
    throw new Error("Third-round blocked source asset IDs must be unique");
  }

  const groups = new Map();
  for (const blockedEntry of blocked) {
    const asset = byAssetId.get(blockedEntry.sourceAssetId);
    if (!asset) {
      throw new Error(
        `Third-round source asset missing from base plan: ${blockedEntry.sourceAssetId}`,
      );
    }
    if (asset.languageId !== ENGLISH_LANGUAGE_ID) continue;
    const text = normalizeWord(asset.text);
    if (!text)
      throw new Error(
        `English source asset has empty text: ${asset.sourceAssetId}`,
      );
    const group = groups.get(text) ?? {
      languageId: ENGLISH_LANGUAGE_ID,
      text,
      sourceAssetIds: [],
      currentCanonicalIpas: [],
      targetUnits: [],
      phonemePageIds: [],
      relationshipIssues: [],
      thirdRoundReasons: [],
    };
    group.sourceAssetIds.push(asset.sourceAssetId);
    group.currentCanonicalIpas.push(String(asset.canonicalIpa ?? "").trim());
    group.targetUnits.push(...(asset.targetUnits ?? []));
    group.phonemePageIds.push(...(asset.phonemePageIds ?? []));
    group.relationshipIssues.push(...(asset.relationshipIssues ?? []));
    group.thirdRoundReasons.push(blockedEntry.reason);
    groups.set(text, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      sourceAssetIds: uniqueSorted(group.sourceAssetIds),
      currentCanonicalIpas: uniqueSorted(group.currentCanonicalIpas),
      targetUnits: uniqueSorted(group.targetUnits),
      phonemePageIds: uniqueSorted(group.phonemePageIds),
      relationshipIssues: uniqueSorted(group.relationshipIssues),
      thirdRoundReasons: uniqueSorted(group.thirdRoundReasons),
    }))
    .sort((a, b) => a.text.localeCompare(b.text, "en-US"));
}

function buildKaikkiObservationMap(kaikkiObservations) {
  const entries = kaikkiObservations?.entries ?? [];
  const map = new Map();
  for (const observation of entries) {
    if (observation.languageId !== ENGLISH_LANGUAGE_ID) continue;
    const key = normalizeWord(observation.text);
    if (map.has(key))
      throw new Error(`Duplicate Kaikki English observation: ${key}`);
    map.set(key, observation);
  }
  return map;
}

function buildSources({
  cmuReference,
  cmuMatch,
  kaikkiObservation,
  kaikkiMatches,
}) {
  const sources = [
    {
      name: "CMUdict",
      publisherId: "cmudict",
      independenceGroup: CMUDICT_INDEPENDENCE_GROUP,
      revisionOrDate: cmuReference.revision ?? cmuReference.sha256,
      value: cmuMatch.ipa,
      arpabet: cmuMatch.arpabet,
      sha256: cmuReference.sha256,
    },
    {
      name: "Kaikki.org structured Wiktionary extract",
      publisherId: "kaikki-wiktionary",
      independenceGroup: KAIKKI_INDEPENDENCE_GROUP,
      revisionOrDate:
        kaikkiObservation.source?.dumpDate ??
        kaikkiObservation.source?.extractedAt ??
        kaikkiObservation.htmlSha256,
      value: kaikkiMatches.join(" | "),
      sourceUrl: kaikkiObservation.source?.sourceUrl,
      htmlSha256: kaikkiObservation.htmlSha256,
      wiktextractRevision: kaikkiObservation.source?.wiktextractRevision,
    },
  ];
  if (countIndependentReferenceGroups(sources) !== 2) {
    throw new Error(
      "English confirmation sources must have two independent groups",
    );
  }
  return sources;
}

function evaluateGroup(group, kaikkiObservation, cmuReference) {
  const blockers = [];
  if (
    !group.thirdRoundReasons.every(
      (reason) =>
        reason === "unresolved-reference" ||
        /^Third candidate blocked by unresolved reference for [a-f0-9]+$/u.test(
          String(reason),
        ),
    )
  ) {
    blockers.push("non-reference-third-round-blocker");
  }
  if (
    group.currentCanonicalIpas.length !== 1 ||
    !group.currentCanonicalIpas[0]
  ) {
    blockers.push("project-canonical-ipa-conflict");
  }
  if (group.relationshipIssues.length > 0)
    blockers.push("relationship-issues-present");
  if (!kaikkiObservation) {
    blockers.push("missing-kaikki-observation");
  } else {
    if (kaikkiObservation.status !== "structured-ipa-observed") {
      blockers.push("kaikki-ipa-unresolved");
    }
    if (
      String(kaikkiObservation.source?.independenceGroup ?? "") !==
      KAIKKI_INDEPENDENCE_GROUP
    ) {
      blockers.push("invalid-kaikki-independence-group");
    }
  }

  const currentCanonicalIpa = group.currentCanonicalIpas[0] ?? "";
  const normalizedCurrent = normalizeComparableEnglishIpa(currentCanonicalIpa);
  const cmuMatches = lookupCmuPronunciations(cmuReference.entries, group.text)
    .map((arpabet) => ({
      arpabet,
      ipa: arpabetPronunciationToIpa(arpabet),
      normalizedIpa: normalizeComparableEnglishIpa(
        arpabetPronunciationToIpa(arpabet),
      ),
      ...pronunciationMetadata(arpabet),
    }))
    .filter((candidate) => candidate.normalizedIpa === normalizedCurrent);
  if (cmuMatches.length === 0)
    blockers.push("project-ipa-not-confirmed-by-cmudict");

  const kaikkiIpas = (kaikkiObservation?.ipas ?? [])
    .filter(isPlausibleEnglishIpaToken)
    .map((ipa) => ({
      ipa,
      normalizedIpa: normalizeComparableEnglishIpa(ipa),
    }));
  const kaikkiMatches = kaikkiIpas.filter(
    (candidate) => candidate.normalizedIpa === normalizedCurrent,
  );
  if (kaikkiMatches.length === 0)
    blockers.push("project-ipa-not-confirmed-by-kaikki");
  blockers.push(
    ...targetRelationshipIssues(currentCanonicalIpa, group.targetUnits),
  );

  const uniqueBlockers = uniqueSorted(blockers);
  const cmuMatch = cmuMatches[0] ?? null;
  const audit = {
    languageId: ENGLISH_LANGUAGE_ID,
    text: group.text,
    sourceAssetIds: group.sourceAssetIds,
    currentCanonicalIpas: group.currentCanonicalIpas,
    targetUnits: group.targetUnits,
    phonemePageIds: group.phonemePageIds,
    thirdRoundReasons: group.thirdRoundReasons,
    projectRelationshipIssues: group.relationshipIssues,
    cmuCandidates: lookupCmuPronunciations(
      cmuReference.entries,
      group.text,
    ).map((arpabet) => ({
      arpabet,
      ipa: arpabetPronunciationToIpa(arpabet),
      normalizedIpa: normalizeComparableEnglishIpa(
        arpabetPronunciationToIpa(arpabet),
      ),
    })),
    matchingCmuCandidates: cmuMatches,
    kaikkiIpas,
    matchingKaikkiIpas: kaikkiMatches.map((candidate) => candidate.ipa),
    accentAssessment:
      cmuMatches.length > 0
        ? "en-US-supported-by-cmudict"
        : "en-US-not-established",
    blockers: uniqueBlockers,
  };
  if (uniqueBlockers.length > 0) return { audit, decision: null };

  const sources = buildSources({
    cmuReference,
    cmuMatch,
    kaikkiObservation,
    kaikkiMatches: audit.matchingKaikkiIpas,
  });
  return {
    audit,
    decision: {
      languageId: ENGLISH_LANGUAGE_ID,
      text: group.text,
      canonicalIpa: currentCanonicalIpa,
      acceptedVariants: [],
      homophones: [],
      primaryStress: cmuMatch.primaryStress,
      syllableCount: cmuMatch.syllableCount,
      status: "two-source-confirmed",
      sources,
      notes:
        "Conservative machine reference decision: the existing project IPA exactly normalizes to both CMUdict (en-US) and a Kaikki/Wiktionary observation, and every page target remains present. This confirms the reference used for candidate generation; it is not human verification of the audio.",
    },
  };
}

export function buildEnglishReferenceDecisionPlan({
  basePlan,
  thirdPlan,
  kaikkiObservations,
  cmuReference,
  inputDigests = {},
}) {
  if (!cmuReference?.entries || !(cmuReference.entries instanceof Map)) {
    throw new Error("CMUdict reference must provide an entries Map");
  }
  const groups = buildWordGroups(basePlan, thirdPlan);
  const observationMap = buildKaikkiObservationMap(kaikkiObservations);
  const evaluations = groups.map((group) =>
    evaluateGroup(group, observationMap.get(group.text), cmuReference),
  );
  const decisions = evaluations
    .filter((evaluation) => evaluation.decision)
    .map((evaluation) => evaluation.decision);
  const blocked = evaluations
    .filter((evaluation) => !evaluation.decision)
    .map((evaluation) => evaluation.audit);
  const auditable = evaluations.map((evaluation) => ({
    ...evaluation.audit,
    outcome: evaluation.decision ? "two-source-confirmed" : "blocked",
  }));
  const confirmedAssetIds = uniqueSorted(
    auditable
      .filter((entry) => entry.outcome === "two-source-confirmed")
      .flatMap((entry) => entry.sourceAssetIds),
  );
  const blockedAssetIds = uniqueSorted(
    blocked.flatMap((entry) => entry.sourceAssetIds),
  );
  const deterministic = {
    version: 1,
    languageId: ENGLISH_LANGUAGE_ID,
    policyVersion: "english-reference-decision-conservative-v1",
    inputDigests,
    strictQueueAssetCount: confirmedAssetIds.length + blockedAssetIds.length,
    strictQueueWordCount: groups.length,
    confirmedAssetCount: confirmedAssetIds.length,
    confirmedWordCount: decisions.length,
    blockedAssetCount: blockedAssetIds.length,
    blockedWordCount: blocked.length,
    confirmedAssetIds,
    blockedAssetIds,
    decisions,
    blocked,
    auditEntries: auditable,
  };
  return {
    ...deterministic,
    planSha256: sha256(stableStringify(deterministic)),
    networkRequestsMade: 0,
    paidCallsMade: 0,
  };
}

export const ENGLISH_REFERENCE_DECISION_POLICY = Object.freeze({
  languageId: ENGLISH_LANGUAGE_ID,
  cmuIndependenceGroup: CMUDICT_INDEPENDENCE_GROUP,
  kaikkiIndependenceGroup: KAIKKI_INDEPENDENCE_GROUP,
});
