import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/benchmark-archive", () => ({
  clearBenchmarkRecordings: vi.fn(async () => {}),
  exportBenchmarkRecordings: vi.fn(async () => ({
    meta: [],
    audio: [],
    missingAudioIds: [],
    errors: [],
  })),
}));

vi.mock("@/lib/tts-cache", () => ({
  clearTtsCache: vi.fn(async () => {}),
}));

vi.mock("@/lib/language-audio-pack-cache", () => ({
  clearAllLanguageAudioPacks: vi.fn(async () => {}),
}));

describe("Browser Edition full local reset", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("removes current and future SpeakRight data while preserving keys on request", async () => {
    const { deleteAllLocalData } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_future_cache_v9", "temporary");
    sessionStorage.setItem("speakright_free_practice_state", "temporary");
    sessionStorage.setItem(
      "speakright_azure_config",
      '{"subscriptionKey":"session-key","region":"eastus"}',
    );

    await deleteAllLocalData({ includeApiKeys: false });

    expect(localStorage.getItem("speakright_future_cache_v9")).toBeNull();
    expect(sessionStorage.getItem("speakright_free_practice_state")).toBeNull();
    expect(sessionStorage.getItem("speakright_azure_config")).toContain(
      "session-key",
    );
  });

  it("also removes session-first BYOK values when explicitly requested", async () => {
    const { deleteAllLocalData } = await import("@/lib/data-registry");
    sessionStorage.setItem(
      "speakright_azure_config",
      '{"subscriptionKey":"session-key","region":"eastus"}',
    );
    localStorage.setItem("speakright_llm_config", '{"apiKey":"local-key"}');

    await deleteAllLocalData({ includeApiKeys: true });

    expect(sessionStorage.getItem("speakright_azure_config")).toBeNull();
    expect(localStorage.getItem("speakright_llm_config")).toBeNull();
  });
});
