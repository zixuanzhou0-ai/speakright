import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProgressPage from "@/app/progress/page";
import type { MasteryProfile } from "@/types/training";

const benchmarkRecording = {
  id: "bench-1",
  createdAt: 1_718_000_000_000,
  source: "prosody" as const,
  title: "Stress baseline",
  text: "I think so.",
  score: 82,
  targetLabel: "/th/",
};

const mocks = vi.hoisted(() => ({
  clearBenchmarkRecordings: vi.fn(),
  deleteBenchmarkRecording: vi.fn(),
  getBenchmarkAudioBlob: vi.fn(),
  languageId: "en-US",
  listBenchmarkRecordings: vi.fn<() => Array<typeof benchmarkRecording>>(
    () => [],
  ),
  getMasteryProfileStorageWarning: vi.fn<() => string | null>(() => null),
  loadMasteryProfile: vi.fn<() => MasteryProfile>(() => ({
    version: 2,
    updatedAt: 1_718_000_000_000,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "mastered",
        masteryState: "transferred",
        levelProgress: {},
        bestTargetScore: 94,
        perceptionBestRate: 0.9,
        completedSessions: 3,
        failureStreak: 0,
        lastPracticedAt: 1_718_000_000_000,
      },
    },
    phonemes: {},
    errorPatterns: {},
    sessions: [],
  })),
  playBlob: vi.fn(),
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
    playBlob: mocks.playBlob,
  }),
}));

vi.mock("@/lib/benchmark-archive", () => ({
  clearBenchmarkRecordings: mocks.clearBenchmarkRecordings,
  deleteBenchmarkRecording: mocks.deleteBenchmarkRecording,
  getBenchmarkAudioBlob: mocks.getBenchmarkAudioBlob,
  listBenchmarkRecordings: mocks.listBenchmarkRecordings,
  summarizeBenchmarkGroups: (items: typeof benchmarkRecording[]) =>
    items.length === 0
      ? []
      : [
          {
            key: "prosody:/th/:i think so",
            source: "prosody",
            targetLabel: "/th/",
            text: "I think so.",
            title: "Stress baseline",
            recordings: items,
            trend: {
              count: items.length,
              latestScore: items[0].score,
              bestScore: items[0].score,
              deltaFromFirst: 0,
            },
          },
        ],
  summarizeBenchmarkTrend: () => ({
    count: 0,
    latestScore: 0,
    deltaFromFirst: 0,
  }),
}));

vi.mock("@/lib/mastery-profile", () => ({
  getMasteryProfileStorageWarning: mocks.getMasteryProfileStorageWarning,
  loadMasteryProfile: mocks.loadMasteryProfile,
}));

