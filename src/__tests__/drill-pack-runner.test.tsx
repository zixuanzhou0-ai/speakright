import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingPackPage from "@/app/drill/pack/[packId]/pack-runner-client";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  languageId: "en-US",
  wordAudioClearError: vi.fn(),
  ttsReset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ packId: "final-consonants" }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
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
    clearError: mocks.wordAudioClearError,
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
    reset: mocks.ttsReset,
    isLoading: false,
    isPlaying: false,
  }),
}));

function expectBadgeWraps(element: Element | null) {
  expect(element).not.toBeNull();
  expect(element).toHaveClass("h-auto");
  expect(element).toHaveClass("min-h-5");
  expect(element).toHaveClass("max-w-full");
  expect(element).toHaveClass("whitespace-normal");
  expect(element).toHaveClass("break-words");
  expect(element).toHaveClass("text-center");
  expect(element).toHaveClass("[overflow-wrap:anywhere]");
  expect(element).not.toHaveClass("whitespace-nowrap");
}

describe("drill pack runner start flow", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.searchParams = new URLSearchParams();
    mocks.languageId = "en-US";
    mocks.wordAudioClearError.mockClear();
    mocks.ttsReset.mockClear();
  });

  it("starts final-consonants from the intro primary action", () => {
    const { container } = render(<TrainingPackPage />);

    expect(screen.getByText("词尾别吞")).toBeInTheDocument();
    expect(screen.getByText("课前任务单")).toBeInTheDocument();
    expect(
      container.querySelector('[data-smoke="pack-runner-page"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-smoke="pack-runner-intro-card"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-smoke="pack-runner-course-map"]'),
    ).toBeTruthy();
    expectBadgeWraps(
      container.querySelector('[data-smoke="pack-runner-intro-phoneme-badge"]'),
    );
    expectBadgeWraps(
      container.querySelector(
        '[data-smoke="pack-runner-course-map-status-badge"]',
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "从 听辨 ABX 开始" }));

    expect(screen.queryByText("课前任务单")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "先听准，再说准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "听辨 ABX" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "X = A" })).toBeInTheDocument();
    expectBadgeWraps(
      document.querySelector('[data-smoke="pack-runner-course-header-badge"]'),
    );
    expect(mocks.wordAudioClearError).toHaveBeenCalled();
    expect(mocks.ttsReset).toHaveBeenCalled();
  });

  it("starts final-consonants when clicking an unlocked course map level", () => {
    render(<TrainingPackPage />);

    const levelCards = screen.getAllByRole("button", { name: /听辨 ABX/ });
    fireEvent.click(levelCards[0]);

    expect(screen.queryByText("课前任务单")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "先听准，再说准" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "听辨 ABX" })).toBeInTheDocument();
  });

  it("blocks direct English pack routes for experimental languages", () => {
    mocks.languageId = "es-ES";

    const { container } = render(<TrainingPackPage />);

    expect(screen.getByText("西语暂不使用英语训练包")).toBeInTheDocument();
    expect(screen.getByText(/这里不会混入英语训练包/)).toBeInTheDocument();
    expect(
      container.querySelector('[data-smoke="pack-runner-experimental-blocker"]'),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "当前语言单词训练" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("词尾别吞")).not.toBeInTheDocument();
    expect(screen.queryByText("课前任务单")).not.toBeInTheDocument();
  });
});
