import { describe, expect, it } from "vitest";
import {
  buildHvptSession,
  buildHvptTrainingSession,
  getHvptContrast,
  HVPT_CONTRASTS,
  recommendedHvptContrastIds,
  summarizeHvptSession,
} from "@/lib/hvpt-training";
import {
  createEmptyMasteryProfile,
  recordTrainingSession,
} from "@/lib/mastery-profile";
import type { MasteryProfile } from "@/types/training";

describe("hvpt training", () => {
  it("builds multi-speaker ABX trials", () => {
    const trials = buildHvptSession("ee-ih", 12, 42);

    expect(trials).toHaveLength(12);
    expect(new Set(trials.map((trial) => trial.speakerX)).size).toBeGreaterThan(
      1,
    );
    expect(trials.every((trial) => trial.xWord.length > 0)).toBe(true);
    expect(trials.every((trial) => trial.context.length > 0)).toBe(true);
  });

  it("summarizes confusion direction and focused review", () => {
    const contrast = getHvptContrast("s-th");
    if (!contrast) throw new Error("missing contrast");
    const trials = buildHvptSession("s-th", 4, 7).map((trial, index) => ({
      ...trial,
      xIsA: index < 3,
      xWord: index < 3 ? trial.wordA : trial.wordB,
    }));
    const responses = trials.map((trial) => ({
      trialId: trial.id,
      answer: "B" as const,
    }));

    const summary = summarizeHvptSession(contrast, trials, responses);

    expect(summary.correct).toBe(1);
    expect(summary.passed).toBe(false);
    expect(summary.biasDirection).toContain(contrast.targetA);
    expect(summary.focusedReviewTrials).toHaveLength(3);
  });

  it("keeps default recommendations when no profile exists", () => {
    expect(recommendedHvptContrastIds(null)).toEqual([
      "ee-ih",
      "eh-ae",
      "s-th",
      "v-w",
      "l-r",
    ]);
  });

  it("recommends weak profile contrasts before generic defaults", () => {
    const profile: MasteryProfile = {
      version: 2,
      updatedAt: 1000,
      packs: {
        "v-w": {
          packId: "v-w",
          status: "practicing",
          levelProgress: {},
          bestTargetScore: 52,
          perceptionBestRate: 0.4,
          completedSessions: 1,
          failureStreak: 3,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [],
    };

    expect(recommendedHvptContrastIds(profile)[0]).toBe("v-w");
  });

  it("defines HVPT coverage for high-impact contrast packs", () => {
    expect(HVPT_CONTRASTS.map((contrast) => contrast.packId)).toEqual(
      expect.arrayContaining([
        "ee-ih",
        "eh-ae",
        "oo-uh",
        "s-th",
        "z-dh",
        "v-w",
        "l-r",
        "n-ng",
      ]),
    );
  });

  it("turns HVPT summary into perception-layer mastery evidence", () => {
    const contrast = getHvptContrast("ee-ih");
    if (!contrast) throw new Error("missing contrast");
    const trials = buildHvptSession("ee-ih", 10, 12);
    const responses = trials.map((trial) => {
      const answer: "A" | "B" = trial.xIsA ? "A" : "B";
      return { trialId: trial.id, answer };
    });
    const summary = summarizeHvptSession(contrast, trials, responses);
    const session = buildHvptTrainingSession(contrast, summary, 1000);

    expect(session.packId).toBe("ee-ih");
    expect(session.modality).toBe("perception");
    expect(session.perceptionCorrect).toBe(10);
    expect(session.targetScores).toEqual([]);
    expect(session.levelSummaries?.[0]).toMatchObject({
      levelId: "perception-abx",
      kind: "perception",
      passed: true,
      bestScore: 100,
    });
    expect(session.assessmentReliability?.canPromoteMastery).toBe(true);
  });

  it("does not write HVPT perception accuracy into production phoneme mastery", () => {
    const contrast = getHvptContrast("ee-ih");
    if (!contrast) throw new Error("missing contrast");
    const trials = buildHvptSession("ee-ih", 10, 12);
    const responses = trials.map((trial) => ({
      trialId: trial.id,
      answer: (trial.xIsA ? "A" : "B") as "A" | "B",
    }));
    const summary = summarizeHvptSession(contrast, trials, responses);
    const profile = recordTrainingSession(
      createEmptyMasteryProfile(),
      buildHvptTrainingSession(contrast, summary, 1000),
    );

    expect(
      profile.packs["ee-ih"]?.levelProgress["perception-abx"]?.passed,
    ).toBe(true);
    expect(profile.packs["ee-ih"]?.perceptionBestRate).toBe(1);
    expect(profile.phonemes.ee).toBeUndefined();
    expect(profile.phonemes.ih).toBeUndefined();
  });
});
