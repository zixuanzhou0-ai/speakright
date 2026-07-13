import { describe, expect, it } from "vitest";
import type { LearningEvidenceV3 } from "@speakright/core/evidence/types";
import { getNextRetentionReviewAt } from "@speakright/core/scheduling/retention";
import { decideEvidencePromotion } from "@speakright/core/training/evidence-boundary";

function evidence(overrides: Partial<LearningEvidenceV3> = {}): LearningEvidenceV3 {
  return {
    id: "evidence-1",
    version: 3,
    languageId: "en-US",
    taskType: "controlled-word",
    targetUnits: ["ee"],
    observations: [{ metric: "target-unit", score: 82, source: "azure" }],
    recordingQuality: { status: "good", reasons: [] },
    alignmentQuality: { status: "good", reasons: [] },
    sampleCount: 2,
    contextCount: 2,
    source: "training",
    confidence: "medium",
    evidenceStage: "introduced",
    calibrationVersion: "provisional-v1",
    createdAt: 0,
    ...overrides,
  };
}

describe("shared training evidence boundary", () => {
  it("blocks promotion when recording quality is not qualified", () => {
    const decision = decideEvidencePromotion(
      evidence({ recordingQuality: { status: "caution", reasons: ["noise"] } }),
      "controlled",
    );
    expect(decision.allowed).toBe(false);
    expect(decision.nextStage).toBe("introduced");
    expect(decision.reasons).toContain("recording-quality-not-good");
  });

  it("does not infer transfer from a controlled word task", () => {
    const decision = decideEvidencePromotion(evidence(), "transfer_observed");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toContain(
      "invalid-task-for-transfer-or-retention",
    );
  });

  it("allows qualified controlled evidence to advance", () => {
    expect(decideEvidencePromotion(evidence(), "controlled")).toEqual({
      allowed: true,
      nextStage: "controlled",
      reasons: [],
    });
  });
});

describe("shared retention schedule", () => {
  it("uses immutable 1, 7, and 21 day review intervals", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(getNextRetentionReviewAt(0, 0)).toBe(day);
    expect(getNextRetentionReviewAt(0, 1)).toBe(7 * day);
    expect(getNextRetentionReviewAt(0, 2)).toBe(21 * day);
    expect(getNextRetentionReviewAt(0, 3)).toBeNull();
  });
});