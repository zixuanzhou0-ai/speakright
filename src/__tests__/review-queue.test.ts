import { describe, expect, it } from "vitest";
import {
  buildReviewQueue,
  buildSessionReviewItems,
} from "@/lib/review-queue";
import type { MasteryProfile, TrainingSessionSummary } from "@/types/training";

function session(
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary {
  return {
    id: "s1",
    packId: "s-th",
    startedAt: 1,
    completedAt: 2,
    perceptionCorrect: 4,
    perceptionTotal: 8,
    targetScores: [52],
    wordScores: [52],
    sentenceScores: [],
    mastered: false,
    recommendedNextLevelId: "articulation",
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
    remediationResults: [
      {
        pathId: "th-rebuild",
        stepIndex: 0,
        text: "thin",
        targetPhonemes: ["th"],
        beforeTargetScore: 52,
        targetScore: 60,
        overallScore: 80,
        passed: false,
      },
    ],
    ...overrides,
  };
}

describe("review queue", () => {
  it("builds session review tasks from failed items, remediation, weak levels, and stuck patterns", () => {
    const tasks = buildSessionReviewItems(session(), 10);

    expect(tasks.map((task) => task.source)).toEqual([
      "failed-item",
      "remediation-failed",
      "weak-level",
      "stuck-pattern",
    ]);
    expect(tasks[0]).toMatchObject({
      packId: "s-th",
      levelId: "word-ladder",
      priority: "critical",
      itemText: "think",
    });
  });

  it("prioritizes due review and active error patterns in the profile queue", () => {
    const profile: MasteryProfile = {
      version: 2,
      updatedAt: 1,
      packs: {
        "v-w": {
          packId: "v-w",
          status: "mastered",
          levelProgress: {},
          bestTargetScore: 90,
          perceptionBestRate: 1,
          completedSessions: 2,
          failureStreak: 0,
          nextReviewAt: 5,
        },
      },
      phonemes: {},
      errorPatterns: {
        "tongue-between-teeth": {
          patternId: "tongue-between-teeth",
          seenCount: 2,
          stuckCount: 2,
          lastSeenAt: 9,
          status: "active",
        },
      },
      sessions: [session()],
    };

    const tasks = buildReviewQueue(profile, 10);

    expect(tasks[0].priority).toBe("critical");
    expect(tasks.some((task) => task.source === "due-review")).toBe(true);
    expect(tasks.some((task) => task.errorPatternId === "tongue-between-teeth")).toBe(true);
  });
});

