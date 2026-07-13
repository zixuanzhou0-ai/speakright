import {
  evaluateTrainingCriterion,
  type TrainingCriterion,
  type TrainingCriterionEvidence,
} from "../training/criteria";
import { decideEvidencePromotion } from "../training/evidence-boundary";
import type {
  EvidenceConfidence,
  EvidenceObservation,
  EvidenceStage,
  EvidenceTaskType,
  LearningEvidenceV3,
  LearningLanguageId,
} from "./types";

type QualityStatus = LearningEvidenceV3["recordingQuality"]["status"];

export interface TrainingEvidenceQuality {
  status: QualityStatus;
  score?: number;
  reasons: string[];
}

export interface TrainingEvidenceTrace {
  sessionId: string;
  levelId?: string;
  materialIds: string[];
  criterionKind: string;
}

interface TrainingEvidenceBaseInput {
  id: string;
  languageId: LearningLanguageId;
  taskType: EvidenceTaskType;
  targetUnits: string[];
  observations: EvidenceObservation[];
  recordingQuality: TrainingEvidenceQuality;
  alignmentQuality: TrainingEvidenceQuality;
  sampleCount: number;
  contextCount: number;
  calibrationVersion: string;
  createdAt: number;
  trace: TrainingEvidenceTrace;
}

export function buildTrainingAttemptEvidence(
  input: Omit<TrainingEvidenceBaseInput, "sampleCount" | "contextCount"> & {
    sampleCount?: number;
    contextCount?: number;
  },
): LearningEvidenceV3 {
  return {
    id: input.id,
    version: 3,
    languageId: input.languageId,
    taskType: input.taskType,
    targetUnits: input.targetUnits,
    observations: input.observations,
    recordingQuality: input.recordingQuality,
    alignmentQuality: input.alignmentQuality,
    sampleCount: input.sampleCount ?? 1,
    contextCount: input.contextCount ?? 1,
    source: "training",
    confidence: "low",
    evidenceStage: "introduced",
    calibrationVersion: input.calibrationVersion,
    createdAt: input.createdAt,
    trace: { ...input.trace, aggregate: false },
  };
}

export function buildTrainingAggregateEvidence(
  input: TrainingEvidenceBaseInput & {
    criterion: TrainingCriterion;
    criterionEvidence: TrainingCriterionEvidence;
    requestedStage: EvidenceStage;
  },
): LearningEvidenceV3 {
  const criterionResult = evaluateTrainingCriterion(
    input.criterion,
    input.criterionEvidence,
  );
  const draft: LearningEvidenceV3 = {
    id: input.id,
    version: 3,
    languageId: input.languageId,
    taskType: input.taskType,
    targetUnits: input.targetUnits,
    observations: input.observations,
    recordingQuality: input.recordingQuality,
    alignmentQuality: input.alignmentQuality,
    sampleCount: input.sampleCount,
    contextCount: input.contextCount,
    source: "training",
    confidence: "low",
    evidenceStage: "introduced",
    calibrationVersion: input.calibrationVersion,
    createdAt: input.createdAt,
    trace: { ...input.trace, aggregate: true },
  };
  if (!criterionResult.passed) return draft;
  const promotion = decideEvidencePromotion(draft, input.requestedStage);
  const confidence: EvidenceConfidence = promotion.allowed ? "medium" : "low";
  return {
    ...draft,
    confidence,
    evidenceStage: promotion.allowed
      ? promotion.nextStage
      : draft.evidenceStage,
  };
}
