import {
  buildTrainingAggregateEvidence,
  buildTrainingAttemptEvidence,
} from "@speakright/core/evidence/training";
import type { LearningEvidenceV3 } from "@speakright/core/evidence/types";
import type { TrainingCriterion } from "@speakright/core/training/criteria";
import type { HvptSummary, HvptTrial } from "./hvpt-training";
import { DEFAULT_CALIBRATION_VERSION } from "./learning-evidence";

const HVPT_CRITERION: TrainingCriterion = {
  kind: "perception",
  minCorrectRate: 0.85,
  minTrials: 8,
  minUniquePairs: 4,
  crossSpeakerRequired: true,
};

interface HvptEvidenceContext {
  sessionId: string;
  packId: string;
  targetUnits: string[];
  createdAt: number;
}

export function buildHvptAttemptEvidence(
  context: HvptEvidenceContext,
  trial: HvptTrial,
  correct: boolean,
  attemptNumber: number,
): LearningEvidenceV3 {
  return buildTrainingAttemptEvidence({
    id: `${context.sessionId}-attempt-${attemptNumber}-${trial.id}`,
    languageId: "en-US",
    taskType: "perception",
    targetUnits: context.targetUnits,
    observations: [
      {
        metric: "perception-rate",
        score: correct ? 100 : 0,
        text: `${trial.pairId}:${trial.probePairId}`,
        source: "task",
      },
    ],
    recordingQuality: {
      status: "not-applicable",
      reasons: ["Perception trials do not use learner recordings."],
    },
    alignmentQuality: {
      status: "not-applicable",
      reasons: ["Perception trials do not use speech alignment."],
    },
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt: context.createdAt,
    trace: {
      sessionId: context.sessionId,
      levelId: "perception-abx",
      materialIds: [trial.pairId, trial.probePairId],
      criterionKind: "perception",
    },
  });
}

export function buildHvptAggregateEvidence(
  context: HvptEvidenceContext,
  trials: HvptTrial[],
  summary: HvptSummary,
): LearningEvidenceV3 {
  const materialIds = Array.from(
    new Set(trials.flatMap((trial) => [trial.pairId, trial.probePairId])),
  );
  const crossSpeakerValid = trials.every(
    (trial) =>
      trial.speakerA === trial.speakerB &&
      trial.speakerA !== trial.speakerX &&
      trial.audioUriA !== trial.audioUriX &&
      trial.audioUriB !== trial.audioUriX,
  );

  return buildTrainingAggregateEvidence({
    id: `${context.sessionId}-aggregate`,
    languageId: "en-US",
    taskType: "perception",
    targetUnits: context.targetUnits,
    observations: [
      {
        metric: "perception-rate",
        score: Math.round(summary.accuracy * 100),
        text: `${summary.correct}/${summary.total}`,
        source: "task",
      },
    ],
    recordingQuality: {
      status: "not-applicable",
      reasons: ["Perception trials do not use learner recordings."],
    },
    alignmentQuality: {
      status: "not-applicable",
      reasons: ["Perception trials do not use speech alignment."],
    },
    sampleCount: summary.total,
    contextCount: new Set(trials.map((trial) => trial.pairId)).size,
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt: context.createdAt,
    trace: {
      sessionId: context.sessionId,
      levelId: "perception-abx",
      materialIds,
      criterionKind: "perception",
    },
    criterion: HVPT_CRITERION,
    criterionEvidence: {
      correctCount: summary.correct,
      totalCount: summary.total,
      uniqueContextIds: trials.map((trial) => trial.pairId),
      crossSpeakerValid,
    },
    requestedStage: "discriminated",
  });
}
