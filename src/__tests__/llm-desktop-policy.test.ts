import { describe, expect, it, vi, beforeEach } from "vitest";
import { testLlm, streamLlmFeedback } from "@/lib/api-client";
import {
  DESKTOP_LLM_POLICY_MESSAGE,
  getDesktopLlmPolicyError,
  normalizeStoredProvider,
  PRESET_PROVIDERS,
  PROVIDER_NAMES,
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
      getDesktopLlmPolicyError("moonshot", "https://api.moonshot.ai/v1"),
    ).toBeNull();
    expect(
      getDesktopLlmPolicyError("moonshot", "https://api.moonshot.cn/v1"),
    ).toBeNull();
    expect(
      getDesktopLlmPolicyError("glm", "https://api.z.ai/api/paas/v4"),
    ).toBeNull();
    expect(
      getDesktopLlmPolicyError("glm", "https://open.bigmodel.cn/api/paas/v4"),
    ).toBeNull();
    expect(
      getDesktopLlmPolicyError("custom", "https://llm.example.com/v1"),
    ).toBe(DESKTOP_LLM_POLICY_MESSAGE);
    expect(
      getDesktopLlmPolicyError("minimax", "https://api.minimax.example/v1"),
    ).toBe(DESKTOP_LLM_POLICY_MESSAGE);
    expect(
      getDesktopLlmPolicyError("mimo", "https://api.mimo.example/v1"),
    ).toBe(DESKTOP_LLM_POLICY_MESSAGE);
    expect(getDesktopLlmPolicyError("gpt", "not a url")).toBe(
      DESKTOP_LLM_POLICY_MESSAGE,
    );
    expect(
      getDesktopLlmPolicyError("unknown", "https://api.openai.com/v1"),
    ).toBe(DESKTOP_LLM_POLICY_MESSAGE);
  });

  it("normalizes damaged stored provider names before rendering settings", () => {
    expect(normalizeStoredProvider("gpt")).toBe("gpt");
    expect(normalizeStoredProvider("minimax")).toBe("minimax");
    expect(normalizeStoredProvider("mimo")).toBe("mimo");
    expect(normalizeStoredProvider("custom")).toBe("custom");
    expect(normalizeStoredProvider("custom", true)).toBe("claude");
    expect(normalizeStoredProvider("unknown-provider")).toBe("claude");
  });

  it("keeps the preset registry on current stable provider chips", () => {
    expect(PROVIDER_NAMES).toEqual([
      "claude",
      "gpt",
      "gemini",
      "deepseek",
      "qwen",
      "glm",
      "moonshot",
      "doubao",
      "minimax",
      "mimo",
      "custom",
    ]);
    expect(PRESET_PROVIDERS.claude.models).toEqual([
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ]);
    expect(PRESET_PROVIDERS.gpt.models).toEqual([
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
    ]);
    expect(PRESET_PROVIDERS.gemini.models).toEqual([
      "gemini-3.5-flash",
      "gemini-3.1-pro",
      "gemini-3.1-flash-lite",
    ]);
    expect(PRESET_PROVIDERS.deepseek.models).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ]);
    expect(PRESET_PROVIDERS.qwen.models).toEqual([
      "qwen3-max",
      "qwen3.5-plus",
      "qwen3.5-flash",
    ]);
    expect(PRESET_PROVIDERS.glm).toMatchObject({
      label: "GLM / Z.ai",
      baseUrl: "https://api.z.ai/api/paas/v4",
      models: ["glm-5.1", "glm-5", "glm-5-turbo"],
    });
    expect(PRESET_PROVIDERS.moonshot).toMatchObject({
      label: "Kimi",
      baseUrl: "https://api.moonshot.ai/v1",
      models: ["kimi-k2.7-code", "kimi-k2.6", "kimi-k2.5"],
    });

    const deprecatedModels = new Set([
      "o3-mini",
      "deepseek-chat",
      "deepseek-reasoner",
      "kimi-k2-thinking",
    ]);
    const defaultModelChips = Object.values(PRESET_PROVIDERS).flatMap(
      (provider) => provider.models,
    );
    for (const model of deprecatedModels) {
      expect(defaultModelChips).not.toContain(model);
    }
  });

  it("keeps unverifiable MiniMax and MiMo endpoints out of ready presets", () => {
    for (const providerName of ["minimax", "mimo"] as const) {
      expect(PRESET_PROVIDERS[providerName]).toMatchObject({
        status: "needsManualConfig",
        baseUrl: "",
        models: [],
        baseUrlEditable: true,
      });
    }
  });

  it("keeps ready provider base URLs as OpenAI-compatible roots", () => {
    for (const [providerName, preset] of Object.entries(PRESET_PROVIDERS)) {
      if (
        providerName === "custom" ||
        preset.status === "needsManualConfig"
      ) {
        continue;
      }
      expect(preset.models.length, providerName).toBeGreaterThan(0);
      expect(preset.baseUrl, providerName).toMatch(/^https:\/\//);
      expect(preset.baseUrl, providerName).not.toMatch(
        /\/(chat\/completions|messages)\/?$/,
      );
      expect(preset.baseUrl, providerName).not.toMatch(/\/$/);
      expect(preset.docsUrl, providerName).toMatch(/^https:\/\//);
    }
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

  it("uses Anthropic Messages API for Claude tests", async () => {
    mocks.isTauriEnvironment.mockReturnValue(true);
    mocks.apiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "你好" }],
        }),
      ),
    );

    const result = await testLlm({
      apiKey: "secret",
      provider: "claude",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-6",
    });

    expect(result).toEqual({ success: true, reply: "你好" });
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "secret",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
    const request = mocks.apiFetch.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe(
      undefined,
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "claude-sonnet-4-6",
      max_tokens: 50,
      messages: [
        { role: "user", content: "Say hello in Chinese, one sentence only." },
      ],
    });
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

  it("translates Anthropic stream events into local feedback SSE chunks", async () => {
    mocks.isTauriEnvironment.mockReturnValue(true);
    mocks.apiFetch.mockResolvedValue(
      new Response(
        [
          "event: message_start",
          'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}',
          "",
          "event: content_block_delta",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"<summary>好"}}',
          "",
          "event: content_block_delta",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"</summary>"}}',
          "",
          "event: message_delta",
          'data: {"type":"message_delta","usage":{"output_tokens":8}}',
          "",
          "event: message_stop",
          'data: {"type":"message_stop"}',
          "",
        ].join("\n"),
      ),
    );

    const stream = streamLlmFeedback(
      {
        apiKey: "secret",
        provider: "claude",
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-6",
      },
      "think",
      { words: [] } as unknown as AzureAssessmentResult,
    );
    const reader = stream.getReader();
    let output = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += new TextDecoder().decode(value);
    }

    expect(output).toContain('"content":"<summary>好"');
    expect(output).toContain('"content":"</summary>"');
    expect(output).toContain(
      '"usage":{"prompt_tokens":12,"completion_tokens":1}',
    );
    expect(output).toContain(
      '"usage":{"prompt_tokens":0,"completion_tokens":8}',
    );
    expect(output).toContain("data: [DONE]");
    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
    const request = mocks.apiFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "claude-sonnet-4-6",
      stream: true,
      messages: expect.any(Array),
    });
    expect(JSON.parse(String(request.body)).stream_options).toBeUndefined();
  });
});
