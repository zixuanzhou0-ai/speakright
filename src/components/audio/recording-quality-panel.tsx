"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  RecordingQualityIssue,
  RecordingQualityReport,
} from "@/lib/recording-quality";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function issueIcon(issue: RecordingQualityIssue) {
  if (issue.severity === "blocker") {
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  }
  if (issue.severity === "warning") {
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  }
  return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function RecordingQualityPanel({
  report,
  compact = false,
}: {
  report: RecordingQualityReport | null;
  compact?: boolean;
}) {
  if (!report) return null;

  const statusLabel = report.canSubmit
    ? report.issues.length > 0
      ? "可评分，有提示"
      : "录音质量合格"
    : "建议重录";

  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-background p-3 text-left",
        !report.canSubmit && "border-destructive/35 bg-destructive/5",
        compact && "p-2",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {report.canSubmit ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
          <p className="text-sm font-semibold">录音质量</p>
        </div>
        <Badge variant={report.canSubmit ? "secondary" : "destructive"}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">时长</p>
          <p className="mt-0.5 font-semibold">
            {formatDuration(report.durationMs)}
          </p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">峰值</p>
          <p className="mt-0.5 font-semibold">{percent(report.peak)}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <p className="text-muted-foreground">静音</p>
          <p className="mt-0.5 font-semibold">{percent(report.silentRatio)}</p>
        </div>
      </div>

      {report.issues.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {report.issues.map((issue) => (
            <div
              key={issue.code}
              className="flex items-start gap-2 rounded-md bg-muted/30 p-2 text-xs"
            >
              <span className="mt-0.5 shrink-0">{issueIcon(issue)}</span>
              <div>
                <p className="font-medium">{issue.title}</p>
                <p className="mt-0.5 text-muted-foreground">{issue.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
