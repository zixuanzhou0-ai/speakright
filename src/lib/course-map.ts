import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingLevel,
  TrainingLevelKind,
  TrainingPack,
} from "@/types/training";
import {
  firstUnpassedBeforeLevel,
  resolveCourseStartGate,
} from "./course-gates";

export type CourseLevelMapStatus =
  | "current"
  | "due"
  | "needs-work"
  | "passed"
  | "locked"
  | "new";

export interface CourseLevelMapItem {
  id: string;
  title: string;
  kind: TrainingLevelKind;
  index: number;
  status: CourseLevelMapStatus;
  passed: boolean;
  bestScore: number;
  attempts: number;
  stuckCount: number;
  dueTaskCount: number;
  reviewReason?: string;
  startLevelId: string;
  lockedByLevelId?: string;
  lockReason?: string;
  coachCue: string;
  passRuleText: string;
}

export interface CourseMapSummary {
  packId: string;
  totalLevels: number;
  passedLevels: number;
  attemptedLevels: number;
  stuckLevels: number;
  dueLevels: number;
  completionPercent: number;
  nextLevelId: string;
  nextLevelTitle: string;
  requestedLevelId?: string | null;
  requestedLevelTitle?: string;
  startLevelId: string;
  startLevelTitle: string;
  redirectedByGate: boolean;
  gateReason?: string;
  guidance: string;
  levels: CourseLevelMapItem[];
}

interface CourseMapInput {
  pack: TrainingPack;
  profile?: MasteryProfile | null;
  reviewQueue?: ReviewQueueItem[];
  currentLevelId?: string | null;
  requestedLevelId?: string | null;
}

function isKnownLevel(
  pack: TrainingPack,
  levelId?: string | null,
): levelId is string {
  return (
    !!levelId && !!pack.course?.levels.some((level) => level.id === levelId)
  );
}

function tasksForLevel(
  reviewQueue: ReviewQueueItem[] | undefined,
  packId: string,
  levelId: string,
): ReviewQueueItem[] {
  return (reviewQueue ?? []).filter(
    (task) => task.packId === packId && task.levelId === levelId,
  );
}

function passRuleText(level: TrainingLevel): string {
  const rule = level.passRule;
  if (level.kind === "perception") {
    return `听辨正确率 ${Math.round((rule.minCorrectRate ?? 0.8) * 100)}%+`;
  }
  if (rule.minAverageScore != null)
    return `平均目标音 ${rule.minAverageScore}+`;
  if (rule.requiredPasses != null) return `${rule.requiredPasses} 题过线`;
  return `目标音 ${rule.minTargetScore ?? 75}+`;
}

function statusForLevel({
  isCurrent,
  dueTaskCount,
  passed,
  attempts,
  stuckCount,
  locked,
}: {
  isCurrent: boolean;
  dueTaskCount: number;
  passed: boolean;
  attempts: number;
  stuckCount: number;
  locked: boolean;
}): CourseLevelMapStatus {
  if (isCurrent) return "current";
  if (dueTaskCount > 0) return "due";
  if (stuckCount > 0 || (attempts > 0 && !passed)) return "needs-work";
  if (passed) return "passed";
  if (locked) return "locked";
  return "new";
}

function firstRecentRecommendedLevel(
  profile: MasteryProfile | null | undefined,
  pack: TrainingPack,
): string | null {
  const recent = profile?.sessions.find(
    (session) =>
      session.packId === pack.id &&
      isKnownLevel(pack, session.recommendedNextLevelId),
  );
  return recent?.recommendedNextLevelId ?? null;
}

function chooseNextLevel(
  pack: TrainingPack,
  levels: CourseLevelMapItem[],
  profile: MasteryProfile | null | undefined,
  requestedLevelId?: string | null,
): CourseLevelMapItem {
  if (isKnownLevel(pack, requestedLevelId)) {
    return levels.find((level) => level.id === requestedLevelId) ?? levels[0];
  }
  const due = levels.find((level) => level.status === "due");
  if (due) return due;
  const recentId = firstRecentRecommendedLevel(profile, pack);
  const recent = levels.find((level) => level.id === recentId);
  if (recent) return recent;
  return (
    levels.find((level) => level.status === "needs-work") ??
    levels.find((level) => level.status === "new") ??
    levels[levels.length - 1] ?? {
      id: "perception-abx",
      title: "听辨 ABX",
      kind: "perception",
      index: 0,
      status: "new",
      passed: false,
      bestScore: 0,
      attempts: 0,
      stuckCount: 0,
      dueTaskCount: 0,
      startLevelId: "perception-abx",
      coachCue: pack.focus,
      passRuleText: "按课程标准通过",
    }
  );
}

