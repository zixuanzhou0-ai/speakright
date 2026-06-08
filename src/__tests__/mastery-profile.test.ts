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
    targetScores: [88, 85, 83, 82],
    wordScores: [86, 83, 81],
    sentenceScores: [84, 82],
    mixedReviewScores: [90, 84, 82, 80],
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
        bestScore: 86,
        stuckCount: 0,
      },
      {
        levelId: "sentence-ladder",
        kind: "sentence",
        attempts: 6,
        passed: true,
        bestScore: 84,
        stuckCount: 0,
      },
      {
        levelId: "mixed-review",
        kind: "mixed-review",
        attempts: 5,
        passed: true,
        bestScore: 90,
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
    expect(evaluateSessionMastery(session({ perceptionCorrect: 3 }))).toBe(
      false,
    );
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
              bestScore: 86,
              stuckCount: 0,
            },
            {
              levelId: "sentence-ladder",
              kind: "sentence",
              attempts: 6,
              passed: true,
              bestScore: 84,
              stuckCount: 0,
            },
            {
              levelId: "mixed-review",
              kind: "mixed-review",
              attempts: 5,
              passed: true,
              bestScore: 90,
              stuckCount: 0,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("records pack and phoneme mastery", () => {
    const profile = recordTrainingSession(
      createEmptyMasteryProfile(),
      session(),
    );

    expect(profile.packs["s-th"].status).toBe("mastered");
    expect(profile.packs["s-th"].masteryState).toBe("integrated");
    expect(profile.packs["s-th"].stageCeiling).toBe(75);
    expect(profile.packs["s-th"].nextRequiredLayer).toBe("guided");
    expect(profile.packs["s-th"].nextReviewAt).toBeGreaterThan(2);
    expect(profile.packs["s-th"].levelProgress["word-ladder"].passed).toBe(
      true,
    );
    expect(profile.phonemes.th.bestScore).toBe(88);
    expect(profile.sessions[0].masteryStateAfter).toBe("integrated");
  });

  it("does not promote mastery from warning-quality evidence", () => {
    const profile = recordTrainingSession(
      createEmptyMasteryProfile(),
      session({
        assessmentReliability: {
          alignment: "good",
          evidenceStrength: "strong",
          canPromoteMastery: false,
          audioQualityScore: 72,
          audioQualityIssues: ["音量偏低"],
          note: "测试用 warning，不提升掌握度。",
        },
      }),
    );

    expect(profile.packs["s-th"].status).toBe("practicing");
    expect(profile.packs["s-th"].masteryState).toBe("suspected");
    expect(profile.packs["s-th"].levelProgress["word-ladder"]).toBeUndefined();
    expect(profile.phonemes.th).toBeUndefined();
    expect(profile.sessions[0].assessmentReliability?.canPromoteMastery).toBe(
      false,
    );
  });

  it("does not promote mastery from target phoneme fallback evidence", () => {
    const profile = recordTrainingSession(
      createEmptyMasteryProfile(),
      session({
        promotionBlockers: [
          "目标音素未成功对齐，本轮整体分只作反馈，不提升掌握度。",
        ],
      }),
    );

    expect(evaluateSessionMastery(profile.sessions[0])).toBe(false);
    expect(profile.packs["s-th"].status).toBe("practicing");
    expect(profile.packs["s-th"].masteryState).toBe("suspected");
    expect(profile.packs["s-th"].levelProgress["word-ladder"]).toBeUndefined();
    expect(profile.phonemes.th).toBeUndefined();
    expect(profile.sessions[0].promotionBlockers).toHaveLength(1);
  });

  it("downgrades a due mastered pack after repeated review failure", () => {
    const mastered = recordTrainingSession(
      createEmptyMasteryProfile(),
      session(),
    );
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
    expect(failed.packs["s-th"].masteryState).toBe("controlled");
  });

  it("records retained and transferred evidence without changing storage version", () => {
    const first = recordTrainingSession(createEmptyMasteryProfile(), session());
    first.packs["s-th"].nextReviewAt = 1;

    const retained = recordTrainingSession(
      first,
      session({
        id: "s2",
        completedAt: 3,
        isReviewSession: true,
      }),
    );
    expect(retained.packs["s-th"].masteryState).toBe("retained");
    expect(retained.packs["s-th"].retainedReviewCount).toBe(1);

    const transferred = recordTrainingSession(
      retained,
      session({
        id: "s3",
        completedAt: 4,
        transferEvidence: [
          {
            layer: "spontaneous",
            prompt: "Tell me about your work.",
            score: 88,
            passed: true,
            completedAt: 4,
          },
        ],
      }),
    );

    expect(transferred.version).toBe(2);
    expect(transferred.packs["s-th"].masteryState).toBe("transferred");
    expect(transferred.packs["s-th"].transferEvidenceCount).toBe(1);
  });
});
