import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import type { AzureAssessmentResult } from "@/types/azure";

const mocks = vi.hoisted(() => ({
  getLlmConfig: vi.fn(),
  streamLlmFeedback: vi.fn(),
  trackLlmUsage: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  streamLlmFeedback: mocks.streamLlmFeedback,
}));

vi.mock("@/lib/api-keys", () => ({
  getLlmConfig: mocks.getLlmConfig,
}));

vi.mock("@/lib/usage-tracker", () => ({
  trackLlmUsage: mocks.trackLlmUsage,
}));

function streamFromSse(lines: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

describe("useLlmFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLlmConfig.mockReturnValue({
      apiKey: "secret",
      provider: "gpt",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
    });
  });

  it("shows a clear settings hint when no LLM key is configured", async () => {
    mocks.getLlmConfig.mockReturnValue(null);
    const { result } = renderHook(() => useLlmFeedback());

    await act(async () => {
      await result.current.requestFeedback("think", {
        words: [],
      } as unknown as AzureAssessmentResult);
    });

    expect(result.current.error).toBe("请先在设置页面配置 LLM API 密钥");
    expect(mocks.streamLlmFeedback).not.toHaveBeenCalled();
  });

  it("surfaces SSE error chunks instead of silently finishing with no feedback", async () => {
    mocks.streamLlmFeedback.mockReturnValue(
      streamFromSse([
        'data: {"error":"LLM test failed (401): invalid key"}',
        "data: [DONE]",
      ]),
    );
    const { result } = renderHook(() => useLlmFeedback());

    await act(async () => {
      await result.current.requestFeedback("think", {
        words: [],
      } as unknown as AzureAssessmentResult);
    });

    expect(result.current.error).toBe(
      "AI 教练认证失败，请检查设置页里的 LLM API Key、Provider 和模型是否匹配。",
    );
    expect(result.current.hasFeedback).toBe(false);
    expect(result.current.isStreaming).toBe(false);
  });

  it("continues to parse content and track usage from valid SSE chunks", async () => {
    mocks.streamLlmFeedback.mockReturnValue(
      streamFromSse([
        'data: {"content":"<summary>继续练 /th/</summary>"}',
        'data: {"usage":{"prompt_tokens":12,"completion_tokens":7}}',
        "data: [DONE]",
      ]),
    );
    const { result } = renderHook(() => useLlmFeedback());

    await act(async () => {
      await result.current.requestFeedback("think", {
        words: [],
      } as unknown as AzureAssessmentResult);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.feedback.summary).toBe("继续练 /th/");
    expect(mocks.trackLlmUsage).toHaveBeenCalledWith(12, 7);
  });
});
