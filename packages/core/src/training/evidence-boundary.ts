import type { EvidenceStage, LearningEvidenceV3 } from "../evidence/types";

export interface PromotionDecision {
  allowed: boolean;
  nextStage: EvidenceStage;
  reasons: string[];
}

export function decideEvidencePromotion(
  evidence: LearningEvidenceV3,
  requestedStage: EvidenceStage,
): PromotionDecision {
  const reasons: string[] = [];
  const recordingIsApplicable =
    evidence.taskType !== "perception" && evidence.taskType !== "articulation";
  if (recordingIsApplicable) {
    if (evidence.recordingQuality.status !== "good") {
      reasons.push("recording-quality-not-good");
    }
    if (evidence.alignmentQuality.status !== "good") {
      reasons.push("target-alignment-not-good");
    }
  }
  if (evidence.sampleCount < 2) reasons.push("insufficient-samples");
  if (evidence.contextCount < 2 && requestedStage !== "introduced") {
    reasons.push("insufficient-contexts");
  }
  if (
    (requestedStage === "transfer_observed" ||
      requestedStage === "retention_observed") &&
    evidence.taskType !== "guided-transfer" &&
    evidence.taskType !== "spontaneous-transfer" &&
    evidence.taskType !== "delayed-retention"
  ) {
    reasons.push("invalid-task-for-transfer-or-retention");
  }

  return {
    allowed: reasons.length === 0,
    nextStage: reasons.length === 0 ? requestedStage : evidence.evidenceStage,
    reasons,
  };
}
