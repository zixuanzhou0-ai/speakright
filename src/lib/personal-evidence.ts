import type { TrainingPack } from "@/types/training";
import { getTrainingPack } from "./training-packs";

export interface PersonalEvidenceOccurrence {
  packId: string;
  word: string;
  sentence: string;
  targetPhonemes: string[];
  reason: string;
}

export interface PersonalEvidencePlan {
  text: string;
  occurrences: PersonalEvidenceOccurrence[];
  generatedSentences: string[];
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)?/g)
      ?.filter((word) => word.length >= 2) ?? []
  );
}

function packVocabulary(packId: string): Set<string> {
  const pack = getTrainingPack(packId);
  if (!pack) return new Set();
  return new Set(
    [
      ...pack.wordLadder.map((item) => item.text),
      ...pack.sentenceLadder.flatMap((item) => words(item.text)),
      ...pack.minimalPairs.flatMap((item) => [item.wordA, item.wordB]),
      ...(pack.course?.levels.flatMap((level) =>
        level.items.flatMap((item) => words(item.referenceText ?? item.text)),
      ) ?? []),
    ].map((word) => word.toLowerCase()),
  );
}

export function buildPersonalEvidencePlan(
  text: string,
  packIds: string[],
): PersonalEvidencePlan {
  const sentences = splitSentences(text);
  const occurrences = packIds.flatMap((packId) => {
    const pack = getTrainingPack(packId);
    if (!pack) return [];
    const vocab = packVocabulary(packId);
    return sentences.flatMap((sentence) =>
      words(sentence)
        .filter((word) => vocab.has(word))
        .map((word) => ({
          packId,
          word,
          sentence,
          targetPhonemes: pack.targetPhonemes,
          reason: `你的文本中出现了 ${pack.title} 的证据词。`,
        })),
    );
  });

  const generatedSentences =
    occurrences.length > 0
      ? occurrences.slice(0, 3).map((item) => item.sentence)
      : packIds
          .map((packId) => getTrainingPack(packId))
          .filter((pack): pack is TrainingPack => !!pack)
          .map((pack) => pack.sentenceLadder[0]?.text ?? pack.focus)
          .slice(0, 3);

  return {
    text,
    occurrences,
    generatedSentences: Array.from(new Set(generatedSentences)),
  };
}
