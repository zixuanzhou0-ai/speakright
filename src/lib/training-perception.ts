import catalogJson from "@speakright/core/content/training-perception-catalog.json";
import type {
  PerceptionExample,
  PerceptionTrial,
} from "@speakright/core/training/perception";
import { createPerceptionTrials } from "@speakright/core/training/perception";
import type { TrainingCourseItem } from "@/types/training";

interface PerceptionCatalogEntry {
  packId: string;
  categoryA: { targetUnit: string; label: string };
  categoryB: { targetUnit: string; label: string };
  examples: Array<{ id: string; wordA: string; wordB: string }>;
}

const CATALOG = catalogJson as PerceptionCatalogEntry[];

export function getPerceptionCatalogEntry(
  packId: string,
): PerceptionCatalogEntry | null {
  return CATALOG.find((entry) => entry.packId === packId) ?? null;
}

export function getPerceptionExamples(packId: string): PerceptionExample[] {
  const entry = getPerceptionCatalogEntry(packId);
  if (!entry) return [];
  return entry.examples.map((example) => ({
    id: example.id,
    categoryA: {
      word: example.wordA,
      targetUnit: entry.categoryA.targetUnit,
    },
    categoryB: {
      word: example.wordB,
      targetUnit: entry.categoryB.targetUnit,
    },
  }));
}

export function createPackPerceptionTrials(
  packId: string,
  seed: string | number,
  trialCount = 8,
): PerceptionTrial[] {
  return createPerceptionTrials(getPerceptionExamples(packId), {
    seed,
    trialCount,
    speakers: ["blue", "pink"],
  });
}

export function perceptionTrialToCourseItem(
  trial: PerceptionTrial,
  index: number,
): TrainingCourseItem {
  return {
    id: `perception-trial-${index + 1}-${trial.id}`,
    text: trial.referenceA.word,
    contrastText: trial.referenceB.word,
    displayText: "隐藏文字，只按声音分类",
    referenceText: trial.referenceA.word,
    playbackText: trial.referenceA.word,
    targetPhonemes: Array.from(
      new Set([trial.referenceA.targetUnit, trial.referenceB.targetUnit]),
    ),
    focusPoint:
      "A、B 是同一位说话人的参照；X 来自另一位说话人。只判断目标发音类别。",
    commonMistake: "不要根据说话人、音量或某一条录音的细节猜答案。",
    successCue: "换说话人、换单词后仍能稳定归类。",
    difficulty: index < 4 ? 1 : 2,
    isRecordable: false,
  };
}

export function perceptionCriterionLabel(packId: string): string {
  const entry = getPerceptionCatalogEntry(packId);
  if (!entry) return "跨说话人听辨";
  return `${entry.categoryA.label} 与 ${entry.categoryB.label}`;
}

export { CATALOG as TRAINING_PERCEPTION_CATALOG };
