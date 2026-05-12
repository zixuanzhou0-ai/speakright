import { describe, expect, it } from "vitest";
import {
  createEmptyMasteryProfile,
  evaluateSessionMastery,
  recordTrainingSession,
} from "@/lib/mastery-profile";
import type { TrainingSessionSummary } from "@/types/training";

function session(overrides: Partial<TrainingSessionSummary> = {}) {
  const base: TrainingSessionSummary = {
    id: "s1",
    packId: "s-th",
    startedAt: 1,
    completedAt: 2,
    perceptionCorrect: 5,
    perceptionTotal: 5,
    targetScores: [82, 78, 80, 77],
    wordScores: [82, 78, 80],
    sentenceScores: [77],
    mixedReviewScores: [78, 79, 80],
    levelSummaries: [
      {
        levelId: "perception-abx",
        kind: "perception",
        attempts: 8,
        passed: true,
        bestScore: 100,
        stuckCount: 0,
      },
      {
        levelId: "word-ladder",
        kind: "word",
        attempts: 8,
        passed: true,
        bestScore: 82,
        stuckCount: 0,
      },
      {
        levelId: "sentence-ladder",
        kind: "sentence",
        attempts: 5,
        passed: true,
        bestScore: 80,
        stuckCount: 0,
      },
      {
        levelId: "mixed-review",
        kind: "mixed-review",
        attempts: 4,
        passed: true,
        bestScore: 80,
        stuckCount: 0,
      },
    ],
    stuckPatternIds: [],
    mastered: false,
  };
  return { ...base, ...overrides };
}

describe("mastery profile", () => {
  it("requires perception, recent word scores, and sentence scores", () => {
    expect(evaluateSessionMastery(session())).toBe(true);
    expect(
      evaluateSessionMastery(session({ perceptionCorrect: 3 })),
    ).toBe(false);
    expect(evaluateSessionMastery(session({ wordScores: [60, 76, 62] }))).toBe(
      false,
    );
    expect(evaluateSessionMastery(session({ sentenceScores: [70] }))).toBe(
      false,
    );
    expect(evaluateSessionMastery(session({ mixedReviewScores: [70] }))).toBe(
      false,
    );
    expect(evaluateSessionMastery(session({ stuckPatternIds: ["th"] }))).toBe(
      false,
    );
    expect(
      evaluateSessionMastery(
        session({
          levelSummaries: [
            {
              levelId: "perception-abx",
              kind: "perception",
              attempts: 8,
              passed: true,
              bestScore: 100,
              stuckCount: 0,
            },
            {
              levelId: "word-ladder",
              kind: "word",
              attempts: 8,
              passed: false,
              bestScore: 82,
              stuckCount: 0,
            },
            {
              levelId: "sentence-ladder",
              kind: "sentence",
              attempts: 5,
              passed: true,
              bestScore: 80,
              stuckCount: 0,
            },
            {
              levelId: "mixed-review",
              kind: "mixed-review",
              attempts: 4,
              passed: true,
              bestScore: 80,
              stuckCount: 0,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("records pack and phoneme mastery", () => {
    const profile = recordTrainingSession(createEmptyMasteryProfile(), session());

    expect(profile.packs["s-th"].status).toBe("mastered");
    expect(profile.packs["s-th"].nextReviewAt).toBeGreaterThan(2);
    expect(profile.packs["s-th"].levelProgress["word-ladder"].passed).toBe(true);
    expect(profile.phonemes.th.bestScore).toBe(82);
  });

  it("downgrades a due mastered pack after repeated review failure", () => {
    const mastered = recordTrainingSession(createEmptyMasteryProfile(), session());
    const pack = mastered.packs["s-th"];
    pack.nextReviewAt = 1;
    pack.failureStreak = 1;

    const failed = recordTrainingSession(
      mastered,
      session({
        id: "s2",
        completedAt: 3,
        perceptionCorrect: 2,
        wordScores: [50, 55],
        sentenceScores: [50],
        mixedReviewScores: [45],
      }),
    );

    expect(failed.packs["s-th"].status).toBe("practicing");
    expect(failed.packs["s-th"].failureStreak).toBe(2);
  });
});
