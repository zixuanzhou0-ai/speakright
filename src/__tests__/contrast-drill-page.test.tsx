import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContrastDrillPage from "@/app/drill/contrast/page";
import type { AzureAssessmentResult } from "@/types/azure";

const audioBlob = new Blob([new Uint8Array([1, 2, 3])], {
  type: "audio/wav",
});

const passingAssessment: AzureAssessmentResult = {
  pronunciationScore: 88,
  accuracyScore: 88,
  fluencyScore: 90,
  completenessScore: 92,
  words: [
    {
      word: "sheep",
      accuracyScore: 88,
      errorType: "None",
      phonemes: [{ phoneme: "iy", accuracyScore: 88 }],
      syllables: [],
    },
  ],
};

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
  recorderAudioBlob: null as Blob | null,
  recorderError: null as string | null,
  recorderReset: vi.fn(),
  recorderStart: vi.fn(),
  recorderStop: vi.fn(),
  assess: vi.fn(),
  azureError: null as string | null,
  azureLastError: null as string | null,
  azureReset: vi.fn(),
  playWord: vi.fn(),
}));

vi.mock("@/components/audio/waveform-display", () => ({
  WaveformDisplay: ({ audioBlob }: { audioBlob?: Blob | null }) => (
    <div data-testid="waveform">{audioBlob ? "has-audio" : "empty"}</div>
  ),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useCoachMode: () => "normal",
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob: mocks.recorderAudioBlob,
    autoStopped: false,
    elapsedSeconds: 0,
    error: mocks.recorderError,
    isRecording: false,
    maxDurationSeconds: 30,
    rawBlob: mocks.recorderAudioBlob,
    reset: mocks.recorderReset,
    startRecording: mocks.recorderStart,
    stopRecording: mocks.recorderStop,
    stream: null,
  }),
}));

vi.mock("@/hooks/use-azure-assessment", () => ({
  useAzureAssessment: () => ({
    assess: mocks.assess,
    error: mocks.azureError,
    getLastError: () => mocks.azureLastError,
    isLoading: false,
    reset: mocks.azureReset,
    restore: vi.fn(),
    result: null,
  }),
}));

vi.mock("@/hooks/use-word-pronunciation", () => ({
  useWordPronunciation: () => ({
    clearError: vi.fn(),
    error: null,
    isLoading: false,
    isPlaying: false,
    playWord: mocks.playWord,
    stop: vi.fn(),
  }),
}));

describe("ContrastDrillPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.languageId = "en-US";
    mocks.recorderAudioBlob = null;
    mocks.recorderError = null;
    mocks.azureError = null;
    mocks.azureLastError = null;
    mocks.recorderReset.mockImplementation(() => {
      mocks.recorderAudioBlob = null;
      mocks.recorderError = null;
    });
    mocks.azureReset.mockImplementation(() => {
      mocks.azureError = null;
      mocks.azureLastError = null;
    });
  });

  it("shows every preview pair in the contrast-set cards without ellipsis", () => {
    render(<ContrastDrillPage />);

    expect(screen.getByText("sheep / ship")).toBeInTheDocument();
    expect(screen.getByText("seat / sit")).toBeInTheDocument();
    expect(screen.getByText("feet / fit")).toBeInTheDocument();
    expect(screen.getByText("beat / bit")).toBeInTheDocument();
    expect(screen.getByText("cheap / chip")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("...");
  });

  it("lets users retry contrast Azure scoring on the same recording after a provider failure", async () => {
    const azureFailure =
      "请先到设置页配置 Azure Speech API 密钥和区域；配置后回到本页重新评分。";
    mocks.assess
      .mockImplementationOnce(async () => {
        mocks.azureError = azureFailure;
        mocks.azureLastError = azureFailure;
        return null;
      })
      .mockResolvedValueOnce(passingAssessment);

    const { rerender } = render(<ContrastDrillPage />);

    fireEvent.click(screen.getByRole("button", { name: /\/iː\/ vs \/ɪ\// }));
    fireEvent.click(screen.getByRole("button", { name: /开始录音（先读 sheep）/ }));

    mocks.recorderAudioBlob = audioBlob;
    rerender(<ContrastDrillPage />);

    await waitFor(() => {
      expect(mocks.assess).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(azureFailure);
    expect(
      screen.getByRole("button", { name: "重新评分" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重新评分" }));

    await waitFor(() => {
      expect(mocks.assess).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText("很好！现在请读：")).toBeInTheDocument();
    });
    expect(screen.getByText("ship")).toBeInTheDocument();
  });
});
