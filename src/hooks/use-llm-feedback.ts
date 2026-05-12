"use client";

import { useCallback, useRef, useState } from "react";
import { streamLlmFeedback } from "@/lib/api-client";
import { getLlmConfig } from "@/lib/api-keys";
import { trackLlmUsage } from "@/lib/usage-tracker";
import type { AzureAssessmentResult } from "@/types/azure";

export interface FeedbackData {
  summary: string;
  topIssues: string;
  priorityFixes: string;
  dimensions: string;
  details: string;
}

const EMPTY_FEEDBACK: FeedbackData = {
  summary: "",
  topIssues: "",
  priorityFixes: "",
  dimensions: "",
  details: "",
};

function parseFeedback(raw: string, streaming: boolean): FeedbackData {
  const extract = (tag: string): string => {
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;
    const startIdx = raw.indexOf(openTag);
    if (startIdx === -1) return "";
    const contentStart = startIdx + openTag.length;
    const endIdx = raw.indexOf(closeTag, contentStart);
    if (endIdx === -1) {
      // Tag not closed yet (streaming) — return partial content
      return raw.slice(contentStart).trim();
    }
    return raw.slice(contentStart, endIdx).trim();
  };

  const result = {
    summary: extract("summary"),
    topIssues: extract("top_issues"),
    priorityFixes: extract("priority_fixes"),
    dimensions: extract("dimensions"),
    details: extract("details"),
  };

  // Fallback: if streaming is done and no XML tags were found, treat raw text as summary
  if (
    !streaming &&
    raw.trim().length > 0 &&
    !result.summary &&
    !result.topIssues &&
    !result.priorityFixes &&
    !result.dimensions &&
    !result.details
  ) {
    return { ...EMPTY_FEEDBACK, summary: raw.trim() };
  }

  return result;
}

interface UseLlmFeedbackReturn {
  requestFeedback: (
    target: string,
    azureResult: AzureAssessmentResult,
    mode?: "phoneme" | "sentence",
  ) => Promise<void>;
  feedback: FeedbackData;
  hasFeedback: boolean;
  isStreaming: boolean;
  error: string | null;
  reset: () => void;
  restore: (saved: FeedbackData) => void;
}

export function useLlmFeedback(): UseLlmFeedbackReturn {
  const [feedback, setFeedback] = useState<FeedbackData>(EMPTY_FEEDBACK);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  const hasFeedback =
    feedback.summary.length > 0 ||
    feedback.topIssues.length > 0 ||
    feedback.priorityFixes.length > 0 ||
    feedback.dimensions.length > 0 ||
    feedback.details.length > 0;

  const reset = useCallback(() => {
    // Abort any in-flight SSE stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setFeedback(EMPTY_FEEDBACK);
    setIsStreaming(false);
    setError(null);
    accRef.current = "";
  }, []);

  const requestFeedback = useCallback(
    async (
      target: string,
      azureResult: AzureAssessmentResult,
      mode: "phoneme" | "sentence" = "phoneme",
    ) => {
      const config = getLlmConfig();
      if (!config) {
        setError("请先在设置页面配置 LLM API 密钥");
        return;
      }

      reset();
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const stream = streamLlmFeedback(
          config,
          target,
          azureResult,
          mode,
          controller.signal,
        );
        const reader = stream.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accRef.current += parsed.content;
                setFeedback(parseFeedback(accRef.current, true));
              }
              if (parsed.usage) {
                trackLlmUsage(
                  parsed.usage.prompt_tokens ?? 0,
                  parsed.usage.completion_tokens ?? 0,
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Final parse with streaming=false for fallback handling
        if (accRef.current) {
          setFeedback(parseFeedback(accRef.current, false));
        }
      } catch (e) {
        // AbortError is expected when user starts a new recording — don't show error
        if (e instanceof DOMException && e.name === "AbortError") return;
        console.error("[LLM Feedback]", e);
        setError(e instanceof Error ? e.message : "AI 反馈生成失败");
      } finally {
        setIsStreaming(false);
      }
    },
    [reset],
  );

  const restore = useCallback((saved: FeedbackData) => {
    setFeedback(saved);
    setError(null);
  }, []);

  return {
    requestFeedback,
    feedback,
    hasFeedback,
    isStreaming,
    error,
    reset,
    restore,
  };
}
