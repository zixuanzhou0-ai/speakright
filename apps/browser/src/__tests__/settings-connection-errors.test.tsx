import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AzureConfigCard } from "@/components/settings/azure-config-card";
import { ConnectionStatus } from "@/components/settings/connection-status";
import { ElevenLabsConfigCard } from "@/components/settings/elevenlabs-config-card";
import { LlmConfigCard } from "@/components/settings/llm-config-card";
import { PronunciationConfigCard } from "@/components/settings/pronunciation-config-card";
import { SettingsStorageWarning } from "@/components/settings/settings-storage-warning";

const mocks = vi.hoisted(() => ({
  fetchPronunciation: vi.fn(),
  hermesXaiStatus: vi.fn(),
  hermesXaiTts: vi.fn(),
  standardTtsProvider: "elevenlabs" as
    | "elevenlabs"
    | "hermes-grok"
    | "vertex-gemini",
  setAzureConfig: vi.fn(),
  setElevenLabsConfig: vi.fn(),
  setLlmConfig: vi.fn(),
  setStandardTtsConfig: vi.fn(),
  setVertexGeminiTtsConfig: vi.fn(),
  testAzure: vi.fn(),
  testElevenLabs: vi.fn(),
  testLlm: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  vertexGeminiStatus: vi.fn(),
  vertexGeminiTts: vi.fn(),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useAzureConfig: () => null,
  useElevenLabsConfig: () => null,
  useLanguageConfig: () => ({ languageId: "en-US" }),
  useLlmConfig: () => null,
  useStandardTtsConfig: () => ({ provider: mocks.standardTtsProvider }),
  useVertexGeminiTtsConfig: () => ({ voiceName: "Kore" }),
}));

vi.mock("@/lib/api-client", () => ({
  fetchPronunciation: mocks.fetchPronunciation,
  hermesXaiStatus: mocks.hermesXaiStatus,
  hermesXaiTts: mocks.hermesXaiTts,
  vertexGeminiStatus: mocks.vertexGeminiStatus,
  vertexGeminiTts: mocks.vertexGeminiTts,
  testAzure: mocks.testAzure,
  testElevenLabs: mocks.testElevenLabs,
  testLlm: mocks.testLlm,
}));

