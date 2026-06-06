import { describe, expect, it } from "vitest";
import { buildTrainingMemory } from "@/lib/training-memory";
import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingSessionSummary,
} from "@/types/training";

const NOW = 100_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function session(
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary {
  return {
    id: "s1",
    languageId: "en-US",
    packId: "s-th",
    startedAt: NOW - 2_000,
    completedAt: NOW - 1_000,
    perceptionCorrect: 4,
    perceptionTotal: 8,
    targetScores: [52, 60],
    wordScores: [52],
    sentenceScores: [],
    mastered: false,
    stuckPatternIds: ["tongue-between-teeth"],
    failedItems: [
      {
        itemId: "word-1",
        levelId: "word-ladder",
        levelKind: "word",
        text: "think",
        targetPhonemes: ["th"],
        targetScore: 52,
        overallScore: 86,
        patternIds: ["tongue-between-teeth"],
        nextCue: "露出一点舌尖",
        passed: false,
      },
    ],
    ...overrides,
  };
}

function profile(overrides: Partial<MasteryProfile> = {}): MasteryProfile {
  return {
    version: 2,
    languageId: "en-US",
    updatedAt: NOW,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "practicing",
        levelProgress: {},
        bestTargetScore: 60,
        perceptionBestRate: 0.5,
        completedSessions: 1,
        failureStreak: 1,
        lastPracticedAt: NOW - 1_000,
      },
      "v-w": {
        packId: "v-w",
        status: "mastered",
        levelProgress: {},
        bestTargetScore: 88,
        perceptionBestRate: 1,
        completedSessions: 2,
        failureStreak: 0,
        nextReviewAt: NOW - 1,
      },
    },
    phonemes: {},
    errorPatterns: {
      "tongue-between-teeth": {
        patternId: "tongue-between-teeth",
        seenCount: 2,
        stuckCount: 2,
        lastSeenAt: NOW - 1_000,
        status: "active",
      },
    },
    sessions: [session()],
    ...overrides,
  };
}

function task(
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
  return {
    id: "task",
    packId: "s-th",
    levelId: "articulation",
    source: "stuck-pattern",
    reason: "舌尖缩回去了",
    priority: "critical",
    dueAt: NOW,
    errorPatternId: "tongue-between-teeth",
    ...overrides,
  };
}

describe("training memory", () => {
  it("returns an empty but stable snapshot without a profile", () => {
    const memory = buildTrainingMemory(null, [], NOW);

    expect(memory.totalSessions).toBe(0);
    expect(memory.activeWeaknesses).toEqual([]);
    expect(memory.reviewWindows.map((window) => window.count)).toEqual([
      0, 0, 0, 0,
    ]);
  });

  it("merges active error patterns, failed items, and review tasks into one weakness", () => {
    const memory = buildTrainingMemory(profile(), [task()], NOW);
    const weakness = memory.activeWeaknesses[0];

    expect(weakness).toMatchObject({
      id: "pattern:tongue-between-teeth",
      packId: "s-th",
      severity: "critical",
      failedItemCount: 1,
    });
    expect(weakness.evidenceCount).toBeGreaterThanOrEqual(4);
    expect(weakness.stuckCount).toBeGreaterThanOrEqual(3);
    expect(weakness.cue).toContain("舌尖");
  });

  it("buckets review tasks by due window and keeps recent target trend", () => {
    const memory = buildTrainingMemory(
      profile({
        sessions: [
          session({ id: "newer", completedAt: NOW - 1_000, targetScores: [70, 80] }),
          session({ id: "older", completedAt: NOW - 2_000, targetScores: [50, 60] }),
        ],
      }),
      [
        task({ id: "now", dueAt: NOW - 1 }),
        task({ id: "tomorrow", dueAt: NOW + DAY_MS }),
        task({ id: "week", dueAt: NOW + 3 * DAY_MS }),
        task({ id: "later", dueAt: NOW + 10 * DAY_MS }),
      ],
      NOW,
    );

    expect(memory.reviewWindows.map((window) => window.count)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(memory.recentTrend.map((point) => point.sessionId)).toEqual([
      "older",
      "newer",
    ]);
    expect(memory.recentTrend[1].averageTargetScore).toBe(75);
  });
});
