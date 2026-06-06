import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingSessionSummary,
} from "@/types/training";
import { DEFAULT_LANGUAGE_ID } from "./language-profiles";
import { TRAINING_ERROR_PATTERNS } from "./training-error-patterns";
import { getTrainingPack } from "./training-packs";

function taskKey(task: ReviewQueueItem): string {
  return [
    task.packId,
    task.levelId,
    task.source,
    task.errorPatternId ?? "",
    task.itemText ?? "",
  ].join(":");
}

function priorityWeight(priority: ReviewQueueItem["priority"]): number {
  if (priority === "critical") return 0;
  if (priority === "major") return 1;
  return 2;
}

function addUnique(
  tasks: ReviewQueueItem[],
  seen: Set<string>,
  task: ReviewQueueItem,
) {
  const key = taskKey(task);
  if (seen.has(key)) return;
  seen.add(key);
  tasks.push(task);
}

function levelFromPattern(patternId: string): string {
  const pattern = TRAINING_ERROR_PATTERNS.find((item) => item.id === patternId);
  if (!pattern) return "word-ladder";
  if (patternId.includes("rhythm")) return "shadowing-transfer";
  if (patternId.includes("final")) return "word-ladder";
  return "articulation";
}

function levelFromMasteryLayer(layer: string): string {
  if (layer === "perception") return "perception-abx";
  if (layer === "articulation" || layer === "isolated") return "articulation";
  if (layer === "word") return "word-ladder";
  if (layer === "sentence") return "sentence-ladder";
  if (layer === "connected" || layer === "guided") return "shadowing-transfer";
  return "mixed-review";
}

function recentFailedItemTask(
  session: TrainingSessionSummary,
  now: number,
): ReviewQueueItem | null {
  const item = session.failedItems?.[0];
  if (!item) return null;
  return {
    id: `failed-${session.packId}-${item.itemId}-${session.completedAt}`,
    packId: session.packId,
    levelId: item.levelId,
    source: "failed-item",
    reason: `${item.text} 的目标音 ${item.targetScore} 分，下一次先改：${item.nextCue}`,
    priority: item.targetScore < 60 ? "critical" : "major",
    dueAt: now,
    errorPatternId: item.patternIds[0],
    itemText: item.text,
  };
}

function remediationTask(
  session: TrainingSessionSummary,
  now: number,
): ReviewQueueItem | null {
  const failed = session.remediationResults?.find((item) => !item.passed);
  if (!failed) return null;
  return {
    id: `remediation-${session.packId}-${failed.pathId}-${session.completedAt}`,
    packId: session.packId,
    levelId: session.recommendedNextLevelId ?? "word-ladder",
    source: "remediation-failed",
    reason: `补救步骤 ${failed.text} 没过线，先回到更慢的拆解。`,
    priority: "critical",
    dueAt: now,
    itemText: failed.text,
  };
}

export function buildSessionReviewItems(
  session: TrainingSessionSummary,
  now = Date.now(),
): ReviewQueueItem[] {
  const tasks: ReviewQueueItem[] = [];
  const seen = new Set<string>();
  const failedTask = recentFailedItemTask(session, now);
  if (failedTask) addUnique(tasks, seen, failedTask);
  const remediation = remediationTask(session, now);
  if (remediation) addUnique(tasks, seen, remediation);

  if (session.recommendedNextLevelId) {
    addUnique(tasks, seen, {
      id: `weak-level-${session.packId}-${session.recommendedNextLevelId}-${session.completedAt}`,
      packId: session.packId,
      levelId: session.recommendedNextLevelId,
      source: "weak-level",
      reason: "上一轮这个关卡没有完全过线，今天从这里接着补。",
      priority: "major",
      dueAt: now,
    });
  }

  for (const patternId of session.stuckPatternIds ?? []) {
    addUnique(tasks, seen, {
      id: `stuck-${session.packId}-${patternId}-${session.completedAt}`,
      packId: session.packId,
      levelId: levelFromPattern(patternId),
      source: "stuck-pattern",
      reason: "上次训练出现连续卡住的错因，需要优先拆解。",
      priority: "critical",
      dueAt: now,
      errorPatternId: patternId,
    });
  }

  return tasks.slice(0, 4);
}

export function buildReviewQueue(
  profile: MasteryProfile | null | undefined,
  now = Date.now(),
): ReviewQueueItem[] {
  if (!profile) return [];
  if (profile.languageId !== DEFAULT_LANGUAGE_ID) return [];
  const tasks: ReviewQueueItem[] = [];
  const seen = new Set<string>();

  for (const [packId, mastery] of Object.entries(profile.packs)) {
    if (mastery.nextReviewAt && mastery.nextReviewAt <= now) {
      const layer = mastery.nextRequiredLayer ?? "connected";
      addUnique(tasks, seen, {
        id: `due-${packId}-${mastery.nextReviewAt}`,
        packId,
        levelId: levelFromMasteryLayer(layer),
        source: "due-review",
        reason: mastery.masteryState
          ? `${mastery.masteryState} 阶段内容到期复习，防止回到旧习惯。`
          : "已掌握内容到期复习，防止回到旧习惯。",
        priority: "maintenance",
        dueAt: mastery.nextReviewAt,
      });
    }
  }

  for (const [patternId, mastery] of Object.entries(profile.errorPatterns)) {
    if (mastery.status !== "active") continue;
    const pattern = TRAINING_ERROR_PATTERNS.find(
      (item) => item.id === patternId,
    );
    const packId =
      pattern?.appliesToPackIds.find((id) => getTrainingPack(id)) ?? "";
    if (!packId) continue;
    addUnique(tasks, seen, {
      id: `active-pattern-${patternId}-${mastery.lastSeenAt ?? now}`,
      packId,
      levelId: levelFromPattern(patternId),
      source: "stuck-pattern",
      reason:
        pattern?.coachExplanation ?? "这个错因近期反复出现，需要优先复练。",
      priority: mastery.stuckCount >= 2 ? "critical" : "major",
      dueAt: mastery.lastSeenAt ?? now,
      errorPatternId: patternId,
    });
  }

  for (const session of profile.sessions.slice(0, 8)) {
    for (const task of session.reviewItems ??
      buildSessionReviewItems(session, now)) {
      addUnique(tasks, seen, task);
    }
  }

  return tasks
    .sort((a, b) => {
      const priority = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (priority !== 0) return priority;
      return a.dueAt - b.dueAt;
    })
    .slice(0, 8);
}
