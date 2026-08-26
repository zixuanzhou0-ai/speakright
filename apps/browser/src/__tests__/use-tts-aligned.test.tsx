import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTtsAligned } from "@/hooks/use-tts-aligned";

interface MockHowlOptions {
  onload?: () => void;
  onplay?: () => void;
  onend?: () => void;
  onstop?: () => void;
  onloaderror?: () => void;
  onplayerror?: () => void;
}

const mocks = vi.hoisted(() => ({
  elevenLabsTtsAligned: vi.fn(),
  hermesXaiTtsAligned: vi.fn(),
  mimoTts: vi.fn(),
  miniMaxTtsAligned: vi.fn(),
  vertexGeminiTts: vi.fn(),
  getElevenLabsConfig: vi.fn(),
  getStandardTtsConfig: vi.fn(),
  getMimoTtsConfig: vi.fn(),
  getMiniMaxTtsConfig: vi.fn(),
  getVertexGeminiTtsConfig: vi.fn(),
  subscribeToStorage: vi.fn(),
  getLanguageAudioPackEntry: vi.fn(),
  getStaticLanguageAudioPackEntry: vi.fn(),
  buildCacheKey: vi.fn(),
  captureTtsCacheEpoch: vi.fn(),
  deleteTtsFromCache: vi.fn(),
  getTtsFromCache: vi.fn(),
  setTtsToCache: vi.fn(),
  subscribeToTtsCacheInvalidation: vi.fn(),
  resumeAudioContext: vi.fn(),
  Howl: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  elevenLabsTtsAligned: mocks.elevenLabsTtsAligned,
  hermesXaiTtsAligned: mocks.hermesXaiTtsAligned,
  mimoTts: mocks.mimoTts,
  miniMaxTtsAligned: mocks.miniMaxTtsAligned,
  vertexGeminiTts: mocks.vertexGeminiTts,
}));

vi.mock("@/lib/api-keys", () => ({
  getElevenLabsConfig: mocks.getElevenLabsConfig,
  getStandardTtsConfig: mocks.getStandardTtsConfig,
  getMimoTtsConfig: mocks.getMimoTtsConfig,
  getMiniMaxTtsConfig: mocks.getMiniMaxTtsConfig,
  getVertexGeminiTtsConfig: mocks.getVertexGeminiTtsConfig,
  subscribeToStorage: mocks.subscribeToStorage,
}));

vi.mock("@/lib/language-audio-pack-cache", () => ({
  getLanguageAudioPackEntry: mocks.getLanguageAudioPackEntry,
}));

vi.mock("@/lib/static-language-audio-pack", () => ({
  getStaticLanguageAudioPackEntry: mocks.getStaticLanguageAudioPackEntry,
}));

vi.mock("@/lib/tts-cache", () => ({
  buildCacheKey: mocks.buildCacheKey,
  captureTtsCacheEpoch: mocks.captureTtsCacheEpoch,
  deleteTtsFromCache: mocks.deleteTtsFromCache,
  getTtsFromCache: mocks.getTtsFromCache,
  setTtsToCache: mocks.setTtsToCache,
  subscribeToTtsCacheInvalidation: mocks.subscribeToTtsCacheInvalidation,
}));

