import type { DiagnosisIssue } from "@/types/diagnosis";
import type {
  MasteryProfile,
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

function isPackDue(profile: MasteryProfile | null | undefined, packId: string): boolean {
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
): TrainingPrescriptionItem | null {
  const pack = getTrainingPack(packId);
  if (!pack) return null;
  return {
    packId,
    levelId,
    reason,
    priority,
    estimatedMinutes: pack.estimatedMinutes,
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

function levelForIssue(issue: DiagnosisIssue, packId: string): string | undefined {
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
          levelForIssue(issue, packId),
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
