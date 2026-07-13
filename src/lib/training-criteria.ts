import type { TrainingCriterion } from "@speakright/core/training/criteria";
import { getPhonemeBySlug } from "@/lib/phoneme-data";
import type { LevelPassRule, TrainingLevel } from "@/types/training";

const NON_PHONEME_TARGET_LABELS: Record<string, string> = {
  "open-syllable": "无目标词尾",
  "final-consonant": "有词尾辅音",
  "initial-stress": "首音节重读",
  "later-stress": "后续音节重读",
};

export function criterionToLegacyPassRule(
  criterion: TrainingCriterion,
): LevelPassRule {
  if (criterion.kind === "perception") {
    return { minCorrectRate: criterion.minCorrectRate };
  }
  return {
    minTargetScore: criterion.minTargetScore,
    requiredPasses: criterion.minValidSamples,
  };
}

export function describeTrainingCriterion(level: TrainingLevel): string {
  const criterion = level.criterion;
  if (criterion.kind === "perception") {
    return `${criterion.minTrials} 次听辨、至少 ${criterion.minUniquePairs} 组对比、正确率 ${Math.round(
      criterion.minCorrectRate * 100,
    )}% 且跨说话人`;
  }
  if (criterion.kind === "retention") {
    return `${criterion.minValidSamples} 个有效样本达到 ${criterion.minTargetScore} 分，使用未训练材料并间隔至少 ${criterion.minDelayHours} 小时`;
  }
  if (criterion.kind === "transfer") {
    return `${criterion.minValidSamples} 个有效样本达到 ${criterion.minTargetScore} 分，并覆盖 ${criterion.minContexts} 个语境`;
  }
  if (criterion.minTargetScore <= 0) {
    return `完成 ${criterion.minValidSamples} 个动作自检`;
  }
  return `${criterion.minValidSamples} 个有效样本达到目标音 ${criterion.minTargetScore} 分`;
}

export function criterionTargetScore(level: TrainingLevel): number {
  return level.criterion.kind === "perception"
    ? 0
    : level.criterion.minTargetScore;
}

export function formatTrainingTargetUnit(unit: string): string {
  const ipa = getPhonemeBySlug(unit)?.ipa;
  if (ipa) return ipa;
  if (NON_PHONEME_TARGET_LABELS[unit]) return NON_PHONEME_TARGET_LABELS[unit];
  return unit.startsWith("/") ? unit : "当前训练目标";
}
