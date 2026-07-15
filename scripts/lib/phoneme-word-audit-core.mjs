import { createHash } from "node:crypto";
import {
  arpabetPronunciationToIpa,
  lookupCmuPronunciations,
  normalizeComparableEnglishIpa,
} from "./cmudict-reference.mjs";
import {
  AUDIT_VERSION,
  buildPronunciationInventory,
  compareTranscript,
  LANGUAGE_IDS,
  loadLanguagePhonemeContent,
  loadPhonemeAssessmentAliases,
  normalizeAuditText,
} from "./pronunciation-audit-core.mjs";

export const WORD_AUDIT_VERSION = 2;
export const WORD_AUDIT_DATE = "2026-07-14";
export const WORD_AUDIT_OUTPUT_NAME = `phoneme-word-auditory-audit-${WORD_AUDIT_DATE}`;
export const EXPECTED_PHONEME_PAGE_ASSET_COUNT = 4543;
export const EXPECTED_WORD_BEARING_ASSET_COUNT = 4362;
export const EXPECTED_ANCHOR_ASSET_COUNT = 181;

export const WORD_AUDIT_ROLES = new Set([
  "phoneme-anchor",
  "header-clip",
  "ipa-word-normal",
  "ipa-word-slow",
  "example-word",
]);

export const WORD_AUDIT_FINAL_STATUSES = [
  "machine-consistent-awaiting-human",
  "verified-auditory",
  "verified-variant",
  "metadata-error",
  "audio-quality-fix",
  "confirmed-audio-error",
  "needs-native-review",
  "regenerated-candidate",
  "replaced-and-verified",
];

const WORD_BEARING_ROLES = new Set([
  "ipa-word-normal",
  "ipa-word-slow",
  "example-word",
]);

const VOICE_GENDER_BY_LANGUAGE_AND_SLOT = {
  "en-US": { blue: "masculine", pink: "feminine" },
  "es-ES": { blue: "masculine", pink: "feminine" },
  "fr-FR": { blue: "masculine", pink: "feminine" },
  "ru-RU": { blue: "feminine", pink: "masculine" },
};

const ARPABET_VOWELS = new Set([
  "AA",
  "AE",
  "AH",
  "AO",
  "AW",
  "AY",
  "EH",
  "ER",
  "EY",
  "IH",
  "IY",
  "OW",
  "OY",
  "UH",
  "UW",
]);

const AUDIT_ONLY_ENGLISH_RELATIONS = {
  bays: { currentIpa: "/beɪz/", targetUnits: ["/z/"] },
  fool: { currentIpa: "/fuːl/", targetUnits: ["/uː/"] },
};

const HEADER_ALIAS_PAGE_IDS = {
  "ru-near-open-central": ["ru-unstressed-o-a"],
  "ru-r-palatalized": ["ru-r-rj", "ru-soft-n-l-r"],
  "ru-schwa": ["ru-stress-reduction", "ru-unstressed-e-ya"],
  "ru-shch-proxy": ["ru-ch", "ru-shch"],
  "ru-reduction-open-back": ["ru-unstressed-o-a"],
  "ru-reduction-schwa": ["ru-stress-reduction", "ru-unstressed-e-ya"],
};

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIpaForSearch(value) {
  return normalizeComparableEnglishIpa(value)
    .replaceAll("?", "")
    .replaceAll("_", "");
}

