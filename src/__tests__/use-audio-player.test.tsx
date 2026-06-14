import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "@/hooks/use-audio-player";

type MockHowlInstance = {
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  unload: ReturnType<typeof vi.fn>;
};

const howlerMock = vi.hoisted(() => ({
  Howl: vi.fn(),
  instances: [] as MockHowlInstance[],
}));

vi.mock("howler", () => ({
  Howl: howlerMock.Howl,
}));

beforeEach(() => {
  howlerMock.instances.length = 0;
  howlerMock.Howl.mockImplementation(function MockHowl(options: {
    onplay?: () => void;
  }) {
    const instance: MockHowlInstance = {
      play: vi.fn(() => {
        options.onplay?.();
        return 3;
      }),
      stop: vi.fn(),
      unload: vi.fn(),
    };
    howlerMock.instances.push(instance);
    return instance;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAudioPlayer", () => {
  it("refuses video-backed sources so speaker controls cannot play teaching video tracks", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.play("/videos/language-assets/fr-FR/articulation/fr-schwa.mp4", {
        maxDurationMs: 500,
      });
    });

    expect(howlerMock.Howl).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Refusing to play video-backed audio"),
    );
  });

  it("still plays normal local audio sources", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.play("/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a", {
        maxDurationMs: 500,
      });
    });

    expect(howlerMock.Howl).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[0].play).toHaveBeenCalledTimes(1);
    expect(result.current.isPlaying).toBe(true);
  });

  it("passes boosted local playback volume through to Howl", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.play("/audio/ipa/normal/cat.mp3", { volume: 1.6 });
    });

    expect(howlerMock.Howl).toHaveBeenCalledWith(
      expect.objectContaining({
        src: ["/audio/ipa/normal/cat.mp3"],
        volume: 1.6,
      }),
    );
  });
});
