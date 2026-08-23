import {
  evaluateTrainingCriterion,
  type TrainingCriterion,
} from "@speakright/core/training/criteria";
import { describe, expect, it } from "vitest";
import { formatTrainingTargetUnit } from "@/lib/training-criteria";

const perceptionCriterion: TrainingCriterion = {
  kind: "perception",
  minCorrectRate: 0.85,
  minTrials: 8,
  minUniquePairs: 4,
  crossSpeakerRequired: true,
};

describe("training criterion contracts", () => {
  it("accepts 7 of 8 valid cross-speaker trials across four pairs", () => {
    expect(
      evaluateTrainingCriterion(perceptionCriterion, {
        correctCount: 7,
        totalCount: 8,
        uniqueContextIds: ["p1", "p2", "p3", "p4"],
        crossSpeakerValid: true,
      }).passed,
    ).toBe(true);
  });

  it("keeps internal non-phoneme category slugs out of user-facing labels", () => {
    expect(formatTrainingTargetUnit("open-syllable")).toBe("无目标词尾");
    expect(formatTrainingTargetUnit("final-consonant")).toBe("有词尾辅音");
    expect(formatTrainingTargetUnit("initial-stress")).toBe("首音节重读");
    expect(formatTrainingTargetUnit("unknown-internal-slug")).toBe(
      "当前训练目标",
    );
  });

  it("rejects an accurate-looking result without enough trials or valid speakers", () => {
    const result = evaluateTrainingCriterion(perceptionCriterion, {
      correctCount: 4,
      totalCount: 4,
      uniqueContextIds: ["p1", "p2", "p3", "p4"],
      crossSpeakerValid: false,
    });

    expect(result.passed).toBe(false);
    expect(result.blockers).toContain("至少完成 8 次听辨");
    expect(result.blockers).toContain("A/B 与 X 必须使用不同说话人");
  });

  it("never treats a same-day result as retention evidence", () => {
    const retention: TrainingCriterion = {
      kind: "retention",
      minTargetScore: 80,
      minValidSamples: 2,
      minContexts: 2,
      minDelayHours: 24,
      requireUntrainedMaterial: true,
    };

    expect(
      evaluateTrainingCriterion(retention, {
        passedCount: 2,
        validSampleCount: 2,
        contextCount: 2,
        untrainedMaterial: true,
        delayHours: 2,
      }).passed,
    ).toBe(false);
  });
});
