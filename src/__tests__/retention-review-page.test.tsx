import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RetentionReviewPage from "@/app/drill/retention/page";
import { scheduleRetentionAfterTransfer } from "@/lib/retention-schedule";
import { getRetentionMaterialIds } from "@/lib/training-packs";

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
}));

vi.mock("@/hooks/use-api-keys", () => ({
  useLanguageConfig: () => ({ languageId: mocks.languageId }),
}));

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob: null,
    stream: null,
    isRecording: false,
    error: null,
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

vi.mock("@/hooks/use-azure-assessment", () => ({
  useAzureAssessment: () => ({
    assess: vi.fn(),
    result: null,
    isLoading: false,
    error: null,
    reset: vi.fn(),
  }),
}));

describe("retention review page", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.languageId = "en-US";
  });

  it("does not expose a review before it is due", () => {
    const observedAt = Date.now();
    scheduleRetentionAfterTransfer({
      packId: "ee-ih",
      transferEvidenceId: "transfer-future",
      observedAt,
      materialIdsByDelay: {
        24: getRetentionMaterialIds("ee-ih", 24),
        168: getRetentionMaterialIds("ee-ih", 168),
        504: getRetentionMaterialIds("ee-ih", 504),
      },
    });

    render(<RetentionReviewPage />);

    expect(screen.getByText("目前没有到期复测")).toBeInTheDocument();
  });

  it("shows due held-out material without a reference playback action", () => {
    const observedAt = Date.now() - 25 * 60 * 60 * 1_000;
    scheduleRetentionAfterTransfer({
      packId: "ee-ih",
      transferEvidenceId: "transfer-due",
      observedAt,
      materialIdsByDelay: {
        24: getRetentionMaterialIds("ee-ih", 24),
        168: getRetentionMaterialIds("ee-ih", 168),
        504: getRetentionMaterialIds("ee-ih", 504),
      },
    });

    render(<RetentionReviewPage />);

    expect(screen.getByText("到期保持复测")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.getByText("不预播答案")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /播放.*示范/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps formal retention English-only", () => {
    mocks.languageId = "es-ES";

    render(<RetentionReviewPage />);

    expect(screen.getByText("英语保持复测")).toBeInTheDocument();
    expect(screen.getByText(/只对英语 en-US 开放/)).toBeInTheDocument();
  });
});
