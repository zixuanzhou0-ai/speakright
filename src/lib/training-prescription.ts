import type { DiagnosisIssue } from "@/types/diagnosis";
import type {
  MasteryProfile,
  MasteryTaskLayer,
  TrainingPrescription,
  TrainingPrescriptionItem,
} from "@/types/training";
import {
  DEFAULT_RECOMMENDED_PACK_IDS,
  getTrainingPack,
} from "./training-packs";

const SEVERITY_WEIGHT: Record<DiagnosisIssue["severity"], number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

function isPackDue(
  profile: MasteryProfile | null | undefined,
  packId: string,
): boolean {
  const nextReviewAt = profile?.packs[packId]?.nextReviewAt;
  return nextReviewAt != null && nextReviewAt <= Date.now();
}

function shouldDeferMastered(
  profile: MasteryProfile | null | undefined,
  packId: string,
): boolean {
  const mastery = profile?.packs[packId];
  return mastery?.status === "mastered" && !isPackDue(profile, packId);
}

function itemForPack(
  packId: string,
  reason: string,
  priority: TrainingPrescriptionItem["priority"],
  levelId?: string,
  profile?: MasteryProfile | null,
  issue?: DiagnosisIssue,
): TrainingPrescriptionItem | null {
  const pack = getTrainingPack(packId);
  if (!pack) return null;
  const mastery = profile?.packs[packId];
  const inferredLayer = layerFromLevelId(levelId);
  const nextRequiredLayer = mastery?.nextRequiredLayer ?? inferredLayer;
  return {
    packId,
    levelId,
    reason,
    priority,
    estimatedMinutes: pack.estimatedMinutes,
    currentMasteryState:
      mastery?.masteryState ?? (issue ? "suspected" : undefined),
    stageScore: mastery?.stageScore,
    stageCeiling: mastery?.stageCeiling,
    highestLayer: mastery?.highestLayer,
    nextRequiredLayer,
    stageReason: mastery?.stateRationale,
    evidenceStrength: issue?.evidenceStrength,
    learningObjective: objectiveForLayer(nextRequiredLayer),
  };
}

function pushUnique(
  target: TrainingPrescriptionItem[],
  seen: Set<string>,
  item: TrainingPrescriptionItem | null,
) {
  if (!item || seen.has(item.packId) || target.length >= 6) return;
  seen.add(item.packId);
  target.push(item);
}

function levelFromMasteryLayer(layer: MasteryTaskLayer): string {
  switch (layer) {
    case "perception":
      return "perception-abx";
    case "articulation":
    case "isolated":
      return "articulation";
    case "word":
      return "word-ladder";
    case "sentence":
      return "sentence-ladder";
    case "connected":
    case "guided":
    case "spontaneous":
      return "shadowing-transfer";
  }
}

function layerFromLevelId(levelId?: string): MasteryTaskLayer | undefined {
  if (!levelId) return undefined;
  if (levelId.includes("perception")) return "perception";
  if (levelId.includes("articulation")) return "articulation";
  if (levelId.includes("word")) return "word";
  if (levelId.includes("sentence")) return "sentence";
  if (levelId.includes("shadowing") || levelId.includes("transfer")) {
    return "connected";
  }
  if (levelId.includes("mixed")) return "connected";
  return undefined;
}

function objectiveForLayer(layer?: MasteryTaskLayer): string | undefined {
  switch (layer) {
    case "isolated":
      return "先把单音和关键发音动作做稳，不急着追求句子速度。";
    case "perception":
      return "先听出目标差异，避免靠拼写和猜测进入发音练习。";
    case "articulation":
      return "建立一个可重复的口腔动作，让下一次尝试只改一个动作。";
    case "word":
      return "把动作放进真实单词，重点看目标音素是否保住。";
    case "sentence":
      return "把目标音放进短句，检查一有语速和重音负荷是否会掉。";
    case "connected":
      return "进入自然语流，在弱读、连读和停顿中保持清晰度。";
    case "guided":
      return "用半开放回答做迁移，开始脱离逐字朗读。";
    case "spontaneous":
      return "在自由表达里复测，不提醒时也要保住这个目标。";
  }
}

