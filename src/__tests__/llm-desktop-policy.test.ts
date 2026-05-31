import { describe, expect, it, vi, beforeEach } from "vitest";
import { testLlm, streamLlmFeedback } from "@/lib/api-client";
import {
  DESKTOP_LLM_POLICY_MESSAGE,
  getDesktopLlmPolicyError,
} from "@/lib/llm-providers";
import type { AzureAssessmentResult } from "@/types/azure";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
}));

vi.mock("@/lib/tauri-http", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

describe("desktop LLM network policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriEnvironment.mockReturnValue(false);
  });

  it("allows preset provider origins and blocks custom desktop endpoints", () => {
    expect(
      getDesktopLlmPolicyError("gpt", "https://api.openai.com/v1"),
    ).toBeNull();
    expect(
      getDesktopLlmPolicyError("custom", "https://llm.example.com/v1"),
    ).toBe(DESKTOP_LLM_POLICY_MESSAGE);
    expect(getDesktopLlmPolicyError("gpt", "not a url")).toBe(
      DESKTOP_LLM_POLICY_MESSAGE,
    );
  });

  it("blocks custom desktop LLM tests before calling network fetch", async () => {
    mocks.isTauriEnvironment.mockReturnValue(true);

    const result = await testLlm({
      apiKey: "secret",
      provider: "custom",
      baseUrl: "https://llm.example.com/v1",
      model: "custom-model",
    });

    expect(result).toEqual({
      success: false,
      error: DESKTOP_LLM_POLICY_MESSAGE,
    });
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("keeps preset desktop LLM tests available", async () => {
    mocks.isTauriEnvironment.mockReturnValue(true);
    mocks.apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "你好" } }],
        }),
      ),
    );

    const result = await testLlm({
      apiKey: "secret",
      provider: "gpt",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5.4-mini",
    });

    expect(result).toEqual({ success: true, reply: "你好" });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns a stream error for blocked custom desktop LLM feedback", async () => {
    mocks.isTauriEnvironment.mockReturnValue(true);

    const stream = streamLlmFeedback(
      {
        apiKey: "secret",
        provider: "custom",
        baseUrl: "https://llm.example.com/v1",
        model: "custom-model",
      },
      "think",
      {} as AzureAssessmentResult,
    );
    const { value } = await stream.getReader().read();

    expect(new TextDecoder().decode(value)).toContain(
      DESKTOP_LLM_POLICY_MESSAGE,
    );
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
