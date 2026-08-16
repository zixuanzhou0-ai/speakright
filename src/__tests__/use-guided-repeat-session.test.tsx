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
  mode: "standard",
  anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
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

const TWO_WORD_PLAN: GuidedRepeatSessionPlan = {
  ...PLAN,
  queue: [
    ...PLAN.queue,
    {
      materialId: "en-US:ee:green",
      word: "green",
      ipa: "/gri:n/",
      targetUnits: ["ee"],
      masculineAudioSrc: "/audio/words/blue/green.mp3",
      feminineAudioSrc: "/audio/words/pink/green.mp3",
    },
  ],
  totalWords: 2,
};

const QUICK_TWO_WORD_PLAN: GuidedRepeatSessionPlan = {
  ...TWO_WORD_PLAN,
  mode: "quick",
};

const QUICK_THREE_WORD_PLAN: GuidedRepeatSessionPlan = {
  ...QUICK_TWO_WORD_PLAN,
  queue: [
    ...TWO_WORD_PLAN.queue,
    {
      materialId: "en-US:ee:beach",
      word: "beach",
      ipa: "/bi:tch/",
      targetUnits: ["ee"],
      masculineAudioSrc: "/audio/words/blue/beach.mp3",
      feminineAudioSrc: "/audio/words/pink/beach.mp3",
    },
  ],
  totalWords: 3,
};

class FakeAudioAdapter implements GuidedRepeatAudioAdapter {
  readonly preload = vi.fn(
    async (_src: string): Promise<AudioMetadata> => ({ durationMs: 100 }),
  );
  readonly play = vi.fn(
    (_src: string, _seekMs?: number, onPlaybackStart?: () => void) =>
      new Promise<void>((resolve) => {
        this.playResolvers.push(resolve);
        if (onPlaybackStart) this.playStartCallbacks.push(onPlaybackStart);
      }),
  );
  readonly pause = vi.fn(
    (): PlaybackPosition => ({
      src: "/audio/ipa/phoneme/green.mp3",
      seekMs: 432,
    }),
  );
  readonly resume = vi.fn(async (onPlaybackStart?: () => void) => {
    onPlaybackStart?.();
  });
  readonly stop = vi.fn();
  readonly unload = vi.fn();
  readonly getDuration = vi.fn((_src: string) => 100);
  private readonly playResolvers: Array<() => void> = [];
  private readonly playStartCallbacks: Array<() => void> = [];

  startPlayback() {
    this.playStartCallbacks.shift()?.();
  }

  finishPlayback() {
    this.playResolvers.shift()?.();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
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

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe("playing");
    expect(result.current.isAudioPlaying).toBe(false);

    act(() => adapter.startPlayback());
    await waitFor(() => expect(result.current.isAudioPlaying).toBe(true));

    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    expect(result.current.isAudioPlaying).toBe(false);
    expect(adapter.pause).toHaveBeenCalledTimes(1);

    act(() => result.current.resume());
    expect(result.current.status).toBe("playing");
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(adapter.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isAudioPlaying).toBe(true));

    act(() => result.current.pause(true));
    expect(result.current.status).toBe("auto-paused");
    expect(result.current.isAudioPlaying).toBe(false);

