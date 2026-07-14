export type GuidedRepeatLanguageId = "en-US" | "es-ES" | "fr-FR" | "ru-RU";
export type GuidedRepeatRhythm = "flow" | "standard" | "relaxed";
export type GuidedRepeatStatus =
  | "idle"
  | "preloading"
  | "playing"
  | "paused"
  | "auto-paused"
  | "recoverable-error"
  | "completed";
export type GuidedRepeatAudioRole =
  | "anchor-single"
  | "word-masculine"
  | "word-feminine";
export type GuidedRepeatGapKind = "cue" | "imitation" | "transition";

export interface GuidedRepeatVoicePolicy {
  languageId: GuidedRepeatLanguageId;
  masculine: { assetSlot: "blue" | "pink"; speakerId: string };
  feminine: { assetSlot: "blue" | "pink"; speakerId: string };
}

export interface GuidedRepeatQueueItem {
  materialId: string;
  word: string;
  ipa: string;
  targetUnits: string[];
  masculineAudioSrc: string;
  feminineAudioSrc: string;
}

export interface GuidedRepeatSessionPlan {
  languageId: GuidedRepeatLanguageId;
  soundUnitSlug: string;
  rhythm: GuidedRepeatRhythm;
  anchorAudio: { single: string };
  queue: GuidedRepeatQueueItem[];
  totalWords: number;
}

export type GuidedRepeatStep =
  | {
      kind: "audio";
      role: GuidedRepeatAudioRole;
      src: string;
      wordIndex: number;
      turn?: 1 | 2;
    }
  | { kind: "gap"; gapKind: GuidedRepeatGapKind; wordIndex: number }
  | { kind: "transition"; fromWordIndex: number; toWordIndex: number };

export interface GuidedRepeatValidation {
  valid: boolean;
  issues: string[];
}

const VOICE_POLICIES: Record<GuidedRepeatLanguageId, GuidedRepeatVoicePolicy> =
  {
    "en-US": {
      languageId: "en-US",
      masculine: { assetSlot: "blue", speakerId: "max" },
      feminine: { assetSlot: "pink", speakerId: "nichalia" },
    },
    "es-ES": {
      languageId: "es-ES",
      masculine: { assetSlot: "blue", speakerId: "marco-cruz" },
      feminine: { assetSlot: "pink", speakerId: "lydia" },
    },
    "fr-FR": {
      languageId: "fr-FR",
      masculine: { assetSlot: "blue", speakerId: "clement" },
      feminine: { assetSlot: "pink", speakerId: "rachel" },
    },
    "ru-RU": {
      languageId: "ru-RU",
      masculine: { assetSlot: "pink", speakerId: "sergey" },
      feminine: { assetSlot: "blue", speakerId: "valeria" },
    },
  };

