import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import type {
  EvidenceTaskType,
  LearningEvidenceV3,
  LearningLanguageId,
} from "@speakright/core/evidence/types";
import type {
  TrainingCourseItem,
  TrainingLevel,
  TrainingPack,
} from "@/types/training";
import { DEFAULT_CALIBRATION_VERSION } from "./learning-evidence";

function taskTypeFor(level: TrainingLevel): EvidenceTaskType {
  if (level.kind === "minimal-pair") return "minimal-pair";
  if (level.kind === "sentence" || level.kind === "mixed-review") {
    return "sentence";
  }
  if (level.kind === "shadowing") return "connected-speech";
  return "controlled-word";
}

interface GuidedAttemptEvidenceInput {
  sessionId: string;
  languageId: LearningLanguageId;
  pack: TrainingPack;
  level: TrainingLevel;
  item: TrainingCourseItem;
  targetScore: number;
  overallScore: number;
  recordingQualityScore?: number;
  recordingQualityValid: boolean;
  alignmentValid: boolean;
  createdAt: number;
}

export function buildGuidedAttemptEvidence({
  sessionId,
  languageId,
  pack,
  level,
  item,
  targetScore,
  overallScore,
  recordingQualityScore,
  recordingQualityValid,
  alignmentValid,
  createdAt,
}: GuidedAttemptEvidenceInput): LearningEvidenceV3 {
  return buildTrainingAttemptEvidence({
    id: `${sessionId}-${level.id}-${item.id}-${createdAt}`,
    languageId,
    taskType: taskTypeFor(level),
    targetUnits:
      item.targetPhonemes.length > 0
        ? item.targetPhonemes
        : pack.targetPhonemes,
    observations: [
      {
        metric: "target-unit",
        score: targetScore,
        text: item.text,
        source: "azure",
      },
      {
        metric: "accuracy",
        score: overallScore,
        text: item.text,
        source: "azure",
      },
    ],
    recordingQuality: {
      status: recordingQualityValid ? "good" : "invalid",
      score: recordingQualityScore,
      reasons: recordingQualityValid
        ? ["Recording passed the local quality gate."]
        : ["Recording did not pass the local quality gate."],
    },
    alignmentQuality: {
      status: alignmentValid ? "good" : "invalid",
      score: alignmentValid ? targetScore : undefined,
      reasons: alignmentValid
        ? ["Azure returned target-unit alignment."]
        : ["Azure did not return target-unit alignment."],
    },
    calibrationVersion: DEFAULT_CALIBRATION_VERSION,
    createdAt,
    trace: {
      sessionId,
      levelId: level.id,
      materialIds: [item.id],
      criterionKind: level.criterion.kind,
    },
  });
}
