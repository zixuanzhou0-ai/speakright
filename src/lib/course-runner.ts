import type {
  AttemptAnalysis,
  CourseRunnerState,
  LevelGateResult,
  TrainingPackCourse,
  TrainingCourseItem,
  TrainingLevel,
  TrainingLevelProgress,
} from "@/types/training";
import {
  hasLevelPassed,
  levelBestScore,
  shouldEnterRemediation,
  shouldMarkStuck,
  type CourseAttemptSnapshot,
} from "./training-course-session";

export function createCourseRunnerState(packId: string): CourseRunnerState {
  return {
    packId,
    levelIndex: 0,
    itemIndex: 0,
    attemptsByItem: {},
    levelProgress: {},
    stuckPatternIds: [],
    focusedReviewQueue: [],
    phase: "intro",
  };
}

export function getLevelIndexById(
  course: TrainingPackCourse,
  levelId?: string | null,
): number {
  if (!levelId) return 0;
  const index = course.levels.findIndex((level) => level.id === levelId);
  return index >= 0 ? index : 0;
}

export function createCourseStartPosition(
  course: TrainingPackCourse,
  levelId?: string | null,
): { levelIndex: number; itemIndex: number } {
  return { levelIndex: getLevelIndexById(course, levelId), itemIndex: 0 };
}

export function getCourseItemReference(item: TrainingCourseItem): string {
  return item.referenceText ?? item.contrastText?.replace(" / ", " ") ?? item.text;
}

export function getCourseItemPlaybackText(item: TrainingCourseItem): string {
  return item.playbackText ?? getCourseItemReference(item);
}

export function isRecordableCourseItem(item: TrainingCourseItem): boolean {
  return item.isRecordable !== false;
}

export function getAttemptCount(
  state: CourseRunnerState,
  item: TrainingCourseItem,
): number {
  return state.attemptsByItem[item.id] ?? 0;
}

function updateProgress(
  current: TrainingLevelProgress | undefined,
  analysis: AttemptAnalysis,
): TrainingLevelProgress {
  return {
    passed: analysis.passed || current?.passed === true,
    bestScore: Math.max(current?.bestScore ?? 0, analysis.targetScore),
    attempts: (current?.attempts ?? 0) + 1,
  };
}

export function recordRunnerAttempt(
  state: CourseRunnerState,
  level: TrainingLevel,
  item: TrainingCourseItem,
  analysis: AttemptAnalysis,
): CourseRunnerState {
  const attempts = getAttemptCount(state, item) + 1;
  const stuck = !analysis.passed && shouldMarkStuck(attempts);
  const patternIds =
    analysis.detectedPatternIds.length > 0
      ? analysis.detectedPatternIds
      : ["target-low-overall-high"];

  return {
    ...state,
    attemptsByItem: { ...state.attemptsByItem, [item.id]: attempts },
    levelProgress: {
      ...state.levelProgress,
      [level.id]: updateProgress(state.levelProgress[level.id], analysis),
    },
    stuckPatternIds: stuck
      ? Array.from(new Set([...state.stuckPatternIds, ...patternIds]))
      : state.stuckPatternIds,
    phase:
      !analysis.passed && shouldEnterRemediation(attempts)
        ? "remediation"
        : state.phase,
  };
}

export function recordRunnerPerceptionAnswer(
  state: CourseRunnerState,
  level: TrainingLevel,
  item: TrainingCourseItem,
  correct: boolean,
): CourseRunnerState {
  const attempts = getAttemptCount(state, item) + 1;
  const current = state.levelProgress[level.id];
  return {
    ...state,
    attemptsByItem: { ...state.attemptsByItem, [item.id]: attempts },
    levelProgress: {
      ...state.levelProgress,
      [level.id]: {
        passed: correct || current?.passed === true,
        bestScore: correct ? 100 : current?.bestScore ?? 0,
        attempts: (current?.attempts ?? 0) + 1,
      },
    },
  };
}

export function buildFocusedReviewItems(
  level: TrainingLevel,
  currentItem?: TrainingCourseItem | null,
  count = 3,
): TrainingCourseItem[] {
  const currentTargets = new Set(currentItem?.targetPhonemes ?? []);
  const candidates = level.items.filter((item) => {
    if (!isRecordableCourseItem(item) && level.kind !== "perception") return false;
    if (item.id === currentItem?.id) return true;
    return item.targetPhonemes.some((phoneme) => currentTargets.has(phoneme));
  });
  const fallback = level.items.filter(
    (item) => isRecordableCourseItem(item) || level.kind === "perception",
  );
  return Array.from(new Map([...candidates, ...fallback].map((item) => [item.id, item])).values())
    .slice(0, count)
    .map((item, index) => ({
      ...item,
      id: `focus-${level.id}-${index + 1}-${item.id}`,
      focusPoint: `专项复练：${item.focusPoint}`,
    }));
}

export function evaluateLevelGate(
  level: TrainingLevel,
  snapshot: CourseAttemptSnapshot,
  currentItem?: TrainingCourseItem | null,
): LevelGateResult {
  if (hasLevelPassed(level, snapshot)) {
    return {
      passed: true,
      reason: "本关已经达到通过标准。",
      focusedReviewItems: [],
    };
  }
  const required =
    level.passRule.requiredPasses ??
    level.passRule.minCorrectRate ??
    level.passRule.minAverageScore ??
    level.passRule.minTargetScore ??
    0;
  return {
    passed: false,
    reason: `${level.title} 还没有达到通过标准（当前 best ${levelBestScore(
      snapshot.scores,
    )}，标准 ${required}）。先补 3 题专项复练，再进入下一关。`,
    focusedReviewItems: buildFocusedReviewItems(level, currentItem),
  };
}
