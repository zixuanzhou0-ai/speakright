import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import type { LearningEvidenceV3 } from "@speakright/core/evidence/types";
import type { PerceptionTrial } from "@speakright/core/training/perception";
import type { TrainingPack } from "@/types/training";
import { DEFAULT_CALIBRATION_VERSION } from "./learning-evidence";

interface PerceptionAttemptEvidenceInput {
  sessionId: string;
  pack: TrainingPack;
  levelId: string;
  trial: PerceptionTrial;
  correct: boolean;
  attemptNumber: number;
  createdAt: number;
}

export function buildPerceptionAttemptEvidence({
  sessionId,
  pack,
  levelId,
  trial,
  correct,
  attemptNumber,
  createdAt,
}: PerceptionAttemptEvidenceInput): LearningEvidenceV3 {
  return buildTrainingAttemptEvidence({
    id: `${sessionId}-${levelId}-${trial.id}-${attemptNumber}`,
    languageId: "en-US",
    taskType: "perception",
    targetUnits: pack.targetPhonemes,
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
      reasons: ["This perception task does not use learner recording quality."],
    },
    alignmentQuality: {
      status: "not-applicable",
      reasons: ["This perception task does not use speech alignment."],
    },
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt,
    trace: {
      sessionId,
      levelId,
      materialIds: [trial.pairId, trial.probePairId],
      criterionKind: "perception",
    },
  });
}
