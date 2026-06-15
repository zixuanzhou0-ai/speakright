import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageAvailabilityCard } from "@/components/settings/language-availability-card";

const mocks = vi.hoisted(() => ({
  azureConfig: null as { subscriptionKey: string; region: string } | null,
  elevenLabsConfig: null as { apiKey: string } | null,
  languageId: "fr-FR",
  llmConfig: null as { apiKey: string } | null,
  getStaticLanguageAudioPackSummary: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useAzureConfig: () => mocks.azureConfig,
  useElevenLabsConfig: () => mocks.elevenLabsConfig,
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
    mocks.languageId = "fr-FR";
    mocks.llmConfig = null;
  });

  it("shows a pending local-pack check instead of briefly claiming resources are missing", () => {
    mocks.getStaticLanguageAudioPackSummary.mockReturnValue(new Promise(() => {}));

    render(<LanguageAvailabilityCard />);

    expect(screen.getByText("检查中")).toBeInTheDocument();
    expect(screen.getByText("检查内置资源")).toBeInTheDocument();
    expect(screen.queryByText("缺失或不可读")).not.toBeInTheDocument();
    expect(screen.getByText(/检查完成前不需要安装额外语言包/)).toBeInTheDocument();
  });

  it("surfaces missing local-pack manifests as a Chinese reinstall hint", async () => {
    mocks.getStaticLanguageAudioPackSummary.mockResolvedValue(null);

    render(<LanguageAvailabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("缺失或不可读")).toBeInTheDocument();
    });

    expect(screen.getByText(/重新安装最新版桌面端/)).toBeInTheDocument();
    expect(screen.getByText(/反馈 Release EXE 问题/)).toBeInTheDocument();
  });

  it("shows bundled local-pack counts once the manifest is readable", async () => {
    mocks.getStaticLanguageAudioPackSummary.mockResolvedValue({
      languageId: "fr-FR",
      itemCount: 545,
      modelId: "eleven_multilingual_v2",
      voiceName: "Clément",
      voiceSlots: ["blue", "pink"],
    });

    render(<LanguageAvailabilityCard />);

    await waitFor(() => {
      expect(screen.getByText("内置 545 条")).toBeInTheDocument();
    });

    expect(screen.getByText("内置资源可用")).toBeInTheDocument();
    expect(screen.queryByText("缺失或不可读")).not.toBeInTheDocument();
  });
});
