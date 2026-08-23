import type { TrainingCriterion } from "@speakright/core/training/criteria";
import type { AzureAssessmentResult } from "@/types/azure";
import type {
  AttemptAnalysis,
  TrainingCourseItem,
  TrainingLevelKind,
  TrainingPack,
} from "@/types/training";
import { detectErrorPatterns } from "./training-error-patterns";
import { getPassScore } from "./training-score";

export interface AttemptAnalysisInput {
  pack: TrainingPack;
  item: TrainingCourseItem;
  result: AzureAssessmentResult;
  levelKind?: TrainingLevelKind;
  criterion?: TrainingCriterion;
}

function fallbackCue(item: TrainingCourseItem, passed: boolean): string {
  if (passed) return item.successCue;
  return item.focusPoint;
}

function targetMissingCue(): string {
  return "这次没有对齐到目标音素，整体分只作参考；请放慢一点重录，让目标音更清楚。";
}

function isFinalPosition(
  pack: TrainingPack,
  item: TrainingCourseItem,
): boolean {
  return pack.id === "final-consonants" || item.position === "final";
}

function prosodyPatternIds(
  pack: TrainingPack,
  result: AzureAssessmentResult,
): string[] {
  if (pack.id !== "stress-rhythm") return [];
  const prosody = result.prosodyScore ?? 100;
  const fluency = result.fluencyScore ?? 100;
  return Math.min(prosody, fluency) < 78 ? ["weak-forms-rhythm"] : [];
}

export function analyzeAttempt({
  pack,
  item,
  result,
  levelKind,
  criterion,
}: AttemptAnalysisInput): AttemptAnalysis {
  const score = getPassScore(result, item.targetPhonemes);
  const threshold =
    criterion &&
    criterion.kind !== "perception" &&
    criterion.kind !== "motor-formation"
      ? criterion.minTargetScore
      : levelKind === "syllable"
        ? 78
        : levelKind === "mixed-review"
          ? (pack.masteryRule.mixedReviewAverage ??
            pack.masteryRule.targetPassScore)
          : pack.masteryRule.targetPassScore;
  const passed = !score.usedFallback && score.targetScore >= threshold;
  const patterns = score.usedFallback
    ? []
    : detectErrorPatterns({
        packId: pack.id,
        targetPhonemes: item.targetPhonemes,
        targetScore: score.targetScore,
        overallScore: score.overallScore,
        isFinalPosition: isFinalPosition(pack, item),
        issueType: pack.id === "stress-rhythm" ? "rhythm" : undefined,
      });
  const patternIds = [
    ...patterns.map((pattern) => pattern.id),
    ...prosodyPatternIds(pack, result),
  ];
  const uniquePatternIds = Array.from(new Set(patternIds));
  const primaryPattern =
    patterns.find((pattern) => pattern.id !== "target-low-overall-high") ??
    patterns[0];

  return {
    itemId: item.id,
    passed,
    targetScore: score.targetScore,
    overallScore: score.overallScore,
    usedFallback: score.usedFallback,
    scoreGap: score.overallScore - score.targetScore,
    detectedPatternIds: uniquePatternIds,
    primaryPatternId: primaryPattern?.id ?? uniquePatternIds[0],
    nextCue:
      primaryPattern?.immediateCue ??
      (score.usedFallback ? targetMissingCue() : fallbackCue(item, passed)),
    remediationPathId: primaryPattern?.remediationPathId,
  };
}
