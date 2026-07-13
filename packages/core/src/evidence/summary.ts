import type {
  EvidenceStage,
  LearningEvidenceV3,
  LearningLanguageId,
} from "./types";

const EVIDENCE_STAGE_ORDER: EvidenceStage[] = [
  "introduced",
  "discriminated",
  "controlled",
  "varied",
  "transfer_observed",
  "retention_observed",
];

export interface LearningEvidenceStageSummary {
  totalTargets: number;
  stageCounts: Record<EvidenceStage, number>;
  highestStageByTarget: Record<string, EvidenceStage>;
}

export function summarizeLearningEvidence(
  evidence: LearningEvidenceV3[],
  languageId: LearningLanguageId,
): LearningEvidenceStageSummary {
  const highestStageByTarget: Record<string, EvidenceStage> = {};
  for (const item of evidence) {
    if (
      item.languageId !== languageId ||
      item.recordingQuality.status === "invalid" ||
      item.alignmentQuality.status === "invalid"
    ) {
      continue;
    }
    for (const target of item.targetUnits) {
      const current = highestStageByTarget[target];
      if (
        !current ||
        EVIDENCE_STAGE_ORDER.indexOf(item.evidenceStage) >
          EVIDENCE_STAGE_ORDER.indexOf(current)
      ) {
        highestStageByTarget[target] = item.evidenceStage;
      }
    }
  }

  const stages = Object.values(highestStageByTarget);
  const stageCounts = Object.fromEntries(
    EVIDENCE_STAGE_ORDER.map((stage, index) => [
      stage,
      stages.filter((current) => EVIDENCE_STAGE_ORDER.indexOf(current) >= index)
        .length,
    ]),
  ) as Record<EvidenceStage, number>;

  return {
    totalTargets: stages.length,
    stageCounts,
    highestStageByTarget,
  };
}
