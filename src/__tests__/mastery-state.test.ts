import { describe, expect, it } from "vitest";
import { evaluateMasteryStage, highestPassedLayer } from "@/lib/mastery-state";
import type {
  PackMastery,
  TrainingLevelKind,
  TrainingLevelSummary,
  TrainingSessionSummary,
} from "@/types/training";

function level(kind: TrainingLevelKind, passed = true): TrainingLevelSummary {
  return {
    levelId: kind,
    kind,
    attempts: 4,
    passed,
    bestScore: passed ? 86 : 60,
    stuckCount: 0,
  };
}

function session(overrides: Partial<TrainingSessionSummary> = {}) {
  const base: TrainingSessionSummary = {
    id: "s1",
    languageId: "en-US",
    packId: "ee-ih",
    startedAt: 1,
    completedAt: 2,
    perceptionCorrect: 4,
    perceptionTotal: 5,
    targetScores: [82, 84],
    wordScores: [],
    sentenceScores: [],
    mastered: false,
    levelSummaries: [],
  };
  return { ...base, ...overrides };
}

function existing(overrides: Partial<PackMastery> = {}): PackMastery {
  return {
    packId: "ee-ih",
    status: "mastered",
    masteryState: "integrated",
    levelProgress: {},
    bestTargetScore: 88,
    perceptionBestRate: 0.9,
    completedSessions: 2,
    failureStreak: 0,
    nextReviewAt: 1,
    ...overrides,
  };
}

describe("mastery state", () => {
  it("maps passed levels to the highest learning layer", () => {
    expect(
      highestPassedLayer(session({ levelSummaries: [level("perception")] })),
    ).toBe("perception");
    expect(
      highestPassedLayer(
        session({ levelSummaries: [level("perception"), level("word")] }),
      ),
    ).toBe("word");
    expect(
      highestPassedLayer(
        session({
          levelSummaries: [
            level("word"),
            level("sentence"),
            level("shadowing"),
          ],
        }),
      ),
    ).toBe("connected");
  });

  it("caps mastery score by the highest demonstrated layer", () => {
    const stage = evaluateMasteryStage(
      undefined,
      session({
        targetScores: [96, 94],
        wordScores: [95],
        levelSummaries: [level("word")],
      }),
      false,
      0,
    );

    expect(stage.state).toBe("controlled");
    expect(stage.highestLayer).toBe("word");
    expect(stage.stageCeiling).toBe(45);
    expect(stage.stageScore).toBe(45);
  });

  it("does not inflate a zero raw score to the layer ceiling", () => {
    const stage = evaluateMasteryStage(
      undefined,
      session({
        targetScores: [0],
        wordScores: [0],
        levelSummaries: [level("word")],
      }),
      false,
      0,
    );

    expect(stage.state).toBe("controlled");
    expect(stage.stageCeiling).toBe(45);
    expect(stage.stageScore).toBe(0);
  });

  it("marks due review success as retained", () => {
    const stage = evaluateMasteryStage(
      existing(),
      session({
        completedAt: 3,
        levelSummaries: [level("mixed-review")],
        mixedReviewScores: [86, 88],
        isReviewSession: true,
      }),
      true,
      0,
    );

    expect(stage.state).toBe("retained");
    expect(stage.stageCeiling).toBe(75);
  });

  it("marks spontaneous transfer evidence as transferred", () => {
    const stage = evaluateMasteryStage(
      existing({ masteryState: "retained" }),
      session({
        transferEvidence: [
          {
            layer: "spontaneous",
            prompt: "Explain your morning routine.",
            score: 86,
            passed: true,
            completedAt: 4,
          },
        ],
      }),
      true,
      0,
    );

    expect(stage.state).toBe("transferred");
    expect(stage.highestLayer).toBe("spontaneous");
    expect(stage.stageCeiling).toBe(100);
  });

  it("downgrades after repeated failures instead of preserving a stale state", () => {
    const stage = evaluateMasteryStage(
      existing({ masteryState: "retained" }),
      session({
        levelSummaries: [level("word", false)],
        targetScores: [55],
        wordScores: [55],
      }),
      false,
      2,
    );

    expect(stage.state).toBe("integrated");
    expect(stage.rationale).toContain("降级");
  });
});
