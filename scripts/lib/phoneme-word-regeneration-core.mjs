import { createHash } from "node:crypto";

export const REGENERATION_VERSION = 1;
export const EXPECTED_REGENERATION_ASSET_COUNT = 416;
export const EXPECTED_FIRST_ROUND_CANDIDATE_COUNT = 832;
export const MAX_REGENERATION_CANDIDATE_COUNT = 1248;
export const EXPECTED_FIRST_ROUND_CHARACTERS = 3650;
export const MAX_REGENERATION_CHARACTERS = 5475;
export const ELEVENLABS_SAFETY_RESERVE = 5000;

export const EXPECTED_ASSETS_BY_LANGUAGE = {
  "en-US": 23,
  "es-ES": 71,
  "fr-FR": 265,
  "ru-RU": 57,
};

export const EXPECTED_ASSETS_BY_VOICE = {
  Max: 12,
  Nichalia: 11,
  "Marco Cruz": 41,
  Lydia: 30,
  Clément: 122,
  Rachel: 143,
  Sergey: 28,
  Valeria: 29,
};

export const STABLE_BLIND_OUTCOMES = new Set([
  "exact",
  "accepted-homophone",
  "orthographic-variant",
]);
export async function runFailStopPool(items, concurrency, worker) {
  let cursor = 0;
  let stopped = false;
  let firstError = null;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!stopped) {
        const index = cursor;
        if (index >= items.length) return;
        cursor += 1;
        try {
          await worker(items[index], index);
        } catch (error) {
          stopped = true;
          firstError ??= error;
          return;
        }
      }
    }),
  );
  if (firstError) throw firstError;
}

const ENGLISH_VOICES = {
  blue: {
    voiceId: "Gfpl8Yo74Is0W6cPUWWT",
    voiceName: "Max",
    voiceGender: "masculine",
    modelId: "eleven_flash_v2_5",
    speed: 0.9,
    voiceSettings: {
      stability: 0.85,
      similarity_boost: 0.85,
      style: 0,
      use_speaker_boost: true,
    },
  },
  pink: {
    voiceId: "XfNU2rGpBa01ckF309OY",
    voiceName: "Nichalia",
    voiceGender: "feminine",
    modelId: "eleven_flash_v2_5",
    speed: 0.9,
    voiceSettings: {
      stability: 0.85,
      similarity_boost: 0.85,
      style: 0,
      use_speaker_boost: true,
    },
  },
};

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function codePointLength(value) {
  return [...String(value ?? "")].length;
}

