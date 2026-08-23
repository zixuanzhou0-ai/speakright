import { evaluateTrainingCriterion } from "@speakright/core/training/criteria";
import { describe, expect, it } from "vitest";
import { buildGuidedTrainingEvidence } from "@/lib/guided-training-evidence";
import { getRetentionMaterialIds, getTrainingPack } from "@/lib/training-packs";

describe("English depth progression contracts", () => {
  it("separates valid sample count from required passing sample count", () => {
    const criterion = {
      kind: "controlled-production" as const,
      minTargetScore: 82,
      minValidSamples: 10,
      minPassedSamples: 8,
      minUniqueMaterials: 10,
      requireRecordingQuality: true,
      requireAlignment: true,
    };

    expect(
      evaluateTrainingCriterion(criterion, {
        passedCount: 8,
        validSampleCount: 10,
        materialIds: Array.from({ length: 10 }, (_, index) => `word-${index}`),
        recordingQualityValid: true,
        alignmentValid: true,
      }).passed,
    ).toBe(true);
    expect(
      evaluateTrainingCriterion(criterion, {
        passedCount: 7,
        validSampleCount: 10,
        materialIds: Array.from({ length: 10 }, (_, index) => `word-${index}`),
        recordingQualityValid: true,
        alignmentValid: true,
      }).passed,
    ).toBe(false);
  });

  it("builds transfer only from three valid held-out samples in two contexts", () => {
    const pack = getTrainingPack("ee-ih");
    const level = pack?.course?.levels.find(
      (candidate) => candidate.kind === "transfer",
    );
    expect(pack).toBeTruthy();
    expect(level).toBeTruthy();
    if (!pack || !level) return;

    const [evidence] = buildGuidedTrainingEvidence({
      sessionId: "ee-ih-transfer-session",
      languageId: "en-US",
      pack,
      createdAt: 1_000,
      levels: [
        {
          level,
          snapshot: {
            levelId: level.id,
            kind: level.kind,
            scores: [84, 83, 82],
            attempts: 4,
            passedCount: 3,
            stuckCount: 0,
            contextIds: ["word-a", "word-b", "sentence"],
            validSampleCount: 3,
            recordingQualityValid: true,
            alignmentValid: true,
            materialIds: ["ee-ih-far-01", "ee-ih-far-02", "ee-ih-far-03"],
            novelty: "confirmed-untrained",
          },
        },
      ],
    });

    expect(evidence).toMatchObject({
      taskType: "guided-transfer",
      evidenceStage: "transfer_observed",
      sampleCount: 3,
      confidence: "medium",
      trace: {
        materialRole: "far-transfer",
        novelty: "confirmed-untrained",
      },
    });
  });

  it("keeps a failed or exposed transfer as an observation", () => {
    const pack = getTrainingPack("ee-ih");
    const level = pack?.course?.levels.find(
      (candidate) => candidate.kind === "transfer",
    );
    expect(pack).toBeTruthy();
    expect(level).toBeTruthy();
    if (!pack || !level) return;

    const [evidence] = buildGuidedTrainingEvidence({
      sessionId: "ee-ih-transfer-exposed",
      languageId: "en-US",
      pack,
      createdAt: 1_000,
      levels: [
        {
          level,
          snapshot: {
            levelId: level.id,
            kind: level.kind,
            scores: [90, 90, 90],
            attempts: 3,
            passedCount: 3,
            stuckCount: 0,
            contextIds: ["word-a", "word-b", "sentence"],
            validSampleCount: 3,
            recordingQualityValid: true,
            alignmentValid: true,
            materialIds: ["ee-ih-far-01", "ee-ih-far-02", "ee-ih-far-03"],
            novelty: "exposed",
          },
        },
      ],
    });

    expect(evidence.evidenceStage).toBe("introduced");
    expect(evidence.confidence).toBe("low");
  });

  it("provides separate local retention sets for 1, 7, and 21 days", () => {
    const sets = ([24, 168, 504] as const).map((delay) =>
      getRetentionMaterialIds("ee-ih", delay),
    );
    expect(sets.every((ids) => ids.length >= 4)).toBe(true);
    expect(new Set(sets.flat()).size).toBe(sets.flat().length);
    expect(getRetentionMaterialIds("s-th", 24)).toEqual([]);
  });
});
