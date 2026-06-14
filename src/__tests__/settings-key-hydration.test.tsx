import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  secureStoreGet: vi.fn(
    async (key: string) => mocks.secureStore.get(key) ?? null,
  ),
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

  it(
    "updates the Azure settings card when desktop secure-store hydration completes",
    async () => {
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
    },
    30_000,
  );

  it(
    "refreshes the ElevenLabs usage card after secure-store hydration",
    async () => {
      const { UsageMonitor } = await import(
        "@/components/settings/usage-monitor"
      );
      const { hydrateKeys } = await import("@/lib/api-keys");
      mocks.secureStore.set("speakright_elevenlabs_config", {
        apiKey: "eleven-hydrated-key",
        voiceId: "voice",
        modelId: "eleven_flash_v2_5",
      });

      render(<UsageMonitor />);

      expect(
        screen.getByText(/未配置 ElevenLabs API Key/),
      ).toBeInTheDocument();
      expect(screen.getByText(/本地单词音频/)).toHaveAttribute(
        "data-smoke",
        "elevenlabs-usage-empty",
      );
      expect(mocks.fetchElevenLabsUsage).not.toHaveBeenCalled();

      await act(async () => {
        await hydrateKeys();
      });

      await waitFor(() => {
        expect(mocks.fetchElevenLabsUsage).toHaveBeenCalledWith(
          "eleven-hydrated-key",
        );
      });
    },
    30_000,
  );

  it("keeps the word pronunciation label fixed after legacy source hydration", async () => {
    const { SentenceInputCard } = await import(
      "@/components/sentences/sentence-input-card"
    );
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.store.set("speakright_pronunciation_config", {
      source: "legacy-source",
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
        wordAudioIsPlaying={false}
        wordAudioIsLoading={false}
        onWordAudioPlay={vi.fn()}
        ttsIsPlaying={false}
        ttsIsLoading={false}
        ttsError={null}
        ttsWordTimings={[]}
        ttsCurrentTime={0}
        onTtsReplay={vi.fn()}
        onListen={vi.fn()}
      />,
    );

    expect(screen.getByText("单词模式 · 本地音频优先，有道兜底")).toBeInTheDocument();

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(
        screen.getByText("单词模式 · 本地音频优先，有道兜底"),
      ).toBeInTheDocument();
    });
  }, 30_000);

  it("shows free-practice word audio failures inline", async () => {
    const { SentenceInputCard } = await import(
      "@/components/sentences/sentence-input-card"
    );

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
        wordAudioIsPlaying={false}
        wordAudioIsLoading={false}
        wordAudioError="在线发音兜底失败，请检查网络后重试。"
        onWordAudioPlay={vi.fn()}
        ttsIsPlaying={false}
        ttsIsLoading={false}
        ttsError={null}
        ttsWordTimings={[]}
        ttsCurrentTime={0}
        onTtsReplay={vi.fn()}
        onListen={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("在线发音兜底失败，请检查网络后重试。");
    expect(alert).toHaveAttribute(
      "data-smoke",
      "free-practice-word-audio-error",
    );
  });

  it("updates the coach mode card after store hydration", async () => {
    const { CoachModeCard } = await import(
      "@/components/settings/coach-mode-card"
    );
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.store.set("speakright_coach_mode", "strict");

    render(<CoachModeCard />);

    expect(screen.getByRole("button", { name: /正常/ })).toHaveClass(
      "border-primary",
    );

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /严师/ })).toHaveClass(
        "border-primary",
      );
    });
  });

  it("updates drill config pass threshold after coach mode hydration", async () => {
    const { DrillConfig } = await import("@/components/drill/drill-config");
    const { hydrateKeys } = await import("@/lib/api-keys");
    const onStart = vi.fn();
    mocks.store.set("speakright_coach_mode", "strict");

    render(<DrillConfig kind="word" onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: /see/ }));

    expect(screen.getByText(/达标分数：70 分/)).toBeInTheDocument();

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByText(/达标分数：85 分/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "开始训练" }));

    expect(onStart).toHaveBeenCalledWith("ee", 10, 85);
  });

  it("updates the data privacy summary after desktop key hydration", async () => {
    const { DataControlCard } = await import(
      "@/components/settings/data-control-card"
    );
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.secureStore.set("speakright_azure_config", {
      subscriptionKey: "desktop-azure-key",
      region: "eastus",
    });
    mocks.secureStore.set("speakright_llm_config", {
      provider: "claude",
      apiKey: "desktop-llm-key",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-sonnet-4-5",
    });

    render(<DataControlCard />);

    expect(screen.getByText("已配置密钥")).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByText("2/3")).toBeInTheDocument();
    });
  });
});