function guidanceFor({
  passedLevels,
  totalLevels,
  dueLevels,
  stuckLevels,
  attemptedLevels,
  nextLevel,
  gateReason,
  redirectedByGate,
}: {
  passedLevels: number;
  totalLevels: number;
  dueLevels: number;
  stuckLevels: number;
  attemptedLevels: number;
  nextLevel: CourseLevelMapItem;
  gateReason?: string;
  redirectedByGate?: boolean;
}): string {
  if (redirectedByGate && gateReason) return gateReason;
  if (totalLevels > 0 && passedLevels === totalLevels) {
    return "这门课已经全线过关。下一轮重点做混合复测和间隔复习，防止回到旧习惯。";
  }
  if (dueLevels > 0) {
    return `先处理 ${dueLevels} 个到期/错题关卡，本轮建议从「${nextLevel.title}」开始。`;
  }
  if (stuckLevels > 0) {
    return `有 ${stuckLevels} 个关卡出现卡点，先拆动作，再追速度。`;
  }
  if (attemptedLevels > 0) {
    return `已经开始这门课，本轮从「${nextLevel.title}」继续，把还没过线的层级补齐。`;
  }
  return "还没开始这门课。先听辨，再做动作定位，避免一上来就机械录音。";
}

export function buildCourseMap({
  pack,
  profile,
  reviewQueue,
  currentLevelId,
  requestedLevelId,
}: CourseMapInput): CourseMapSummary {
  const levels = pack.course?.levels ?? [];
  const progress = profile?.packs[pack.id]?.levelProgress ?? {};
  const startGate = resolveCourseStartGate({
    pack,
    requestedLevelId,
    profile,
    reviewQueue,
  });

  const items = levels.map((level, index) => {
    const levelProgress = progress[level.id];
    const tasks = tasksForLevel(reviewQueue, pack.id, level.id);
    const passed = levelProgress?.passed === true;
    const attempts = levelProgress?.attempts ?? 0;
    const prerequisite = firstUnpassedBeforeLevel(pack, level.id, profile);
    const locked =
      !!prerequisite &&
      currentLevelId !== level.id &&
      tasks.length === 0 &&
      !passed &&
      attempts === 0;
    const stuckCount =
      profile?.sessions
        .filter((session) => session.packId === pack.id)
        .flatMap((session) => session.levelSummaries ?? [])
        .filter((summary) => summary.levelId === level.id)
        .reduce((sum, summary) => sum + summary.stuckCount, 0) ?? 0;

    return {
      id: level.id,
      title: level.title,
      kind: level.kind,
      index,
      status: statusForLevel({
        isCurrent: currentLevelId === level.id,
        dueTaskCount: tasks.length,
        passed,
        attempts,
        stuckCount,
        locked,
      }),
      passed,
      bestScore: levelProgress?.bestScore ?? 0,
      attempts,
      stuckCount,
      dueTaskCount: tasks.length,
      reviewReason: tasks[0]?.reason,
      startLevelId: locked ? prerequisite.id : level.id,
      lockedByLevelId: locked ? prerequisite.id : undefined,
      lockReason: locked
        ? `先完成「${prerequisite.title}」，再进入「${level.title}」。`
        : undefined,
      coachCue: level.coachCue,
      passRuleText: passRuleText(level),
    } satisfies CourseLevelMapItem;
  });

  const passedLevels = items.filter((item) => item.passed).length;
  const attemptedLevels = items.filter((item) => item.attempts > 0).length;
  const stuckLevels = items.filter((item) => item.stuckCount > 0).length;
  const dueLevels = items.filter((item) => item.dueTaskCount > 0).length;
  const nextLevel = chooseNextLevel(
    pack,
    items,
    profile,
    startGate.redirected ? startGate.effectiveLevelId : requestedLevelId,
  );

  return {
    packId: pack.id,
    totalLevels: items.length,
    passedLevels,
    attemptedLevels,
    stuckLevels,
    dueLevels,
    completionPercent:
      items.length > 0 ? Math.round((passedLevels / items.length) * 100) : 0,
    nextLevelId: nextLevel.id,
    nextLevelTitle: nextLevel.title,
    requestedLevelId: startGate.requestedLevelId,
    requestedLevelTitle: startGate.requestedLevelTitle,
    startLevelId: startGate.effectiveLevelId,
    startLevelTitle: startGate.effectiveLevelTitle,
    redirectedByGate: startGate.redirected,
    gateReason: startGate.redirected ? startGate.reason : undefined,
    guidance: guidanceFor({
      passedLevels,
      totalLevels: items.length,
      dueLevels,
      stuckLevels,
      attemptedLevels,
      nextLevel,
      gateReason: startGate.reason,
      redirectedByGate: startGate.redirected,
    }),
    levels: items,
  };
}
