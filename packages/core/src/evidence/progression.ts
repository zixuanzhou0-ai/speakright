import type { TrainingCriterion } from "../training/criteria";
import type { TrainingMaterialNovelty } from "../training/exposure";
import {
  buildTrainingAggregateEvidence,
  type TrainingEvidenceBaseInput,
} from "./training";
import type { LearningEvidenceV3 } from "./types";

export const ENGLISH_DEPTH_TRANSFER_CRITERION: TrainingCriterion = {
  kind: "transfer",
  minTargetScore: 78,
  minValidSamples: 3,
  minContexts: 2,
  requireUntrainedMaterial: true,
};

export const ENGLISH_DEPTH_RETENTION_CRITERION: TrainingCriterion = {
  kind: "retention",
  minTargetScore: 78,
  minValidSamples: 3,
  minContexts: 2,
  minDelayHours: 24,
  requireUntrainedMaterial: true,
};

interface ProgressionEvidenceInput extends TrainingEvidenceBaseInput {
  passedCount: number;
  contextIds: readonly string[];
  novelty: TrainingMaterialNovelty;
}

export function buildTransferEvidence(
  input: ProgressionEvidenceInput,
): LearningEvidenceV3 {
  return buildTrainingAggregateEvidence({
    ...input,
    trace: {
      ...input.trace,
      novelty: input.novelty,
      materialRole: input.trace.materialRole ?? "far-transfer",
    },
    criterion: ENGLISH_DEPTH_TRANSFER_CRITERION,
    criterionEvidence: {
      passedCount: input.passedCount,
      validSampleCount: input.sampleCount,
      contextCount: new Set(input.contextIds).size,
      untrainedMaterial: input.novelty === "confirmed-untrained",
    },
    requestedStage: "transfer_observed",
  });
}

export function buildRetentionEvidence(
  input: ProgressionEvidenceInput & {
    delayHours: number;
    priorValidRetentionCount: number;
  },
): LearningEvidenceV3 {
  const evidence = buildTrainingAggregateEvidence({
    ...input,
    trace: {
      ...input.trace,
      novelty: input.novelty,
      materialRole: "retention",
      scheduledDelayHours: input.trace.scheduledDelayHours ?? input.delayHours,
    },
    criterion: ENGLISH_DEPTH_RETENTION_CRITERION,
    criterionEvidence: {
      passedCount: input.passedCount,
      validSampleCount: input.sampleCount,
      contextCount: new Set(input.contextIds).size,
      untrainedMaterial: input.novelty === "confirmed-untrained",
      delayHours: input.delayHours,
    },
    requestedStage: "retention_observed",
  });

  if (
    evidence.evidenceStage === "retention_observed" &&
    input.delayHours >= 168 &&
    input.priorValidRetentionCount >= 1
  ) {
    return { ...evidence, confidence: "high" };
  }
  return evidence;
}