function buildPageRelation(asset, languagePhonemes, assessmentAliases) {
  const pages = languagePhonemes[asset.languageId] ?? [];
  const relations = [];
  for (const unit of asset.targetUnits ?? []) {
    const matches =
      asset.languageId === "en-US"
        ? pages.filter((page) => page.ipa === unit)
        : pages.filter((page) => page.slug === unit);
    for (const page of matches) {
      const targetIpa = page.ipa ?? unit;
      const normalizedWord = normalizeIpaForSearch(asset.expectedIpa);
      // English page IPA is the product's source of truth. Azure assessment
      // aliases use a different symbol inventory and would create false
      // "target missing" findings for valid values such as /iː/.
      const aliases =
        asset.languageId === "en-US"
          ? [page.ipa ?? unit]
          : (assessmentAliases[page.slug] ?? []);
      const normalizedAliases = aliases
        .map(normalizeIpaForSearch)
        .filter(Boolean);
      relations.push({
        pageId: page.slug,
        targetUnit: unit,
        targetIpa,
        currentIpa: asset.expectedIpa ?? null,
        targetPresentInCurrentIpa:
          normalizedAliases.length > 0 && normalizedWord
            ? normalizedAliases.some((alias) => normalizedWord.includes(alias))
            : null,
        acceptedTargetAliases: aliases,
      });
    }
  }
  if (relations.length === 0 && asset.role === "header-clip") {
    for (const pageId of HEADER_ALIAS_PAGE_IDS[asset.text] ?? []) {
      const page = pages.find((candidate) => candidate.slug === pageId);
      if (!page) continue;
      relations.push({
        pageId,
        targetUnit: asset.text,
        targetIpa: page.ipa ?? null,
        currentIpa: null,
        targetPresentInCurrentIpa: null,
        relationshipKind: "supporting-anchor-alias",
      });
    }
  }
  return relations;
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value) ?? "unknown";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export function isWordBearingAuditAsset(asset) {
  return WORD_BEARING_ROLES.has(asset.role);
}

export function buildPhonemeWordAuditInventory(
  root,
  { baseInventory, signalRows = [] } = {},
) {
  const sourceInventory = baseInventory ?? buildPronunciationInventory(root);
  const signalByHash = new Map(
    signalRows.map((row) => [row.sha256, row.signal]),
  );
  const languagePhonemes = loadLanguagePhonemeContent(root);
  const assessmentAliases = loadPhonemeAssessmentAliases(root);
  const assets = sourceInventory.assets
    .filter((asset) => WORD_AUDIT_ROLES.has(asset.role))
    .map((asset) => {
      const englishOverride =
        asset.languageId === "en-US" && asset.role === "example-word"
          ? AUDIT_ONLY_ENGLISH_RELATIONS[asset.text?.toLocaleLowerCase("en-US")]
          : null;
      const effectiveAsset = englishOverride
        ? {
            ...asset,
            expectedIpa: englishOverride.currentIpa,
            targetUnits: englishOverride.targetUnits,
          }
        : asset;
      const pageRelations = buildPageRelation(
        effectiveAsset,
        languagePhonemes,
        assessmentAliases,
      );
      const voiceGender =
        VOICE_GENDER_BY_LANGUAGE_AND_SLOT[asset.languageId]?.[
          asset.voiceSlot
        ] ?? null;
      const relationshipIssues = [];
      if (pageRelations.length === 0)
        relationshipIssues.push("page-unresolved");
      for (const relation of pageRelations) {
        if (relation.targetPresentInCurrentIpa === false) {
          relationshipIssues.push(
            `target-missing:${relation.pageId}:${relation.targetIpa}`,
          );
        }
      }
      if (asset.role === "example-word" && !voiceGender) {
        relationshipIssues.push("voice-gender-unresolved");
      }
      return {
        version: WORD_AUDIT_VERSION,
        assetId: asset.assetId,
        sha256: asset.sha256,
        languageId: asset.languageId,
        locale: asset.locale,
        role: asset.role,
        text: isWordBearingAuditAsset(asset) ? asset.text : undefined,
        anchorLabel: isWordBearingAuditAsset(asset) ? undefined : asset.text,
        currentIpa: effectiveAsset.expectedIpa ?? null,
        targetUnit:
          pageRelations[0]?.targetUnit ?? asset.targetUnits?.[0] ?? null,
        targetUnits: pageRelations.map((relation) => relation.targetUnit),
        phonemePageIds: pageRelations.map((relation) => relation.pageId),
        pageRelations,
        speakerId: asset.speakerId ?? null,
        voiceSlot: asset.voiceSlot ?? null,
        voiceGender,
        desktopPath: asset.desktopPath,
        browserPath: asset.browserPath,
        publicPath: asset.publicPath,
        durationSeconds:
          signalByHash.get(asset.sha256)?.durationSeconds ?? null,
        sourceInventoryVersion: AUDIT_VERSION,
        sourceIssues: asset.issues,
        relationshipIssues,
      };
    })
    .sort((a, b) => a.publicPath.localeCompare(b.publicPath));

  const wordBearingCount = assets.filter(isWordBearingAuditAsset).length;
  const anchorCount = assets.length - wordBearingCount;
  const hardIssues = assets.flatMap((asset) => {
    const issues = [...asset.sourceIssues];
    if (asset.relationshipIssues.includes("page-unresolved")) {
      issues.push("page-unresolved");
    }
    if (asset.durationSeconds === null) issues.push("duration-missing");
    return issues.map((issue) => ({ assetId: asset.assetId, issue }));
  });
  if (assets.length !== EXPECTED_PHONEME_PAGE_ASSET_COUNT) {
    hardIssues.push({
      assetId: null,
      issue: `asset-count-${assets.length}-expected-${EXPECTED_PHONEME_PAGE_ASSET_COUNT}`,
    });
  }
  if (wordBearingCount !== EXPECTED_WORD_BEARING_ASSET_COUNT) {
    hardIssues.push({
      assetId: null,
      issue: `word-count-${wordBearingCount}-expected-${EXPECTED_WORD_BEARING_ASSET_COUNT}`,
    });
  }
  if (anchorCount !== EXPECTED_ANCHOR_ASSET_COUNT) {
    hardIssues.push({
      assetId: null,
      issue: `anchor-count-${anchorCount}-expected-${EXPECTED_ANCHOR_ASSET_COUNT}`,
    });
  }
  return {
    version: WORD_AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    expectedAssetCount: EXPECTED_PHONEME_PAGE_ASSET_COUNT,
    assetCount: assets.length,
    wordBearingCount,
    anchorCount,
    durationSeconds: Number(
      assets
        .reduce((sum, asset) => sum + Number(asset.durationSeconds ?? 0), 0)
        .toFixed(3),
    ),
    countsByLanguage: countBy(assets, (asset) => asset.languageId),
    countsByRole: countBy(assets, (asset) => asset.role),
    relationshipFindingCount: assets.reduce(
      (sum, asset) => sum + asset.relationshipIssues.length,
      0,
    ),
    hardIssues,
    assets,
  };
}

