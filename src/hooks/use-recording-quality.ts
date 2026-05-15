"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AnalyzeRecordingQualityOptions,
  analyzeRecordingQuality,
  type RecordingQualityReport,
} from "@/lib/recording-quality";

export interface UseRecordingQualityReturn {
  report: RecordingQualityReport | null;
  isAnalyzing: boolean;
  reset: () => void;
}

export function useRecordingQuality(
  audioBlob: Blob | null,
  options: AnalyzeRecordingQualityOptions = {},
): UseRecordingQualityReturn {
  const [report, setReport] = useState<RecordingQualityReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { expectedMode, minDurationMs } = options;

  useEffect(() => {
    if (!audioBlob) {
      setReport(null);
      setIsAnalyzing(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzing(true);
    analyzeRecordingQuality(audioBlob, { expectedMode, minDurationMs })
      .then((nextReport) => {
        if (!cancelled) setReport(nextReport);
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [audioBlob, expectedMode, minDurationMs]);

  const reset = useCallback(() => {
    setReport(null);
    setIsAnalyzing(false);
  }, []);

  return useMemo(
    () => ({
      report,
      isAnalyzing,
      reset,
    }),
    [report, isAnalyzing, reset],
  );
}