vi.mock("howler", () => ({
  Howler: {
    ctx: {
      state: "suspended",
      resume: mocks.resumeAudioContext,
    },
  },
  Howl: mocks.Howl.mockImplementation(function (
    this: unknown,
    options: MockHowlOptions,
  ) {
    let isPlaying = false;
    return {
      play: () => {
        options.onload?.();
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
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "elevenlabs" });
    mocks.getMiniMaxTtsConfig.mockReturnValue({
      apiKey: "mini-key",
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });
    mocks.getMimoTtsConfig.mockReturnValue({
      apiKey: "mimo-key",
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
    });
    mocks.getVertexGeminiTtsConfig.mockReturnValue({ voiceName: "Kore" });
    mocks.subscribeToStorage.mockImplementation(() => () => {});
    mocks.getTtsFromCache.mockResolvedValue(null);
    mocks.buildCacheKey.mockImplementation(
      (text, voiceIdentity, speed, languageId = "en-US") =>
        `v3:${languageId}:${text}:${voiceIdentity}:${Number(speed).toFixed(2)}`,
    );
    mocks.captureTtsCacheEpoch.mockReturnValue("epoch-7");
    mocks.deleteTtsFromCache.mockResolvedValue(undefined);
    mocks.getLanguageAudioPackEntry.mockResolvedValue(null);
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue(null);
    mocks.setTtsToCache.mockResolvedValue(undefined);
    mocks.subscribeToTtsCacheInvalidation.mockImplementation(() => () => {});
    mocks.resumeAudioContext.mockResolvedValue(undefined);
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
    mocks.hermesXaiTtsAligned.mockResolvedValue({
      audioBlob: new Blob([new Uint8Array([4, 5, 6])], {
        type: "audio/mpeg",
      }),
      alignment: null,
    });
    mocks.miniMaxTtsAligned.mockResolvedValue({
      audioBlob: new Blob([new Uint8Array([10, 11])], {
        type: "audio/mpeg",
      }),
      wordTimings: [
        { word: "Testing", start: 0, end: 0.3 },
        { word: "audio.", start: 0.31, end: 0.7 },
      ],
      alignmentOutcome: "matched",
    });
    mocks.mimoTts.mockResolvedValue(
      new Blob([new Uint8Array([12, 13])], { type: "audio/wav" }),
    );
    mocks.vertexGeminiTts.mockResolvedValue(
      new Blob([new Uint8Array([7, 8, 9])], { type: "audio/wav" }),
    );

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const audioBlob = new Blob([new Uint8Array([1, 2, 3])], {
          type: "audio/mpeg",
        });
        return {
          ok: true,
          blob: async () => audioBlob,
        } as Response;
      }),
    );
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
        "elevenlabs:test-voice:eleven_multilingual_v2",
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
      expect.any(AbortSignal),
    );
    expect(mocks.setTtsToCache).toHaveBeenCalledWith(
      "Bonjour",
      "elevenlabs:test-voice:eleven_multilingual_v2",
      0.84,
      expect.any(Blob),
      expect.any(Object),
      "fr-FR",
      "epoch-7",
    );
  });

  it("explains TTS setup clearly when no provider or local pack is available", async () => {
    mocks.getElevenLabsConfig.mockReturnValue(null);
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Привет, как дела?", {
        languageId: "ru-RU",
      });
    });

    expect(result.current.error).toContain("无法播放标准示范");
    expect(result.current.error).toContain(
      "ElevenLabs、MiniMax、小米 MiMo、爱马仕 Grok 或 Vertex Gemini",
    );
    expect(result.current.error).toContain("随应用提供示范音频");
    expect(result.current.error).toContain("单词词典发音只负责单词复读");
  });

  it("shows Chinese ElevenLabs provider errors when online TTS fails", async () => {
    mocks.elevenLabsTtsAligned.mockRejectedValueOnce(
      new Error(
        "ElevenLabs 请求过于频繁或额度不足，请稍后重试或检查 ElevenLabs 用量。",
      ),
    );
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("This is an online sentence.", {
        languageId: "en-US",
      });
    });

    expect(result.current.error).toContain("无法播放标准示范");
    expect(result.current.error).toContain("ElevenLabs 请求过于频繁或额度不足");
  });

  it("normalizes raw English online TTS failures before showing them", async () => {
    mocks.elevenLabsTtsAligned.mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("This is an online sentence.", {
        languageId: "en-US",
      });
    });

    expect(result.current.error).toContain("无法播放标准示范");
    expect(result.current.error).toContain("无法连接当前标准示范服务");
    expect(result.current.error).not.toContain("Failed to fetch");
  });

  it("uses an installed local language pack when TTS provider is missing", async () => {
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.getLanguageAudioPackEntry.mockResolvedValueOnce({
      audioBlob: new Blob([new Uint8Array([1, 2, 3])], {
        type: "audio/mpeg",
      }),
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("hola", { languageId: "es-ES" });
    });

    expect(result.current.error).toBeNull();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mocks.elevenLabsTtsAligned).not.toHaveBeenCalled();
  });

  it("keeps static language-pack playback gain when replaying", async () => {
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValueOnce({
      audioSrc: "/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3",
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("bonjour", { languageId: "fr-FR" });
    });

    act(() => {
      result.current.replay();
    });

    expect(mocks.Howl).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        src: ["/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3"],
        html5: false,
        volume: 12,
      }),
    );
    expect(mocks.Howl).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        src: ["/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3"],
        html5: false,
        volume: 12,
      }),
    );
  });

  it("prefers a static local language pack before using a configured TTS provider", async () => {
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValueOnce({
      audioSrc: "/audio/language-packs/es-ES/hola.mp3",
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("hola", { languageId: "es-ES" });
    });

    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/audio/language-packs/es-ES/hola.mp3", {
      signal: expect.any(AbortSignal),
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.getTtsFromCache).not.toHaveBeenCalled();
    expect(mocks.elevenLabsTtsAligned).not.toHaveBeenCalled();
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();
    expect(mocks.resumeAudioContext).toHaveBeenCalled();
  });

  it("keeps playback gain for static local language-pack audio", async () => {
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValueOnce({
      audioSrc: "/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3",
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("bonjour", { languageId: "fr-FR" });
    });

    expect(mocks.Howl).toHaveBeenCalledWith(
      expect.objectContaining({
        src: ["/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3"],
        html5: false,
        volume: 12,
      }),
    );
    expect(mocks.elevenLabsTtsAligned).not.toHaveBeenCalled();
  });

  it("aggregates Hermes character alignment into word timings and replays without another request", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "hermes-grok" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.hermesXaiTtsAligned.mockResolvedValueOnce({
      audioBlob: new Blob([new Uint8Array([4, 5, 6])], {
        type: "audio/mpeg",
      }),
      alignment: {
        characters: Array.from("Hermes audio."),
        character_start_times_seconds: [
          0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6,
        ],
        character_end_times_seconds: [
          0.04, 0.09, 0.14, 0.19, 0.24, 0.29, 0.34, 0.39, 0.44, 0.49, 0.54,
          0.59, 0.64,
        ],
      },
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Hermes audio.", {
        languageId: "en-US",
        speed: 0.9,
      });
    });

    expect(mocks.getTtsFromCache).not.toHaveBeenCalled();
    expect(mocks.hermesXaiTtsAligned).toHaveBeenCalledWith("Hermes audio.", {
      languageId: "en-US",
      speed: 0.9,
      signal: expect.any(AbortSignal),
    });
    expect(mocks.elevenLabsTtsAligned).not.toHaveBeenCalled();
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();
    expect(result.current.wordTimings).toEqual([
      { word: "Hermes", start: 0, end: 0.29 },
      { word: "audio.", start: 0.35, end: 0.64 },
    ]);
    expect(result.current.hasAudio).toBe(true);

    act(() => result.current.replay());
    expect(mocks.Howl).toHaveBeenCalledTimes(2);
    expect(mocks.hermesXaiTtsAligned).toHaveBeenCalledTimes(1);
  });

  it("keeps Hermes playback available when an older bridge has no alignment", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "hermes-grok" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Audio only.", { speed: 1 });
    });

    expect(result.current.wordTimings).toEqual([]);
    expect(result.current.hasAudio).toBe(true);
    expect(mocks.Howl).toHaveBeenCalledTimes(1);
  });

  it("maps MiniMax official word timestamps to UI tokens and caches the timeline", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "minimax" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.miniMaxTtsAligned.mockResolvedValueOnce({
      audioBlob: new Blob([new Uint8Array([10, 11])], {
        type: "audio/mpeg",
      }),
      wordTimings: [
        { word: "I", start: 0, end: 0.1 },
        { word: "'m", start: 0.1, end: 0.22 },
        { word: "ready", start: 0.25, end: 0.7 },
        { word: ".", start: 0.7, end: 0.73 },
      ],
      alignmentOutcome: "matched",
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("I'm ready.", {
        languageId: "en-US",
        speed: 0.9,
      });
    });

    expect(mocks.miniMaxTtsAligned).toHaveBeenCalledWith(
      "mini-key",
      "I'm ready.",
      {
        modelId: "speech-2.8-turbo",
        voiceId: "English_expressive_narrator",
        languageId: "en-US",
        speed: 0.9,
        signal: expect.any(AbortSignal),
      },
    );
    expect(result.current.wordTimings).toEqual([
      { word: "I'm", start: 0, end: 0.22 },
      { word: "ready.", start: 0.25, end: 0.7 },
    ]);
    expect(mocks.setTtsToCache).toHaveBeenCalledWith(
      "I'm ready.",
      "minimax:English_expressive_narrator:speech-2.8-turbo",
      0.9,
      expect.any(Blob),
      {
        kind: "word-timings",
        items: [
          { word: "I'm", start: 0, end: 0.22 },
          { word: "ready.", start: 0.25, end: 0.7 },
        ],
      },
      "en-US",
      "epoch-7",
    );
  });

  it("falls back to sentence playback when MiniMax expands a displayed token", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "minimax" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.getMiniMaxTtsConfig.mockReturnValue({
      apiKey: "mini-key",
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });
    mocks.miniMaxTtsAligned.mockResolvedValueOnce({
      audioBlob: new Blob([new Uint8Array([12, 13])], {
        type: "audio/mpeg",
      }),
      wordTimings: [
        { word: "Read", start: 0, end: 0.2 },
        { word: "twenty", start: 0.22, end: 0.4 },
        { word: "twenty-six", start: 0.42, end: 0.7 },
        { word: "now", start: 0.72, end: 0.9 },
      ],
      alignmentOutcome: "transcript-mismatch",
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Read 2026 now", {
        languageId: "en-US",
        speed: 0.9,
      });
    });

    expect(result.current.wordTimings).toEqual([]);
    expect(mocks.setTtsToCache).toHaveBeenCalledWith(
      "Read 2026 now",
      "minimax:English_expressive_narrator:speech-2.8-turbo",
      0.9,
      expect.any(Blob),
      { kind: "word-timings", items: [] },
      "en-US",
      "epoch-7",
    );
  });

  it("retries MiniMax after a transient subtitle failure and restores word timing", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "minimax" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.miniMaxTtsAligned
      .mockResolvedValueOnce({
        audioBlob: new Blob([new Uint8Array([12, 13])], {
          type: "audio/mpeg",
        }),
        wordTimings: [],
        alignmentOutcome: "transient-unavailable",
      })
      .mockResolvedValueOnce({
        audioBlob: new Blob([new Uint8Array([14, 15])], {
          type: "audio/mpeg",
        }),
        wordTimings: [
          { word: "Recover", start: 0, end: 0.35 },
          { word: "timing.", start: 0.36, end: 0.8 },
        ],
        alignmentOutcome: "matched",
      });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Recover timing.", 0.9);
    });
    expect(result.current.wordTimings).toEqual([]);
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.speak("Recover timing.", 0.9);
    });
    expect(mocks.miniMaxTtsAligned).toHaveBeenCalledTimes(2);
    expect(result.current.wordTimings).toEqual([
      { word: "Recover", start: 0, end: 0.35 },
      { word: "timing.", start: 0.36, end: 0.8 },
    ]);
    expect(mocks.setTtsToCache).toHaveBeenCalledOnce();
  });

  it("keeps MiMo sentence-untimed and caches audio without invented timing", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "mimo" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("MiMo audio.", {
        languageId: "en-US",
        speed: 1,
      });
    });

    expect(mocks.mimoTts).toHaveBeenCalledWith("mimo-key", "MiMo audio.", {
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
      languageId: "en-US",
      speed: 1,
      signal: expect.any(AbortSignal),
    });
    expect(result.current.wordTimings).toEqual([]);
    expect(mocks.setTtsToCache).toHaveBeenCalledWith(
      "MiMo audio.",
      "mimo:Mia:mimo-v2.5-tts:prompt-v1",
      1,
      expect.any(Blob),
      null,
      "en-US",
      "epoch-7",
    );
    expect(result.current.hasAudio).toBe(true);
  });

  it("routes Vertex WAV audio without persistent cache or fake alignment", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "vertex-gemini" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.getVertexGeminiTtsConfig.mockReturnValue({ voiceName: "Callirrhoe" });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Vertex audio.", {
        languageId: "fr-FR",
        speed: 0.9,
      });
    });

    expect(mocks.getTtsFromCache).not.toHaveBeenCalled();
    expect(mocks.vertexGeminiTts).toHaveBeenCalledWith("Vertex audio.", {
      languageId: "fr-FR",
      speed: 0.9,
      voiceName: "Callirrhoe",
      signal: expect.any(AbortSignal),
    });
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();
    expect(result.current.wordTimings).toEqual([]);
    expect(result.current.hasAudio).toBe(true);
    expect(mocks.Howl).toHaveBeenCalledWith(
      expect.objectContaining({ format: ["wav"] }),
    );
  });

  it("keeps loading active until playback really starts", async () => {
    let events: MockHowlOptions | undefined;
    mocks.Howl.mockImplementationOnce(function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      events = options;
      let isPlaying = false;
      return {
        play: () => {
          isPlaying = true;
          return 1;
        },
        playing: () => isPlaying,
        seek: () => 0,
        unload: () => {
          isPlaying = false;
        },
      };
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    expect(mocks.setTtsToCache).not.toHaveBeenCalled();

    // Simulate another tab clearing local data before this Blob decodes.
    mocks.captureTtsCacheEpoch.mockReturnValue("epoch-8");
    act(() => events?.onload?.());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasAudio).toBe(true);
    expect(mocks.setTtsToCache).toHaveBeenCalledOnce();
    expect(mocks.setTtsToCache.mock.calls[0]?.at(-1)).toBe("epoch-7");

    act(() => events?.onplay?.());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(true);

    act(() => events?.onend?.());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(true);
  });

  it("reports playback errors while keeping successfully loaded audio replayable", async () => {
    let events: MockHowlOptions | undefined;
    mocks.Howl.mockImplementationOnce(function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      events = options;
      return {
        play: () => 1,
        playing: () => false,
        seek: () => 0,
        unload: vi.fn(),
      };
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });
    act(() => {
      events?.onload?.();
      events?.onplayerror?.();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(true);
    expect(result.current.error).toContain("音频播放失败");
  });

  it("clears replay state when the current Howl fails to load", async () => {
    let events: MockHowlOptions | undefined;
    mocks.Howl.mockImplementationOnce(function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      events = options;
      return {
        play: () => 1,
        playing: () => false,
        seek: () => 0,
        unload: vi.fn(),
      };
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });
    act(() => events?.onloaderror?.());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    expect(result.current.error).toContain("音频加载失败");

    act(() => result.current.replay());
    expect(mocks.Howl).toHaveBeenCalledTimes(1);
  });

  it("evicts undecodable cached audio so retry calls the provider", async () => {
    let cachedEvents: MockHowlOptions | undefined;
    mocks.getTtsFromCache
      .mockResolvedValueOnce({
        audioBlob: new Blob([new Uint8Array([0xff])], {
          type: "audio/mpeg",
        }),
        alignment: null,
      })
      .mockResolvedValueOnce(null);
    mocks.Howl.mockImplementationOnce(function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      cachedEvents = options;
      return {
        play: () => 1,
        playing: () => false,
        seek: () => 0,
        unload: vi.fn(),
      };
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Broken cache.", 0.85);
    });
    expect(mocks.elevenLabsTtsAligned).not.toHaveBeenCalled();

    act(() => cachedEvents?.onloaderror?.());
    expect(mocks.deleteTtsFromCache).toHaveBeenCalledWith(
      "Broken cache.",
      "elevenlabs:test-voice:eleven_flash_v2_5",
      0.85,
      "en-US",
    );

    await act(async () => {
      await result.current.speak("Broken cache.", 0.85);
    });

    expect(mocks.getTtsFromCache).toHaveBeenCalledTimes(1);
    expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledOnce();
    expect(mocks.setTtsToCache).toHaveBeenCalledOnce();
  });

  it("settles playback state when the current Howl stops", async () => {
    let events: MockHowlOptions | undefined;
    mocks.Howl.mockImplementationOnce(function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      events = options;
      let isPlaying = false;
      return {
        play: () => {
          isPlaying = true;
          return 1;
        },
        playing: () => isPlaying,
        seek: () => 0.5,
        unload: () => {
          isPlaying = false;
        },
      };
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });
    act(() => {
      events?.onload?.();
      events?.onplay?.();
      events?.onstop?.();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.hasAudio).toBe(true);
  });

  it("handles a Howl constructor exception without exposing replay", async () => {
    mocks.Howl.mockImplementationOnce(() => {
      throw new Error("constructor failed");
    });
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    expect(result.current.error).toContain("无法开始播放");
  });

  it("handles a synchronous Howl play exception without exposing replay", async () => {
    mocks.Howl.mockImplementationOnce(() => ({
      play: () => {
        throw new Error("play failed");
      },
      playing: () => false,
      seek: () => 0,
      unload: vi.fn(),
    }));
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    expect(result.current.error).toContain("无法开始播放");
  });

  it("ignores callbacks from an older Howl generation", async () => {
    const generations: MockHowlOptions[] = [];
    const createControlledHowl = function (
      this: unknown,
      options: MockHowlOptions,
    ) {
      generations.push(options);
      let isPlaying = false;
      return {
        play: () => {
          isPlaying = true;
          return 1;
        },
        playing: () => isPlaying,
        seek: () => 0,
        unload: () => {
          isPlaying = false;
        },
      };
    };
    mocks.Howl.mockImplementationOnce(createControlledHowl);
    mocks.Howl.mockImplementationOnce(createControlledHowl);
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("First audio.", 0.85);
      await result.current.speak("Second audio.", 0.85);
    });
    act(() => {
      generations[1]?.onload?.();
      generations[1]?.onplay?.();
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.hasAudio).toBe(true);

    act(() => {
      generations[0]?.onloaderror?.();
      generations[0]?.onplayerror?.();
      generations[0]?.onend?.();
    });

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.hasAudio).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("invalidates loaded audio when TTS configuration changes", async () => {
    const { result } = renderHook(() => useTtsAligned());

    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });
    expect(result.current.hasAudio).toBe(true);

    const storageSubscriber = mocks.subscribeToStorage.mock.calls.at(-1)?.[0];
    act(() => storageSubscriber?.());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    expect(result.current.wordTimings).toEqual([]);
  });

  it("stops playback and clears replay audio when the TTS cache is cleared", async () => {
    const { result } = renderHook(() => useTtsAligned());
    await act(async () => {
      await result.current.speak("Testing audio.", 0.85);
    });
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.hasAudio).toBe(true);
    const howlCallsBeforeClear = mocks.Howl.mock.calls.length;

    const cacheInvalidationSubscriber =
      mocks.subscribeToTtsCacheInvalidation.mock.calls.at(-1)?.[0];
    act(() => cacheInvalidationSubscriber?.());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.hasAudio).toBe(false);
    act(() => result.current.replay());
    expect(mocks.Howl).toHaveBeenCalledTimes(howlCallsBeforeClear);
  });

  it("aborts a pending provider request when the TTS cache is cleared", async () => {
    const pending = deferred<{
      audio_base64: string;
      alignment: null;
    }>();
    mocks.elevenLabsTtsAligned.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useTtsAligned());
    let speakPromise!: Promise<void>;

    await act(async () => {
      speakPromise = result.current.speak("Pending audio.", 0.85);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledOnce();
    });
    const signal = mocks.elevenLabsTtsAligned.mock.calls[0]?.at(-1) as
      | AbortSignal
      | undefined;

    const cacheInvalidationSubscriber =
      mocks.subscribeToTtsCacheInvalidation.mock.calls.at(-1)?.[0];
    act(() => cacheInvalidationSubscriber?.());
    expect(signal?.aborted).toBe(true);

    pending.resolve({ audio_base64: "AA==", alignment: null });
    await act(async () => {
      await speakPromise;
    });
    expect(mocks.Howl).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasAudio).toBe(false);
  });

  it("lets a new text, language, and speed identity supersede an older request", async () => {
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
      void result.current.speak("Old text.", {
        languageId: "en-US",
        speed: 0.8,
      });
    });
    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledTimes(1);
    });
    const firstSignal = mocks.elevenLabsTtsAligned.mock.calls[0]?.[5] as
      | AbortSignal
      | undefined;

    await act(async () => {
      await result.current.speak("Bonjour", {
        languageId: "fr-FR",
        speed: 0.9,
      });
    });
    expect(mocks.elevenLabsTtsAligned).toHaveBeenLastCalledWith(
      "test-key",
      "test-voice",
      "Bonjour",
      "eleven_multilingual_v2",
      { speed: 0.9, languageCode: "fr" },
      expect.any(AbortSignal),
    );
    expect(firstSignal?.aborted).toBe(true);

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

    expect(mocks.Howl).toHaveBeenCalledTimes(1);
    expect(result.current.hasAudio).toBe(true);
  });

  it("invalidates an in-flight request when the subscribed TTS configuration changes", async () => {
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
      void result.current.speak("Pending audio.", 0.85);
    });
    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledTimes(1);
    });
    const pendingSignal = mocks.elevenLabsTtsAligned.mock.calls[0]?.[5] as
      | AbortSignal
      | undefined;

    const storageSubscriber = mocks.subscribeToStorage.mock.calls.at(-1)?.[0];
    act(() => storageSubscriber?.());
    expect(pendingSignal?.aborted).toBe(true);

    await act(async () => {
      pending.resolve({
        audio_base64: "AA==",
        alignment: {
          characters: Array.from("Pending audio."),
          character_start_times_seconds: Array.from(
            { length: 14 },
            (_, index) => index * 0.05,
          ),
          character_end_times_seconds: Array.from(
            { length: 14 },
            (_, index) => index * 0.05 + 0.04,
          ),
        },
      });
      await pending.promise;
    });

    expect(mocks.Howl).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasAudio).toBe(false);
  });

  it("aborts an in-flight request when playback is stopped", async () => {
    const pending = deferred<{
      audio_base64: string;
      alignment: null;
    }>();
    mocks.elevenLabsTtsAligned.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useTtsAligned());

    act(() => {
      void result.current.speak("Pending audio.", 0.85);
    });
    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledTimes(1);
    });
    const signal = mocks.elevenLabsTtsAligned.mock.calls[0]?.[5] as
      | AbortSignal
      | undefined;

    act(() => result.current.stop());
    expect(signal?.aborted).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      pending.resolve({ audio_base64: "AA==", alignment: null });
      await pending.promise;
    });
    expect(mocks.Howl).not.toHaveBeenCalled();
  });

  it("aborts an in-flight request when the hook unmounts", async () => {
    const pending = deferred<{
      audio_base64: string;
      alignment: null;
    }>();
    mocks.elevenLabsTtsAligned.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useTtsAligned());

    act(() => {
      void result.current.speak("Pending audio.", 0.85);
    });
    await waitFor(() => {
      expect(mocks.elevenLabsTtsAligned).toHaveBeenCalledTimes(1);
    });
    const signal = mocks.elevenLabsTtsAligned.mock.calls[0]?.[5] as
      | AbortSignal
      | undefined;

    unmount();
    expect(signal?.aborted).toBe(true);

    pending.resolve({ audio_base64: "AA==", alignment: null });
    await pending.promise;
    expect(mocks.Howl).not.toHaveBeenCalled();
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
        expect.any(AbortSignal),
      );
    });

    const pendingSignal = mocks.elevenLabsTtsAligned.mock.calls[0]?.[5] as
      | AbortSignal
      | undefined;

    act(() => {
      result.current.reset();
    });
    expect(pendingSignal?.aborted).toBe(true);

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
