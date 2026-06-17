import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SpontaneousPage from "@/app/drill/spontaneous/page";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { MasteryProfile } from "@/types/training";

const mocks = vi.hoisted(() => ({
  languageId: "en-US",
  loadMasteryProfile: vi.fn(),
  saveMasteryProfile: vi.fn(),
  playBlob: vi.fn(),
  stop: vi.fn(),
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

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob: null,
    stream: null,
    error: null,
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-recording-quality", () => ({
  useRecordingQuality: () => ({
    report: null,
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    playBlob: mocks.playBlob,
    stop: mocks.stop,
  }),
}));

vi.mock("@/lib/mastery-profile", () => ({
  loadMasteryProfile: mocks.loadMasteryProfile,
  saveMasteryProfile: mocks.saveMasteryProfile,
}));

function profileWithActivePacks(packIds: string[]): MasteryProfile {
  return {
    version: 2,
    updatedAt: 1_718_000_000_000,
    packs: Object.fromEntries(
      packIds.map((packId, index) => [
        packId,
        {
          packId,
          status: "practicing",
          masteryState: "learning",
          levelProgress: {},
          bestTargetScore: 60 + index,
          perceptionBestRate: 0.7,
          completedSessions: 1,
          failureStreak: packIds.length - index,
          lastPracticedAt: 1_718_000_000_000 - index,
        },
      ]),
    ),
    phonemes: {},
    errorPatterns: {},
    sessions: [],
  };
}

describe("SpontaneousPage target packs", () => {
  beforeEach(() => {
    mocks.languageId = "en-US";
    mocks.playBlob.mockClear();
    mocks.stop.mockClear();
    mocks.saveMasteryProfile.mockClear();
    mocks.loadMasteryProfile.mockReset();
  });

  it("shows every current target pack instead of hiding the fourth one", async () => {
    const packIds = TRAINING_PACKS.slice(0, 4).map((pack) => pack.id);
    mocks.loadMasteryProfile.mockReturnValue(profileWithActivePacks(packIds));

    render(<SpontaneousPage />);

    await screen.findByText("即兴迁移测试");
    await waitFor(() => {
      expect(
        document.querySelectorAll(
          '[data-smoke="spontaneous-target-pack-badge"]',
        ),
      ).toHaveLength(packIds.length);
    });

    for (const pack of TRAINING_PACKS.slice(0, 4)) {
      expect(screen.getByText(`观察 ${pack.title}`)).toBeInTheDocument();
    }
  });
});
