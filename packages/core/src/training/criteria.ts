export type TrainingCriterion =
  | {
      kind: "perception";
      minCorrectRate: number;
      minTrials: number;
      minUniquePairs: number;
      crossSpeakerRequired: boolean;
      minUniqueSpeakers?: number;
      minSpeakerPairings?: number;
    }
  | {
      kind: "motor-formation";
      minSelfChecks: number;
      minRecordedSamples: number;
      requirePlaybackComparison: boolean;
    }
  | {
      kind: "controlled-production";
      minTargetScore: number;
      minValidSamples: number;
      minPassedSamples?: number;
      requireRecordingQuality: boolean;
      requireAlignment: boolean;
      minUniqueMaterials?: number;
      requiredPositions?: readonly string[];
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
  speakerIds?: string[];
  speakerPairings?: string[];
  completedSelfChecks?: number;
  recordedSampleCount?: number;
  playbackComparisonCompleted?: boolean;
  materialIds?: string[];
  positions?: string[];
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
    if (
      criterion.minUniqueSpeakers !== undefined &&
      new Set(evidence.speakerIds ?? []).size < criterion.minUniqueSpeakers
    ) {
      blockers.push(
        `\u81f3\u5c11\u8986\u76d6 ${criterion.minUniqueSpeakers} \u540d\u4e0d\u540c\u8bf4\u8bdd\u4eba`,
      );
    }
    if (
      criterion.minSpeakerPairings !== undefined &&
      new Set(evidence.speakerPairings ?? []).size <
        criterion.minSpeakerPairings
    ) {
      blockers.push(
        `\u81f3\u5c11\u8986\u76d6 ${criterion.minSpeakerPairings} \u79cd\u8bf4\u8bdd\u4eba\u7ec4\u5408`,
      );
    }
    return { passed: blockers.length === 0, blockers };
  }

  if (criterion.kind === "motor-formation") {
    if ((evidence.completedSelfChecks ?? 0) < criterion.minSelfChecks) {
      blockers.push(
        `\u5b8c\u6210\u81f3\u5c11 ${criterion.minSelfChecks} \u9879\u52a8\u4f5c\u81ea\u68c0`,
      );
    }
    if ((evidence.recordedSampleCount ?? 0) < criterion.minRecordedSamples) {
      blockers.push(
        `\u81f3\u5c11\u5f55\u5236 ${criterion.minRecordedSamples} \u6bb5\u672c\u4eba\u6837\u672c`,
      );
    }
    if (
      criterion.requirePlaybackComparison &&
      evidence.playbackComparisonCompleted !== true
    ) {
      blockers.push(
        "\u5b8c\u6210\u4e00\u6b21\u672c\u4eba\u5f55\u97f3\u4e0e\u793a\u8303\u7684\u4ea4\u66ff\u64ad\u653e",
      );
    }
    return { passed: blockers.length === 0, blockers };
  }

  const validSamples = evidence.validSampleCount ?? 0;
  const requiredPassedSamples =
    criterion.kind === "controlled-production"
      ? (criterion.minPassedSamples ?? criterion.minValidSamples)
      : criterion.minValidSamples;
  const passedCount = evidence.passedCount ?? 0;
  if (validSamples < criterion.minValidSamples) {
    blockers.push(`至少 ${criterion.minValidSamples} 个有效样本`);
  }
  if (passedCount < requiredPassedSamples) {
    blockers.push(
      `至少 ${requiredPassedSamples} 个样本达到 ${criterion.minTargetScore} 分`,
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
    if (
      criterion.minUniqueMaterials !== undefined &&
      new Set(evidence.materialIds ?? []).size < criterion.minUniqueMaterials
    ) {
      blockers.push(
        `\u8986\u76d6\u81f3\u5c11 ${criterion.minUniqueMaterials} \u9879\u4e0d\u540c\u6750\u6599`,
      );
    }
    if (criterion.requiredPositions?.length) {
      const observedPositions = new Set(evidence.positions ?? []);
      const missingPositions = criterion.requiredPositions.filter(
        (position) => !observedPositions.has(position),
      );
      if (missingPositions.length > 0) {
        blockers.push(
          `\u8fd8\u9700\u8986\u76d6\u8fd9\u4e9b\u97f3\u4f4d\u4f4d\u7f6e\uff1a${missingPositions.join("\u3001")}`,
        );
      }
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
