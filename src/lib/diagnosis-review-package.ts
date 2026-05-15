import type {
  DiagnosisIssue,
  DiagnosisReport,
  EvidenceStrength,
} from "@/types/diagnosis";

export interface DiagnosisReviewItem {
  issueId: string;
  title: string;
  reason: string;
  evidenceStrength: EvidenceStrength | "unknown";
  confidence: "low" | "medium" | "high" | "unknown";
  suggestedAction: "retest" | "coach-review" | "train-with-caution";
  recommendedPackIds: string[];
}

export interface DiagnosisReviewPackage {
  createdAt: number;
  totalIssues: number;
  reviewItems: DiagnosisReviewItem[];
  summary: string;
}

function actionForIssue(
  issue: DiagnosisIssue,
): DiagnosisReviewItem["suggestedAction"] {
  if (issue.confidence === "low" || issue.evidenceStrength === "thin") {
    return "retest";
  }
  if (issue.confidence === "medium" || issue.evidenceStrength === "fair") {
    return "train-with-caution";
  }
  return "coach-review";
}

function reasonForIssue(issue: DiagnosisIssue): string {
  if (issue.confidence === "low") {
    return "模型信号不够稳定，建议补测后再作为核心弱点。";
  }
  if (issue.evidenceStrength === "thin") {
    return "证据样本偏少，先补 2-4 个同类词。";
  }
  if (issue.evidenceStrength === "fair") {
    return "可以训练，但报告措辞应保守，不要当成绝对结论。";
  }
  return "证据较强；如果用户主观听感冲突，可进入教练复核。";
}

export function buildDiagnosisReviewPackage(
  report: DiagnosisReport,
): DiagnosisReviewPackage {
  const reviewItems = report.issues
    .filter(
      (issue) =>
        issue.confidence !== "high" ||
        issue.evidenceStrength === "thin" ||
        issue.evidenceStrength === "fair",
    )
    .map(
      (issue): DiagnosisReviewItem => ({
        issueId: issue.id,
        title: issue.title,
        reason: reasonForIssue(issue),
        evidenceStrength: issue.evidenceStrength ?? "unknown",
        confidence: issue.confidence ?? "unknown",
        suggestedAction: actionForIssue(issue),
        recommendedPackIds: issue.recommendedPackIds,
      }),
    );

  const weakCount = reviewItems.filter(
    (item) => item.suggestedAction === "retest",
  ).length;

  return {
    createdAt: Date.now(),
    totalIssues: report.issues.length,
    reviewItems,
    summary:
      weakCount > 0
        ? `${weakCount} 个结论需要先补测；其余可以低风险进入训练。`
        : "没有明显低置信度诊断；可以按处方训练。",
  };
}
