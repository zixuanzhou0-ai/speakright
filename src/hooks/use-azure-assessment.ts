"use client";

import { useCallback, useState } from "react";
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
  reset: () => void;
  restore: (saved: AzureAssessmentResult) => void;
}

export function useAzureAssessment(): UseAzureAssessmentReturn {
  const [result, setResult] = useState<AzureAssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assess = useCallback(async (
    audioBlob: Blob,
    referenceText: string,
    language = "en-US",
  ) => {
    const config = getAzureConfig();
    if (!config) {
      setError("请先在设置页面配置 Azure Speech API 密钥");
      return null;
    }

    setError(null);
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
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const restore = useCallback((saved: AzureAssessmentResult) => {
    setResult(saved);
    setError(null);
  }, []);

  return { assess, result, isLoading, error, reset, restore };
}
