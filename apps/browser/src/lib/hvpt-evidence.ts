import type { LearningEvidenceV3 } from "@speakright/core/evidence/types";
import type { HvptSummary, HvptTrial } from "./hvpt-training";
import { DEFAULT_CALIBRATION_VERSION } from "./learning-evidence";

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
  return {
    id: `${context.sessionId}-attempt-${attemptNumber}-${trial.id}`,
    version: 3,
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
    sampleCount: 1,
    contextCount: 1,
    source: "training",
    confidence: "low",
    evidenceStage: "introduced",
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt: context.createdAt,
    trace: {
      sessionId: context.sessionId,
      levelId: "perception-abx",
      materialIds: [trial.pairId, trial.probePairId],
      criterionKind: "perception",
      aggregate: false,
    },
  };
}

export function buildHvptAggregateEvidence(
  context: HvptEvidenceContext,
  trials: HvptTrial[],
  summary: HvptSummary,
): LearningEvidenceV3 {
  const materialIds = Array.from(
    new Set(trials.flatMap((trial) => [trial.pairId, trial.probePairId])),
  );
  return {
    id: `${context.sessionId}-aggregate`,
    version: 3,
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
    source: "training",
    confidence: summary.passed ? "medium" : "low",
    evidenceStage: summary.passed ? "discriminated" : "introduced",
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt: context.createdAt,
    trace: {
      sessionId: context.sessionId,
      levelId: "perception-abx",
      materialIds,
      criterionKind: "perception",
      aggregate: true,
    },
  };
}
