"use client";

import { getScoreBg } from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";
import { AnimatedNumber, SubScoreRow } from "./score-breakdown";
import { ScoreTrend } from "./score-trend";

interface ScoreSummaryProps {
  result: AzureAssessmentResult;
  showProsody?: boolean;
  historyKey?: string;
}

export function ScoreSummary({
  result,
  showProsody = false,
  historyKey,
}: ScoreSummaryProps) {
  return (
    <div
      className="grid grid-cols-[100px_1fr] gap-4"
      aria-live="polite"
      aria-label="发音评分结果"
    >
      {/* Total score + trend */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl p-4 text-white",
            getScoreBg(result.pronunciationScore),
          )}
        >
          <AnimatedNumber
            value={result.pronunciationScore}
            className="text-4xl font-bold tabular-nums"
          />
          <span className="mt-0.5 text-sm opacity-80">总分</span>
        </div>
        {historyKey && <ScoreTrend historyKey={historyKey} />}
      </div>

      {/* Sub-scores */}
      <div className="flex flex-col justify-center gap-2">
        <SubScoreRow score={result.accuracyScore} label="准确度" />
        <SubScoreRow score={result.fluencyScore} label="流利度" />
        <SubScoreRow score={result.completenessScore} label="完整度" />
        {showProsody && result.prosodyScore != null && (
          <SubScoreRow score={result.prosodyScore} label="韵律" />
        )}
      </div>
    </div>
  );
}
