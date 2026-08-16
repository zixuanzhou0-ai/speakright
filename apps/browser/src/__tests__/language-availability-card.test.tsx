import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageAvailabilityCard } from "@/components/settings/language-availability-card";

const mocks = vi.hoisted(() => ({
  azureConfig: null as { subscriptionKey: string; region: string } | null,
  elevenLabsConfig: null as { apiKey: string } | null,
  standardTtsProvider: "elevenlabs" as
    | "elevenlabs"
    | "hermes-grok"
    | "vertex-gemini",
  languageId: "fr-FR",
  llmConfig: null as { apiKey: string } | null,
  getStaticLanguageAudioPackSummary: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useAzureConfig: () => mocks.azureConfig,
  useElevenLabsConfig: () => mocks.elevenLabsConfig,
  useStandardTtsConfig: () => ({ provider: mocks.standardTtsProvider }),
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
  useLlmConfig: () => mocks.llmConfig,
}));

vi.mock("@/lib/static-language-audio-pack", () => ({
  getStaticLanguageAudioPackSummary: mocks.getStaticLanguageAudioPackSummary,
}));

describe("language availability card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.azureConfig = { subscriptionKey: "azure-key", region: "eastus" };
    mocks.elevenLabsConfig = null;
    mocks.standardTtsProvider = "elevenlabs";
    mocks.languageId = "fr-FR";
    mocks.llmConfig = null;
  });

  it("shows a pending demo-audio check instead of briefly claiming resources are missing", () => {
    mocks.getStaticLanguageAudioPackSummary.mockReturnValue(
      new Promise(() => {}),
    );

    render(<LanguageAvailabilityCard />);

    expect(screen.getByText("检查中")).toBeInTheDocument();
    expect(
      screen.getByText(/正在确认随应用提供的单词和短语示范音频/),
    ).toBeInTheDocument();
    expect(screen.getByText("实验板块")).toHaveClass("whitespace-normal");
    expect(screen.getByText("检查中")).toHaveClass("whitespace-normal");
    expect(screen.queryByText("缺失或不可读")).not.toBeInTheDocument();
    expect(screen.getByText(/不需要额外安装语言包/)).toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-smoke="language-availability-recommendation"]',
      ),
    ).not.toBeNull();
  });

  it("surfaces missing demo audio as a Chinese reinstall hint", async () => {
    mocks.getStaticLanguageAudioPackSummary.mockResolvedValue(null);

    render(<LanguageAvailabilityCard />);

    await waitFor(() => {
      expect(
        screen.getByText(/没有读到浏览器版提供的示范音频/),
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText(/静态资源已构建\/部署/).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(/反馈 Browser Edition 资源问题/),
    ).toBeInTheDocument();
  });

  it("shows user-facing bundled demo audio status once the manifest is readable", async () => {
    mocks.getStaticLanguageAudioPackSummary.mockResolvedValue({
      languageId: "fr-FR",
      itemCount: 545,
      modelId: "eleven_multilingual_v2",
      voiceName: "Clément",
      voiceSlots: ["blue", "pink"],
    });

    render(<LanguageAvailabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("内置资源可用")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/单词和短语示范已随浏览器版静态资源提供/),
    ).toBeInTheDocument();
    expect(screen.getByText(/小喇叭会保持不可点击/)).toBeInTheDocument();
    expect(
      screen.getByText(/当前公开入口为音标\/发音单位练习和自由练习/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/刻意练习和发音诊断仍在建设中/),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-smoke="language-availability-local-pack"]'),
    ).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /exact|speaker|音系清单|待补|mastery|evidenceMastery/,
    );
  });
});
