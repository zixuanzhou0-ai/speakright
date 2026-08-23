import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PerceptionDrillPage from "@/app/drill/perception/page";

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
  pronunciationError: null as string | null,
  clearError: vi.fn(),
  playLocalAsset: vi.fn(),
  playWord: vi.fn(),
}));
vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/hooks/use-word-pronunciation", () => ({
  useWordPronunciation: () => ({
    clearError: mocks.clearError,
    error: mocks.pronunciationError,
    isLoading: false,
    isPlaying: false,
    playWord: mocks.playWord,
    playLocalAsset: mocks.playLocalAsset,
    stop: vi.fn(),
  }),
}));

describe("PerceptionDrillPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.languageId = "en-US";
    mocks.pronunciationError = null;
    mocks.clearError.mockImplementation(() => {
      mocks.pronunciationError = null;
    });
  });

  it("clears stale pronunciation errors when advancing to the next ABX question", () => {
    const { rerender } = render(<PerceptionDrillPage />);

    fireEvent.click(
      screen.getAllByRole("button", { name: /\/iː\/ vs \/ɪ\// })[0],
    );

    mocks.pronunciationError = "在线发音兜底失败，请检查网络后重试。";
    rerender(<PerceptionDrillPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("在线发音兜底失败");

    fireEvent.click(screen.getByRole("button", { name: "X = A" }));
    expect(screen.getByRole("alert")).toHaveTextContent("在线发音兜底失败");

    fireEvent.click(screen.getByRole("button", { name: "下一题" }));

    expect(mocks.clearError).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/第 2 \/ 8 题/)).toBeInTheDocument();
  });
});
