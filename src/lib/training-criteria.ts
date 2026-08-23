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
  if (criterion.kind === "motor-formation") {
    return {
      minTargetScore: 0,
      requiredPasses: criterion.minRecordedSamples,
    };
  }
  return {
    minTargetScore: criterion.minTargetScore,
    requiredPasses:
      criterion.kind === "controlled-production"
        ? (criterion.minPassedSamples ?? criterion.minValidSamples)
        : criterion.minValidSamples,
  };
}

export function describeTrainingCriterion(level: TrainingLevel): string {
  const criterion = level.criterion;
  if (criterion.kind === "perception") {
    const speakerCoverage = [
      criterion.minUniqueSpeakers
        ? `${criterion.minUniqueSpeakers} 名说话人`
        : null,
      criterion.minSpeakerPairings
        ? `${criterion.minSpeakerPairings} 种组合`
        : null,
    ].filter(Boolean);
    return `${criterion.minTrials} 次听辨、至少 ${criterion.minUniquePairs} 组对比、正确率 ${Math.round(
      criterion.minCorrectRate * 100,
    )}% 且跨说话人${speakerCoverage.length ? `（${speakerCoverage.join("、")}）` : ""}`;
  }
  if (criterion.kind === "motor-formation") {
    return `\u5b8c\u6210 ${criterion.minSelfChecks} \u9879\u52a8\u4f5c\u81ea\u68c0\u3001${criterion.minRecordedSamples} \u6bb5\u672c\u4eba\u5f55\u97f3\uff0c\u5e76\u5b8c\u6210\u4e00\u6b21\u4ea4\u66ff\u64ad\u653e`;
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
  const requiredPasses =
    criterion.minPassedSamples ?? criterion.minValidSamples;
  return `${criterion.minValidSamples} 个有效样本中至少 ${requiredPasses} 个达到目标音 ${criterion.minTargetScore} 分`;
}

export function criterionTargetScore(level: TrainingLevel): number {
  if (
    level.criterion.kind === "perception" ||
    level.criterion.kind === "motor-formation"
  )
    return 0;
  return level.criterion.minTargetScore;
}

export function formatTrainingTargetUnit(unit: string): string {
  const ipa = getPhonemeBySlug(unit)?.ipa;
  if (ipa) return ipa;
  if (NON_PHONEME_TARGET_LABELS[unit]) return NON_PHONEME_TARGET_LABELS[unit];
  return unit.startsWith("/") ? unit : "当前训练目标";
}
