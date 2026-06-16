import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhonemeDetailPage } from "@/app/phonemes/[phoneme]/phoneme-detail-page";
import type { AzureAssessmentResult } from "@/types/azure";

const mocks = vi.hoisted(() => ({
  assess: vi.fn(),
  requestFeedback: vi.fn(),
  addScore: vi.fn(),
  markWordPracticedForLanguage: vi.fn(),
  routerReplace: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ phoneme: "ee" }),
  useRouter: () => ({ replace: mocks.routerReplace }),
}));

vi.mock("@/components/audio/record-button", () => ({
  RecordButton: () => <button type="button">录音</button>,
}));

vi.mock("@/components/audio/recording-actions", () => ({
  RecordingActions: ({ onAssess }: { onAssess: () => void }) => (
    <button type="button" onClick={onAssess}>
      评分
    </button>
  ),
}));

vi.mock("@/components/audio/waveform-display", () => ({
  WaveformDisplay: () => <div data-testid="waveform" />,
}));

vi.mock("@/components/feedback/feedback-display", () => ({
  FeedbackDisplay: () => <div data-testid="feedback" />,
}));

vi.mock("@/components/phoneme/phoneme-study-card", () => ({
  PhonemeStudyCard: () => <div data-testid="phoneme-study-card" />,
}));

vi.mock("@/components/scoring/phoneme-highlight", () => ({
  PhonemeHighlight: () => <div data-testid="phoneme-highlight" />,
}));

vi.mock("@/components/scoring/score-summary", () => ({
  ScoreSummary: () => <div data-testid="score-summary" />,
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: "en-US" }),
}));

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    play: vi.fn(),
    playBlob: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-azure-assessment", () => ({
  useAzureAssessment: () => ({
    assess: mocks.assess,
    result: null,
    isLoading: false,
    error: null,
    getLastError: vi.fn(() => null),
    reset: mocks.reset,
    restore: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-llm-feedback", () => ({
  useLlmFeedback: () => ({
    requestFeedback: mocks.requestFeedback,
    feedback: null,
    hasFeedback: false,
    isStreaming: false,
    error: null,
    reset: mocks.reset,
    restore: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob: new Blob(["audio"], { type: "audio/wav" }),
    rawBlob: null,
    stream: null,
    isRecording: false,
    isConverting: false,
    autoStopped: false,
    error: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    reset: mocks.reset,
  }),
}));

vi.mock("@/hooks/use-syllable-stress", () => ({
  useSyllableStress: () => [],
}));

vi.mock("@/hooks/use-word-pronunciation", () => ({
  useWordPronunciation: () => ({
    isPlaying: false,
    isLoading: false,
    error: null,
    playWord: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock("@/lib/score-history", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/score-history")>(
      "@/lib/score-history",
    );
  return {
    ...actual,
    addScore: mocks.addScore,
  };
});

vi.mock("@/lib/practice-tracker", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/practice-tracker")>(
      "@/lib/practice-tracker",
    );
  return {
    ...actual,
    markWordPracticedForLanguage: mocks.markWordPracticedForLanguage,
  };
});

const assessmentResult: AzureAssessmentResult = {
  pronunciationScore: 88,
  accuracyScore: 87,
  fluencyScore: 86,
  completenessScore: 89,
  words: [
    {
      word: "green",
      accuracyScore: 88,
      errorType: "None",
      phonemes: [{ phoneme: "iy", accuracyScore: 88 }],
      syllables: [],
    },
  ],
};

describe("PhonemeDetailPage local persistence warnings", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mocks.assess.mockResolvedValue(assessmentResult);
    mocks.requestFeedback.mockResolvedValue(undefined);
    mocks.addScore.mockReturnValue(true);
    mocks.markWordPracticedForLanguage.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("shows a Chinese alert when local score or practice history cannot be saved", async () => {
    mocks.addScore.mockReturnValue(false);

    render(<PhonemeDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "评分" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("data-smoke", "local-practice-save-error");
    expect(alert).toHaveTextContent("本次评分已完成");
    expect(alert).toHaveTextContent("本机练习记录或趋势图未保存");
    expect(alert).toHaveTextContent("本地存储");
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");

    await waitFor(() => {
      expect(mocks.requestFeedback).toHaveBeenCalled();
    });
  });

  it("does not show a local-save alert when score and practice history save", async () => {
    render(<PhonemeDetailPage />);

    fireEvent.click(screen.getByRole("button", { name: "评分" }));

    await waitFor(() => {
      expect(mocks.requestFeedback).toHaveBeenCalled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
