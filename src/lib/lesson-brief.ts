import type {
  ErrorPattern,
  MasteryProfile,
  ReviewQueueItem,
  TrainingPack,
  TrainingSessionSummary,
} from "@/types/training";
import { resolveCourseStartGate } from "./course-gates";
import { TRAINING_ERROR_PATTERNS } from "./training-error-patterns";

export interface LessonRisk {
  id: string;
  title: string;
  explanation: string;
  cue: string;
  active: boolean;
}

export interface LessonBrief {
  packId: string;
  startLevelId: string;
  startLevelTitle: string;
  headline: string;
  reason: string;
  estimatedMinutes: number;
  coachFocus: string;
  successCriteria: string[];
  warmupSteps: string[];
  risks: LessonRisk[];
  nextActionLabel: string;
}

export interface SessionDebrief {
  headline: string;
  mainFinding: string;
  nextLevelId?: string;
  nextLevelTitle?: string;
  nextActionReason: string;
  reviewPlan: string[];
}

interface LessonBriefInput {
  pack: TrainingPack;
  requestedLevelId?: string | null;
  profile?: MasteryProfile | null;
  reviewQueue?: ReviewQueueItem[];
}

function levelTitle(pack: TrainingPack, levelId: string): string {
  return (
    pack.course?.levels.find((level) => level.id === levelId)?.title ?? levelId
  );
}

function isKnownLevel(
  pack: TrainingPack,
  levelId?: string | null,
): levelId is string {
  return (
    !!levelId && !!pack.course?.levels.some((level) => level.id === levelId)
  );
}

function matchingReviewTask(
  pack: TrainingPack,
  reviewQueue?: ReviewQueueItem[],
): ReviewQueueItem | undefined {
  return reviewQueue
    ?.filter(
      (task) => task.packId === pack.id && isKnownLevel(pack, task.levelId),
    )
    .sort((a, b) => a.dueAt - b.dueAt)[0];
}

function latestSession(
  pack: TrainingPack,
  profile?: MasteryProfile | null,
): TrainingSessionSummary | undefined {
  return profile?.sessions.find((session) => session.packId === pack.id);
}

function lessonReason(
  pack: TrainingPack,
  startLevelId: string,
  gateReason?: string,
  redirected = false,
  requestedLevelId?: string | null,
  profile?: MasteryProfile | null,
  reviewQueue?: ReviewQueueItem[],
): string {
  if (redirected && gateReason) return gateReason;
  if (requestedLevelId === startLevelId) {
    return (
      gateReason ??
      `这次按处方直接进入「${levelTitle(pack, startLevelId)}」，少绕路，先处理最具体的训练点。`
    );
  }
  const reviewTask = matchingReviewTask(pack, reviewQueue);
  if (reviewTask?.levelId === startLevelId) return reviewTask.reason;
  const recent = latestSession(pack, profile);
  if (recent?.recommendedNextLevelId === startLevelId) {
    return "上一轮训练留下了未过线关卡，这次先从断点继续，避免只重复已经会的部分。";
  }
  if (profile?.packs[pack.id]?.completedSessions) {
    return "你已经练过这个专项，本轮会根据掌握记录从最需要巩固的关卡开始。";
  }
  return pack.l1Problem;
}

function estimateMinutes(pack: TrainingPack, startLevelId: string): number {
  const levels = pack.course?.levels ?? [];
  const index = Math.max(
    0,
    levels.findIndex((level) => level.id === startLevelId),
  );
  if (levels.length === 0) return pack.estimatedMinutes;
  const remainingRatio = (levels.length - index) / levels.length;
  return Math.max(6, Math.round(pack.estimatedMinutes * remainingRatio));
}

function activePatterns(
  pack: TrainingPack,
  profile?: MasteryProfile | null,
): ErrorPattern[] {
  return Object.entries(profile?.errorPatterns ?? {})
    .filter(([, mastery]) => mastery.status !== "cleared")
    .sort(
      ([, a], [, b]) =>
        b.stuckCount + b.seenCount - (a.stuckCount + a.seenCount),
    )
    .map(([patternId]) =>
      TRAINING_ERROR_PATTERNS.find((pattern) => pattern.id === patternId),
    )
    .filter(
      (pattern): pattern is ErrorPattern =>
        !!pattern && pattern.appliesToPackIds.includes(pack.id),
    );
}

function coursePatterns(pack: TrainingPack): ErrorPattern[] {
  return pack.course?.errorPatterns ?? [];
}

