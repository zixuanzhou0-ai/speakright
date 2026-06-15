import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearBenchmarkRecordings: vi.fn(async () => {}),
  exportBenchmarkRecordings: vi.fn(async () => ({
    meta: [] as Array<Record<string, unknown>>,
    audio: [] as Array<Record<string, unknown>>,
    missingAudioIds: [] as string[],
    errors: [] as string[],
  })),
  clearTtsCache: vi.fn(async () => {}),
  secureStoreDelete: vi.fn(async (key: string) => {
    localStorage.removeItem(key);
  }),
  storeDelete: vi.fn(async () => {}),
  storeGet: vi.fn(async (_key: string): Promise<unknown | null> => null),
  storeSet: vi.fn(async () => {}),
}));

vi.mock("@/lib/benchmark-archive", () => ({
  clearBenchmarkRecordings: mocks.clearBenchmarkRecordings,
  exportBenchmarkRecordings: mocks.exportBenchmarkRecordings,
}));

vi.mock("@/lib/tts-cache", () => ({
  clearTtsCache: mocks.clearTtsCache,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => false,
}));

vi.mock("@/lib/secure-store", () => ({
  secureStoreDelete: mocks.secureStoreDelete,
  secureStoreGet: vi.fn(async () => null),
  secureStoreSet: vi.fn(async () => {}),
}));

vi.mock("@/lib/tauri-store", () => ({
  storeDelete: mocks.storeDelete,
  storeGet: mocks.storeGet,
  storeSet: mocks.storeSet,
}));

