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

function normalizeIpa(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/gu, "")
    .replaceAll("ˈ", "")
    .replaceAll("ˌ", "")
    .replaceAll(" ", "");
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
  const risks = consensus.items.filter((item) => item.priority === "P0-human");
  if (risks.length !== EXPECTED_REGENERATION_ASSET_COUNT) {
    throw new Error(
      `Regeneration scope must contain ${EXPECTED_REGENERATION_ASSET_COUNT} P0 assets, received ${risks.length}`,
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
      return {
        sourceAssetId: asset.assetId,
        sourceSha256: asset.sha256,
        languageId: asset.languageId,
        languageCode: asset.languageId.slice(0, 2),
        role: asset.role,
        text: asset.text,
        canonicalIpa,
        referenceStatus: reference?.status ?? "needs-native-review",
        referenceSourceCount: reference?.sources?.length ?? 0,
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
    ["A", "B"].map((label, index) => ({
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
    })),
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
  if (
    !["two-source-confirmed", "variant-confirmed"].includes(
      source.referenceStatus,
    ) ||
    source.referenceSourceCount < 2
  ) {
    throw new Error(
      `Third candidate blocked by unresolved reference for ${source.sourceAssetId}`,
    );
  }
  return {
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
      phoneme: normalizeIpa(source.canonicalIpa),
    },
    status: "planned",
  };
}

export function evaluateCandidate({
  candidate,
  signal,
  whisper,
  azure,
  scribe,
  azurePronunciation,
}) {
  const reasons = [];
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