const RHYTHM_TIMING = {
  flow: {
    cue: 300,
    transition: 450,
    multiplier: 0.7,
    base: 350,
    min: 900,
    max: 2200,
  },
  standard: {
    cue: 450,
    transition: 650,
    multiplier: 0.9,
    base: 500,
    min: 1200,
    max: 3200,
  },
  relaxed: {
    cue: 650,
    transition: 900,
    multiplier: 1.15,
    base: 700,
    min: 1600,
    max: 4200,
  },
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isLocalAudioSrc(src: string | undefined): src is string {
  return Boolean(src?.startsWith("/audio/"));
}

export function resolveGuidedRepeatVoicePolicy(
  languageId: GuidedRepeatLanguageId,
): GuidedRepeatVoicePolicy {
  return VOICE_POLICIES[languageId];
}

export function rotateGuidedRepeatQueue<T extends { materialId: string }>(
  pool: readonly T[],
  currentMaterialId: string,
): T[] {
  if (pool.length === 0) return [];
  const currentIndex = pool.findIndex(
    (item) => item.materialId === currentMaterialId,
  );
  if (currentIndex <= 0) return [...pool];
  return [...pool.slice(currentIndex), ...pool.slice(0, currentIndex)];
}

export function getGuidedRepeatGapMs(
  audioDurationMs: number,
  rhythm: GuidedRepeatRhythm,
  gapKind: GuidedRepeatGapKind,
): number {
  const timing = RHYTHM_TIMING[rhythm];
  if (gapKind === "cue") return timing.cue;
  if (gapKind === "transition") return timing.transition;
  return Math.round(
    clamp(
      Math.max(0, audioDurationMs) * timing.multiplier + timing.base,
      timing.min,
      timing.max,
    ),
  );
}

export function buildGuidedRepeatSessionPlan(input: {
  languageId: GuidedRepeatLanguageId;
  soundUnitSlug: string;
  rhythm?: GuidedRepeatRhythm;
  anchorAudio: GuidedRepeatSessionPlan["anchorAudio"];
  pool: readonly GuidedRepeatQueueItem[];
  currentMaterialId: string;
}): GuidedRepeatSessionPlan {
  const queue = rotateGuidedRepeatQueue(input.pool, input.currentMaterialId);
  return {
    languageId: input.languageId,
    soundUnitSlug: input.soundUnitSlug,
    rhythm: input.rhythm ?? "standard",
    anchorAudio: { ...input.anchorAudio },
    queue,
    totalWords: queue.length,
  };
}

function buildWordAudioSteps(
  item: GuidedRepeatQueueItem,
  wordIndex: number,
): GuidedRepeatStep[] {
  return [
    {
      kind: "audio",
      role: "word-masculine",
      src: item.masculineAudioSrc,
      wordIndex,
      turn: 1,
    },
    { kind: "gap", gapKind: "imitation", wordIndex },
    {
      kind: "audio",
      role: "word-feminine",
      src: item.feminineAudioSrc,
      wordIndex,
      turn: 1,
    },
    { kind: "gap", gapKind: "imitation", wordIndex },
    {
      kind: "audio",
      role: "word-masculine",
      src: item.masculineAudioSrc,
      wordIndex,
      turn: 2,
    },
    { kind: "gap", gapKind: "imitation", wordIndex },
    {
      kind: "audio",
      role: "word-feminine",
      src: item.feminineAudioSrc,
      wordIndex,
      turn: 2,
    },
    { kind: "gap", gapKind: "imitation", wordIndex },
  ];
}

export function buildGuidedRepeatSteps(
  plan: GuidedRepeatSessionPlan,
): GuidedRepeatStep[] {
  const steps: GuidedRepeatStep[] = [];
  plan.queue.forEach((item, wordIndex) => {
    steps.push(
      {
        kind: "audio",
        role: "anchor-single",
        src: plan.anchorAudio.single,
        wordIndex,
        turn: 1,
      },
      { kind: "gap", gapKind: "cue", wordIndex },
      {
        kind: "audio",
        role: "anchor-single",
        src: plan.anchorAudio.single,
        wordIndex,
        turn: 2,
      },
      { kind: "gap", gapKind: "imitation", wordIndex },
    );
    steps.push(...buildWordAudioSteps(item, wordIndex));
    if (wordIndex < plan.queue.length - 1) {
      steps.push(
        { kind: "gap", gapKind: "transition", wordIndex },
        {
          kind: "transition",
          fromWordIndex: wordIndex,
          toWordIndex: wordIndex + 1,
        },
      );
    }
  });
  return steps;
}

export function validateGuidedRepeatSessionPlan(
  plan: GuidedRepeatSessionPlan,
): GuidedRepeatValidation {
  const issues: string[] = [];
  if (!plan.soundUnitSlug.trim()) issues.push("sound unit slug is required");
  if (plan.queue.length === 0) issues.push("word queue is empty");
  if (plan.totalWords !== plan.queue.length) {
    issues.push("totalWords does not match queue length");
  }
  if (!isLocalAudioSrc(plan.anchorAudio.single)) {
    issues.push("sound-unit anchor must be local");
  }
  const ids = new Set<string>();
  for (const item of plan.queue) {
    if (ids.has(item.materialId)) {
      issues.push(`duplicate material: ${item.materialId}`);
    }
    ids.add(item.materialId);
    if (!item.word.trim()) issues.push(`empty word: ${item.materialId}`);
    if (!isLocalAudioSrc(item.masculineAudioSrc)) {
      issues.push(`missing local masculine audio: ${item.materialId}`);
    }
    if (!isLocalAudioSrc(item.feminineAudioSrc)) {
      issues.push(`missing local feminine audio: ${item.materialId}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export function validateGuidedRepeatAssets(
  plans: readonly GuidedRepeatSessionPlan[],
): GuidedRepeatValidation {
  const issues = plans.flatMap((plan) =>
    validateGuidedRepeatSessionPlan(plan).issues.map(
      (issue) => `${plan.languageId}/${plan.soundUnitSlug}: ${issue}`,
    ),
  );
  return { valid: issues.length === 0, issues };
}
