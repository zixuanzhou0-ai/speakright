import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";

const mocks = vi.hoisted(() => ({
  assessPronunciation: vi.fn(),
  getAzureConfig: vi.fn(),
  trackAzureUsage: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  assessPronunciation: mocks.assessPronunciation,
}));

vi.mock("@/lib/api-keys", () => ({
  getAzureConfig: mocks.getAzureConfig,
}));

vi.mock("@/lib/usage-tracker", () => ({
  trackAzureUsage: mocks.trackAzureUsage,
}));

describe("useAzureAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAzureConfig.mockReturnValue({
      subscriptionKey: "azure-key",
      region: "eastus",
    });
    mocks.assessPronunciation.mockResolvedValue({
      pronunciationScore: 90,
      accuracyScore: 90,
      fluencyScore: 90,
      completenessScore: 90,
      words: [],
    });
  });

  it("passes the selected Azure locale to pronunciation assessment", async () => {
    const { result } = renderHook(() => useAzureAssessment());
    const audio = new Blob([new Uint8Array(32044)], { type: "audio/wav" });

    await act(async () => {
      await result.current.assess(audio, "bonjour", "fr-FR");
    });

    expect(mocks.assessPronunciation).toHaveBeenCalledWith(
      audio,
      "bonjour",
      "azure-key",
      "eastus",
      "fr-FR",
    );
  });

  it("defaults to en-US when no locale is provided", async () => {
    const { result } = renderHook(() => useAzureAssessment());
    const audio = new Blob([new Uint8Array(32044)], { type: "audio/wav" });

    await act(async () => {
      await result.current.assess(audio, "hello");
    });

    expect(mocks.assessPronunciation).toHaveBeenCalledWith(
      audio,
      "hello",
      "azure-key",
      "eastus",
      "en-US",
    );
  });

  it("keeps the latest failure reason available in the same async turn", async () => {
    const { result } = renderHook(() => useAzureAssessment());
    const audio = new Blob([new Uint8Array(32044)], { type: "audio/wav" });
    mocks.assessPronunciation.mockRejectedValueOnce(
      new Error("无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。"),
    );

    await act(async () => {
      await result.current.assess(audio, "hello");
    });

    expect(result.current.getLastError()).toBe(
      "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    );
    expect(result.current.error).toBe(
      "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    );
  });

  it("normalizes raw English Azure failures before exposing them", async () => {
    const { result } = renderHook(() => useAzureAssessment());
    const audio = new Blob([new Uint8Array(32044)], { type: "audio/wav" });
    mocks.assessPronunciation.mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    await act(async () => {
      await result.current.assess(audio, "hello");
    });

    expect(result.current.getLastError()).toBe(
      "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    );
    expect(result.current.error).not.toContain("Failed to fetch");
  });

  it("exposes the missing-key message before React rerenders the caller", async () => {
    const { result } = renderHook(() => useAzureAssessment());
    const audio = new Blob([new Uint8Array(32044)], { type: "audio/wav" });
    mocks.getAzureConfig.mockReturnValueOnce(null);
    let sameTurnError: string | null = null;

    await act(async () => {
      await result.current.assess(audio, "hello");
      sameTurnError = result.current.getLastError();
    });

    expect(sameTurnError).toBe(
      "请先到设置页配置 Azure Speech API 密钥和区域；配置后回到本页重新评分。",
    );
    expect(mocks.assessPronunciation).not.toHaveBeenCalled();
  });
});
