import type {
  ErrorPatternMastery,
  MasteryProfile,
  ReviewQueueItem,
  TrainingSessionSummary,
} from "@/types/training";
import { buildReviewQueue } from "./review-queue";
import { TRAINING_ERROR_PATTERNS } from "./training-error-patterns";
import { getTrainingPack } from "./training-packs";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrainingMemoryWeakness {
  id: string;
  packId: string;
  packTitle: string;
  levelId: string;
  title: string;
  severity: ReviewQueueItem["priority"];
  evidenceCount: number;
  stuckCount: number;
  failedItemCount: number;
  lastSeenAt?: number;
  bestTargetScore: number;
  cue: string;
  reason: string;
}

export interface TrainingMemoryReviewWindow {
  id: "now" | "tomorrow" | "week" | "later";
  label: string;
  count: number;
  priorityCount: number;
}

export interface TrainingMemoryTrendPoint {
  sessionId: string;
  packId: string;
  completedAt: number;
  averageTargetScore: number;
  stuckCount: number;
  mastered: boolean;
}

export interface TrainingMemorySnapshot {
  generatedAt: number;
  totalSessions: number;
  practicedPacks: number;
  masteredPacks: number;
  dueReviews: number;
  activeWeaknesses: TrainingMemoryWeakness[];
  reviewWindows: TrainingMemoryReviewWindow[];
  recentTrend: TrainingMemoryTrendPoint[];
  nextFocus?: ReviewQueueItem;
}

interface WeaknessDraft extends TrainingMemoryWeakness {
  severityScore: number;
}

function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function priorityScore(priority: ReviewQueueItem["priority"]): number {
  if (priority === "critical") return 3;
  if (priority === "major") return 2;
  return 1;
}

function priorityFromScore(score: number): ReviewQueueItem["priority"] {
  if (score >= 6) return "critical";
  if (score >= 3) return "major";
  return "maintenance";
}

function patternTitle(patternId: string): string {
  return (
    TRAINING_ERROR_PATTERNS.find((pattern) => pattern.id === patternId)?.title ??
    "训练中反复出现的弱点"
  );
}

function patternCue(patternId: string): string {
  return (
    TRAINING_ERROR_PATTERNS.find((pattern) => pattern.id === patternId)
      ?.immediateCue ?? "下一轮只改一个动作，先慢速稳定。"
  );
}

function packTitle(packId: string): string {
  return getTrainingPack(packId)?.title ?? packId;
}

function levelFromTask(task: ReviewQueueItem): string {
  return task.levelId || "word-ladder";
}

function addOrMergeWeakness(
  map: Map<string, WeaknessDraft>,
  weakness: WeaknessDraft,
) {
  const existing = map.get(weakness.id);
  if (!existing) {
    map.set(weakness.id, weakness);
    return;
  }
  map.set(weakness.id, {
    ...existing,
    evidenceCount: existing.evidenceCount + weakness.evidenceCount,
    stuckCount: existing.stuckCount + weakness.stuckCount,
    failedItemCount: existing.failedItemCount + weakness.failedItemCount,
    lastSeenAt: Math.max(existing.lastSeenAt ?? 0, weakness.lastSeenAt ?? 0),
    bestTargetScore: Math.max(existing.bestTargetScore, weakness.bestTargetScore),
    severityScore: existing.severityScore + weakness.severityScore,
    severity: priorityFromScore(existing.severityScore + weakness.severityScore),
  });
}

function weaknessFromPattern(
  patternId: string,
  mastery: ErrorPatternMastery,
): WeaknessDraft | null {
  const pattern = TRAINING_ERROR_PATTERNS.find((item) => item.id === patternId);
  const packId = pattern?.appliesToPackIds.find((id) => getTrainingPack(id));
  if (!packId) return null;
  const severityScore =
    (mastery.status === "active" ? 3 : 1) + mastery.stuckCount + mastery.seenCount;
  return {
    id: `pattern:${patternId}`,
    packId,
    packTitle: packTitle(packId),
    levelId: patternId.includes("rhythm") ? "shadowing-transfer" : "articulation",
    title: patternTitle(patternId),
    severity: priorityFromScore(severityScore),
    evidenceCount: mastery.seenCount,
    stuckCount: mastery.stuckCount,
    failedItemCount: 0,
    lastSeenAt: mastery.lastSeenAt,
    bestTargetScore: 0,
    cue: patternCue(patternId),
    reason: pattern?.coachExplanation ?? "这个错因近期反复出现，需要优先复练。",
    severityScore,
  };
}

function addFailedItemWeakness(
  map: Map<string, WeaknessDraft>,
  session: TrainingSessionSummary,
) {
  for (const item of session.failedItems ?? []) {
    const patternId = item.patternIds[0];
    const id = patternId
      ? `pattern:${patternId}`
      : `failed:${session.packId}:${item.levelId}`;
    const severityScore =
      item.targetScore < 60 ? 4 : item.targetScore < 75 ? 2 : 1;
    addOrMergeWeakness(map, {
      id,
      packId: session.packId,
      packTitle: packTitle(session.packId),
      levelId: item.levelId,
      title: patternId ? patternTitle(patternId) : `${item.text} 目标音不稳`,
      severity: priorityFromScore(severityScore),
      evidenceCount: 1,
      stuckCount: 0,
      failedItemCount: 1,
      lastSeenAt: session.completedAt,
      bestTargetScore: item.targetScore,
      cue: item.nextCue,
      reason: `${item.text} 的目标音只有 ${item.targetScore} 分。`,
      severityScore,
    });
  }
}

