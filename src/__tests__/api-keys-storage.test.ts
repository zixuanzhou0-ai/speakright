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
});