function pronunciationMetadata(arpabet) {
  const symbols = String(arpabet ?? "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  let syllableIndex = -1;
  let primaryStress = null;
  for (const symbol of symbols) {
    const base = symbol.replace(/\d$/u, "");
    if (!ARPABET_VOWELS.has(base)) continue;
    syllableIndex += 1;
    if (symbol.endsWith("1")) primaryStress = syllableIndex;
  }
  return { syllableCount: syllableIndex + 1, primaryStress };
}

export function buildGoldPronunciations(inventory, cmuReference) {
  const groups = new Map();
  for (const asset of inventory.assets.filter(isWordBearingAuditAsset)) {
    const key = `${asset.languageId}\u0000${normalizeAuditText(
      asset.text,
      asset.languageId,
    )}`;
    const current = groups.get(key) ?? {
      languageId: asset.languageId,
      text: asset.text,
      projectIpas: new Set(),
      targetUnits: new Set(),
      pageIds: new Set(),
      assetIds: [],
    };
    if (asset.currentIpa) current.projectIpas.add(asset.currentIpa);
    for (const relation of asset.pageRelations) {
      current.targetUnits.add(relation.targetIpa);
      current.pageIds.add(relation.pageId);
    }
    current.assetIds.push(asset.assetId);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => {
      const projectIpas = [...group.projectIpas];
      if (group.languageId !== "en-US") {
        return {
          version: 1,
          languageId: group.languageId,
          text: group.text,
          canonicalIpa: projectIpas[0] ?? "",
          acceptedVariants: projectIpas.slice(1),
          homophones: [],
          primaryStress: null,
          syllableCount: null,
          sources: projectIpas.map((value) => ({
            name: "SpeakRight project metadata (not independent)",
            revisionOrDate: WORD_AUDIT_DATE,
            value,
          })),
          status: "needs-native-review",
          referenceStatus: "wiktionary-and-native-review-required",
          projectIpas,
          targetUnits: [...group.targetUnits],
          phonemePageIds: [...group.pageIds],
          assetIds: group.assetIds,
        };
      }

      const pronunciations = lookupCmuPronunciations(
        cmuReference.entries,
        group.text,
      );
      const variants = pronunciations.map((arpabet) => ({
        arpabet,
        ipa: arpabetPronunciationToIpa(arpabet),
        ...pronunciationMetadata(arpabet),
      }));
      const matched =
        projectIpas.length > 0 &&
        projectIpas.every((projectIpa) =>
          variants.some(
            (variant) =>
              normalizeComparableEnglishIpa(projectIpa) ===
              normalizeComparableEnglishIpa(variant.ipa),
          ),
        );
      const canonical = variants[0];
      return {
        version: 1,
        languageId: group.languageId,
        text: group.text,
        canonicalIpa: canonical?.ipa ?? projectIpas[0] ?? "",
        acceptedVariants: variants.slice(1).map((variant) => variant.ipa),
        homophones: [],
        primaryStress: canonical?.primaryStress ?? null,
        syllableCount: canonical?.syllableCount ?? null,
        sources: variants.length
          ? [
              {
                name: "CMUdict",
                revisionOrDate: cmuReference.revision,
                value: variants.map((variant) => variant.ipa).join(" | "),
              },
            ]
          : [],
        status: variants.length && matched ? "needs-native-review" : "conflict",
        referenceStatus: !variants.length
          ? "cmudict-missing"
          : matched
            ? "cmudict-matched-needs-second-source"
            : "cmudict-conflict-needs-review",
        projectIpas,
        cmuVariants: variants,
        targetUnits: [...group.targetUnits],
        phonemePageIds: [...group.pageIds],
        assetIds: group.assetIds,
      };
    })
    .sort((a, b) =>
      `${a.languageId}:${a.text}`.localeCompare(`${b.languageId}:${b.text}`),
    );
}

const GOLD_REFERENCE_DECISION_STATUSES = new Set([
  "two-source-confirmed",
  "variant-confirmed",
  "conflict",
  "needs-native-review",
]);

export function applyGoldPronunciationDecisions(entries, ledger) {
  if (!ledger || ledger.version !== 1 || !Array.isArray(ledger.entries)) {
    throw new Error(
      "Reference decision ledger must use version 1 with an entries array.",
    );
  }

  const decisions = new Map();
  for (const decision of ledger.entries) {
    if (!LANGUAGE_IDS.includes(decision.languageId)) {
      throw new Error(`Unsupported decision language: ${decision.languageId}`);
    }
    if (!GOLD_REFERENCE_DECISION_STATUSES.has(decision.status)) {
      throw new Error(
        `Unsupported reference decision status: ${decision.status}`,
      );
    }
    const key = `${decision.languageId}\u0000${normalizeAuditText(
      decision.text,
      decision.languageId,
    )}`;
    if (decisions.has(key)) {
      throw new Error(
        `Duplicate reference decision: ${decision.languageId}:${decision.text}`,
      );
    }
    const sources = Array.isArray(decision.sources) ? decision.sources : [];
    const independentSourceGroups = new Set(
      sources
        .filter(
          (source) =>
            source?.name &&
            !String(source.name)
              .toLocaleLowerCase("en-US")
              .includes("speakright"),
        )
        .map((source) =>
          String(source.independenceGroup ?? source.publisherId ?? source.name)
            .trim()
            .toLocaleLowerCase("en-US"),
        ),
    );
    if (
      ["two-source-confirmed", "variant-confirmed"].includes(decision.status) &&
      independentSourceGroups.size < 2
    ) {
      throw new Error(
        `Confirmed reference requires two independent sources: ${decision.languageId}:${decision.text}`,
      );
    }
    if (
      ["two-source-confirmed", "variant-confirmed"].includes(decision.status) &&
      !String(decision.canonicalIpa ?? "").trim()
    ) {
      throw new Error(
        `Confirmed reference requires canonical IPA: ${decision.languageId}:${decision.text}`,
      );
    }
    decisions.set(key, decision);
  }

  const appliedDecisionKeys = new Set();
  const merged = entries.map((entry) => {
    const key = `${entry.languageId}\u0000${normalizeAuditText(
      entry.text,
      entry.languageId,
    )}`;
    const decision = decisions.get(key);
    if (!decision) return entry;
    appliedDecisionKeys.add(key);
    return {
      ...entry,
      canonicalIpa: decision.canonicalIpa ?? entry.canonicalIpa,
      acceptedVariants: decision.acceptedVariants ?? entry.acceptedVariants,
      homophones: decision.homophones ?? entry.homophones,
      primaryStress: decision.primaryStress ?? entry.primaryStress,
      syllableCount: decision.syllableCount ?? entry.syllableCount,
      sources: decision.sources ?? entry.sources,
      status: decision.status,
      referenceStatus: decision.status,
      decisionNotes: decision.notes ?? null,
      decisionLedgerRevision: ledger.revision ?? "unversioned",
    };
  });

  const unknownDecisions = [...decisions.keys()].filter(
    (key) => !appliedDecisionKeys.has(key),
  );
  if (unknownDecisions.length > 0) {
    throw new Error(
      `Reference decisions do not match inventory entries: ${unknownDecisions.join(", ")}`,
    );
  }
  return merged;
}

function manualHomophoneMatch(expected, actual, languageId, groups) {
  const left = normalizeAuditText(expected, languageId);
  const right = normalizeAuditText(actual, languageId);
  return groups.some((group) => {
    if (group.languageId !== languageId) return false;
    const members = group.members.map((item) =>
      normalizeAuditText(item, languageId),
    );
    return members.includes(left) && members.includes(right);
  });
}

function cmuHomophoneMatch(expected, actual, cmuReference) {
  const left = new Set(
    lookupCmuPronunciations(cmuReference.entries, expected).map((value) =>
      value.replaceAll(/\d/gu, ""),
    ),
  );
  return lookupCmuPronunciations(cmuReference.entries, actual).some((value) =>
    left.has(value.replaceAll(/\d/gu, "")),
  );
}

export function classifyBlindTranscript({
  expected,
  actual,
  languageId,
  homophoneGroups = [],
  cmuReference,
}) {
  const base = compareTranscript(expected, actual, languageId);
  if (base === "exact") return "exact";
  if (base === "orthographic-variant") return "orthographic-variant";
  if (base === "no-speech") return "no-speech";
  if (
    manualHomophoneMatch(expected, actual, languageId, homophoneGroups) ||
    (languageId === "en-US" &&
      cmuReference &&
      cmuHomophoneMatch(expected, actual, cmuReference))
  ) {
    return "accepted-homophone";
  }
  if (base === "contains-expected") return "uncertain";
  return "different-word";
}

const STABLE_BLIND_OUTCOMES = new Set([
  "exact",
  "accepted-homophone",
  "orthographic-variant",
]);

export function buildBlindConsensus({ asset, observations }) {
  const available = Object.entries(observations ?? {}).filter(
    ([, observation]) => Boolean(observation),
  );
  const stable = available.filter(([, observation]) =>
    STABLE_BLIND_OUTCOMES.has(observation.outcome),
  );
  const risk = available.filter(
    ([, observation]) => !STABLE_BLIND_OUTCOMES.has(observation.outcome),
  );
  const differentWords = available.filter(
    ([, observation]) => observation.outcome === "different-word",
  );
  const normalizedAlternatives = differentWords
    .map(([, observation]) =>
      normalizeAuditText(observation.heardText, asset.languageId),
    )
    .filter(Boolean);
  const expected = normalizeAuditText(asset.text, asset.languageId);
  const sameAlternative =
    normalizedAlternatives.length >= 2 &&
    new Set(normalizedAlternatives).size === 1 &&
    normalizedAlternatives[0] !== expected;
  const category =
    available.length < 2
      ? "insufficient"
      : risk.length === 0
        ? "all-stable"
        : stable.length === 0
          ? "all-risk"
          : "mixed";
  const priority =
    sameAlternative || category === "all-risk"
      ? "P0-human"
      : category === "mixed"
        ? "P1-human"
        : category === "all-stable"
          ? "P2-confirm"
          : "blocked";
  return {
    assetId: asset.assetId,
    sha256: asset.sha256,
    languageId: asset.languageId,
    text: asset.text,
    role: asset.role,
    voiceGender: asset.voiceGender,
    category,
    priority,
    listenerCount: available.length,
    stableListeners: stable.map(([name]) => name),
    riskListeners: risk.map(([name]) => name),
    sameAlternative,
    heard: Object.fromEntries(
      available.map(([name, observation]) => [
        name,
        {
          text: observation.heardText ?? "",
          outcome: observation.outcome,
        },
      ]),
    ),
  };
}

export function levenshteinDistance(left, right) {
  const a = Array.from(left ?? "");
  const b = Array.from(right ?? "");
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return row[b.length];
}

export function buildEnglishAlignment({ asset, gold, azure, blind = {} }) {
  const expected = normalizeComparableEnglishIpa(gold?.canonicalIpa ?? "");
  const project = normalizeComparableEnglishIpa(asset.currentIpa ?? "");
  const actualPhonemes =
    azure?.result?.words
      ?.flatMap((word) => word.phonemes ?? [])
      .map((phoneme) => phoneme.phoneme)
      .join("") ?? "";
  const actual = normalizeComparableEnglishIpa(actualPhonemes);
  const targets = asset.pageRelations.map((relation) => {
    const normalized = normalizeComparableEnglishIpa(relation.targetIpa);
    return {
      pageId: relation.pageId,
      targetIpa: relation.targetIpa,
      expectedIndex: expected.indexOf(normalized),
      projectIndex: project.indexOf(normalized),
      azureIndex: actual.indexOf(normalized),
      expectedPresent: expected.includes(normalized),
      projectPresent: project.includes(normalized),
      azurePresent: actual.includes(normalized),
    };
  });
  const riskReasons = [];
  if (!gold || gold.referenceStatus !== "two-source-confirmed") {
    riskReasons.push("reference-not-two-source-confirmed");
  }
  if (expected && project && expected !== project) {
    riskReasons.push("project-ipa-differs-from-gold");
  }
  if (!actual) riskReasons.push("azure-phoneme-sequence-missing");
  if (targets.some((target) => !target.expectedPresent)) {
    riskReasons.push("page-target-missing-from-gold");
  }
  if (targets.some((target) => !target.azurePresent)) {
    riskReasons.push("page-target-missing-from-azure-supporting-sequence");
  }
  const blindOutcomes = Object.values(blind)
    .map((item) => item?.outcome)
    .filter(Boolean);
  if (new Set(blindOutcomes).size > 1) {
    riskReasons.push("blind-listeners-disagree");
  }
  return {
    version: 1,
    assetId: asset.assetId,
    sha256: asset.sha256,
    text: asset.text,
    projectIpa: asset.currentIpa,
    canonicalIpa: gold?.canonicalIpa ?? null,
    azureSupportingPhonemeSequence: actualPhonemes || null,
    supportingEvidenceOnly: true,
    sequenceDistance:
      expected && actual ? levenshteinDistance(expected, actual) : null,
    syllableCount: gold?.syllableCount ?? null,
    primaryStress: gold?.primaryStress ?? null,
    actualStressConclusion: "human-review-required",
    targets,
    riskReasons,
  };
}

export function createBlindReviewQueue(assets, duplicateRate = 0.05) {
  const primary = assets.map((asset) => ({
    reviewId: digest(`primary:${asset.assetId}`).slice(0, 24),
    assetId: asset.assetId,
    duplicateOf: null,
  }));
  const duplicateCount = Math.round(assets.length * duplicateRate);
  const selected = [...assets]
    .sort((a, b) =>
      digest(`duplicate:${a.assetId}`).localeCompare(
        digest(`duplicate:${b.assetId}`),
      ),
    )
    .slice(0, duplicateCount)
    .map((asset) => ({
      reviewId: digest(`repeat:${asset.assetId}`).slice(0, 24),
      assetId: asset.assetId,
      duplicateOf: digest(`primary:${asset.assetId}`).slice(0, 24),
    }));
  return [...primary, ...selected].sort((a, b) =>
    digest(`order:${a.reviewId}`).localeCompare(digest(`order:${b.reviewId}`)),
  );
}

export function assertLoopbackUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1") {
    throw new Error(
      `Gemini proxy must use an http://127.0.0.1 loopback URL: ${value}`,
    );
  }
  return parsed;
}

export function buildBlindListenerPrompt(languageId) {
  const locale = {
    "en-US": "American English",
    "es-ES": "Peninsular Spanish",
    "fr-FR": "Metropolitan French",
    "ru-RU": "Standard Russian",
  }[languageId];
  return [
    `Listen to one isolated word spoken in ${locale}.`,
    "Return JSON only with heardText, bestEffortIpa, detectedLanguage, and confidence.",
    "Do not infer from a filename or expected answer; report only what is audible.",
  ].join(" ");
}

export function buildGeminiBlindRequest({
  languageId,
  model,
  mimeType,
  audioBase64,
}) {
  return {
    model,
    temperature: 0,
    stream: false,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildBlindListenerPrompt(languageId) },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${audioBase64}`,
            },
          },
        ],
      },
    ],
  };
}
