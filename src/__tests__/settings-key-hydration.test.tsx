import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secureStore = new Map<string, unknown>();
  const store = new Map<string, unknown>();

  return {
    fetchElevenLabsUsage: vi.fn(async () => ({
      characterCount: 120,
      characterLimit: 10_000,
      nextResetUnix: Math.floor(Date.now() / 1000) + 86_400,
    })),
    secureStore,
    secureStoreDelete: vi.fn(async (key: string) => {
      secureStore.delete(key);
    }),
    store,
    storeDelete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

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
  secureStoreDelete: mocks.secureStoreDelete,
}));

vi.mock("@/lib/tauri-store", () => ({
  storeGet: vi.fn(async (key: string) => mocks.store.get(key) ?? null),
  storeSet: vi.fn(async (key: string, value: unknown) => {
    mocks.store.set(key, value);
  }),
  storeDelete: mocks.storeDelete,
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
    mocks.secureStoreDelete.mockImplementation(async (key: string) => {
      mocks.secureStore.delete(key);
    });
    mocks.storeDelete.mockImplementation(async (key: string) => {
      mocks.store.delete(key);
    });
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
  }, 30_000);

  it("refreshes the ElevenLabs usage card after secure-store hydration", async () => {
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

    expect(screen.getByText(/未配置 ElevenLabs API Key/)).toBeInTheDocument();
    expect(screen.getByText(/本地单词音频/)).toHaveAttribute(
      "data-smoke",
      "elevenlabs-usage-empty",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "未配置 ElevenLabs API Key",
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
  }, 30_000);

  it("keeps ElevenLabs usage network failures actionable in Chinese", async () => {
    const { UsageMonitor } = await import(
      "@/components/settings/usage-monitor"
    );
    const { hydrateKeys } = await import("@/lib/api-keys");
    mocks.fetchElevenLabsUsage.mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    mocks.secureStore.set("speakright_elevenlabs_config", {
      apiKey: "eleven-hydrated-key",
      voiceId: "voice",
      modelId: "eleven_flash_v2_5",
    });

    render(<UsageMonitor />);

    await act(async () => {
      await hydrateKeys();
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "ElevenLabs 用量查询失败，请检查网络、代理或 API Key 后重试",
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "本地单词音频和已内置语言包音频可继续使用",
    );
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  }, 30_000);

  it("keeps usage reset controls wrap-ready in narrow Settings cards", async () => {
    const { UsageMonitor } = await import(
      "@/components/settings/usage-monitor"
    );

    render(<UsageMonitor />);

    const resetButtons = screen.getAllByRole("button", {
      name: "重置计数",
    });

    expect(resetButtons).toHaveLength(2);
    for (const button of resetButtons) {
      expect(button).toHaveClass("h-auto");
      expect(button).toHaveClass("min-h-6");
      expect(button).toHaveClass("max-w-full");
      expect(button).toHaveClass("whitespace-normal");
      expect(button).toHaveClass("break-words");
      expect(button).toHaveClass("text-center");
      expect(button).toHaveClass("[overflow-wrap:anywhere]");
      expect(button).not.toHaveClass("whitespace-nowrap");
    }

    fireEvent.click(resetButtons[0]);

    const cancelButton = screen.getByRole("button", { name: "取消" });
    const confirmButton = screen.getByRole("button", { name: "重置" });

    for (const button of [cancelButton, confirmButton]) {
      expect(button).toHaveClass("h-auto");
      expect(button).toHaveClass("min-h-8");
      expect(button).toHaveClass("max-w-full");
      expect(button).toHaveClass("whitespace-normal");
      expect(button).not.toHaveClass("whitespace-nowrap");
    }
  });

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

    expect(
      screen.getByText("单词模式 · 本地音频优先，有道兜底"),
    ).toBeInTheDocument();

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

  it("shows actionable data privacy guidance for quarantined corrupt local data", async () => {
    const { DataControlCard } = await import(
      "@/components/settings/data-control-card"
    );
    localStorage.setItem(
      "speakright_corrupt_data_v1",
      JSON.stringify([
        {
          key: "speakright_score_history",
          raw: "{broken score history",
          reason: "Malformed JSON",
          detectedAt: new Date().toISOString(),
          schemaVersion: 2,
        },
      ]),
    );

    render(<DataControlCard />);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveAttribute(
      "data-smoke",
      "data-control-corrupt-data-warning",
    );
    expect(alert).toHaveTextContent("已隔离 1 项损坏的本机数据");
    expect(alert).toHaveTextContent("导出学习数据或诊断包");
    expect(alert).toHaveTextContent("重置本机数据");
    expect(alert).toHaveTextContent("默认不会删除 API keys");
  });

  it("keeps data privacy controls visible when the local data summary cannot be read", async () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });

    try {
      const { DataControlCard } = await import(
        "@/components/settings/data-control-card"
      );

      render(<DataControlCard />);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute(
        "data-smoke",
        "data-control-summary-warning",
      );
      expect(alert).toHaveTextContent("本机数据摘要暂时无法读取");
      expect(screen.getByText("数据与隐私中心")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "导出诊断包" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "重置本机数据" }),
      ).toBeInTheDocument();
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it("keeps data privacy action buttons wrap-ready in narrow Settings windows", async () => {
    const { DataControlCard } = await import(
      "@/components/settings/data-control-card"
    );

    render(<DataControlCard />);

    const longMainAction = screen.getByRole("button", {
      name: "清空 benchmark 音频",
    });
    expect(longMainAction).toHaveClass("h-auto");
    expect(longMainAction).toHaveClass("max-w-full");
    expect(longMainAction).toHaveClass("whitespace-normal");
    expect(longMainAction).toHaveClass("break-words");
    expect(longMainAction).toHaveClass("text-center");
    expect(longMainAction).toHaveClass("[overflow-wrap:anywhere]");
    expect(longMainAction).not.toHaveClass("whitespace-nowrap");

    fireEvent.click(longMainAction);

    const confirmAction = screen.getByRole("button", { name: "清空音频" });
    expect(confirmAction).toHaveClass("h-auto");
    expect(confirmAction).toHaveClass("max-w-full");
    expect(confirmAction).toHaveClass("whitespace-normal");
    expect(confirmAction).not.toHaveClass("whitespace-nowrap");
  });

  it("keeps data privacy delete failures visible inline", async () => {
    const { DataControlCard } = await import(
      "@/components/settings/data-control-card"
    );
    mocks.secureStoreDelete.mockRejectedValueOnce(
      new Error("keychain delete failed"),
    );

    render(<DataControlCard />);

    fireEvent.click(screen.getByRole("button", { name: "删除 API keys" }));
    const confirmButtons = screen.getAllByRole("button", {
      name: "删除 API keys",
    });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("删除 API keys 失败");
    expect(alert).toHaveTextContent("本机安全存储或设置存储不可用");
    expect(
      document.querySelector('[data-smoke="data-control-status"]'),
    ).not.toBeNull();
  });
});
