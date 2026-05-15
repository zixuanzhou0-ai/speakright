import { describe, expect, it } from "vitest";
import { buildLessonBrief, buildSessionDebrief } from "@/lib/lesson-brief";
import { getTrainingPack } from "@/lib/training-packs";
import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingSessionSummary,
} from "@/types/training";

const NOW = 100_000;

function pack() {
  const trainingPack = getTrainingPack("s-th");
  if (!trainingPack) throw new Error("missing s-th pack");
  return trainingPack;
}

function profile(overrides: Partial<MasteryProfile> = {}): MasteryProfile {
  return {
    version: 2,
    updatedAt: NOW,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "practicing",
        levelProgress: {
          "perception-abx": { passed: true, bestScore: 100, attempts: 8 },
          articulation: { passed: true, bestScore: 100, attempts: 3 },
        },
        bestTargetScore: 68,
        perceptionBestRate: 0.8,
        completedSessions: 1,
        failureStreak: 1,
        lastPracticedAt: NOW - 1_000,
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
    sessions: [],
    ...overrides,
  };
}

function reviewTask(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id: "review-s-th-word",
    packId: "s-th",
    levelId: "word-ladder",
    source: "failed-item",
    reason: "think 的目标音没有过线，先回到单词阶梯。",
    priority: "critical",
    dueAt: NOW,
    errorPatternId: "tongue-between-teeth",
    itemText: "think",
    ...overrides,
  };
}

function session(
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary {
  return {
    id: "s1",
    packId: "s-th",
    startedAt: NOW - 10_000,
    completedAt: NOW,
    perceptionCorrect: 6,
    perceptionTotal: 8,
    targetScores: [52, 64, 70],
    wordScores: [52, 64],
    sentenceScores: [70],
    mastered: false,
    stuckPatternIds: ["tongue-between-teeth"],
    recommendedNextLevelId: "word-ladder",
    failedItems: [
      {
        itemId: "word-think",
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

describe("lesson brief", () => {
  it("redirects a deep requested level back to the first unpassed prerequisite", () => {
    const brief = buildLessonBrief({
      pack: pack(),
      requestedLevelId: "sentence-ladder",
      profile: profile(),
      reviewQueue: [reviewTask()],
    });

    expect(brief.startLevelId).toBe("syllable-bridge");
    expect(brief.reason).toContain("前置层");
    expect(brief.nextActionLabel).toContain(brief.startLevelTitle);
  });

  it("allows a requested level when it is the current mastery next layer", () => {
    const brief = buildLessonBrief({
      pack: pack(),
      requestedLevelId: "sentence-ladder",
      profile: profile({
        packs: {
          "s-th": {
            packId: "s-th",
            status: "practicing",
            masteryState: "controlled",
            nextRequiredLayer: "sentence",
            levelProgress: {
              "perception-abx": { passed: true, bestScore: 100, attempts: 8 },
              articulation: { passed: true, bestScore: 100, attempts: 3 },
              "word-ladder": { passed: true, bestScore: 84, attempts: 4 },
            },
            bestTargetScore: 84,
            perceptionBestRate: 0.88,
            completedSessions: 2,
            failureStreak: 0,
          },
        },
      }),
      reviewQueue: [],
    });

    expect(brief.startLevelId).toBe("sentence-ladder");
    expect(brief.reason).toContain("当前掌握阶段");
  });

  it("uses due review evidence before generic unpassed levels", () => {
    const brief = buildLessonBrief({
      pack: pack(),
      profile: profile(),
      reviewQueue: [reviewTask()],
    });

    expect(brief.startLevelId).toBe("word-ladder");
    expect(brief.reason).toContain("think");
    expect(
      brief.successCriteria.some((item) => item.includes("目标音素")),
    ).toBe(true);
  });

  it("surfaces active error patterns as risk cards", () => {
    const brief = buildLessonBrief({
      pack: pack(),
      profile: profile(),
      reviewQueue: [],
    });

    expect(brief.risks[0]).toMatchObject({
      id: "tongue-between-teeth",
      active: true,
    });
    expect(brief.warmupSteps.join(" ")).toContain("口型定位");
  });

  it("turns a finished session into a concrete next lesson", () => {
    const debrief = buildSessionDebrief(pack(), session());

    expect(debrief.headline).toContain("卡点");
    expect(debrief.nextLevelId).toBe("word-ladder");
    expect(debrief.reviewPlan).toHaveLength(3);
  });

  it("treats mastered sessions as spaced-review work", () => {
    const debrief = buildSessionDebrief(
      pack(),
      session({
        mastered: true,
        failedItems: [],
        stuckPatternIds: [],
        targetScores: [82, 88, 91],
      }),
    );

    expect(debrief.headline).toContain("复习");
    expect(debrief.nextActionReason).toContain("间隔复习");
  });
});