function levelForIssue(
  issue: DiagnosisIssue,
  packId: string,
  profile?: MasteryProfile | null,
): string | undefined {
  const nextLayer = profile?.packs[packId]?.nextRequiredLayer;
  if (nextLayer) return levelFromMasteryLayer(nextLayer);
  if (issue.nextLesson?.packId === packId) return issue.nextLesson.levelId;
  if (issue.type === "contrast") return "perception-abx";
  if (
    issue.type === "rhythm" ||
    issue.type === "stress" ||
    issue.type === "connected-speech"
  ) {
    return "shadowing-transfer";
  }
  if (issue.type === "final-consonant") return "word-ladder";
  return "articulation";
}

function dueReviewLevel(
  profile: MasteryProfile | null | undefined,
  packId: string,
): string | undefined {
  const nextLayer = profile?.packs[packId]?.nextRequiredLayer;
  if (nextLayer) return levelFromMasteryLayer(nextLayer);
  const recentSession = profile?.sessions.find(
    (session) => session.packId === packId && session.recommendedNextLevelId,
  );
  return recentSession?.recommendedNextLevelId ?? "mixed-review";
}

export function buildTrainingPrescription(
  issues: DiagnosisIssue[],
  source: TrainingPrescription["source"] = "diagnosis",
  profile?: MasteryProfile | null,
): TrainingPrescription {
  const generatedAt = Date.now();
  const sorted = [...issues].sort((a, b) => {
    const severity = SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity];
    if (severity !== 0) return severity;
    return b.evidence.length - a.evidence.length;
  });
  const selected: TrainingPrescriptionItem[] = [];
  const seen = new Set<string>();

  for (const issue of sorted) {
    for (const packId of issue.recommendedPackIds) {
      if (shouldDeferMastered(profile, packId)) continue;
      pushUnique(
        selected,
        seen,
        itemForPack(
          packId,
          `${issue.title}：${issue.impact}`,
          issue.severity === "critical" ? "critical" : "major",
          levelForIssue(issue, packId, profile),
          profile,
          issue,
        ),
      );
    }
  }

  if (profile) {
    for (const [packId, mastery] of Object.entries(profile.packs)) {
      if (mastery.status === "mastered" && isPackDue(profile, packId)) {
        pushUnique(
          selected,
          seen,
          itemForPack(
            packId,
            "已掌握内容到期复习，防止回到旧习惯",
            "maintenance",
            dueReviewLevel(profile, packId),
            profile,
          ),
        );
      }
    }
  }

  if (selected.length === 0) {
    for (const packId of DEFAULT_RECOMMENDED_PACK_IDS) {
      if (shouldDeferMastered(profile, packId)) continue;
      pushUnique(
        selected,
        seen,
        itemForPack(
          packId,
          "中国学习者高频问题，适合作为默认训练起点",
          "maintenance",
          "perception-abx",
          profile,
        ),
      );
    }
  }

  const day1 = selected.slice(0, 2);
  const day2 = selected.slice(2, 4);
  const day3 = selected.slice(4, 6);
  const review = selected.slice(0, 2).map((item) => ({
    ...item,
    priority: "maintenance" as const,
    reason: `复习巩固：${item.reason}`,
  }));

  return {
    generatedAt,
    source,
    days: [
      { day: 1, title: "今天：先处理最影响清晰度的问题", items: day1 },
      {
        day: 2,
        title: "第 2 天：扩大到相邻易混音和词尾",
        items: day2.length > 0 ? day2 : day1,
      },
      {
        day: 3,
        title: "第 3 天：放进句子和节奏里复测",
        items: day3.length > 0 ? day3 : review,
      },
      {
        day: 7,
        title: "第 7 天：间隔复习，防止回到旧习惯",
        items: review,
      },
    ],
  };
}

export function buildDefaultPrescription(): TrainingPrescription {
  return buildTrainingPrescription([], "default");
}
