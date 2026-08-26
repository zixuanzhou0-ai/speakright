import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_KEY_STORAGE_ERROR_EVENT,
  APP_PREFERENCE_STORAGE_KEYS,
  clearItem,
  getApiKeyPersistence,
  getApiKeySummary,
  getAzureConfig,
  getElevenLabsConfig,
  getLlmConfig,
  getMimoTtsConfig,
  getMiniMaxTtsConfig,
  getPronunciationConfig,
  getStandardTtsConfig,
  getVertexGeminiTtsConfig,
  hydrateKeys,
  setApiKeyPersistence,
  setAzureConfig,
  setElevenLabsConfig,
  setLlmConfig,
  setMimoTtsConfig,
  setMiniMaxTtsConfig,
  setPronunciationConfig,
  setStandardTtsConfig,
  setVertexGeminiTtsConfig,
  subscribeToStorage,
} from "@/lib/api-keys";

describe("browser API key storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores BYOK provider config in sessionStorage by default", async () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });

    expect(sessionStorage.getItem("speakright_azure_config")).toContain(
      "azure-key",
    );
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
    expect(getAzureConfig()).toMatchObject({
      subscriptionKey: "azure-key",
      region: "eastus",
    });

    await clearItem("speakright_azure_config");
    expect(getAzureConfig()).toBeNull();
  });

  it("moves existing API keys only after the user enables local persistence", () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });

    expect(getApiKeyPersistence()).toBe("session");

    setApiKeyPersistence("local");

    expect(localStorage.getItem("speakright_azure_config")).toContain(
      "azure-key",
    );
    expect(sessionStorage.getItem("speakright_azure_config")).toBeNull();
    expect(getApiKeyPersistence()).toBe("local");

    setApiKeyPersistence("session");

    expect(sessionStorage.getItem("speakright_azure_config")).toContain(
      "azure-key",
    );
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
  });

  it("treats MiniMax and MiMo as BYOK secrets across all five key slots", () => {
    setMiniMaxTtsConfig({
      apiKey: "mini-key",
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });
    setMimoTtsConfig({
      apiKey: "mimo-key",
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
    });

    expect(sessionStorage.getItem("speakright_minimax_tts_config")).toContain(
      "mini-key",
    );
    expect(sessionStorage.getItem("speakright_mimo_tts_config")).toContain(
      "mimo-key",
    );
    expect(localStorage.getItem("speakright_minimax_tts_config")).toBeNull();
    expect(localStorage.getItem("speakright_mimo_tts_config")).toBeNull();
    expect(getApiKeySummary()).toEqual({ configured: 2, totalSlots: 5 });
  });

  it("returns stable snapshots for saved configs", () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });
    setElevenLabsConfig({
      apiKey: "eleven-key",
      voiceId: "voice-id",
      voiceName: "Voice",
      modelId: "eleven_flash_v2_5",
    });
    setLlmConfig({
      provider: "openai",
      apiKey: "llm-key",
      baseUrl: "https://example.test/v1",
      model: "gpt-test",
    });
    setMiniMaxTtsConfig({
      apiKey: "mini-key",
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });
    setMimoTtsConfig({
      apiKey: "mimo-key",
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
    });
    setPronunciationConfig({ source: "youdao" });

    expect(getAzureConfig()).toBe(getAzureConfig());
    expect(getElevenLabsConfig()).toBe(getElevenLabsConfig());
    expect(getLlmConfig()).toBe(getLlmConfig());
    expect(getMiniMaxTtsConfig()).toBe(getMiniMaxTtsConfig());
    expect(getMimoTtsConfig()).toBe(getMimoTtsConfig());
    expect(getPronunciationConfig()).toBe(getPronunciationConfig());
  });

  it("returns a new stable snapshot after a config changes", () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });
    const previous = getAzureConfig();

    setAzureConfig({
      subscriptionKey: "azure-key-2",
      region: "westus",
    });
    const next = getAzureConfig();

    expect(next).not.toBe(previous);
    expect(next).toMatchObject({
      subscriptionKey: "azure-key-2",
      region: "westus",
    });
    expect(next).toBe(getAzureConfig());
  });

  it("keeps snapshots stable after moving key persistence", () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });

    setApiKeyPersistence("local");
    const localSnapshot = getAzureConfig();

    expect(localSnapshot).toBe(getAzureConfig());
    expect(localStorage.getItem("speakright_azure_config")).toContain(
      "azure-key",
    );
    expect(sessionStorage.getItem("speakright_azure_config")).toBeNull();

    setApiKeyPersistence("session");
    const sessionSnapshot = getAzureConfig();

    expect(sessionSnapshot).toBe(getAzureConfig());
    expect(sessionStorage.getItem("speakright_azure_config")).toContain(
      "azure-key",
    );
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
  });

  it("does not return stale cached snapshots after clearing a config", async () => {
    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });
    expect(getAzureConfig()).not.toBeNull();

    await clearItem("speakright_azure_config");

    expect(getAzureConfig()).toBeNull();
  });

  it("reports an API-key deletion failure and still tries both browser stores", async () => {
    const key = "speakright_minimax_tts_config";
    const value = JSON.stringify({ apiKey: "mini-key" });
    sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
    const listener = vi.fn();
    window.addEventListener(API_KEY_STORAGE_ERROR_EVENT, listener);
    const originalRemoveItem = Storage.prototype.removeItem;
    const removeSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(function removeItem(
        this: Storage,
        storageKey: string,
      ) {
        if (this === sessionStorage && storageKey === key) {
          throw new Error("session delete blocked");
        }
        return originalRemoveItem.call(this, storageKey);
      });

    try {
      await expect(clearItem(key)).rejects.toThrow("session delete blocked");
      expect(sessionStorage.getItem(key)).toBe(value);
      expect(localStorage.getItem(key)).toBeNull();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({ key, operation: "delete" }),
        }),
      );
    } finally {
      removeSpy.mockRestore();
      window.removeEventListener(API_KEY_STORAGE_ERROR_EVENT, listener);
    }
  });

  it("keeps non-secret browser preferences in localStorage", () => {
    expect(getPronunciationConfig()).toEqual({ source: "youdao" });

    setPronunciationConfig({ source: "youdao" });

    expect(localStorage.getItem("speakright_pronunciation_config")).toContain(
      "youdao",
    );
    expect(getPronunciationConfig()).toEqual({ source: "youdao" });
  });

  it("stores the standard TTS provider locally and falls back from invalid values", () => {
    expect(getStandardTtsConfig()).toEqual({ provider: "elevenlabs" });

    setStandardTtsConfig({ provider: "hermes-grok" });

    expect(localStorage.getItem("speakright_standard_tts_config")).toContain(
      "hermes-grok",
    );
    expect(sessionStorage.getItem("speakright_standard_tts_config")).toBeNull();
    expect(getStandardTtsConfig()).toEqual({ provider: "hermes-grok" });
    expect(APP_PREFERENCE_STORAGE_KEYS).toContain(
      "speakright_standard_tts_config",
    );

    setStandardTtsConfig({ provider: "vertex-gemini" });
    expect(getStandardTtsConfig()).toEqual({ provider: "vertex-gemini" });

    setStandardTtsConfig({ provider: "minimax" });
    expect(getStandardTtsConfig()).toEqual({ provider: "minimax" });

    setStandardTtsConfig({ provider: "mimo" });
    expect(getStandardTtsConfig()).toEqual({ provider: "mimo" });

    localStorage.setItem(
      "speakright_standard_tts_config",
      JSON.stringify({ provider: "broken" }),
    );
    expect(getStandardTtsConfig()).toEqual({ provider: "elevenlabs" });
  });

  it("stores the Vertex voice as a local non-secret preference", () => {
    expect(getVertexGeminiTtsConfig()).toEqual({ voiceName: "Kore" });

    setVertexGeminiTtsConfig({ voiceName: "Callirrhoe" });

    expect(getVertexGeminiTtsConfig()).toEqual({ voiceName: "Callirrhoe" });
    expect(getVertexGeminiTtsConfig()).toBe(getVertexGeminiTtsConfig());
    expect(
      localStorage.getItem("speakright_vertex_gemini_tts_config"),
    ).toContain("Callirrhoe");
    expect(APP_PREFERENCE_STORAGE_KEYS).toContain(
      "speakright_vertex_gemini_tts_config",
    );
  });

  it("emits storage events for browser settings readers", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToStorage(callback);

    setAzureConfig({
      subscriptionKey: "azure-key",
      region: "eastus",
    });

    expect(callback).toHaveBeenCalled();
    unsubscribe();
  });

  it("reports corrupt browser storage during hydration without blocking startup", async () => {
    const listener = vi.fn();
    window.addEventListener(API_KEY_STORAGE_ERROR_EVENT, listener);
    sessionStorage.setItem("speakright_azure_config", "{not json");

    await hydrateKeys();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          key: "speakright_azure_config",
          operation: "hydrate",
        }),
      }),
    );
    window.removeEventListener(API_KEY_STORAGE_ERROR_EVENT, listener);
  });
});