vi.mock("@/lib/api-keys", () => ({
  API_KEY_STORAGE_ERROR_EVENT: "speakright:api-key-storage-error",
  API_KEY_STORAGE_KEYS: [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config",
  ],
  APP_PREFERENCE_STORAGE_KEYS: [
    "speakright_standard_tts_config",
    "speakright_vertex_gemini_tts_config",
    "speakright_coach_mode",
  ],
  setAzureConfig: mocks.setAzureConfig,
  setElevenLabsConfig: mocks.setElevenLabsConfig,
  setLlmConfig: mocks.setLlmConfig,
  setStandardTtsConfig: mocks.setStandardTtsConfig,
  setVertexGeminiTtsConfig: mocks.setVertexGeminiTtsConfig,
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
    mocks.standardTtsProvider = "elevenlabs";
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
      await screen.findByText(
        "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
      ),
    ).toBeInTheDocument();
  });

  it("shows first-run missing-key guidance without requiring a failed test click", () => {
    render(
      <>
        <AzureConfigCard />
        <ElevenLabsConfigCard />
        <LlmConfigCard />
      </>,
    );

    expect(
      screen.getByText(/未配置 Azure 时可以浏览课程和播放已内置音频/),
    ).toHaveAttribute("data-smoke", "azure-missing-key-guidance");
    expect(
      screen.getByText(/录音评分、诊断和训练达标判定不可用/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/未配置 ElevenLabs 时，已内置单词和语言包音频仍可播放/),
    ).toHaveAttribute("data-smoke", "elevenlabs-missing-key-guidance");
    expect(
      screen.getByText(/自由输入的句子\/短语标准示范/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/未配置 AI 教练 Key 时，Azure 数字评分仍可用/),
    ).toHaveAttribute("data-smoke", "llm-missing-key-guidance");
    expect(screen.getByText(/不会卡住评分流程/)).toBeInTheDocument();
  });

  it("shows the standard TTS provider switch and local Hermes guidance", () => {
    const elevenLabsView = render(<ElevenLabsConfigCard />);
    const selector = screen.getByRole("group", {
      name: "选择标准示范 TTS",
    });

    expect(selector).toHaveAttribute("data-smoke", "tts-provider-selector");
    expect(screen.getByRole("button", { name: /ElevenLabs/ })).toHaveAttribute(
      "data-smoke",
      "tts-provider-elevenlabs",
    );
    const hermesButton = screen.getByRole("button", { name: /爱马仕 Grok/ });
    expect(hermesButton).toHaveAttribute(
      "data-smoke",
      "tts-provider-hermes-grok",
    );

    fireEvent.click(hermesButton);
    expect(mocks.setStandardTtsConfig).toHaveBeenCalledWith({
      provider: "hermes-grok",
    });
    elevenLabsView.unmount();

    mocks.standardTtsProvider = "hermes-grok";
    render(<ElevenLabsConfigCard />);

    expect(
      screen
        .getByText(/无需同时打开桌面端/)
        .closest('[data-smoke="hermes-grok-local-guidance"]'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("API Key")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "检测爱马仕状态" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "试听短句（会产生用量）" }),
    ).toBeVisible();
  });

  it("shows Vertex Gemini as a third provider and checks status without generating audio", async () => {
    mocks.vertexGeminiStatus.mockResolvedValue({
      available: true,
      model: "gemini-3.1-flash-tts-preview",
      authReady: true,
      projectConfigured: true,
    });
    mocks.standardTtsProvider = "vertex-gemini";
    render(<ElevenLabsConfigCard />);

    const vertexButton = screen.getByRole("button", {
      name: /Vertex AI · Gemini 3.1/,
    });
    expect(vertexButton).toHaveAttribute(
      "data-smoke",
      "tts-provider-vertex-gemini",
    );
    expect(
      screen
        .getByText(/SpeakRight 不保存 Google 密钥/)
        .closest('[data-smoke="vertex-gemini-local-guidance"]'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("音色")).toHaveTextContent("Kore");
    expect(
      screen.getByRole("button", { name: "检测 Vertex 状态" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "试听短句（会产生用量）" }),
    ).toBeVisible();
    expect(mocks.vertexGeminiStatus).not.toHaveBeenCalled();
    expect(mocks.vertexGeminiTts).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "检测 Vertex 状态" }),
    );
    expect(
      await screen.findByText("本机 Vertex AI 项目与 ADC 授权已就绪"),
    ).toBeInTheDocument();
    expect(screen.getByText("项目：已配置")).toBeInTheDocument();
    expect(screen.getByText("ADC：已就绪")).toBeInTheDocument();
    expect(mocks.vertexGeminiTts).not.toHaveBeenCalled();
  });

  it("shows a persistent Settings alert when local key storage fails", () => {
    render(<SettingsStorageWarning />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("speakright:api-key-storage-error", {
          detail: {
            key: "speakright_azure_config",
            operation: "save",
            message: "keychain unavailable",
          },
        }),
      );
    });

    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-smoke",
      "settings-storage-warning",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "API Key 保存失败：本机密钥存储暂时不可用",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "keychain unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "刚才的配置可能没有保存成功，请重新保存",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("导出诊断包");
  });

  it("keeps missing connection-test config visible inline instead of toast-only", () => {
    const azureView = render(<AzureConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请先填写 Subscription Key 后再测试连接",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "请先填写 Subscription Key 后再测试连接",
    );
    azureView.unmount();

    const elevenLabsView = render(<ElevenLabsConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请先填写 API Key 后再测试连接",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "请先填写 API Key 后再测试连接",
    );
    elevenLabsView.unmount();

    render(<LlmConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请填写 API Key 后再测试连接",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "请填写 API Key 后再测试连接",
    );
  });

  it("keeps missing save config visible inline instead of toast-only", () => {
    const azureView = render(<AzureConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请填写 Subscription Key 后再保存配置",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "请填写 Subscription Key 后再保存配置",
    );
    expect(mocks.setAzureConfig).not.toHaveBeenCalled();
    azureView.unmount();

    const elevenLabsView = render(<ElevenLabsConfigCard />);

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "eleven-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请选择默认声音后再保存配置",
    );
    expect(mocks.toastError).toHaveBeenCalledWith("请选择默认声音后再保存配置");
    expect(mocks.setElevenLabsConfig).not.toHaveBeenCalled();
    elevenLabsView.unmount();

    render(<LlmConfigCard />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请填写 API Key 后再保存配置",
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "请填写 API Key 后再保存配置",
    );
    expect(mocks.setLlmConfig).not.toHaveBeenCalled();
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
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-smoke",
      "settings-connection-status",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("announces non-error Settings connection states politely", () => {
    render(<ConnectionStatus state="testing" />);

    expect(screen.getByRole("status")).toHaveTextContent("测试中...");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