function addReviewTaskWeakness(
  map: Map<string, WeaknessDraft>,
  task: ReviewQueueItem,
) {
  if (task.source === "due-review") return;
  const id = task.errorPatternId
    ? `pattern:${task.errorPatternId}`
    : `review:${task.packId}:${task.levelId}:${task.source}`;
  const severityScore = priorityScore(task.priority);
  addOrMergeWeakness(map, {
    id,
    packId: task.packId,
    packTitle: packTitle(task.packId),
    levelId: levelFromTask(task),
    title: task.errorPatternId
      ? patternTitle(task.errorPatternId)
      : task.itemText
        ? `${task.itemText} 需要复练`
        : "上一轮未完全过线",
    severity: task.priority,
    evidenceCount: 1,
    stuckCount: task.source === "stuck-pattern" ? 1 : 0,
    failedItemCount: task.source === "failed-item" ? 1 : 0,
    lastSeenAt: task.dueAt,
    bestTargetScore: 0,
    cue: task.errorPatternId
      ? patternCue(task.errorPatternId)
      : "回到对应关卡，先慢速复现正确动作。",
    reason: task.reason,
    severityScore,
  });
}

function buildActiveWeaknesses(
  profile: MasteryProfile,
  reviewQueue: ReviewQueueItem[],
): TrainingMemoryWeakness[] {
  const map = new Map<string, WeaknessDraft>();

  for (const [patternId, mastery] of Object.entries(profile.errorPatterns)) {
    if (mastery.status === "cleared") continue;
    const weakness = weaknessFromPattern(patternId, mastery);
    if (weakness) addOrMergeWeakness(map, weakness);
  }

  for (const session of profile.sessions.slice(0, 6)) {
    addFailedItemWeakness(map, session);
  }

  for (const task of reviewQueue.slice(0, 8)) {
    addReviewTaskWeakness(map, task);
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.severityScore !== a.severityScore) {
        return b.severityScore - a.severityScore;
      }
      return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
    })
    .slice(0, 4)
    .map(({ severityScore: _severityScore, ...weakness }) => weakness);
}

function buildReviewWindows(
  reviewQueue: ReviewQueueItem[],
  now: number,
): TrainingMemoryReviewWindow[] {
  const windows: TrainingMemoryReviewWindow[] = [
    { id: "now", label: "今天", count: 0, priorityCount: 0 },
    { id: "tomorrow", label: "明天", count: 0, priorityCount: 0 },
    { id: "week", label: "7 天内", count: 0, priorityCount: 0 },
    { id: "later", label: "之后", count: 0, priorityCount: 0 },
  ];

  for (const task of reviewQueue) {
    const offset = task.dueAt - now;
    const bucket =
      offset <= 0
        ? windows[0]
        : offset <= DAY_MS
          ? windows[1]
          : offset <= 7 * DAY_MS
            ? windows[2]
            : windows[3];
    bucket.count += 1;
    if (task.priority !== "maintenance") bucket.priorityCount += 1;
  }

  return windows;
}

function buildRecentTrend(
  sessions: TrainingSessionSummary[],
): TrainingMemoryTrendPoint[] {
  return sessions
    .slice(0, 6)
    .map((session) => ({
      sessionId: session.id,
      packId: session.packId,
      completedAt: session.completedAt,
      averageTargetScore: average(session.targetScores),
      stuckCount: session.stuckPatternIds?.length ?? 0,
      mastered: session.mastered,
    }))
    .reverse();
}

export function buildTrainingMemory(
  profile: MasteryProfile | null | undefined,
  reviewQueue?: ReviewQueueItem[],
  now = Date.now(),
): TrainingMemorySnapshot {
  const queue = reviewQueue ?? buildReviewQueue(profile, now);
  if (!profile) {
    return {
      generatedAt: now,
      totalSessions: 0,
      practicedPacks: 0,
      masteredPacks: 0,
      dueReviews: 0,
      activeWeaknesses: [],
      reviewWindows: buildReviewWindows(queue, now),
      recentTrend: [],
      nextFocus: queue[0],
    };
  }

  const packEntries = Object.values(profile.packs);
  return {
    generatedAt: now,
    totalSessions: profile.sessions.length,
    practicedPacks: packEntries.length,
    masteredPacks: packEntries.filter((pack) => pack.status === "mastered").length,
    dueReviews: queue.filter((task) => task.source === "due-review").length,
    activeWeaknesses: buildActiveWeaknesses(profile, queue),
    reviewWindows: buildReviewWindows(queue, now),
    recentTrend: buildRecentTrend(profile.sessions),
    nextFocus: queue[0],
  };
}
