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
});
