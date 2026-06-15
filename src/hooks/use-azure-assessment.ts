"use client";

import { useCallback, useRef, useState } from "react";
import { assessPronunciation } from "@/lib/api-client";
import { getAzureConfig } from "@/lib/api-keys";
import { trackAzureUsage } from "@/lib/usage-tracker";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";

interface UseAzureAssessmentReturn {
  assess: (
    audioBlob: Blob,
    referenceText: string,
    language?: string,
  ) => Promise<AzureAssessmentResult | null>;
  result: AzureAssessmentResult | null;
  isLoading: boolean;
  error: string | null;
  getLastError: () => string | null;
  reset: () => void;
  restore: (saved: AzureAssessmentResult) => void;
}

export function useAzureAssessment(): UseAzureAssessmentReturn {
  const [result, setResult] = useState<AzureAssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);

  const setAssessmentError = useCallback((message: string | null) => {
    errorRef.current = message;
    setError(message);
  }, []);

  const assess = useCallback(async (
    audioBlob: Blob,
    referenceText: string,
    language = "en-US",
  ) => {
    const config = getAzureConfig();
    if (!config) {
      setAssessmentError(
        "请先到设置页配置 Azure Speech API 密钥和区域；配置后回到本页重新评分。",
      );
      return null;
    }

    setAssessmentError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const assessed = await assessPronunciation(
        audioBlob,
        referenceText,
        config.subscriptionKey,
        config.region,
        language,
      );
      if (!isSentence(referenceText)) {
        assessed.prosodyScore = undefined;
      }
      setResult(assessed);

      // Track usage: estimate audio duration from blob size
      // PCM 16kHz 16bit mono = 32,000 bytes/sec, minus 44 byte header
      const estimatedSeconds = Math.max(
        1,
        Math.round((audioBlob.size - 44) / 32000),
      );
      trackAzureUsage(estimatedSeconds, referenceText);

      return assessed;
    } catch (e) {
      console.error("[Azure Assessment]", e);
      const msg = e instanceof Error ? e.message : "发音评估失败";
      setAssessmentError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setAssessmentError]);

  const reset = useCallback(() => {
    setResult(null);
    setAssessmentError(null);
  }, [setAssessmentError]);

  const restore = useCallback((saved: AzureAssessmentResult) => {
    setResult(saved);
    setAssessmentError(null);
  }, [setAssessmentError]);

  const getLastError = useCallback(() => errorRef.current, []);

  return { assess, result, isLoading, error, getLastError, reset, restore };
}
