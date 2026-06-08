import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTtsAligned } from "@/hooks/use-tts-aligned";

const mocks = vi.hoisted(() => ({
  elevenLabsTtsAligned: vi.fn(),
  getElevenLabsConfig: vi.fn(),
  getTtsFromCache: vi.fn(),
  setTtsToCache: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  elevenLabsTtsAligned: mocks.elevenLabsTtsAligned,
}));

vi.mock("@/lib/api-keys", () => ({
  getElevenLabsConfig: mocks.getElevenLabsConfig,
}));

vi.mock("@/lib/tts-cache", () => ({
  getTtsFromCache: mocks.getTtsFromCache,
  setTtsToCache: mocks.setTtsToCache,
}));

vi.mock("howler", () => ({
  Howl: vi.fn().mockImplementation((options) => {
    let isPlaying = false;
    return {
      play: () => {
        isPlaying = true;
        options.onplay?.();
        return 1;
      },
      playing: () => isPlaying,
      seek: () => 0,
      stop: () => {
        isPlaying = false;
        options.onstop?.();
      },
      unload: () => {
        isPlaying = false;
      },
    };
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useTtsAligned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getElevenLabsConfig.mockReturnValue({
      apiKey: "test-key",
      voiceId: "test-voice",
      modelId: "eleven_flash_v2_5",
    });
    mocks.getTtsFromCache.mockResolvedValue(null);
    mocks.setTtsToCache.mockResolvedValue(undefined);
    mocks.elevenLabsTtsAligned.mockResolvedValue({
      audio_base64: "AA==",
      alignment: {
        characters: Array.from("Testing audio."),
        character_start_times_seconds: [
          0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6,
          0.65,
        ],
        character_end_times_seconds: [
          0.04, 0.09, 0.14, 0.19, 0.24, 0.29, 0.34, 0.39, 0.44, 0.49, 0.54,
          0.59, 0.64, 0.69,
        ],
      },
    });

    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) =>
      window.clearTimeout(id),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-audio"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("clears aligned subtitles and replay audio when reset", async () => {
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });

    await waitFor(() => {
      expect(result.current.wordTimings.map((timing) => timing.word)).toEqual([
        "Testing",
        "audio.",
      ]);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.wordTimings).toEqual([]);
    expect(result.current.currentTime).toBe(0);

    act(() => {
      result.current.replay();
    });

    expect(result.current.wordTimings).toEqual([]);
  });

  it("uses language pack defaults and language-separated cache for non-English TTS", async () => {
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Bonjour", { languageId: "fr-FR" });
    });

    await waitFor(() => {
      expect(mocks.getTtsFromCache).toHaveBeenCalledWith(
        "Bonjour",
        "test-voice",
        0.84,
        "fr-FR",
      );
    });

    expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledWith(
      "test-key",
      "test-voice",
      "Bonjour",
      "eleven_multilingual_v2",
      {
        speed: 0.84,
        languageCode: "fr",
      },
    );
    expect(mocks.setTtsToCache).toHaveBeenCalledWith(
      "Bonjour",
      "test-voice",
      0.84,
      expect.any(Blob),
      expect.any(Object),
      "fr-FR",
    );
  });

  it("ignores a stale pending TTS response after reset", async () => {
    const pending = deferred<{
      audio_base64: string;
      alignment: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    }>();
    mocks.elevenLabsTtsAligned.mockReturnValueOnce(pending.promise);

    const { result } = renderHook(() => useTtsAligned());

    act(() => {
      void result.current.speak("Old text.", 0.85);
    });

    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledWith(
        "test-key",
        "test-voice",
        "Old text.",
        "eleven_flash_v2_5",
        0.85,
      );
    });

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      pending.resolve({
        audio_base64: "AA==",
        alignment: {
          characters: Array.from("Old text."),
          character_start_times_seconds: [
            0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4,
          ],
          character_end_times_seconds: [
            0.04, 0.09, 0.14, 0.19, 0.24, 0.29, 0.34, 0.39, 0.44,
          ],
        },
      });
      await pending.promise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.wordTimings).toEqual([]);
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
