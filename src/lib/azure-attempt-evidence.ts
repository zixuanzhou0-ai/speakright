import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import { DEFAULT_CALIBRATION_VERSION } from "@/lib/learning-evidence";
import type { AzureAssessmentResult } from "@/types/azure";
import type { LanguageId } from "@/types/language";
import type {
  EvidenceTaskType,
  LearningEvidenceV3,
} from "@/types/learning-evidence";

export function buildAzureAttemptEvidence(input: {
  id: string;
  sessionId: string;
  languageId: LanguageId;
  taskType: EvidenceTaskType;
  targetUnits: string[];
  materialIds: string[];
  result: AzureAssessmentResult;
  targetScore?: number;
  levelId?: string;
  recordingQuality?: {
    valid: boolean;
    score?: number;
    reasons?: string[];
  };
  alignmentValid: boolean;
  source?: LearningEvidenceV3["source"];
  createdAt?: number;
}): LearningEvidenceV3 {
  const createdAt = input.createdAt ?? Date.now();
  return {
    ...buildTrainingAttemptEvidence({
      id: input.id,
      languageId: input.languageId,
      taskType: input.taskType,
      targetUnits: input.targetUnits,
      observations: [
        ...(input.targetScore === undefined
          ? []
          : [
              {
                metric: "target-unit" as const,
                score: input.targetScore,
                source: "azure" as const,
              },
            ]),
        {
          metric: "accuracy",
          score: input.result.accuracyScore,
          source: "azure",
        },
        {
          metric: "fluency",
          score: input.result.fluencyScore,
          source: "azure",
        },
      ],
      recordingQuality: input.recordingQuality
        ? {
            status: input.recordingQuality.valid ? "good" : "caution",
            score: input.recordingQuality.score,
            reasons: input.recordingQuality.reasons ?? [],
          }
        : {
            status: "unknown",
            reasons: ["No calibrated recording-quality result was available."],
          },
      alignmentQuality: {
        status: input.alignmentValid ? "good" : "invalid",
        reasons: [
          input.alignmentValid
            ? "Azure returned usable alignment for this task."
            : "The target unit was not aligned; overall score cannot replace it.",
        ],
      },
      calibrationVersion: DEFAULT_CALIBRATION_VERSION,
      createdAt,
      trace: {
        sessionId: input.sessionId,
        levelId: input.levelId,
        materialIds: input.materialIds,
        criterionKind: "single-azure-observation",
      },
    }),
    source: input.source ?? "training",
  };
}
