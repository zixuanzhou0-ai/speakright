import {
  buildRetentionEvidence,
  buildTransferEvidence,
} from "@speakright/core/evidence/progression";
import { evaluateTrainingCriterion } from "@speakright/core/training/criteria";
import {
  emptyTrainingExposureStore,
  recordTrainingMaterialExposure,
  trainingMaterialNovelty,
} from "@speakright/core/training/exposure";
import {
  type TrainingMaterialDescriptor,
  validateTrainingMaterialPartitions,
} from "@speakright/core/training/materials";
import { createPerceptionTrials } from "@speakright/core/training/perception";
import { describe, expect, it } from "vitest";

const examples = Array.from({ length: 8 }, (_, index) => ({
  id: `pair-${index + 1}`,
  categoryA: { word: `a-${index + 1}`, targetUnit: "i" },
  categoryB: { word: `b-${index + 1}`, targetUnit: "ih" },
}));

function progressionBase() {
  return {
    id: "evidence-1",
    languageId: "en-US" as const,
    taskType: "guided-transfer" as const,
    targetUnits: ["i", "ih"],
    observations: [
      { metric: "target-unit" as const, score: 84, source: "azure" as const },
    ],
    recordingQuality: { status: "good" as const, reasons: [] },
    alignmentQuality: { status: "good" as const, reasons: [] },
    sampleCount: 3,
    contextCount: 2,
    calibrationVersion: "english-depth-pilot-v1",
    createdAt: 1_000,
    trace: {
      sessionId: "session-1",
      materialIds: ["far-1", "far-2", "far-3"],
      criterionKind: "transfer",
      materialRole: "far-transfer" as const,
    },
    passedCount: 3,
    contextIds: ["word", "sentence"],
  };
}

describe("English depth shared core", () => {
  it("creates deterministic balanced four-speaker perception trials", () => {
    const options = {
      seed: "depth-v1",
      trialCount: 16,
      speakers: ["max", "nichalia", "eryn", "brian"],
      audioUri: (word: string, speakerId: string) =>
        `/audio/${speakerId}/${word}.mp3`,
    };
    const first = createPerceptionTrials(examples, options);
    const second = createPerceptionTrials(examples, options);

    expect(first).toEqual(second);
    expect(first).toHaveLength(16);
    expect(
      new Set(
        first.flatMap((trial) => [
          trial.referenceSpeakerId,
          trial.probeSpeakerId,
        ]),
      ).size,
    ).toBe(4);
    expect(
      new Set(
        first.map((trial) =>
          [trial.referenceSpeakerId, trial.probeSpeakerId].sort().join(":"),
        ),
      ).size,
    ).toBeGreaterThanOrEqual(6);

    for (const speaker of options.speakers) {
      expect(first.some((trial) => trial.referenceSpeakerId === speaker)).toBe(
        true,
      );
      expect(first.some((trial) => trial.probeSpeakerId === speaker)).toBe(
        true,
      );
    }
    for (const trial of first) {
      expect(trial.referenceA.speakerId).toBe(trial.referenceB.speakerId);
      expect(trial.probe.speakerId).not.toBe(trial.referenceSpeakerId);
      expect(
        new Set([trial.referenceA.uri, trial.referenceB.uri, trial.probe.uri])
          .size,
      ).toBe(3);
      expect(trial.probe.word).not.toBe(trial.referenceA.word);
      expect(trial.probe.word).not.toBe(trial.referenceB.word);
    }
  });

  it("rejects material reuse across practice and held-out roles", () => {
    const materials: TrainingMaterialDescriptor[] = [
      {
        id: "shared-word",
        packId: "ee-ih",
        role: "practice",
        targetUnits: ["i"],
        difficulty: 1,
      },
      {
        id: "shared-word",
        packId: "ee-ih",
        role: "retention",
        targetUnits: ["i"],
        difficulty: 2,
      },
    ];
    expect(validateTrainingMaterialPartitions(materials)).toEqual({
      valid: false,
      conflicts: [
        { materialId: "shared-word", roles: ["practice", "retention"] },
      ],
    });
  });

  it("does not call material untrained without exposure history", () => {
    const empty = emptyTrainingExposureStore(100);
    expect(trainingMaterialNovelty(empty, "far-1", false)).toBe("unknown");
    expect(trainingMaterialNovelty(empty, "far-1", true)).toBe(
      "confirmed-untrained",
    );

    const exposed = recordTrainingMaterialExposure(empty, {
      materialId: "far-1",
      packId: "ee-ih",
      role: "practice",
      seenAt: 200,
    });
    expect(trainingMaterialNovelty(exposed, "far-1", true)).toBe("exposed");
    expect(exposed.exposures[0].attemptCount).toBe(1);
  });

  it("requires actual motor work before completing formation", () => {
    const criterion = {
      kind: "motor-formation" as const,
      minSelfChecks: 3,
      minRecordedSamples: 2,
      requirePlaybackComparison: true,
    };
    expect(
      evaluateTrainingCriterion(criterion, {
        completedSelfChecks: 3,
        recordedSampleCount: 1,
        playbackComparisonCompleted: true,
      }).passed,
    ).toBe(false);
    expect(
      evaluateTrainingCriterion(criterion, {
        completedSelfChecks: 3,
        recordedSampleCount: 2,
        playbackComparisonCompleted: true,
      }).passed,
    ).toBe(true);
  });

  it("requires confirmed novelty for transfer evidence", () => {
    expect(
      buildTransferEvidence({
        ...progressionBase(),
        novelty: "unknown",
      }).evidenceStage,
    ).toBe("introduced");
    expect(
      buildTransferEvidence({
        ...progressionBase(),
        novelty: "confirmed-untrained",
      }).evidenceStage,
    ).toBe("transfer_observed");
  });

  it("blocks early retention and raises confidence only after a later retest", () => {
    const base = {
      ...progressionBase(),
      taskType: "delayed-retention" as const,
      novelty: "confirmed-untrained" as const,
    };
    expect(
      buildRetentionEvidence({
        ...base,
        delayHours: 23,
        priorValidRetentionCount: 0,
      }).evidenceStage,
    ).toBe("introduced");

    const firstDay = buildRetentionEvidence({
      ...base,
      delayHours: 24,
      priorValidRetentionCount: 0,
    });
    expect(firstDay.evidenceStage).toBe("retention_observed");
    expect(firstDay.confidence).toBe("medium");

    const seventhDay = buildRetentionEvidence({
      ...base,
      delayHours: 168,
      priorValidRetentionCount: 1,
    });
    expect(seventhDay.evidenceStage).toBe("retention_observed");
    expect(seventhDay.confidence).toBe("high");
  });
});
