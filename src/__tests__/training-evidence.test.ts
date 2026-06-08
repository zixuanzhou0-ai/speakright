import { describe, expect, it } from "vitest";
import { buildTrainingEvidenceBook } from "@/lib/training-evidence";
import type { MasteryProfile, TrainingSessionSummary } from "@/types/training";

const NOW = 100_000;

function session(
  overrides: Partial<TrainingSessionSummary> = {},
): TrainingSessionSummary {
  return {
    id: "s1",
    packId: "s-th",
    startedAt: NOW - 2_000,
    completedAt: NOW - 1_000,
    perceptionCorrect: 5,
    perceptionTotal: 8,
    targetScores: [52, 62],
    wordScores: [52],
    sentenceScores: [],
    mastered: false,
    recommendedNextLevelId: "word-ladder",
    stuckPatternIds: ["tongue-between-teeth"],
    failedItems: [
      {
        itemId: "word-think",
        levelId: "word-ladder",
        levelKind: "word",
        text: "think",
        targetPhonemes: ["th"],
        targetScore: 52,
        overallScore: 88,
        patternIds: ["tongue-between-teeth"],
        nextCue: "露出一点舌尖",
        passed: false,
      },
    ],
    remediationResults: [
      {
        pathId: "th-rebuild",
        stepIndex: 1,
        text: "think",
        targetPhonemes: ["th"],
        beforeTargetScore: 52,
        targetScore: 68,
        overallScore: 78,
        passed: false,
      },
    ],
    ...overrides,
  };
}

function profile(overrides: Partial<MasteryProfile> = {}): MasteryProfile {
  return {
    version: 2,
    updatedAt: NOW,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "practicing",
        levelProgress: {},
        bestTargetScore: 68,
        perceptionBestRate: 0.6,
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
    sessions: [session()],
    ...overrides,
  };
}

describe("training evidence book", () => {
  it("returns an empty stable evidence book without a profile", () => {
    const book = buildTrainingEvidenceBook(null, NOW);

    expect(book.totalEvidence).toBe(0);
    expect(book.cards).toEqual([]);
    expect(book.reviewQueue).toEqual([]);
  });

  it("merges repeated failed items into one evidence card", () => {
    const book = buildTrainingEvidenceBook(
      profile({
        sessions: [
          session({ id: "new", completedAt: NOW, targetScores: [64] }),
          session({
            id: "old",
            completedAt: NOW - 10_000,
            failedItems: [
              {
                itemId: "word-think-old",
                levelId: "word-ladder",
                levelKind: "word",
                text: "think",
                targetPhonemes: ["th"],
                targetScore: 44,
                overallScore: 80,
                patternIds: ["tongue-between-teeth"],
                nextCue: "舌尖不要缩回去",
                passed: false,
              },
            ],
          }),
        ],
      }),
      NOW,
    );

    expect(book.cards).toHaveLength(1);
    expect(book.cards[0]).toMatchObject({
      text: "think",
      attempts: 2,
      worstTargetScore: 44,
      bestTargetScore: 52,
      latestTargetScore: 52,
      severity: "critical",
    });
  });

  it("aggregates active error patterns with failed item counts", () => {
    const book = buildTrainingEvidenceBook(profile(), NOW);
    const pattern = book.patterns[0];

    expect(pattern).toMatchObject({
      patternId: "tongue-between-teeth",
      packId: "s-th",
      severity: "critical",
      failedItemCount: 1,
    });
    expect(pattern.cue).toContain("舌尖");
  });

  it("summarizes remediation attempts and failed counts", () => {
    const book = buildTrainingEvidenceBook(profile(), NOW);

    expect(book.remediations[0]).toMatchObject({
      pathId: "th-rebuild",
      text: "think",
      attempts: 1,
      passedCount: 0,
      failedCount: 1,
      bestImprovement: 16,
    });
    expect(book.remediationFailedCount).toBe(1);
  });
});
