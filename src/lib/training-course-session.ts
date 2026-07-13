import { evaluateTrainingCriterion } from "@speakright/core/training/criteria";
import type {
  TrainingLevel,
  TrainingLevelKind,
  TrainingLevelSummary,
  TrainingPackCourse,
} from "@/types/training";

export interface CoursePosition {
  levelIndex: number;
  itemIndex: number;
  remediationPathId?: string;
}

export interface CourseAttemptSnapshot {
  levelId: string;
  kind: TrainingLevelKind;
  scores: number[];
  attempts: number;
  passedCount: number;
  stuckCount: number;
  contextIds?: string[];
  crossSpeakerValid?: boolean;
  validSampleCount?: number;
  recordingQualityValid?: boolean;
  alignmentValid?: boolean;
}

export function shouldAppendPerceptionReview(
  correct: number,
  total: number,
  requiredRate = 0.85,
): boolean {
  return total > 0 && correct / total < requiredRate;
}

export function shouldEnterRemediation(failedAttempts: number): boolean {
  return failedAttempts >= 2;
}

export function shouldMarkStuck(failedAttempts: number): boolean {
  return failedAttempts >= 3;
}

export function levelBestScore(scores: number[]): number {
  return Math.max(0, ...scores);
}

export function hasLevelPassed(
  level: TrainingLevel,
  snapshot: CourseAttemptSnapshot,
): boolean {
  const contexts = snapshot.contextIds ?? [];
  return evaluateTrainingCriterion(level.criterion, {
    correctCount: snapshot.passedCount,
    totalCount: snapshot.attempts,
    uniqueContextIds: contexts,
    crossSpeakerValid: snapshot.crossSpeakerValid,
    passedCount: snapshot.passedCount,
    validSampleCount: snapshot.validSampleCount ?? snapshot.attempts,
    contextCount: new Set(contexts).size,
    recordingQualityValid: snapshot.recordingQualityValid ?? true,
    alignmentValid: snapshot.alignmentValid ?? true,
  }).passed;
}

export function toLevelSummary(
  level: TrainingLevel,
  snapshot: CourseAttemptSnapshot,
): TrainingLevelSummary {
  return {
    levelId: level.id,
    kind: level.kind,
    attempts: snapshot.attempts,
    passed: hasLevelPassed(level, snapshot),
    bestScore: levelBestScore(snapshot.scores),
    stuckCount: snapshot.stuckCount,
  };
}

export function nextCoursePosition(
  course: TrainingPackCourse,
  position: CoursePosition,
): CoursePosition | null {
  const currentLevel = course.levels[position.levelIndex];
  if (!currentLevel) return null;
  const nextItem = position.itemIndex + 1;
  if (nextItem < currentLevel.items.length) {
    return { levelIndex: position.levelIndex, itemIndex: nextItem };
  }
  const nextLevel = position.levelIndex + 1;
  if (nextLevel >= course.levels.length) return null;
  return { levelIndex: nextLevel, itemIndex: 0 };
}
