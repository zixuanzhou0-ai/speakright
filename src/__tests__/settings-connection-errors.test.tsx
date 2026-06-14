import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AzureConfigCard } from "@/components/settings/azure-config-card";
import { ConnectionStatus } from "@/components/settings/connection-status";
import { ElevenLabsConfigCard } from "@/components/settings/elevenlabs-config-card";
import { LlmConfigCard } from "@/components/settings/llm-config-card";
import { PronunciationConfigCard } from "@/components/settings/pronunciation-config-card";

const mocks = vi.hoisted(() => ({
  fetchPronunciation: vi.fn(),
  isTauriEnvironment: vi.fn(() => true),
  setAzureConfig: vi.fn(),
  setElevenLabsConfig: vi.fn(),
  setLlmConfig: vi.fn(),
  testAzure: vi.fn(),
  testElevenLabs: vi.fn(),
  testLlm: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useAzureConfig: () => null,
  useElevenLabsConfig: () => null,
  useLanguageConfig: () => ({ languageId: "en-US" }),
  useLlmConfig: () => null,
}));

vi.mock("@/lib/api-client", () => ({
  fetchPronunciation: mocks.fetchPronunciation,
  testAzure: mocks.testAzure,
  testElevenLabs: mocks.testElevenLabs,
  testLlm: mocks.testLlm,
}));

vi.mock("@/lib/api-keys", () => ({
  setAzureConfig: mocks.setAzureConfig,
  setElevenLabsConfig: mocks.setElevenLabsConfig,
  setLlmConfig: mocks.setLlmConfig,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("settings connection errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriEnvironment.mockReturnValue(true);
  });

  it("keeps Azure connection-test provider errors actionable in Chinese", async () => {
    mocks.testAzure.mockRejectedValueOnce(
      new Error("无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。"),
    );

    render(<AzureConfigCard />);

    fireEvent.change(screen.getByLabelText("Subscription Key"), {
      target: { value: "azure-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(
      await screen.findByText("无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。"),
    ).toBeInTheDocument();
  });

  it("does not leak raw English ElevenLabs exceptions into Settings", async () => {
    mocks.testElevenLabs.mockRejectedValueOnce(new Error("Failed to fetch"));

    render(<ElevenLabsConfigCard />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "eleven-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(
      await screen.findByText(
        "ElevenLabs 连接测试失败，请检查网络、代理或 API Key 后重试。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("keeps AI coach connection-test provider errors actionable in Chinese", async () => {
    mocks.testLlm.mockRejectedValueOnce(
      new Error("AI 教练请求超时，请检查网络或稍后重试。"),
    );

    render(<LlmConfigCard />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "llm-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(
      await screen.findByText("AI 教练请求超时，请检查网络或稍后重试。"),
    ).toBeInTheDocument();
  });

  it("explains that local practice audio is unaffected when Youdao testing fails", async () => {
    mocks.fetchPronunciation.mockRejectedValueOnce(
      new Error(
        "无法连接在线词典发音，请检查网络后重试；已内置的本地音频不受影响。",
      ),
    );

    render(<PronunciationConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "测试有道发音" }));

    await waitFor(() => {
      expect(screen.getByText(/无法连接在线词典发音/)).toBeInTheDocument();
    });
    expect(screen.getByText(/已内置的本地音频不受影响/)).toBeInTheDocument();
  });

  it("keeps long Settings status messages wrap-ready", () => {
    render(
      <ConnectionStatus
        state="error"
        message="ElevenLabs 连接测试失败，请检查网络、代理或 API Key 后重试。"
      />,
    );

    expect(screen.getByText(/ElevenLabs 连接测试失败/)).toHaveClass(
      "break-words",
    );
  });
});