function buildRisks(
  pack: TrainingPack,
  profile?: MasteryProfile | null,
): LessonRisk[] {
  const active = activePatterns(pack, profile);
  const merged = new Map<string, { pattern: ErrorPattern; active: boolean }>();
  for (const pattern of active) {
    merged.set(pattern.id, { pattern, active: true });
  }
  for (const pattern of coursePatterns(pack)) {
    if (!merged.has(pattern.id))
      merged.set(pattern.id, { pattern, active: false });
  }
  return Array.from(merged.values())
    .slice(0, 3)
    .map(({ pattern, active }) => ({
      id: pattern.id,
      title: pattern.title,
      explanation: pattern.coachExplanation,
      cue: pattern.immediateCue,
      active,
    }));
}

function successCriteria(
  pack: TrainingPack,
  startLevelTitle: string,
): string[] {
  return [
    `本轮从「${startLevelTitle}」开始，不追求快，先追目标动作稳定。`,
    `目标音素达到 ${pack.masteryRule.targetPassScore} 分以上才算过线，整词分只做辅助参考。`,
    "如果连续卡住，先做慢速拆解，再回到原题复测。",
  ];
}

function warmupSteps(pack: TrainingPack, startLevelTitle: string): string[] {
  return [
    `先听「${startLevelTitle}」示范 2 遍，不急着录音。`,
    `做口型定位：${pack.mouthCue}`,
    `第一题只盯一个动作：${pack.focus}`,
  ];
}

export function buildLessonBrief({
  pack,
  requestedLevelId,
  profile,
  reviewQueue,
}: LessonBriefInput): LessonBrief {
  const gate = resolveCourseStartGate({
    pack,
    requestedLevelId,
    profile,
    reviewQueue,
  });
  const reviewTask = matchingReviewTask(pack, reviewQueue);
  const recent = latestSession(pack, profile);
  const startLevelId =
    !gate.requestedLevelId && reviewTask
      ? reviewTask.levelId
      : !gate.requestedLevelId &&
          isKnownLevel(pack, recent?.recommendedNextLevelId)
        ? recent.recommendedNextLevelId
        : gate.effectiveLevelId;
  const startLevelTitle = levelTitle(pack, startLevelId);
  const reason = lessonReason(
    pack,
    startLevelId,
    gate.reason,
    gate.redirected,
    requestedLevelId,
    profile,
    reviewQueue,
  );

  return {
    packId: pack.id,
    startLevelId,
    startLevelTitle,
    headline: `今天先把「${startLevelTitle}」练稳`,
    reason,
    estimatedMinutes: estimateMinutes(pack, startLevelId),
    coachFocus: pack.focus,
    successCriteria: successCriteria(pack, startLevelTitle),
    warmupSteps: warmupSteps(pack, startLevelTitle),
    risks: buildRisks(pack, profile),
    nextActionLabel: `从 ${startLevelTitle} 开始`,
  };
}

export function buildSessionDebrief(
  pack: TrainingPack,
  summary: TrainingSessionSummary,
): SessionDebrief {
  const failedCount = summary.failedItems?.length ?? 0;
  const stuckCount = summary.stuckPatternIds?.length ?? 0;
  const nextLevel = summary.recommendedNextLevelId
    ? pack.course?.levels.find(
        (level) => level.id === summary.recommendedNextLevelId,
      )
    : undefined;
  const averageTarget =
    summary.targetScores.length > 0
      ? Math.round(
          summary.targetScores.reduce((sum, score) => sum + score, 0) /
            summary.targetScores.length,
        )
      : 0;

  if (summary.mastered) {
    return {
      headline: "本轮已经进入可复习状态",
      mainFinding: `平均目标音 ${averageTarget} 分，已经满足本训练包的掌握规则。`,
      nextActionReason:
        "下一步不是继续硬刷，而是按间隔复习防止回到旧发音习惯。",
      reviewPlan: [
        "24 小时后做一次短复测",
        "复习仍过线再延长到 3 天",
        "复习失败就回到本轮最低分关卡",
      ],
    };
  }

  return {
    headline:
      stuckCount > 0 ? "本轮最大的价值是定位了卡点" : "本轮还需要补一层稳定性",
    mainFinding:
      failedCount > 0
        ? `留下 ${failedCount} 条失败证据，说明问题已经具体到词和动作。`
        : `平均目标音 ${averageTarget} 分，还需要把单题表现放进句子和复测里。`,
    nextLevelId: nextLevel?.id,
    nextLevelTitle: nextLevel?.title,
    nextActionReason: nextLevel
      ? `下一轮直接从「${nextLevel.title}」开始，优先补没有过线的关卡。`
      : "下一轮回到今日处方，优先处理系统生成的复习任务。",
    reviewPlan: [
      "先复听本轮最低分题目",
      "只改反馈里那一个动作，不同时改多个问题",
      "复测过线后再进入自然句或影子跟读",
    ],
  };
}
