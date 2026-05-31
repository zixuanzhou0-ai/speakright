import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchElevenLabsUsage: vi.fn(async () => ({
    characterCount: 120,
    characterLimit: 10_000,
    nextResetUnix: Math.floor(Date.now() / 1000) + 86_400,
  })),
  secureStore: new Map<string, unknown>(),
  store: new Map<string, unknown>(),
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: () => true,
}));

vi.mock("@/lib/secure-store", () => ({
  secureStoreGet: vi.fn(async (key: string) => mocks.secureStore.get(key) ?? null),
  secureStoreSet: vi.fn(async (key: string, value: unknown) => {
    mocks.secureStore.set(key, value);
  }),
  secureStoreDelete: vi.fn(async (key: string) => {
    mocks.secureStore.delete(key);
  }),
}));

vi.mock("@/lib/tauri-store", () => ({
  storeGet: vi.fn(async (key: string) => mocks.store.get(key) ?? null),
  storeSet: vi.fn(async (key: string, value: unknown) => {
    mocks.store.set(key, value);
  }),
  storeDelete: vi.fn(async (key: string) => {
    mocks.store.delete(key);
  }),
}));

vi.mock("@/lib/api-client", () => ({
  fetchElevenLabsUsage: mocks.fetchElevenLabsUsage,
  testAzure: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("settings key hydration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.secureStore.clear();
    mocks.store.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates the Azure settings card when desktop secure-store hydration completes", async () => {
    const { AzureConfigCard } = await import(
      "@/components/settings/azure-config-card"
    );
    const { hydrateKeys, clearItem } = await import("@/lib/api-keys");
    mocks.secureStore.set("speakright_azure_config", {
      subscriptionKey: "desktop-hydrated-key",
      region: "westus",
    });

    render(<AzureConfigCard />);

    expect(screen.getByLabelText("Subscription Key")).toHaveValue("");

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Subscription Key")).toHaveValue(
        "desktop-hydrated-key",
      );
      expect(screen.getByLabelText("Region")).toHaveValue("westus");
    });
    expect(localStorage.getItem("speakright_azure_config")).toBeNull();

    await act(async () => {
      await clearItem("speakright_azure_config");
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Subscription Key")).toHaveValue("");
      expect(screen.getByLabelText("Region")).toHaveValue("eastus");
    });
  });

  it("refreshes the ElevenLabs usage card after secure-store hydration", async () => {
    const { UsageMonitor } = await import("@/components/settings/usage-monitor");
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.secureStore.set("speakright_elevenlabs_config", {
      apiKey: "eleven-hydrated-key",
      voiceId: "voice",
      modelId: "eleven_flash_v2_5",
    });

    render(<UsageMonitor />);

    expect(screen.getByText("未配置 API Key")).toBeInTheDocument();
    expect(mocks.fetchElevenLabsUsage).not.toHaveBeenCalled();

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(mocks.fetchElevenLabsUsage).toHaveBeenCalledWith(
        "eleven-hydrated-key",
      );
    });
  });

  it("updates the word pronunciation source label after store hydration", async () => {
    const { SentenceInputCard } = await import(
      "@/components/sentences/sentence-input-card"
    );
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.store.set("speakright_pronunciation_config", {
      source: "merriam-webster",
    });

    render(
      <SentenceInputCard
        sentence="hello"
        onSentenceChange={vi.fn()}
        speed={0.85}
        onSpeedChange={vi.fn()}
        isWordMode={true}
        trimmedText="hello"
        wordIpa={null}
        hasPlayedWord={false}
        mwIsPlaying={false}
        mwIsLoading={false}
        onMwPlay={vi.fn()}
        ttsIsPlaying={false}
        ttsIsLoading={false}
        ttsError={null}
        ttsWordTimings={[]}
        ttsCurrentTime={0}
        onTtsReplay={vi.fn()}
        onListen={vi.fn()}
      />,
    );

    expect(screen.getByText("单词模式 · 发音来自有道词典")).toBeInTheDocument();

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(
        screen.getByText("单词模式 · 发音来自韦氏词典"),
      ).toBeInTheDocument();
    });
  });
});
