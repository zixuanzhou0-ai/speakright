import type {
  MasteryProfile,
  MasteryTaskLayer,
  ReviewQueueItem,
  TrainingLevel,
  TrainingPack,
} from "@/types/training";

export interface CourseStartGate {
  requestedLevelId?: string | null;
  requestedLevelTitle?: string;
  effectiveLevelId: string;
  effectiveLevelTitle: string;
  redirected: boolean;
  reason: string;
}

function isKnownLevel(
  pack: TrainingPack,
  levelId?: string | null,
): levelId is string {
  return (
    !!levelId && !!pack.course?.levels.some((level) => level.id === levelId)
  );
}

function levelTitle(pack: TrainingPack, levelId: string): string {
  return (
    pack.course?.levels.find((level) => level.id === levelId)?.title ?? levelId
  );
}

function firstLevel(pack: TrainingPack): TrainingLevel | undefined {
  return pack.course?.levels[0];
}

export function levelIdForMasteryLayer(
  pack: TrainingPack,
  layer?: MasteryTaskLayer,
): string | null {
  if (!layer || !pack.course) return null;
  const levels = pack.course.levels;
  const byKind = (kind: TrainingLevel["kind"]) =>
    levels.find((level) => level.kind === kind)?.id ?? null;

  switch (layer) {
    case "perception":
      return byKind("perception");
    case "isolated":
    case "articulation":
      return byKind("articulation");
    case "word":
      return (
        levels.find((level) => level.id === "word-ladder")?.id ?? byKind("word")
      );
    case "sentence":
      return (
        levels.find((level) => level.id === "sentence-ladder")?.id ??
        byKind("sentence")
      );
    case "connected":
    case "guided":
    case "spontaneous":
      return (
        levels.find((level) => level.id === "shadowing-transfer")?.id ??
        byKind("shadowing")
      );
  }
}

function hasMatchingReviewTask(
  pack: TrainingPack,
  levelId: string,
  reviewQueue?: ReviewQueueItem[],
): boolean {
  return (reviewQueue ?? []).some(
    (task) => task.packId === pack.id && task.levelId === levelId,
  );
}

function isProfileNextLayer(
  pack: TrainingPack,
  levelId: string,
  profile?: MasteryProfile | null,
): boolean {
  const nextLayer = profile?.packs[pack.id]?.nextRequiredLayer;
  return levelIdForMasteryLayer(pack, nextLayer) === levelId;
}

export function firstUnpassedBeforeLevel(
  pack: TrainingPack,
  levelId: string,
  profile?: MasteryProfile | null,
): TrainingLevel | null {
  const levels = pack.course?.levels ?? [];
  const targetIndex = levels.findIndex((level) => level.id === levelId);
  if (targetIndex <= 0) return null;
  const progress = profile?.packs[pack.id]?.levelProgress ?? {};

  return (
    levels
      .slice(0, targetIndex)
      .find((level) => progress[level.id]?.passed !== true) ?? null
  );
}

export function resolveCourseStartGate({
  pack,
  requestedLevelId,
  profile,
  reviewQueue,
}: {
  pack: TrainingPack;
  requestedLevelId?: string | null;
  profile?: MasteryProfile | null;
  reviewQueue?: ReviewQueueItem[];
}): CourseStartGate {
  const first = firstLevel(pack);
  const fallbackId = first?.id ?? "perception-abx";
  const requested = isKnownLevel(pack, requestedLevelId)
    ? requestedLevelId
    : null;
  if (!requested) {
    return {
      requestedLevelId,
      effectiveLevelId: fallbackId,
      effectiveLevelTitle: levelTitle(pack, fallbackId),
      redirected: false,
      reason: "从课程第一层开始，先听辨，再进入动作和输出。",
    };
  }

  const requestedTitle = levelTitle(pack, requested);
  if (
    hasMatchingReviewTask(pack, requested, reviewQueue) ||
    isProfileNextLayer(pack, requested, profile)
  ) {
    return {
      requestedLevelId: requested,
      requestedLevelTitle: requestedTitle,
      effectiveLevelId: requested,
      effectiveLevelTitle: requestedTitle,
      redirected: false,
      reason: `这次可以直接进入「${requestedTitle}」，因为它来自复习任务或当前掌握阶段。`,
    };
  }

  const prerequisite = firstUnpassedBeforeLevel(pack, requested, profile);
  if (!prerequisite) {
    return {
      requestedLevelId: requested,
      requestedLevelTitle: requestedTitle,
      effectiveLevelId: requested,
      effectiveLevelTitle: requestedTitle,
      redirected: false,
      reason: `前置层已经过关，可以进入「${requestedTitle}」。`,
    };
  }

  return {
    requestedLevelId: requested,
    requestedLevelTitle: requestedTitle,
    effectiveLevelId: prerequisite.id,
    effectiveLevelTitle: prerequisite.title,
    redirected: true,
    reason: `你选了「${requestedTitle}」，但「${prerequisite.title}」还没有过线。先补前置层，避免在高负荷句子里把旧习惯练牢。`,
  };
}
