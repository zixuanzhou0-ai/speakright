export type PerceptionCategory = "category-a" | "category-b";

export interface PerceptionExample {
  id: string;
  categoryA: { word: string; targetUnit: string };
  categoryB: { word: string; targetUnit: string };
}

export interface AudioAssetRef {
  word: string;
  targetUnit: string;
  speakerId: string;
  uri: string;
}

export interface PerceptionTrial {
  id: string;
  pairId: string;
  probePairId: string;
  aCategory: PerceptionCategory;
  probeMatches: "A" | "B";
  referenceSpeakerId: string;
  probeSpeakerId: string;
  referenceA: AudioAssetRef;
  referenceB: AudioAssetRef;
  probe: AudioAssetRef;
}

export interface CreatePerceptionTrialsOptions {
  seed: string | number;
  trialCount?: number;
  speakers?: readonly string[];
  audioUri?: (word: string, speakerId: string) => string;
}

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function defaultAudioUri(word: string, speakerId: string): string {
  return `/audio/words/${speakerId}/${encodeURIComponent(word.toLowerCase())}.mp3`;
}

export function isCrossSpeakerPerceptionTrial(trial: PerceptionTrial): boolean {
  return (
    trial.referenceSpeakerId !== trial.probeSpeakerId &&
    trial.referenceA.speakerId === trial.referenceB.speakerId &&
    trial.probe.speakerId === trial.probeSpeakerId &&
    trial.referenceA.uri !== trial.probe.uri &&
    trial.referenceB.uri !== trial.probe.uri
  );
}

export function createPerceptionTrials(
  examples: readonly PerceptionExample[],
  options: CreatePerceptionTrialsOptions,
): PerceptionTrial[] {
  if (examples.length < 4) {
    throw new Error("Perception training requires at least four examples.");
  }

  const trialCount = options.trialCount ?? 8;
  if (trialCount < 1) return [];
  const speakers = [...new Set(options.speakers ?? ["blue", "pink"])];
  if (speakers.length < 2) {
    throw new Error("Perception training requires two different speakers.");
  }

  const random = mulberry32(hashSeed(options.seed));
  const ordered = shuffle(examples, random);
  const audioUri = options.audioUri ?? defaultAudioUri;
  const startWithSlotA = random() >= 0.5;
  const startWithFirstSpeaker = random() >= 0.5;

  const orderedSpeakers = startWithFirstSpeaker
    ? speakers
    : [...speakers].reverse();
  const speakerPairings = shuffle(
    orderedSpeakers.flatMap((referenceSpeaker) =>
      orderedSpeakers
        .filter((probeSpeaker) => probeSpeaker !== referenceSpeaker)
        .map((probeSpeaker) => ({ referenceSpeaker, probeSpeaker })),
    ),
    random,
  );
  return Array.from({ length: trialCount }, (_, index) => {
    const referenceExample = ordered[index % ordered.length];
    const probeExample = ordered[(index + 1) % ordered.length];
    const probeMatches: "A" | "B" =
      index % 2 === 0
        ? startWithSlotA
          ? "A"
          : "B"
        : startWithSlotA
          ? "B"
          : "A";
    const { referenceSpeaker, probeSpeaker } =
      speakerPairings[index % speakerPairings.length];
    const swapSlots = random() >= 0.5;
    const slotACategory: PerceptionCategory = swapSlots
      ? "category-b"
      : "category-a";
    const slotAData = swapSlots
      ? referenceExample.categoryB
      : referenceExample.categoryA;
    const slotBData = swapSlots
      ? referenceExample.categoryA
      : referenceExample.categoryB;
    const probeCategory: PerceptionCategory =
      probeMatches === "A"
        ? slotACategory
        : slotACategory === "category-a"
          ? "category-b"
          : "category-a";
    const probeData =
      probeCategory === "category-a"
        ? probeExample.categoryA
        : probeExample.categoryB;

    const trial: PerceptionTrial = {
      id: `${referenceExample.id}-${probeExample.id}-${index + 1}`,
      pairId: referenceExample.id,
      probePairId: probeExample.id,
      aCategory: slotACategory,
      probeMatches,
      referenceSpeakerId: referenceSpeaker,
      probeSpeakerId: probeSpeaker,
      referenceA: {
        ...slotAData,
        speakerId: referenceSpeaker,
        uri: audioUri(slotAData.word, referenceSpeaker),
      },
      referenceB: {
        ...slotBData,
        speakerId: referenceSpeaker,
        uri: audioUri(slotBData.word, referenceSpeaker),
      },
      probe: {
        ...probeData,
        speakerId: probeSpeaker,
        uri: audioUri(probeData.word, probeSpeaker),
      },
    };

    if (!isCrossSpeakerPerceptionTrial(trial)) {
      throw new Error(`Invalid cross-speaker perception trial: ${trial.id}`);
    }
    if (
      trial.probe.word === trial.referenceA.word ||
      trial.probe.word === trial.referenceB.word
    ) {
      throw new Error(`Probe must use a different word: ${trial.id}`);
    }
    return trial;
  });
}
