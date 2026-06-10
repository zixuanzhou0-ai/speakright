import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingPackPage from "@/app/drill/pack/[packId]/pack-runner-client";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ packId: "final-consonants" }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: "en-US" }),
}));

vi.mock("@/hooks/use-azure-assessment", () => ({
  useAzureAssessment: () => ({
    assess: vi.fn(),
    reset: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-llm-feedback", () => ({
  useLlmFeedback: () => ({
    requestFeedback: vi.fn(),
    reset: vi.fn(),
    feedback: "",
    isStreaming: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-word-pronunciation", () => ({
  useWordPronunciation: () => ({
    playWord: vi.fn(),
    stop: vi.fn(),
    isLoading: false,
    isPlaying: false,
  }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob: null,
    stream: null,
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-recording-quality", () => ({
  useRecordingQuality: () => ({
    report: null,
    isAnalyzing: false,
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-tts-aligned", () => ({
  useTtsAligned: () => ({
    speak: vi.fn(),
    reset: vi.fn(),
    isLoading: false,
    isPlaying: false,
  }),
}));

describe("drill pack runner start flow", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.searchParams = new URLSearchParams();
  });

  it("starts final-consonants from the intro primary action", () => {
    render(<TrainingPackPage />);

    expect(screen.getByText("词尾别吞")).toBeInTheDocument();
    expect(screen.getByText("课前任务单")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "从 听辨 ABX 开始" }));

    expect(screen.queryByText("课前任务单")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "先听准，再说准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "听辨 ABX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "X = A" })).toBeInTheDocument();
  });

  it("starts final-consonants when clicking an unlocked course map level", () => {
    render(<TrainingPackPage />);

    const levelCards = screen.getAllByRole("button", { name: /听辨 ABX/ });
    fireEvent.click(levelCards[0]);

    expect(screen.queryByText("课前任务单")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "先听准，再说准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "听辨 ABX" })).toBeInTheDocument();
  });
});
