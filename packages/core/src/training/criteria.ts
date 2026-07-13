export type TrainingCriterion =
  | {
      kind: "perception";
      minCorrectRate: number;
      minTrials: number;
      minUniquePairs: number;
      crossSpeakerRequired: boolean;
    }
  | {
      kind: "controlled-production";
      minTargetScore: number;
      minValidSamples: number;
      requireRecordingQuality: boolean;
      requireAlignment: boolean;
    }
  | {
      kind: "transfer";
      minTargetScore: number;
      minValidSamples: number;
      minContexts: number;
      requireUntrainedMaterial: boolean;
    }
  | {
      kind: "retention";
      minTargetScore: number;
      minValidSamples: number;
      minContexts: number;
      minDelayHours: number;
      requireUntrainedMaterial: true;
    };

export interface TrainingCriterionEvidence {
  correctCount?: number;
  totalCount?: number;
  uniqueContextIds?: string[];
  crossSpeakerValid?: boolean;
  passedCount?: number;
  validSampleCount?: number;
  contextCount?: number;
  recordingQualityValid?: boolean;
  alignmentValid?: boolean;
  untrainedMaterial?: boolean;
  delayHours?: number;
}

export interface TrainingCriterionResult {
  passed: boolean;
  blockers: string[];
}

export function evaluateTrainingCriterion(
  criterion: TrainingCriterion,
  evidence: TrainingCriterionEvidence,
): TrainingCriterionResult {
  const blockers: string[] = [];

  if (criterion.kind === "perception") {
    const total = evidence.totalCount ?? 0;
    const correct = evidence.correctCount ?? 0;
    const uniquePairs = new Set(evidence.uniqueContextIds ?? []).size;
    if (total < criterion.minTrials) {
      blockers.push(`至少完成 ${criterion.minTrials} 次听辨`);
    }
    if (total === 0 || correct / total < criterion.minCorrectRate) {
      blockers.push(
        `听辨正确率达到 ${Math.round(criterion.minCorrectRate * 100)}%`,
      );
    }
    if (uniquePairs < criterion.minUniquePairs) {
      blockers.push(`覆盖至少 ${criterion.minUniquePairs} 组不同对比`);
    }
    if (criterion.crossSpeakerRequired && evidence.crossSpeakerValid !== true) {
      blockers.push("A/B 与 X 必须使用不同说话人");
    }
    return { passed: blockers.length === 0, blockers };
  }

  const validSamples = evidence.validSampleCount ?? 0;
  const passedCount = evidence.passedCount ?? 0;
  if (validSamples < criterion.minValidSamples) {
    blockers.push(`至少 ${criterion.minValidSamples} 个有效样本`);
  }
  if (passedCount < criterion.minValidSamples) {
    blockers.push(
      `至少 ${criterion.minValidSamples} 个样本达到 ${criterion.minTargetScore} 分`,
    );
  }

  if (criterion.kind === "controlled-production") {
    if (
      criterion.requireRecordingQuality &&
      evidence.recordingQualityValid !== true
    ) {
      blockers.push("录音质量必须合格");
    }
    if (criterion.requireAlignment && evidence.alignmentValid !== true) {
      blockers.push("目标音必须成功对齐");
    }
    return { passed: blockers.length === 0, blockers };
  }

  if ((evidence.contextCount ?? 0) < criterion.minContexts) {
    blockers.push(`覆盖至少 ${criterion.minContexts} 个不同语境`);
  }
  if (
    criterion.requireUntrainedMaterial &&
    evidence.untrainedMaterial !== true
  ) {
    blockers.push("必须包含未训练材料");
  }
  if (
    criterion.kind === "retention" &&
    (evidence.delayHours ?? 0) < criterion.minDelayHours
  ) {
    blockers.push(`复测至少间隔 ${criterion.minDelayHours} 小时`);
  }

  return { passed: blockers.length === 0, blockers };
}