    unmount();
    expect(adapter.unload).toHaveBeenCalled();
  });

  it("re-lights audio after pausing before the initial play event", async () => {
    const adapter = new FakeAudioAdapter();
    const { result, unmount } = renderHook(() =>
      useGuidedRepeatSession({
        plan: PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    expect(result.current.isAudioPlaying).toBe(false);

    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    expect(result.current.isAudioPlaying).toBe(false);

    act(() => result.current.resume());
    expect(adapter.resume).toHaveBeenCalledTimes(1);
    expect(adapter.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isAudioPlaying).toBe(true));

    unmount();
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
    expect(result.current.isAudioPlaying).toBe(false);
    act(() => adapter.startPlayback());
    await waitFor(() => expect(result.current.isAudioPlaying).toBe(true));
    act(() => adapter.finishPlayback());
    await waitFor(() => expect(result.current.step?.kind).toBe("gap"));
    expect(result.current.isAudioPlaying).toBe(false);

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
    expect(result.current.isAudioPlaying).toBe(false);
    expect(result.current.status).toBe("preloading");

    act(() => {
      for (const resolve of resolvers.splice(0)) {
        resolve({ durationMs: 100 });
      }
    });
    await waitFor(() => expect(result.current.status).toBe("playing"));
  });

  it("replays the current model without letting the interrupted playback advance", async () => {
    const adapter = new FakeAudioAdapter();
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    act(() => result.current.replayCurrent());
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(2));
    expect(adapter.stop).toHaveBeenCalledTimes(1);
    expect(result.current.step).toMatchObject({
      kind: "audio",
      role: "anchor-single",
      turn: 1,
    });

    await act(async () => {
      adapter.finishPlayback();
      await Promise.resolve();
    });
    expect(adapter.play).toHaveBeenCalledTimes(2);
    expect(result.current.step).toMatchObject({
      kind: "audio",
      role: "anchor-single",
      turn: 1,
    });
  });

  it("does not allow word actions to complete an anchor stage", async () => {
    const adapter = new FakeAudioAdapter();
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: QUICK_TWO_WORD_PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    expect(result.current.step).toMatchObject({
      kind: "audio",
      role: "anchor-single",
    });
    expect(result.current.canOperateOnWord).toBe(false);

    act(() => {
      result.current.repeatCurrent();
      result.current.advanceCurrent();
    });

    expect(adapter.stop).not.toHaveBeenCalled();
    expect(result.current.currentWordIndex).toBe(0);
    expect(result.current.completedWords).toBe(0);
    expect(result.current.canOperateOnWord).toBe(false);
    expect(localStorage.getItem("speakright_training_exposure_v1")).toBeNull();
  });

  it("restarts the complete current-word cycle from the first anchor", async () => {
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
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(2), {
      timeout: 1_500,
    });
    expect(result.current.step).toMatchObject({
      kind: "audio",
      role: "anchor-single",
      turn: 2,
    });

    act(() => adapter.finishPlayback());
    await waitFor(
      () =>
        expect(result.current.step).toMatchObject({
          kind: "audio",
          role: "word-masculine",
        }),
      { timeout: 1_500 },
    );
    expect(result.current.canOperateOnWord).toBe(true);

    act(() => result.current.repeatCurrent());
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(4));
    expect(result.current.completedWords).toBe(0);
    expect(result.current.step).toMatchObject({
      kind: "audio",
      role: "anchor-single",
      turn: 1,
    });
  });

  it("advances to the next word and completes cleanly on the final word", async () => {
    const adapter = new FakeAudioAdapter();
    const onWordChange = vi.fn();
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: QUICK_TWO_WORD_PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
        onWordChange,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    act(() => adapter.finishPlayback());
    await waitFor(() => expect(result.current.canOperateOnWord).toBe(true), {
      timeout: 1_500,
    });
    act(() => result.current.advanceCurrent());
    await waitFor(() => expect(result.current.currentWordIndex).toBe(1));
    await waitFor(() => expect(result.current.completedWords).toBe(1));
    expect(result.current.currentItem.word).toBe("green");
    expect(onWordChange).toHaveBeenLastCalledWith(QUICK_TWO_WORD_PLAN.queue[1]);

    await waitFor(() => expect(result.current.canOperateOnWord).toBe(true));
    act(() => result.current.advanceCurrent());
    await waitFor(() => expect(result.current.status).toBe("completed"));
    expect(result.current.completedWords).toBe(2);
    expect(adapter.stop).toHaveBeenCalledTimes(2);
  });

  it("exposes a quick-mode feminine word and preloads the following word", async () => {
    const adapter = new FakeAudioAdapter();
    const { result } = renderHook(() =>
      useGuidedRepeatSession({
        plan: QUICK_THREE_WORD_PLAN,
        rhythm: "flow",
        audioAdapter: adapter,
      }),
    );

    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(1));
    act(() => adapter.finishPlayback());
    await waitFor(() => expect(result.current.canOperateOnWord).toBe(true), {
      timeout: 1_500,
    });
    act(() => result.current.advanceCurrent());
    await waitFor(() => expect(result.current.currentWordIndex).toBe(1));
    await waitFor(() => expect(adapter.play).toHaveBeenCalledTimes(3));

    expect(adapter.play).toHaveBeenLastCalledWith(
      "/audio/words/pink/green.mp3",
      0,
      expect.any(Function),
    );
    await waitFor(() =>
      expect(adapter.preload).toHaveBeenCalledWith(
        "/audio/words/blue/beach.mp3",
      ),
    );
    expect(adapter.preload).toHaveBeenCalledWith("/audio/words/pink/beach.mp3");
    expect(localStorage.getItem("speakright_training_exposure_v1")).toContain(
      "en-US:ee:green",
    );
  });
});