describe("ProgressPage language boundary", () => {
  beforeEach(() => {
    mocks.languageId = "en-US";
    mocks.clearBenchmarkRecordings.mockReset().mockResolvedValue(undefined);
    mocks.deleteBenchmarkRecording.mockReset().mockResolvedValue(undefined);
    mocks.getBenchmarkAudioBlob.mockReset().mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
    );
    mocks.listBenchmarkRecordings.mockReset().mockReturnValue([]);
    mocks.getMasteryProfileStorageWarning.mockReset().mockReturnValue(null);
    mocks.loadMasteryProfile.mockClear();
    mocks.playBlob.mockClear();
  });

  it("shows the formal progress archive for English", async () => {
    render(<ProgressPage />);

    expect(screen.getByText("进步档案")).toBeInTheDocument();
    expect(await screen.findByText("已掌握包")).toBeInTheDocument();
    expect(await screen.findByText("已迁移")).toBeInTheDocument();
    expect(mocks.listBenchmarkRecordings).toHaveBeenCalledTimes(1);
    expect(mocks.loadMasteryProfile).toHaveBeenCalledTimes(1);
    expect(mocks.getMasteryProfileStorageWarning).toHaveBeenCalledTimes(1);
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
    for (const buttonName of [
      "返回当前语言训练",
      "做当前语言诊断",
      "检查语言设置",
    ]) {
      const button = screen.getByRole("button", { name: buttonName });
      expect(button).toHaveClass("max-w-full");
      expect(button).toHaveClass("whitespace-normal");
      expect(button).toHaveClass("break-words");
      expect(button).toHaveClass("text-center");
      expect(button).toHaveClass("[overflow-wrap:anywhere]");
      expect(button).not.toHaveClass("whitespace-nowrap");
    }
    expect(screen.queryByText("已掌握包")).not.toBeInTheDocument();
    expect(screen.queryByText("最近训练状态")).not.toBeInTheDocument();
    expect(screen.queryByText("阶段变化")).not.toBeInTheDocument();
    expect(mocks.listBenchmarkRecordings).not.toHaveBeenCalled();
    expect(mocks.loadMasteryProfile).not.toHaveBeenCalled();
    expect(mocks.getMasteryProfileStorageWarning).not.toHaveBeenCalled();
  });

  it("shows a visible warning when mastery profile storage cannot be read", async () => {
    mocks.getMasteryProfileStorageWarning.mockReturnValueOnce(
      "本机训练进度数据无法读取，已临时使用空档案。可以在设置的数据与隐私中心导出诊断后，重置本机学习数据再继续训练。",
    );

    render(<ProgressPage />);

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveAttribute(
      "data-smoke",
      "progress-mastery-storage-warning",
    );
    expect(alert).toHaveTextContent("本机训练进度数据无法读取");
    expect(alert).toHaveTextContent("重置本机学习数据");
    expect(mocks.loadMasteryProfile).toHaveBeenCalledTimes(1);
  });

  it("shows a visible warning when benchmark audio is missing", async () => {
    mocks.listBenchmarkRecordings.mockReturnValue([benchmarkRecording]);
    mocks.getBenchmarkAudioBlob.mockResolvedValueOnce(null);

    render(<ProgressPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /播放 benchmark 录音/ }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveAttribute(
      "data-smoke",
      "progress-benchmark-archive-status",
    );
    expect(alert).toHaveTextContent("本机音频数据缺失");
    expect(alert).toHaveTextContent("可以删除该记录后重新录制");
    expect(mocks.playBlob).not.toHaveBeenCalled();
  });

  it("keeps benchmark rows wrap-ready for narrow progress windows", () => {
    mocks.listBenchmarkRecordings.mockReturnValue([benchmarkRecording]);

    render(<ProgressPage />);

    const row = document.querySelector('[data-smoke="progress-benchmark-row"]');

    expect(row).toHaveClass("flex-col");
    expect(row).toHaveClass("sm:flex-row");
    expect(row?.textContent).toContain("82");
    expect(screen.getByText("Stress baseline")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("truncate");
    expect(document.body.innerHTML).not.toContain("line-clamp");
  });

  it("keeps recent training session rows wrap-ready", () => {
    mocks.loadMasteryProfile.mockReturnValueOnce({
      version: 2,
      updatedAt: 1_718_000_000_000,
      packs: {
        "s-th": {
          packId: "s-th",
          status: "stable",
          masteryState: "integrated",
          levelProgress: {},
          bestTargetScore: 88,
          perceptionBestRate: 0.9,
          completedSessions: 1,
          failureStreak: 0,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [
        {
          id: "session-1",
          packId: "s-th",
          startedAt: 1_718_000_000_000,
          completedAt: 1_718_000_060_000,
          perceptionCorrect: 4,
          perceptionTotal: 5,
          targetScores: [78, 82, 86],
          wordScores: [80],
          sentenceScores: [84],
          mastered: false,
          masteryStateAfter: "integrated",
        },
      ],
    });

    render(<ProgressPage />);

    const row = document.querySelector(
      '[data-smoke="progress-recent-session-row"]',
    );
    const title = document.querySelector(
      '[data-smoke="progress-recent-session-title"]',
    );
    const meta = document.querySelector(
      '[data-smoke="progress-recent-session-meta"]',
    );

    expect(row).toHaveClass("rounded-lg");
    expect(title).toHaveClass("break-words");
    expect(meta).toHaveClass("break-words");
    expect(screen.getByText("integrated")).toBeInTheDocument();
    expect(screen.getByText(/目标音平均/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("truncate");
    expect(document.body.innerHTML).not.toContain("line-clamp");
  });

  it("shows a visible error when benchmark deletion fails", async () => {
    mocks.listBenchmarkRecordings.mockReturnValue([benchmarkRecording]);
    mocks.deleteBenchmarkRecording.mockRejectedValueOnce(
      new Error("IndexedDB unavailable"),
    );
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    render(<ProgressPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /删除 benchmark 录音/ }),
    );

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("删除这条 benchmark 录音失败");
    expect(alert).toHaveTextContent("本机 IndexedDB 数据库不可用");
  });
});