describe("data registry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.secureStoreDelete.mockImplementation(async (key: string) => {
      localStorage.removeItem(key);
    });
    mocks.storeGet.mockImplementation(
      async (_key: string): Promise<unknown | null> => null,
    );
  });

  it("exports learning data without API keys", async () => {
    const { buildLocalDataExport } = await import("@/lib/data-registry");
    localStorage.setItem(
      "speakright_mastery_profile_v2",
      JSON.stringify({ version: 2 }),
    );
    localStorage.setItem(
      "speakright_azure_config",
      JSON.stringify({ subscriptionKey: "secret" }),
    );

    const snapshot = await buildLocalDataExport();

    expect(snapshot.schemaVersion).toBe(4);
    expect(snapshot.dataSchema.currentVersion).toBeGreaterThanOrEqual(2);
    expect(snapshot.localStorage.speakright_mastery_profile_v2).toEqual({
      version: 2,
    });
    expect(snapshot.localStorage.speakright_azure_config).toBeUndefined();
    expect(snapshot.indexedDb.benchmarkRecordings).toEqual({
      meta: [],
      audio: [],
      missingAudioIds: [],
      errors: [],
    });
    expect(snapshot.excluded).toContain("API keys");
    expect(snapshot.excluded).not.toContain("Benchmark audio blobs");
  });

  it("exports non-secret desktop app preferences from the Tauri store", async () => {
    const { buildLocalDataExport } = await import("@/lib/data-registry");
    mocks.storeGet.mockImplementation(async (key: string) => {
      if (key === "speakright_coach_mode") {
        return "hard";
      }
      return null;
    });

    const snapshot = await buildLocalDataExport();

    expect(snapshot.appSettings).toEqual({
      speakright_coach_mode: "hard",
    });
    expect(
      snapshot.localStorage.speakright_pronunciation_config,
    ).toBeUndefined();
    expect(snapshot.localStorage.speakright_coach_mode).toBeUndefined();
  });

  it("exports benchmark audio from IndexedDB with the learning snapshot", async () => {
    const { buildLocalDataExport } = await import("@/lib/data-registry");
    mocks.exportBenchmarkRecordings.mockResolvedValueOnce({
      meta: [
        {
          id: "bench-1",
          createdAt: 1000,
          source: "spontaneous",
          title: "Transfer",
          text: "I think so.",
          score: 86,
          targetLabel: "/th/",
        },
      ],
      audio: [
        {
          id: "bench-1",
          mimeType: "audio/webm",
          bytes: 3,
          dataBase64: "YWJj",
        },
      ],
      missingAudioIds: [],
      errors: [],
    });

    const snapshot = await buildLocalDataExport();

    expect(snapshot.indexedDb.benchmarkRecordings.audio).toEqual([
      {
        id: "bench-1",
        mimeType: "audio/webm",
        bytes: 3,
        dataBase64: "YWJj",
      },
    ]);
  });

  it("exports desktop device readiness state with the learning snapshot", async () => {
    const { buildLocalDataExport } = await import("@/lib/data-registry");
    localStorage.setItem(
      "speakright_desktop_mic_check_v1",
      JSON.stringify({
        version: 1,
        passedAt: 2000,
        deviceLabel: "USB Mic",
      }),
    );

    const snapshot = await buildLocalDataExport();

    expect(snapshot.localStorage.speakright_desktop_mic_check_v1).toEqual({
      version: 1,
      passedAt: 2000,
      deviceLabel: "USB Mic",
    });
  });

  it("reports configured API keys separately from available key slots", async () => {
    const { getLocalDataSummary } = await import("@/lib/data-registry");
    localStorage.setItem(
      "speakright_azure_config",
      JSON.stringify({ subscriptionKey: "azure-secret", region: "eastus" }),
    );
    localStorage.setItem(
      "speakright_llm_config",
      JSON.stringify({
        provider: "claude",
        apiKey: "llm-secret",
        baseUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-5",
      }),
    );

    const summary = getLocalDataSummary();

    expect(summary.configuredApiKeys).toBe(2);
    expect(summary.apiKeySlots).toBe(3);
  });

  it("returns a degraded local data summary when storage reads are blocked", async () => {
    const { getLocalDataSummary, LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE } =
      await import("@/lib/data-registry");
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });

    try {
      const summary = getLocalDataSummary();

      expect(summary).toMatchObject({
        learningKeys: 0,
        cacheKeys: 0,
        configuredApiKeys: 0,
        apiKeySlots: 3,
        dataSchemaVersion: 0,
        corruptItems: 0,
        storageUnavailable: true,
      });
      expect(LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE).toContain(
        "本机数据摘要暂时无法读取",
      );
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it("deletes learning data and caches while preserving app settings and keys", async () => {
    const { deleteLearningData } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_mastery_profile_v2", "{}");
    localStorage.setItem("speakright_ipa_cache", "{}");
    localStorage.setItem("speakright_mw_words_th", "{}");
    localStorage.setItem("speakright_corrupt_data_v1", "[]");
    localStorage.setItem("speakright_azure_config", "{}");
    localStorage.setItem("theme", "dark");

    await deleteLearningData();

    expect(localStorage.getItem("speakright_mastery_profile_v2")).toBeNull();
    expect(localStorage.getItem("speakright_ipa_cache")).toBeNull();
    expect(localStorage.getItem("speakright_mw_words_th")).toBeNull();
    expect(localStorage.getItem("speakright_corrupt_data_v1")).toBeNull();
    expect(localStorage.getItem("speakright_azure_config")).toBe("{}");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(mocks.clearBenchmarkRecordings).toHaveBeenCalledOnce();
    expect(mocks.clearTtsCache).toHaveBeenCalledOnce();
  });

  it("deletes API key slots separately", async () => {
    const { deleteApiKeys } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_azure_config", "{}");
    localStorage.setItem("speakright_llm_config", "{}");

    await deleteApiKeys();

    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
    expect(localStorage.getItem("speakright_llm_config")).toBeNull();
    expect(mocks.secureStoreDelete).toHaveBeenCalledWith(
      "speakright_azure_config",
    );
    expect(mocks.secureStoreDelete).toHaveBeenCalledWith(
      "speakright_llm_config",
    );
    expect(mocks.storeDelete).not.toHaveBeenCalled();
  });

  it("reports API key delete failures and preserves the local fallback copy", async () => {
    const { deleteApiKeys } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_azure_config", '{"subscriptionKey":"x"}');
    mocks.secureStoreDelete.mockRejectedValueOnce(
      new Error("keychain delete failed"),
    );

    await expect(deleteApiKeys()).rejects.toThrow("keychain delete failed");

    expect(localStorage.getItem("speakright_azure_config")).toBe(
      '{"subscriptionKey":"x"}',
    );
  });

  it("resets all local app data while preserving API keys when requested", async () => {
    const { deleteAllLocalData } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_mastery_profile_v2", "{}");
    localStorage.setItem("speakright_desktop_mic_check_v1", "{}");
    localStorage.setItem("speakright_local_data_schema_version", "3");
    localStorage.setItem("speakright_local_data_migrated_at", "1000");
    localStorage.setItem("speakright_pronunciation_config", "{}");
    localStorage.setItem("speakright_coach_mode", '"strict"');
    localStorage.setItem("speakright_azure_config", '{"subscriptionKey":"x"}');
    localStorage.setItem("theme", "dark");

    await deleteAllLocalData({ includeApiKeys: false });

    expect(localStorage.getItem("speakright_mastery_profile_v2")).toBeNull();
    expect(localStorage.getItem("speakright_desktop_mic_check_v1")).toBeNull();
    expect(
      localStorage.getItem("speakright_local_data_schema_version"),
    ).toBeNull();
    expect(
      localStorage.getItem("speakright_local_data_migrated_at"),
    ).toBeNull();
    expect(localStorage.getItem("speakright_pronunciation_config")).toBeNull();
    expect(localStorage.getItem("speakright_coach_mode")).toBeNull();
    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("speakright_azure_config")).toBe(
      '{"subscriptionKey":"x"}',
    );
    expect(mocks.storeDelete).toHaveBeenCalledWith(
      "speakright_pronunciation_config",
    );
    expect(mocks.storeDelete).toHaveBeenCalledWith("speakright_coach_mode");
    expect(mocks.secureStoreDelete).not.toHaveBeenCalled();
  });

  it("reports app setting delete failures and clears the local fallback copy", async () => {
    const { deleteAllLocalData } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_coach_mode", '"strict"');
    mocks.storeDelete.mockRejectedValueOnce(
      new Error("settings store delete failed"),
    );

    await expect(deleteAllLocalData({ includeApiKeys: false })).rejects.toThrow(
      "settings store delete failed",
    );

    expect(localStorage.getItem("speakright_coach_mode")).toBeNull();
  });

  it("can include API keys in the full local reset", async () => {
    const { deleteAllLocalData } = await import("@/lib/data-registry");
    localStorage.setItem("speakright_azure_config", '{"subscriptionKey":"x"}');
    localStorage.setItem("speakright_elevenlabs_config", '{"apiKey":"y"}');

    await deleteAllLocalData({ includeApiKeys: true });

    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
    expect(localStorage.getItem("speakright_elevenlabs_config")).toBeNull();
    expect(mocks.secureStoreDelete).toHaveBeenCalledWith(
      "speakright_azure_config",
    );
    expect(mocks.secureStoreDelete).toHaveBeenCalledWith(
      "speakright_elevenlabs_config",
    );
  });
});
