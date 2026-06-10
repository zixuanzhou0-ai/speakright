import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  tauri: true,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => mocks.tauri,
}));

describe("secure store", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mocks.invoke.mockReset();
    mocks.tauri = true;
  });

  it("stores desktop secrets through Tauri keychain commands", async () => {
    const { secureStoreSet } = await import("@/lib/secure-store");

    await secureStoreSet("speakright_azure_config", {
      subscriptionKey: "secret",
      region: "eastus",
    });

    expect(mocks.invoke).toHaveBeenCalledWith("secure_store_set", {
      key: "speakright_azure_config",
      value: JSON.stringify({
        subscriptionKey: "secret",
        region: "eastus",
      }),
    });
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();
  });

  it("parses desktop secrets returned by the Tauri keychain command", async () => {
    mocks.invoke.mockResolvedValueOnce(
      JSON.stringify({ apiKey: "secret", voiceId: "voice" }),
    );
    const { secureStoreGet } = await import("@/lib/secure-store");

    await expect(
      secureStoreGet("speakright_elevenlabs_config"),
    ).resolves.toEqual({
      apiKey: "secret",
      voiceId: "voice",
    });
  });

  it("reports corrupted desktop keychain values instead of treating them as missing", async () => {
    mocks.invoke.mockResolvedValueOnce("not-json");
    const { secureStoreGet } = await import("@/lib/secure-store");

    await expect(secureStoreGet("speakright_llm_config")).rejects.toThrow(
      "Secure store value for speakright_llm_config is not valid JSON",
    );
  });

  it("keeps browser dev fallback in localStorage only outside Tauri", async () => {
    mocks.tauri = false;
    const { secureStoreGet, secureStoreSet } = await import(
      "@/lib/secure-store"
    );

    await secureStoreSet("speakright_llm_config", {
      provider: "openai",
      apiKey: "dev-secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(localStorage.getItem("speakright_llm_config")).toContain(
      "dev-secret",
    );
    await expect(secureStoreGet("speakright_llm_config")).resolves.toMatchObject(
      { apiKey: "dev-secret" },
    );
  });
});
