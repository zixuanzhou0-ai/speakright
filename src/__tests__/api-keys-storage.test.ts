import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const secureStore = new Map<string, unknown>();
  return {
    store,
    secureStore,
    secureStoreGet: vi.fn(async (key: string) => secureStore.get(key) ?? null),
    secureStoreSet: vi.fn(async (key: string, value: unknown) => {
      secureStore.set(key, value);
    }),
    secureStoreDelete: vi.fn(async (key: string) => {
      secureStore.delete(key);
    }),
    storeGet: vi.fn(async (key: string) => store.get(key) ?? null),
    storeSet: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    storeDelete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => true,
}));

vi.mock("@/lib/secure-store", () => ({
  secureStoreGet: mocks.secureStoreGet,
  secureStoreSet: mocks.secureStoreSet,
  secureStoreDelete: mocks.secureStoreDelete,
}));

vi.mock("@/lib/tauri-store", () => ({
  storeGet: mocks.storeGet,
  storeSet: mocks.storeSet,
  storeDelete: mocks.storeDelete,
}));

describe("api key storage in Tauri", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mocks.store.clear();
    mocks.secureStore.clear();
    vi.clearAllMocks();
  });

  it("keeps newly saved secrets out of localStorage", async () => {
    const { getAzureConfig, setAzureConfig } = await import("@/lib/api-keys");

    setAzureConfig({ subscriptionKey: "azure-secret", region: "eastus" });

    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
    expect(mocks.secureStore.get("speakright_azure_config")).toEqual({
      subscriptionKey: "azure-secret",
      region: "eastus",
    });
    expect(mocks.store.get("speakright_azure_config")).toBeUndefined();
    expect(getAzureConfig()).toEqual({
      subscriptionKey: "azure-secret",
      region: "eastus",
    });
  });

  it("stores the standard TTS provider as a non-secret preference and rejects invalid values", async () => {
    const { getStandardTtsConfig, setStandardTtsConfig } = await import(
      "@/lib/api-keys"
    );

    expect(getStandardTtsConfig()).toEqual({ provider: "elevenlabs" });
    setStandardTtsConfig({ provider: "hermes-grok" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getStandardTtsConfig()).toEqual({ provider: "hermes-grok" });
    expect(mocks.store.get("speakright_standard_tts_config")).toEqual({
      provider: "hermes-grok",
    });
    expect(
      mocks.secureStore.get("speakright_standard_tts_config"),
    ).toBeUndefined();
    expect(localStorage.getItem("speakright_standard_tts_config")).toBeNull();

    setStandardTtsConfig({ provider: "vertex-gemini" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getStandardTtsConfig()).toEqual({ provider: "vertex-gemini" });

    setStandardTtsConfig({ provider: "minimax" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getStandardTtsConfig()).toEqual({ provider: "minimax" });

    setStandardTtsConfig({ provider: "mimo" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getStandardTtsConfig()).toEqual({ provider: "mimo" });

    mocks.store.set("speakright_standard_tts_config", { provider: "broken" });
    vi.resetModules();
    const reloaded = await import("@/lib/api-keys");
    await reloaded.hydrateKeys();
    expect(reloaded.getStandardTtsConfig()).toEqual({ provider: "elevenlabs" });
  });

  it("keeps MiniMax and MiMo API keys in OS-backed secure storage", async () => {
    const {
      getApiKeySummary,
      getMimoTtsConfig,
      getMiniMaxTtsConfig,
      setMimoTtsConfig,
      setMiniMaxTtsConfig,
    } = await import("@/lib/api-keys");

    setMiniMaxTtsConfig({
      apiKey: "minimax-secret",
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });
    setMimoTtsConfig({
      apiKey: "mimo-secret",
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getMiniMaxTtsConfig()?.apiKey).toBe("minimax-secret");
    expect(getMimoTtsConfig()?.apiKey).toBe("mimo-secret");
    expect(localStorage.getItem("speakright_minimax_tts_config")).toBeNull();
    expect(localStorage.getItem("speakright_mimo_tts_config")).toBeNull();
    expect(
      mocks.secureStore.get("speakright_minimax_tts_config"),
    ).toMatchObject({
      apiKey: "minimax-secret",
    });
    expect(mocks.secureStore.get("speakright_mimo_tts_config")).toMatchObject({
      apiKey: "mimo-secret",
    });
    expect(getApiKeySummary()).toEqual({ configured: 2, totalSlots: 5 });
  });

  it("stores the Vertex voice as a non-secret preference", async () => {
    const { getVertexGeminiTtsConfig, setVertexGeminiTtsConfig } = await import(
      "@/lib/api-keys"
    );

    expect(getVertexGeminiTtsConfig()).toEqual({ voiceName: "Kore" });
    setVertexGeminiTtsConfig({ voiceName: "Aoede" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getVertexGeminiTtsConfig()).toEqual({ voiceName: "Aoede" });
    expect(getVertexGeminiTtsConfig()).toBe(getVertexGeminiTtsConfig());
    expect(mocks.store.get("speakright_vertex_gemini_tts_config")).toEqual({
      voiceName: "Aoede",
    });
    expect(
      mocks.secureStore.get("speakright_vertex_gemini_tts_config"),
    ).toBeUndefined();
  });

  it("migrates legacy localStorage secrets to store and clears the local copy", async () => {
    localStorage.setItem(
      "speakright_elevenlabs_config",
      JSON.stringify({
        apiKey: "eleven-secret",
        voiceId: "voice",
        modelId: "eleven_flash_v2_5",
      }),
    );
    const { getElevenLabsConfig, hydrateKeys } = await import("@/lib/api-keys");

    await hydrateKeys();

    expect(localStorage.getItem("speakright_elevenlabs_config")).toBeNull();
    expect(mocks.secureStore.get("speakright_elevenlabs_config")).toMatchObject(
      {
        apiKey: "eleven-secret",
        voiceId: "voice",
      },
    );
    expect(mocks.store.get("speakright_elevenlabs_config")).toBeUndefined();
    expect(getElevenLabsConfig()?.apiKey).toBe("eleven-secret");
  });

  it("migrates legacy Tauri store secrets into OS keychain storage", async () => {
    mocks.store.set("speakright_llm_config", {
      apiKey: "llm-secret",
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
    });
    const { getLlmConfig, hydrateKeys } = await import("@/lib/api-keys");

    await hydrateKeys();

    expect(mocks.secureStore.get("speakright_llm_config")).toMatchObject({
      apiKey: "llm-secret",
    });
    expect(mocks.store.get("speakright_llm_config")).toBeUndefined();
    expect(getLlmConfig()?.apiKey).toBe("llm-secret");
  });

  it("emits a visible storage error event when Tauri persistence fails", async () => {
    mocks.secureStoreSet.mockRejectedValueOnce(
      new Error("keychain unavailable"),
    );
    const events: Array<{ operation: string; message: string }> = [];
    window.addEventListener("speakright:api-key-storage-error", (event) => {
      events.push({
        operation: event.detail.operation,
        message: event.detail.message,
      });
    });
    const { setAzureConfig } = await import("@/lib/api-keys");

    setAzureConfig({ subscriptionKey: "azure-secret", region: "eastus" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([
      { operation: "save", message: "keychain unavailable" },
    ]);
  });

  it("rolls back optimistic secret cache when Tauri persistence fails", async () => {
    const { getAzureConfig, setAzureConfig } = await import("@/lib/api-keys");
    setAzureConfig({ subscriptionKey: "old-secret", region: "eastus" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.secureStoreSet.mockRejectedValueOnce(
      new Error("keychain unavailable"),
    );

    setAzureConfig({ subscriptionKey: "new-secret", region: "westus" });
    expect(getAzureConfig()).toEqual({
      subscriptionKey: "new-secret",
      region: "westus",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAzureConfig()).toEqual({
      subscriptionKey: "old-secret",
      region: "eastus",
    });
    expect(mocks.secureStore.get("speakright_azure_config")).toEqual({
      subscriptionKey: "old-secret",
      region: "eastus",
    });
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
  });

  it("emits a visible storage error event when app preference persistence fails", async () => {
    mocks.storeSet.mockRejectedValueOnce(
      new Error("settings store unavailable"),
    );
    const events: Array<{ operation: string; message: string }> = [];
    window.addEventListener("speakright:api-key-storage-error", (event) => {
      events.push({
        operation: event.detail.operation,
        message: event.detail.message,
      });
    });
    const { setCoachMode } = await import("@/lib/api-keys");

    setCoachMode("strict");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([
      { operation: "save", message: "settings store unavailable" },
    ]);
  });

  it("rolls back optimistic app preference cache when Tauri persistence fails", async () => {
    const { getCoachMode, setCoachMode } = await import("@/lib/api-keys");
    setCoachMode("normal");
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.storeSet.mockRejectedValueOnce(
      new Error("settings store unavailable"),
    );

    setCoachMode("strict");
    expect(getCoachMode()).toBe("strict");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getCoachMode()).toBe("normal");
    expect(mocks.store.get("speakright_coach_mode")).toBe("normal");
    expect(localStorage.getItem("speakright_coach_mode")).toBeNull();
  });

  it("clears desktop app preferences from the runtime cache and Tauri store", async () => {
    const {
      clearItem,
      getCoachMode,
      getPronunciationConfig,
      setCoachMode,
      setPronunciationConfig,
    } = await import("@/lib/api-keys");
    setCoachMode("strict");
    setPronunciationConfig({ source: "youdao" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await clearItem("speakright_coach_mode");
    await clearItem("speakright_pronunciation_config");

    expect(getCoachMode()).toBe("normal");
    expect(getPronunciationConfig()).toEqual({ source: "youdao" });
    expect(mocks.store.get("speakright_coach_mode")).toBeUndefined();
    expect(mocks.store.get("speakright_pronunciation_config")).toBeUndefined();
  });
});
