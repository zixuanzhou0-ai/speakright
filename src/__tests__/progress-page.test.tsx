import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/app/progress/page";

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
  listBenchmarkRecordings: vi.fn(() => []),
  loadMasteryProfile: vi.fn(() => ({
    version: 1,
    updatedAt: 1_718_000_000_000,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "mastered",
        masteryState: "transferred",
        lastScore: 92,
        bestScore: 94,
        attempts: 3,
        passedAttempts: 3,
        failedAttempts: 0,
        lastPracticedAt: 1_718_000_000_000,
      },
    },
    sessions: [],
  })),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    playBlob: vi.fn(),
  }),
}));

vi.mock("@/lib/benchmark-archive", () => ({
  clearBenchmarkRecordings: vi.fn(),
  deleteBenchmarkRecording: vi.fn(),
  getBenchmarkAudioBlob: vi.fn(),
  listBenchmarkRecordings: mocks.listBenchmarkRecordings,
  summarizeBenchmarkGroups: () => [],
  summarizeBenchmarkTrend: () => ({
    count: 0,
    latestScore: 0,
    deltaFromFirst: 0,
  }),
}));

vi.mock("@/lib/mastery-profile", () => ({
  loadMasteryProfile: mocks.loadMasteryProfile,
}));

describe("ProgressPage language boundary", () => {
  beforeEach(() => {
    mocks.languageId = "en-US";
    mocks.listBenchmarkRecordings.mockClear();
    mocks.loadMasteryProfile.mockClear();
  });

  it("shows the formal progress archive for English", async () => {
    render(<ProgressPage />);

    expect(screen.getByText("进步档案")).toBeInTheDocument();
    expect(await screen.findByText("已掌握包")).toBeInTheDocument();
    expect(await screen.findByText("已迁移")).toBeInTheDocument();
    expect(mocks.listBenchmarkRecordings).toHaveBeenCalledTimes(1);
    expect(mocks.loadMasteryProfile).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(/不显示正式英语 mastery 档案/),
    ).not.toBeInTheDocument();
  });

  it("blocks formal progress archive wording for experimental languages", () => {
    mocks.languageId = "fr-FR";

    render(<ProgressPage />);

    expect(screen.getByText("法语进步档案")).toBeInTheDocument();
    expect(screen.getByText(/当前语言仍为 experimental/)).toBeInTheDocument();
    expect(
      screen.getByText(/不会把英语阶段记录或正式/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "返回当前语言训练" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("已掌握包")).not.toBeInTheDocument();
    expect(screen.queryByText("最近训练状态")).not.toBeInTheDocument();
    expect(screen.queryByText("阶段变化")).not.toBeInTheDocument();
    expect(mocks.listBenchmarkRecordings).not.toHaveBeenCalled();
    expect(mocks.loadMasteryProfile).not.toHaveBeenCalled();
  });
});
