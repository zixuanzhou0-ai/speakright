import { describe, expect, it } from "vitest";
import { buildCourseMap } from "@/lib/course-map";
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

function minimalPairLevelId() {
  return (
    pack().course?.levels.find((level) => level.kind === "minimal-pair")?.id ??
    "word-ladder"
  );
}

function session(
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary {
  return {
    id: "s1",
    languageId: "en-US",
    packId: "s-th",
    startedAt: NOW - 10_000,
    completedAt: NOW,
    perceptionCorrect: 7,
    perceptionTotal: 8,
    targetScores: [52, 68],
    wordScores: [52],
    sentenceScores: [],
    mastered: false,
    recommendedNextLevelId: "word-ladder",
    levelSummaries: [
      {
        levelId: "word-ladder",
        kind: "word",
        attempts: 3,
        passed: false,
        bestScore: 68,
        stuckCount: 1,
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
        levelProgress: {
          "perception-abx": { passed: true, bestScore: 100, attempts: 8 },
          articulation: { passed: true, bestScore: 100, attempts: 3 },
          "word-ladder": { passed: false, bestScore: 68, attempts: 3 },
        },
        bestTargetScore: 68,
        perceptionBestRate: 0.88,
        completedSessions: 1,
        failureStreak: 1,
        lastPracticedAt: NOW,
      },
    },
    phonemes: {},
    errorPatterns: {},
    sessions: [session()],
    ...overrides,
  };
}

function reviewTask(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id: "task",
    packId: "s-th",
    levelId: minimalPairLevelId(),
    source: "failed-item",
    reason: "think/sink 对比仍然不稳。",
    priority: "critical",
    dueAt: NOW,
    itemText: "think",
    errorPatternId: "tongue-between-teeth",
    ...overrides,
  };
}

describe("course map", () => {
  it("builds a stable empty-start map", () => {
    const map = buildCourseMap({
      pack: pack(),
      profile: null,
      reviewQueue: [],
    });

    expect(map.totalLevels).toBeGreaterThanOrEqual(6);
    expect(map.passedLevels).toBe(0);
    expect(map.nextLevelId).toBe(map.levels[0].id);
    expect(map.guidance).toContain("还没开始");
  });

  it("marks passed and needs-work levels from mastery progress", () => {
    const map = buildCourseMap({
      pack: pack(),
      profile: profile(),
      reviewQueue: [],
    });

    expect(
      map.levels.find((level) => level.id === "perception-abx")?.status,
    ).toBe("passed");
    expect(map.levels.find((level) => level.id === "word-ladder")?.status).toBe(
      "needs-work",
    );
    expect(map.stuckLevels).toBe(1);
  });

  it("prioritizes due review tasks before generic weak levels", () => {
    const dueLevelId = minimalPairLevelId();
    const map = buildCourseMap({
      pack: pack(),
      profile: profile(),
      reviewQueue: [reviewTask()],
    });

    expect(map.nextLevelId).toBe(dueLevelId);
    expect(map.dueLevels).toBe(1);
    expect(map.levels.find((level) => level.id === dueLevelId)?.status).toBe(
      "due",
    );
  });

  it("keeps the current level visually active even if it has a due task", () => {
    const currentLevelId = minimalPairLevelId();
    const map = buildCourseMap({
      pack: pack(),
      profile: profile(),
      reviewQueue: [reviewTask()],
      currentLevelId,
    });

    expect(
      map.levels.find((level) => level.id === currentLevelId)?.status,
    ).toBe("current");
  });

  it("redirects a deep requested level to the first unpassed prerequisite", () => {
    const map = buildCourseMap({
      pack: pack(),
      profile: profile(),
      reviewQueue: [],
      requestedLevelId: "sentence-ladder",
    });

    expect(map.redirectedByGate).toBe(true);
    expect(map.nextLevelId).toBe("syllable-bridge");
    expect(map.startLevelId).toBe("syllable-bridge");
    expect(map.gateReason).toContain("还没有过线");
    expect(
      map.levels.find((level) => level.id === "sentence-ladder"),
    ).toMatchObject({
      status: "locked",
      startLevelId: "syllable-bridge",
      lockedByLevelId: "syllable-bridge",
    });
  });

  it("does not lock a requested level when it has due review evidence", () => {
    const map = buildCourseMap({
      pack: pack(),
      profile: profile(),
      reviewQueue: [reviewTask({ levelId: "sentence-ladder" })],
      requestedLevelId: "sentence-ladder",
    });

    expect(map.redirectedByGate).toBe(false);
    expect(map.nextLevelId).toBe("sentence-ladder");
    expect(
      map.levels.find((level) => level.id === "sentence-ladder")?.status,
    ).toBe("due");
  });
});
