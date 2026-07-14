import type { GuidedRepeatSessionPlan } from "@speakright/core/training/guided-repeat";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGuidedRepeatSession } from "@/hooks/use-guided-repeat-session";
import type {
  AudioMetadata,
  GuidedRepeatAudioAdapter,
  PlaybackPosition,
} from "@/lib/guided-repeat-audio";

const PLAN: GuidedRepeatSessionPlan = {
  languageId: "en-US",
  soundUnitSlug: "ee",
  rhythm: "flow",
  anchorAudio: {
    normal: "/audio/ipa/normal/sheep.mp3",
    slow: "/audio/ipa/slow/sheep.mp3",
  },
  queue: [
    {
      materialId: "en-US:ee:sheep",
      word: "sheep",
      ipa: "/shi:p/",
      targetUnits: ["ee"],
      masculineAudioSrc: "/audio/words/blue/sheep.mp3",
      feminineAudioSrc: "/audio/words/pink/sheep.mp3",
    },
  ],
  totalWords: 1,
};

class FakeAudioAdapter implements GuidedRepeatAudioAdapter {
  readonly preload = vi.fn(
    async (_src: string): Promise<AudioMetadata> => ({ durationMs: 100 }),
  );
  readonly play = vi.fn(
    (_src: string, _seekMs?: number) =>
      new Promise<void>((resolve) => {
        this.playResolvers.push(resolve);
      }),
  );
  readonly pause = vi.fn(
    (): PlaybackPosition => ({
      src: "/audio/ipa/normal/sheep.mp3",
      seekMs: 432,
    }),
  );
  readonly resume = vi.fn(async () => {});
  readonly stop = vi.fn();
  readonly unload = vi.fn();
  readonly getDuration = vi.fn((_src: string) => 100);
  private readonly playResolvers: Array<() => void> = [];

  finishPlayback() {
    this.playResolvers.shift()?.();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGuidedRepeatSession", () => {
  it("pauses and resumes the current audio without starting another player", async () => {
    const adapter = new FakeAudioAdapter();
    const { result, unmount } = renderHook(() =>
      useGuidedRepeatSession({
        plan: PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(result.current.status).toBe("playing"));
    expect(adapter.play).toHaveBeenCalledTimes(1);

    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    expect(adapter.pause).toHaveBeenCalledTimes(1);

    act(() => result.current.resume());
    expect(result.current.status).toBe("playing");
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(adapter.play).toHaveBeenCalledTimes(1);

    act(() => result.current.pause(true));
    expect(result.current.status).toBe("auto-paused");

    unmount();
    expect(adapter.unload).toHaveBeenCalled();
  });

  it("preserves a paused imitation gap and advances only after resume", async () => {
    const adapter = new FakeAudioAdapter();
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    act(() => adapter.finishPlayback());
    await waitFor(() => expect(result.current.step?.kind).toBe("gap"));

    act(() => result.current.pause());
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(result.current.status).toBe("paused");
    expect(adapter.play).toHaveBeenCalledTimes(1);

    act(() => result.current.resume());
    expect(result.current.status).toBe("playing");
    expect(adapter.resume).not.toHaveBeenCalled();
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(2), {
      timeout: 1500,
    });
  });

  it("ignores pause while the initial local assets are still preloading", async () => {
    const resolvers: Array<(metadata: AudioMetadata) => void> = [];
    const adapter = new FakeAudioAdapter();
    adapter.preload.mockImplementation(
      () =>
        new Promise<AudioMetadata>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    expect(result.current.status).toBe("preloading");
    act(() => result.current.pause());
    expect(result.current.status).toBe("preloading");

    act(() => {
      for (const resolve of resolvers.splice(0)) {
        resolve({ durationMs: 100 });
      }
    });
    await waitFor(() => expect(result.current.status).toBe("playing"));
  });
});
