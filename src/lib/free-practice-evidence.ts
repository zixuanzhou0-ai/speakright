import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import type { FreePracticeTransferSummary } from "@/lib/free-practice-transfer";
import { DEFAULT_CALIBRATION_VERSION } from "@/lib/learning-evidence";
import type { LanguageId } from "@/types/language";
import type { LearningEvidenceV3 } from "@/types/learning-evidence";

export function buildFreePracticeAttemptEvidence(input: {
  sessionId: string;
  languageId: LanguageId;
  summary: FreePracticeTransferSummary;
}): LearningEvidenceV3[] {
  const reliability = input.summary.assessmentReliability;
  const recordingStatus = reliability?.canPromoteMastery
    ? "good"
    : reliability?.audioQualityIssues?.length
      ? "caution"
      : "unknown";
  const alignmentStatus =
    reliability?.alignment === "good"
      ? "good"
      : reliability?.alignment === "invalid"
        ? "invalid"
        : reliability?.alignment === "caution"
          ? "caution"
          : "unknown";

  return input.summary.evidences.map((evidence, index) => ({
    ...buildTrainingAttemptEvidence({
      id: `${input.sessionId}-${evidence.packId}-${index}`,
      languageId: input.languageId,
      taskType:
        input.summary.transferLayer === "spontaneous"
          ? "spontaneous-transfer"
          : "sentence",
      targetUnits: evidence.targetPhonemes,
      observations: [
        {
          metric: "target-unit",
          score: evidence.targetScore,
          text: evidence.matchedWords.join(", ") || input.summary.text,
          source: "azure",
        },
        {
          metric: "accuracy",
          score: evidence.overallScore,
          source: "azure",
        },
      ],
      recordingQuality: {
        status: recordingStatus,
        score: reliability?.audioQualityScore,
        reasons: reliability?.audioQualityIssues ?? [],
      },
      alignmentQuality: {
        status: alignmentStatus,
        reasons: reliability?.note ? [reliability.note] : [],
      },
      calibrationVersion: DEFAULT_CALIBRATION_VERSION,
      createdAt: input.summary.generatedAt,
      trace: {
        sessionId: input.sessionId,
        levelId: evidence.levelId,
        materialIds:
          evidence.matchedWords.length > 0
            ? evidence.matchedWords
            : [input.summary.text],
        criterionKind: "free-practice-observation",
      },
    }),
    source: "free-practice" as const,
  }));
}