function countBy(values, selector) {
  const result = {};
  for (const value of values) {
    const key = selector(value) ?? "unknown";
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function assertCounts(actual, expected, label) {
  for (const [key, count] of Object.entries(expected)) {
    if (actual[key] !== count) {
      throw new Error(
        `${label} ${key}: expected ${count}, received ${actual[key] ?? 0}`,
      );
    }
  }
  const unexpected = Object.keys(actual).filter((key) => !(key in expected));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unexpected keys: ${unexpected.join(", ")}`,
    );
  }
}

export function normalizePronunciationDictionaryIpa(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/gu, "")
    .trim();
}

function normalizedSourceIdentity(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US");
  return /kaikki|wiktionary/u.test(normalized) ? "wiktionary" : normalized;
}

function fallbackIndependenceGroup(name) {
  const normalizedName = normalizedSourceIdentity(name);
  return normalizedName;
}

function normalizedReferenceSources(source) {
  return (source.referenceSources ?? []).map((reference) => {
    const name = String(reference?.name ?? "").trim();
    return {
      name,
      independenceGroup: String(reference?.independenceGroup ?? "").trim(),
      publisherId: String(reference?.publisherId ?? "").trim(),
      url: String(reference?.url ?? "").trim(),
      revisionOrDate: String(
        reference?.revisionOrDate ??
          reference?.revision ??
          reference?.date ??
          "",
      ).trim(),
      license: String(reference?.license ?? "").trim(),
      rawValue: String(reference?.rawValue ?? reference?.value ?? "").trim(),
      normalizedValue: String(
        reference?.normalizedValue ?? reference?.value ?? "",
      ).trim(),
    };
  });
}

function independentReferenceSourceCount(source) {
  return new Set(
    normalizedReferenceSources(source)
      .map(
        (reference) =>
          normalizedSourceIdentity(reference.independenceGroup) ||
          normalizedSourceIdentity(reference.publisherId) ||
          fallbackIndependenceGroup(reference.name),
      )
      .filter(Boolean),
  ).size;
}

function hasRelationshipIssues(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return false;
}

export function computeReferenceDigest(source) {
  return digest(
    JSON.stringify({
      canonicalIpa: String(source.canonicalIpa ?? "").trim(),
      referenceStatus: source.referenceStatus ?? null,
      referenceSources: normalizedReferenceSources(source),
      syllableCount: source.syllableCount ?? null,
      primaryStress: source.primaryStress ?? null,
      relationshipIssues: source.relationshipIssues ?? [],
    }),
  );
}

function candidateConfigPayload(candidate) {
  return {
    candidateId: candidate.candidateId,
    sourceAssetId: candidate.sourceAssetId,
    languageId: candidate.languageId,
    text: candidate.text,
    canonicalIpa: candidate.canonicalIpa,
    voiceId: candidate.voiceId,
    voiceName: candidate.voiceName,
    voiceGender: candidate.voiceGender,
    voiceSlot: candidate.voiceSlot,
    modelId: candidate.modelId,
    languageCode: candidate.languageCode,
    voiceSettings: candidate.voiceSettings,
    generationRound: candidate.generationRound,
    label: candidate.label,
    seed: candidate.seed,
    sourceSha256: candidate.sourceSha256,
    characterCount: candidate.characterCount,
    pronunciationDictionary: candidate.pronunciationDictionary ?? null,
    referenceDigest: candidate.referenceDigest,
  };
}

function candidateTtsGenerationPayload(candidate) {
  return {
    candidateId: candidate.candidateId,
    sourceAssetId: candidate.sourceAssetId,
    languageId: candidate.languageId,
    text: candidate.text,
    voiceId: candidate.voiceId,
    voiceName: candidate.voiceName,
    voiceGender: candidate.voiceGender,
    voiceSlot: candidate.voiceSlot,
    modelId: candidate.modelId,
    languageCode: candidate.languageCode,
    voiceSettings: candidate.voiceSettings,
    generationRound: candidate.generationRound,
    label: candidate.label,
    seed: candidate.seed,
    characterCount: candidate.characterCount,
    pronunciationDictionary: candidate.pronunciationDictionary ?? null,
  };
}

export function computeCandidateTtsConfigDigest(candidate) {
  return digest(JSON.stringify(candidateTtsGenerationPayload(candidate)));
}

export function computeCandidateConfigDigest(candidate) {
  return digest(JSON.stringify(candidateConfigPayload(candidate)));
}

function attachCandidateDigests(candidate, source) {
  const referenceDigest = computeReferenceDigest(source);
  const withReference = { ...candidate, referenceDigest };
  return {
    ...withReference,
    ttsConfigDigest: computeCandidateTtsConfigDigest(withReference),
    configDigest: computeCandidateConfigDigest(withReference),
  };
}

function seedFor(assetId, label) {
  return Number.parseInt(digest(`${assetId}:${label}`).slice(0, 8), 16);
}

function candidateId(assetId, label) {
  return `regen-${assetId}-${label.toLowerCase()}`;
}

function resolveVoice(asset, manifests) {
  if (asset.languageId === "en-US") {
    const slot = asset.role === "ipa-word-normal" ? "blue" : asset.voiceSlot;
    const voice = ENGLISH_VOICES[slot];
    if (!voice)
      throw new Error(`English voice unresolved for ${asset.assetId}`);
    if (asset.role === "ipa-word-normal" && asset.text !== "goat") {
      throw new Error(`Unexpected IPA-chart regeneration asset: ${asset.text}`);
    }
    return { ...voice, voiceSlot: slot };
  }
  const manifest = manifests[asset.languageId];
  const voice = manifest?.voices?.[asset.voiceSlot];
  if (!voice) {
    throw new Error(
      `Voice unresolved for ${asset.languageId}/${asset.voiceSlot}/${asset.assetId}`,
    );
  }
  return {
    voiceId: voice.voiceId,
    voiceName: voice.voiceName,
    voiceGender: asset.voiceGender,
    voiceSlot: asset.voiceSlot,
    modelId: voice.modelId ?? manifest.modelId,
    speed: voice.speed ?? manifest.speed,
    voiceSettings: voice.voiceSettings ?? manifest.voiceSettings,
  };
}

function goldKey(languageId, text) {
  return `${languageId}\u0000${String(text).normalize("NFKC").toLocaleLowerCase(languageId)}`;
}

function planPayload(plan) {
  return {
    version: plan.version,
    sourceAssetCount: plan.sourceAssetCount,
    firstRoundCandidateCount: plan.firstRoundCandidateCount,
    maximumCandidateCount: plan.maximumCandidateCount,
    firstRoundCharacters: plan.firstRoundCharacters,
    maximumCharacters: plan.maximumCharacters,
    safetyReserve: plan.safetyReserve,
    byLanguage: plan.byLanguage,
    byVoice: plan.byVoice,
    sourceDurationSeconds: plan.sourceDurationSeconds,
    sourceAssets: plan.sourceAssets,
    candidates: plan.candidates,
  };
}

export function computeRegenerationPlanSha(plan) {
  return digest(JSON.stringify(planPayload(plan)));
}

export function buildRegenerationPlan({
  inventory,
  consensus,
  gold,
  manifests,
  signalBySha = new Map(),
}) {
  const assetsById = new Map(
    inventory.assets.map((asset) => [asset.assetId, asset]),
  );
  const goldByKey = new Map(
    gold.entries.map((entry) => [goldKey(entry.languageId, entry.text), entry]),
  );
  const risks = consensus.items.filter((item) =>
    ["P0-human", "blocked"].includes(item.priority),
  );
  if (risks.length !== EXPECTED_REGENERATION_ASSET_COUNT) {
    throw new Error(
      `Regeneration scope must contain ${EXPECTED_REGENERATION_ASSET_COUNT} locked-risk assets, received ${risks.length}`,
    );
  }

  const sourceAssets = risks
    .map((risk) => {
      const asset = assetsById.get(risk.assetId);
      if (!asset || asset.sha256 !== risk.sha256) {
        throw new Error(`Inventory/consensus mismatch for ${risk.assetId}`);
      }
      const voice = resolveVoice(asset, manifests);
      const reference = goldByKey.get(goldKey(asset.languageId, asset.text));
      const canonicalIpa = reference?.canonicalIpa ?? asset.currentIpa ?? null;
      if (!asset.text || !canonicalIpa) {
        throw new Error(`Text or IPA missing for ${asset.assetId}`);
      }
      const characterCount = codePointLength(asset.text);
      const source = {
        sourceAssetId: asset.assetId,
        sourceSha256: asset.sha256,
        languageId: asset.languageId,
        languageCode: asset.languageId.slice(0, 2),
        role: asset.role,
        text: asset.text,
        canonicalIpa,
        referenceStatus: reference?.status ?? "needs-native-review",
        referenceSourceCount: reference?.sources?.length ?? 0,
        referenceSources: reference?.sources ?? [],
        syllableCount: reference?.syllableCount ?? null,
        primaryStress: reference?.primaryStress ?? null,
        targetUnits: asset.targetUnits,
        phonemePageIds: asset.phonemePageIds,
        relationshipIssues: asset.relationshipIssues,
        desktopPath: asset.desktopPath,
        browserPath: asset.browserPath,
        durationSeconds: asset.durationSeconds,
        sourceSignal: signalBySha.get(asset.sha256) ?? null,
        characterCount,
        ...voice,
      };
      return { ...source, referenceDigest: computeReferenceDigest(source) };
    })
    .sort((left, right) =>
      left.sourceAssetId.localeCompare(right.sourceAssetId),
    );

  assertCounts(
    countBy(sourceAssets, (asset) => asset.languageId),
    EXPECTED_ASSETS_BY_LANGUAGE,
    "language count",
  );
  assertCounts(
    countBy(sourceAssets, (asset) => asset.voiceName),
    EXPECTED_ASSETS_BY_VOICE,
    "voice count",
  );
  if (
    sourceAssets.find((asset) => asset.role === "ipa-word-normal")
      ?.voiceName !== "Max"
  ) {
    throw new Error("The goat normal asset must use Max");
  }

  const candidates = sourceAssets.flatMap((asset) =>
    ["A", "B"].map((label, index) =>
      attachCandidateDigests(
        {
          candidateId: candidateId(asset.sourceAssetId, label),
          sourceAssetId: asset.sourceAssetId,
          languageId: asset.languageId,
          text: asset.text,
          canonicalIpa: asset.canonicalIpa,
          voiceId: asset.voiceId,
          voiceName: asset.voiceName,
          voiceGender: asset.voiceGender,
          voiceSlot: asset.voiceSlot,
          modelId: asset.modelId,
          languageCode: asset.languageCode,
          voiceSettings: { ...asset.voiceSettings, speed: asset.speed },
          generationRound: index + 1,
          label,
          seed: seedFor(asset.sourceAssetId, label),
          sourceSha256: asset.sourceSha256,
          characterCount: asset.characterCount,
          status: "planned",
        },
        asset,
      ),
    ),
  );
  if (candidates.length !== EXPECTED_FIRST_ROUND_CANDIDATE_COUNT) {
    throw new Error(
      `Expected 832 A/B candidates, received ${candidates.length}`,
    );
  }
  if (
    new Set(candidates.map((candidate) => candidate.seed)).size !==
    candidates.length
  ) {
    throw new Error("Candidate seeds must be unique within this batch");
  }
  for (const source of sourceAssets) {
    const pair = candidates.filter(
      (candidate) => candidate.sourceAssetId === source.sourceAssetId,
    );
    if (pair[0].seed === pair[1].seed)
      throw new Error(`A/B seeds collide for ${source.sourceAssetId}`);
  }
  const inputCharacters = candidates.reduce(
    (sum, item) => sum + item.characterCount,
    0,
  );
  if (inputCharacters !== EXPECTED_FIRST_ROUND_CHARACTERS) {
    throw new Error(
      `Expected 3650 first-round characters, received ${inputCharacters}`,
    );
  }

  const plan = {
    version: REGENERATION_VERSION,
    generatedAt: new Date().toISOString(),
    sourceAssetCount: sourceAssets.length,
    firstRoundCandidateCount: candidates.length,
    maximumCandidateCount: MAX_REGENERATION_CANDIDATE_COUNT,
    firstRoundCharacters: inputCharacters,
    maximumCharacters: MAX_REGENERATION_CHARACTERS,
    safetyReserve: ELEVENLABS_SAFETY_RESERVE,
    byLanguage: countBy(sourceAssets, (asset) => asset.languageId),
    byVoice: countBy(sourceAssets, (asset) => asset.voiceName),
    sourceDurationSeconds: sourceAssets.reduce(
      (sum, asset) => sum + Number(asset.durationSeconds ?? 0),
      0,
    ),
    sourceAssets,
    candidates,
  };
  return { ...plan, planSha256: computeRegenerationPlanSha(plan) };
}

export function assertRegenerationPlan(plan) {
  if (computeRegenerationPlanSha(plan) !== plan.planSha256) {
    throw new Error(
      "Regeneration plan SHA does not match its immutable payload",
    );
  }
  if (plan.sourceAssetCount !== EXPECTED_REGENERATION_ASSET_COUNT) {
    throw new Error("Regeneration plan asset count changed");
  }
  if (plan.firstRoundCandidateCount !== EXPECTED_FIRST_ROUND_CANDIDATE_COUNT) {
    throw new Error("Regeneration plan candidate count changed");
  }
  if (plan.candidates.length > MAX_REGENERATION_CANDIDATE_COUNT) {
    throw new Error("Regeneration plan exceeds the 2+1 candidate ceiling");
  }
  if (plan.firstRoundCharacters !== EXPECTED_FIRST_ROUND_CHARACTERS) {
    throw new Error("Regeneration plan character total changed");
  }
  return plan;
}

export function buildThirdRoundCandidate(source, failedPair) {
  if (
    failedPair.length !== 2 ||
    failedPair.some((candidate) => candidate.status !== "machine-failed")
  ) {
    throw new Error(
      `Third candidate requires two failed A/B candidates for ${source.sourceAssetId}`,
    );
  }
  if (/[~～]/u.test(String(source.canonicalIpa ?? ""))) {
    throw new Error(
      `Third candidate blocked by polluted IPA for ${source.sourceAssetId}`,
    );
  }
  if (hasRelationshipIssues(source.relationshipIssues)) {
    throw new Error(
      `Third candidate blocked by relationship issues for ${source.sourceAssetId}`,
    );
  }
  if (
    !["two-source-confirmed", "variant-confirmed"].includes(
      source.referenceStatus,
    ) ||
    independentReferenceSourceCount(source) < 2
  ) {
    throw new Error(
      `Third candidate blocked by unresolved reference for ${source.sourceAssetId}`,
    );
  }
  const currentReferenceDigest = computeReferenceDigest(source);
  if (
    source.referenceDigest &&
    source.referenceDigest !== currentReferenceDigest
  ) {
    throw new Error(
      `Third candidate blocked by stale reference digest for ${source.sourceAssetId}`,
    );
  }
  const pronunciationDictionaryIpa = normalizePronunciationDictionaryIpa(
    source.canonicalIpa,
  );
  if (!pronunciationDictionaryIpa) {
    throw new Error(`Third candidate IPA is empty for ${source.sourceAssetId}`);
  }
  return attachCandidateDigests(
    {
      candidateId: candidateId(source.sourceAssetId, "C"),
      sourceAssetId: source.sourceAssetId,
      languageId: source.languageId,
      text: source.text,
      canonicalIpa: source.canonicalIpa,
      voiceId: source.voiceId,
      voiceName: source.voiceName,
      voiceGender: source.voiceGender,
      voiceSlot: source.voiceSlot,
      modelId: "eleven_v3",
      languageCode: source.languageCode,
      voiceSettings: { ...source.voiceSettings, speed: source.speed },
      generationRound: 3,
      label: "C",
      seed: seedFor(source.sourceAssetId, "C"),
      sourceSha256: source.sourceSha256,
      characterCount: source.characterCount,
      pronunciationDictionary: {
        alphabet: "ipa",
        stringToReplace: source.text,
        phoneme: pronunciationDictionaryIpa,
      },
      status: "planned",
    },
    source,
  );
}

function selectionPayload(selection) {
  return {
    version: selection.version,
    basePlanSha256: selection.basePlanSha256,
    thirdPlanSha256: selection.thirdPlanSha256 ?? null,
    thirdPlanInputSelectionSha256:
      selection.thirdPlanInputSelectionSha256 ?? null,
    promotedSourceAssetIds: [
      ...(selection.promotedSourceAssetIds ?? []),
    ].sort(),
    generatedCandidateCount: selection.generatedCandidateCount,
    passedCandidateCount: selection.passedCandidateCount,
    failedCandidateCount: selection.failedCandidateCount,
    selectedAssetCount: selection.selectedAssetCount,
    unresolvedAssetCount: selection.unresolvedAssetCount,
    resultCounts: selection.resultCounts,
    results: selection.results,
    selected: selection.selected,
  };
}

export function computeSelectionDigest(selection) {
  return digest(JSON.stringify(selectionPayload(selection)));
}

export function computeBaseSelectionDigest(selection) {
  return digest(
    JSON.stringify({
      basePlanSha256: selection.basePlanSha256,
      promotedSourceAssetIds: [
        ...(selection.promotedSourceAssetIds ?? []),
      ].sort(),
      results: (selection.results ?? []).filter(
        (result) => result.generationRound !== 3,
      ),
    }),
  );
}

export function buildSelectionRecord({
  basePlanSha256,
  thirdPlanSha256 = null,
  thirdPlanInputSelectionSha256 = null,
  promotedSourceAssetIds = [],
  totalSourceAssetCount,
  results,
  selected,
}) {
  const promoted = [...new Set(promotedSourceAssetIds)].sort();
  const record = {
    version: 2,
    generatedAt: new Date().toISOString(),
    basePlanSha256,
    thirdPlanSha256,
    thirdPlanInputSelectionSha256,
    promotedSourceAssetIds: promoted,
    generatedCandidateCount: results.length,
    passedCandidateCount: results.filter(
      (item) => item.status === "machine-passed",
    ).length,
    failedCandidateCount: results.filter(
      (item) => item.status === "machine-failed",
    ).length,
    selectedAssetCount: selected.length,
    unresolvedAssetCount:
      totalSourceAssetCount - promoted.length - selected.length,
    resultCounts: countBy(results, (item) => item.status),
    results,
    selected,
  };
  record.baseSelectionSha256 = computeBaseSelectionDigest(record);
  record.selectionSha256 = computeSelectionDigest(record);
  return record;
}

export function assertSelectionRecord(
  selection,
  { basePlanSha256, thirdPlanSha256 = null, promotedSourceAssetIds = [] },
) {
  if (selection.basePlanSha256 !== basePlanSha256) {
    throw new Error("Selection was built from a different base plan");
  }
  if ((selection.thirdPlanSha256 ?? null) !== (thirdPlanSha256 ?? null)) {
    throw new Error("Selection was built from a different third-round plan");
  }
  const expectedPromoted = [...new Set(promotedSourceAssetIds)].sort();
  if (
    JSON.stringify([...(selection.promotedSourceAssetIds ?? [])].sort()) !==
    JSON.stringify(expectedPromoted)
  ) {
    throw new Error("Selection promoted-source set changed");
  }
  if (selection.baseSelectionSha256 !== computeBaseSelectionDigest(selection)) {
    throw new Error("Selection base digest is stale");
  }
  if (selection.selectionSha256 !== computeSelectionDigest(selection)) {
    throw new Error("Selection digest is stale");
  }
  return selection;
}

function thirdRoundPlanPayload(plan) {
  return {
    version: plan.version,
    basePlanSha256: plan.basePlanSha256,
    selectionSha256: plan.selectionSha256,
    promotedSourceAssetIds: plan.promotedSourceAssetIds,
    baseCandidateCount: plan.baseCandidateCount,
    maximumCandidateCount: plan.maximumCandidateCount,
    candidateCount: plan.candidateCount,
    blockedCount: plan.blockedCount,
    characterCount: plan.characterCount,
    sourceDurationSeconds: plan.sourceDurationSeconds,
    safetyReserve: plan.safetyReserve,
    paidCallsMade: plan.paidCallsMade,
    blocked: plan.blocked,
    candidates: plan.candidates,
  };
}

export function computeThirdRoundPlanSha(plan) {
  return digest(JSON.stringify(thirdRoundPlanPayload(plan)));
}

export function overlayCurrentReference(source, reference, currentAsset) {
  const overlay = {
    ...source,
    canonicalIpa: reference?.canonicalIpa ?? source.canonicalIpa,
    referenceStatus: reference?.status ?? source.referenceStatus,
    referenceSourceCount:
      reference?.sources?.length ?? source.referenceSourceCount,
    referenceSources: reference?.sources ?? source.referenceSources ?? [],
    syllableCount: reference?.syllableCount ?? source.syllableCount ?? null,
    primaryStress: reference?.primaryStress ?? source.primaryStress ?? null,
    relationshipIssues:
      currentAsset?.relationshipIssues ?? source.relationshipIssues ?? [],
  };
  return { ...overlay, referenceDigest: computeReferenceDigest(overlay) };
}

export function buildThirdRoundPlan({
  plan,
  selection,
  gold,
  currentAssetById = new Map(),
  currentShaByPath = new Map(),
}) {
  assertRegenerationPlan(plan);
  const resultById = new Map(
    selection.results.map((result) => [result.candidateId, result]),
  );
  const goldByKey = new Map(
    (gold?.entries ?? []).map((entry) => [
      goldKey(entry.languageId, entry.text),
      entry,
    ]),
  );
  const promotedSourceAssetIds = [
    ...new Set(selection.promotedSourceAssetIds ?? []),
  ].sort();
  const promotedSourceIds = new Set(promotedSourceAssetIds);
  const candidates = [];
  const blocked = [];
  for (const baseSource of plan.sourceAssets) {
    if (promotedSourceIds.has(baseSource.sourceAssetId)) continue;
    const pair = plan.candidates
      .filter((item) => item.sourceAssetId === baseSource.sourceAssetId)
      .map((item) => ({
        ...item,
        status: resultById.get(item.candidateId)?.status,
      }));
    if (pair.some((item) => item.status === "machine-passed")) continue;
    const currentAsset = currentAssetById.get(baseSource.sourceAssetId);
    const source = overlayCurrentReference(
      baseSource,
      goldByKey.get(goldKey(baseSource.languageId, baseSource.text)),
      currentAsset,
    );
    try {
      const desktopSha = currentShaByPath.get(source.desktopPath);
      const browserSha = currentShaByPath.get(source.browserPath);
      if (
        desktopSha !== source.sourceSha256 ||
        browserSha !== source.sourceSha256
      ) {
        throw new Error(
          `Current source SHA changed for ${source.sourceAssetId}; refusing third candidate`,
        );
      }
      candidates.push(buildThirdRoundCandidate(source, pair));
    } catch (error) {
      blocked.push({
        sourceAssetId: source.sourceAssetId,
        status: "blocked-third-candidate-safety",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (
    plan.candidates.length + candidates.length >
    MAX_REGENERATION_CANDIDATE_COUNT
  ) {
    throw new Error("Candidate ceiling exceeded");
  }
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const thirdPlan = {
    version: REGENERATION_VERSION,
    generatedAt: new Date().toISOString(),
    basePlanSha256: plan.planSha256,
    selectionSha256:
      selection.baseSelectionSha256 ?? computeSelectionDigest(selection),
    promotedSourceAssetIds,
    baseCandidateCount: plan.candidates.length,
    maximumCandidateCount: MAX_REGENERATION_CANDIDATE_COUNT,
    candidateCount: candidates.length,
    blockedCount: blocked.length,
    characterCount: candidates.reduce(
      (sum, candidate) => sum + candidate.characterCount,
      0,
    ),
    sourceDurationSeconds: candidates.reduce(
      (sum, candidate) =>
        sum +
        Number(sourceById.get(candidate.sourceAssetId)?.durationSeconds ?? 0),
      0,
    ),
    safetyReserve: ELEVENLABS_SAFETY_RESERVE,
    paidCallsMade: false,
    blocked,
    candidates,
  };
  return {
    ...thirdPlan,
    thirdPlanSha256: computeThirdRoundPlanSha(thirdPlan),
  };
}

export function assertThirdRoundPlan(
  thirdPlan,
  {
    plan,
    selection,
    gold,
    currentAssetById = new Map(),
    currentShaByPath = new Map(),
  },
) {
  assertRegenerationPlan(plan);
  if (computeThirdRoundPlanSha(thirdPlan) !== thirdPlan.thirdPlanSha256) {
    throw new Error(
      "Third-round plan SHA does not match its immutable payload",
    );
  }
  if (thirdPlan.basePlanSha256 !== plan.planSha256) {
    throw new Error("Third-round plan was built from a different base plan");
  }
  const selectionAnchor =
    selection.thirdPlanInputSelectionSha256 ??
    selection.baseSelectionSha256 ??
    computeSelectionDigest(selection);
  if (thirdPlan.selectionSha256 !== selectionAnchor) {
    throw new Error(
      "Third-round plan was built from different selection results",
    );
  }
  const thirdPromoted = new Set(thirdPlan.promotedSourceAssetIds ?? []);
  const selectionPromoted = new Set(selection.promotedSourceAssetIds ?? []);
  const thirdCandidateSources = new Set(
    thirdPlan.candidates.map((candidate) => candidate.sourceAssetId),
  );
  if (
    [...thirdPromoted].some(
      (sourceAssetId) => !selectionPromoted.has(sourceAssetId),
    ) ||
    [...selectionPromoted].some(
      (sourceAssetId) =>
        !thirdPromoted.has(sourceAssetId) &&
        !thirdCandidateSources.has(sourceAssetId),
    )
  ) {
    throw new Error("Third-round promoted-source set changed");
  }
  if (thirdPlan.paidCallsMade !== false) {
    throw new Error("Third-round planning must never make paid calls");
  }
  const rebuilt = buildThirdRoundPlan({
    plan,
    selection,
    gold,
    currentAssetById,
    currentShaByPath,
  });
  if (rebuilt.thirdPlanSha256 !== thirdPlan.thirdPlanSha256) {
    throw new Error(
      "Third-round plan no longer matches current references or source files",
    );
  }
  if (thirdPlan.candidateCount !== thirdPlan.candidates.length) {
    throw new Error("Third-round plan candidate count changed");
  }
  if (thirdPlan.blockedCount !== thirdPlan.blocked.length) {
    throw new Error("Third-round plan blocked count changed");
  }
  if (
    thirdPlan.baseCandidateCount + thirdPlan.candidateCount >
    thirdPlan.maximumCandidateCount
  ) {
    throw new Error("Third-round plan exceeds the candidate ceiling");
  }
  const characters = thirdPlan.candidates.reduce(
    (sum, candidate) => sum + candidate.characterCount,
    0,
  );
  if (characters !== thirdPlan.characterCount) {
    throw new Error("Third-round plan character count changed");
  }
  for (const candidate of thirdPlan.candidates) {
    if (candidate.generationRound !== 3) {
      throw new Error("Third-round plan contains a non-C candidate");
    }
    if (
      candidate.ttsConfigDigest !==
        computeCandidateTtsConfigDigest(candidate) ||
      candidate.configDigest !== computeCandidateConfigDigest(candidate)
    ) {
      throw new Error(
        `Candidate config digest changed: ${candidate.candidateId}`,
      );
    }
  }
  return thirdPlan;
}

export function isGeneratedCandidateCacheReusable({
  cached,
  candidate,
  audioExists,
}) {
  return Boolean(
    cached &&
      audioExists &&
      candidate.referenceDigest &&
      candidate.configDigest &&
      cached.sourceSha256 === candidate.sourceSha256 &&
      cached.referenceDigest === candidate.referenceDigest &&
      cached.configDigest === candidate.configDigest,
  );
}

export function withCurrentCandidateAuditContext(candidate, source) {
  const current = attachCandidateDigests(
    {
      ...candidate,
      canonicalIpa: source.canonicalIpa,
      sourceSha256: source.sourceSha256,
    },
    source,
  );
  if (candidate.generationRound === 3) {
    for (const [field, expected] of [
      ["sourceSha256", current.sourceSha256],
      ["referenceDigest", current.referenceDigest],
      ["configDigest", current.configDigest],
    ]) {
      if (candidate[field] !== expected) {
        throw new Error(
          `Third candidate ${candidate.candidateId} has stale ${field}`,
        );
      }
    }
  }
  return current;
}

export function bindGeneratedCandidateHistory({
  candidate,
  historyRows,
  actualAudioSha256,
}) {
  if (!actualAudioSha256) return null;
  const expectedTtsDigest = computeCandidateTtsConfigDigest(candidate);
  const matching = [...historyRows].reverse().find((row) => {
    if (
      row?.candidateId !== candidate.candidateId ||
      row?.candidateSha256 !== actualAudioSha256 ||
      computeCandidateTtsConfigDigest(row) !== expectedTtsDigest
    ) {
      return false;
    }
    if (candidate.generationRound !== 3) return true;
    return (
      row.sourceSha256 === candidate.sourceSha256 &&
      row.referenceDigest === candidate.referenceDigest &&
      row.configDigest === candidate.configDigest
    );
  });
  if (!matching) return null;
  return {
    ...matching,
    ...candidate,
    candidateSha256: actualAudioSha256,
    relativePath: matching.relativePath,
    characterCost: matching.characterCost ?? null,
    requestIdFingerprint: matching.requestIdFingerprint ?? null,
    pronunciationDictionaryLocators:
      matching.pronunciationDictionaryLocators ?? [],
    generatedAt: matching.generatedAt,
    status: "generated",
    ttsConfigDigest: expectedTtsDigest,
    auditContextMigrated:
      candidate.generationRound !== 3 &&
      (matching.sourceSha256 !== candidate.sourceSha256 ||
        matching.referenceDigest !== candidate.referenceDigest ||
        matching.configDigest !== candidate.configDigest),
  };
}

export function bindGeneratedCandidateHistories({
  plannedCandidates,
  historyRows,
  actualAudioShaByCandidateId,
  excludedSourceAssetIds = new Set(),
}) {
  const byId = new Map();
  for (const row of historyRows) {
    const values = byId.get(row.candidateId) ?? [];
    values.push(row);
    byId.set(row.candidateId, values);
  }
  const bound = [];
  const issues = [];
  for (const candidate of plannedCandidates) {
    if (excludedSourceAssetIds.has(candidate.sourceAssetId)) continue;
    const rows = byId.get(candidate.candidateId) ?? [];
    const actualAudioSha256 = actualAudioShaByCandidateId.get(
      candidate.candidateId,
    );
    const resolved = bindGeneratedCandidateHistory({
      candidate,
      historyRows: rows,
      actualAudioSha256,
    });
    if (resolved) bound.push(resolved);
    else if (rows.length > 0 || actualAudioSha256) {
      issues.push(`stale-generated-candidate:${candidate.candidateId}`);
    }
  }
  return { bound, issues };
}

export function bindCandidateObservations({
  candidates,
  rows,
  idField = "candidateId",
  shaField = "candidateSha256",
}) {
  const rowsById = new Map();
  for (const row of rows) {
    const id = row?.[idField];
    if (!id) continue;
    const values = rowsById.get(id) ?? [];
    values.push(row);
    rowsById.set(id, values);
  }
  const byCandidateId = new Map();
  const issues = [];
  for (const candidate of candidates) {
    const candidateRows = rowsById.get(candidate.candidateId) ?? [];
    const current = [...candidateRows]
      .reverse()
      .find((row) => row?.[shaField] === candidate.candidateSha256);
    if (current) byCandidateId.set(candidate.candidateId, current);
    else if (candidateRows.length > 0) {
      issues.push(`stale-observation:${candidate.candidateId}`);
    }
  }
  return { byCandidateId, issues };
}

export function validatePromotionLedger({
  plan,
  ledger,
  generatedHistory,
  actualAudioShaByCandidateId,
  formalShaByPath,
  postProcessingLineageBySourceAssetId = new Map(),
  additionalPlannedCandidates = [],
}) {
  if (!ledger) {
    return {
      version: 2,
      generatedAt: null,
      replacementCount: 0,
      warning:
        "Machine-replaced candidates still require human auditory confirmation.",
      replacements: [],
    };
  }
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const candidateById = new Map(
    [...plan.candidates, ...additionalPlannedCandidates].map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const seenSources = new Set();
  const replacements = ledger.replacements.map((replacement) => {
    const source = sourceById.get(replacement.sourceAssetId);
    const candidate = candidateById.get(replacement.candidateId);
    if (
      !source ||
      !candidate ||
      candidate.sourceAssetId !== source.sourceAssetId
    ) {
      throw new Error(
        `Promotion ledger identity mismatch: ${replacement.sourceAssetId}`,
      );
    }
    if (seenSources.has(source.sourceAssetId)) {
      throw new Error(`Duplicate promoted source: ${source.sourceAssetId}`);
    }
    seenSources.add(source.sourceAssetId);
    const bound = bindGeneratedCandidateHistory({
      candidate,
      historyRows: generatedHistory.filter(
        (row) => row.candidateId === candidate.candidateId,
      ),
      actualAudioSha256: actualAudioShaByCandidateId.get(candidate.candidateId),
    });
    const lineage = postProcessingLineageBySourceAssetId.get(
      source.sourceAssetId,
    );
    const directFormal = source.sourceSha256 === bound?.candidateSha256;
    const validatedPostProcessing = Boolean(
      lineage &&
        lineage.sourceSha256 === bound?.candidateSha256 &&
        lineage.candidateSha256 === source.sourceSha256 &&
        lineage.desktopPath === source.desktopPath &&
        lineage.browserPath === source.browserPath,
    );
    if (
      !bound ||
      (!directFormal && !validatedPostProcessing) ||
      replacement.newSha256 !== bound.candidateSha256 ||
      formalShaByPath.get(source.desktopPath) !== source.sourceSha256 ||
      formalShaByPath.get(source.browserPath) !== source.sourceSha256
    ) {
      throw new Error(
        `Promoted candidate/formal SHA mismatch: ${source.sourceAssetId}`,
      );
    }
    return {
      ...replacement,
      newSha256: bound.candidateSha256,
      status: "already-promoted-pending-human",
      currentFormalSha256: source.sourceSha256,
      postProcessingLineageValidated: validatedPostProcessing,
    };
  });
  if (ledger.replacementCount !== replacements.length) {
    throw new Error("Promotion ledger replacement count changed");
  }
  return {
    ...ledger,
    version: 2,
    replacementCount: replacements.length,
    replacements,
  };
}

export function automaticSelectionReferenceIssues(source) {
  const issues = [];
  if (
    !["two-source-confirmed", "variant-confirmed"].includes(
      source?.referenceStatus,
    )
  ) {
    issues.push("reference-not-confirmed");
  }
  if (independentReferenceSourceCount(source ?? {}) < 2) {
    issues.push("reference-independent-sources-below-two");
  }
  if (hasRelationshipIssues(source?.relationshipIssues)) {
    issues.push("relationship-issues-present");
  }
  return issues;
}

export function computeObservationDigest(value) {
  return digest(JSON.stringify(value ?? null));
}

export function evaluateCandidate({
  candidate,
  source,
  signal,
  whisper,
  azure,
  scribe,
  azurePronunciation,
}) {
  const reasons = [...automaticSelectionReferenceIssues(source)];
  if (!signal?.ok || (signal?.issues?.length ?? 0) > 0)
    reasons.push("signal-failed");
  for (const [listener, observation] of [
    ["whisper", whisper],
    ["azure", azure],
    ["scribe", scribe],
  ]) {
    if (!observation || !STABLE_BLIND_OUTCOMES.has(observation.outcome)) {
      reasons.push(`${listener}-${observation?.outcome ?? "missing"}`);
    }
    if (observation?.answerLeakage === true)
      reasons.push(`${listener}-answer-leakage`);
  }
  if (candidate.languageId === "en-US") {
    if (!azurePronunciation?.ok) reasons.push("english-pronunciation-missing");
    if (azurePronunciation?.targetUnitAligned !== true)
      reasons.push("english-target-unit-missing");
    if (azurePronunciation?.syllableCountAligned !== true)
      reasons.push("english-syllable-count-mismatch");
    if (azurePronunciation?.stressAligned !== true)
      reasons.push("english-stress-mismatch");
  }
  return {
    candidateId: candidate.candidateId,
    sourceAssetId: candidate.sourceAssetId,
    status: reasons.length === 0 ? "machine-passed" : "machine-failed",
    reasons,
    exactListenerCount: [whisper, azure, scribe].filter(
      (item) => item?.outcome === "exact",
    ).length,
    wordAccuracy: azurePronunciation?.wordAccuracy ?? null,
    distanceFromVoiceMedian:
      signal?.distanceFromVoiceMedian ?? Number.POSITIVE_INFINITY,
  };
}

export function selectCandidateForAsset(candidates) {
  const passed = candidates.filter(
    (candidate) => candidate.status === "machine-passed",
  );
  if (passed.length === 0) return null;
  return [...passed].sort((left, right) => {
    if (right.exactListenerCount !== left.exactListenerCount)
      return right.exactListenerCount - left.exactListenerCount;
    if ((right.wordAccuracy ?? -1) !== (left.wordAccuracy ?? -1))
      return (right.wordAccuracy ?? -1) - (left.wordAccuracy ?? -1);
    if (left.distanceFromVoiceMedian !== right.distanceFromVoiceMedian)
      return left.distanceFromVoiceMedian - right.distanceFromVoiceMedian;
    return left.candidateId.localeCompare(right.candidateId);
  })[0];
}

export function assertPromotionAllowed({
  source,
  candidate,
  currentSourceSha256,
}) {
  if (!candidate || candidate.status !== "machine-passed") {
    throw new Error(
      `Candidate is not machine-passed for ${source.sourceAssetId}`,
    );
  }
  if (source.sourceSha256 !== currentSourceSha256) {
    throw new Error(
      `Source SHA changed for ${source.sourceAssetId}; refusing promotion`,
    );
  }
  if (candidate.sourceAssetId !== source.sourceAssetId) {
    throw new Error("Candidate/source asset mismatch");
  }
  return true;
}
