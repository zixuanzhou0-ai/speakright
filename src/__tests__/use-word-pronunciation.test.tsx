import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";

const mocks = vi.hoisted(() => ({
  fetchPronunciation: vi.fn(),
  getLanguageAudioPackEntry: vi.fn(),
  getStaticLanguageAudioPackEntry: vi.fn(),
  calculateAudioNormalization: vi.fn(),
  getLocalAudioPlaybackVolume: vi.fn(),
  selectPeakSafePlaybackGain: vi.fn(),
  resumeAudioContext: vi.fn(),
  decodeAudioData: vi.fn(),
  fetchSources: [] as string[],
  howlSources: [] as string[],
  howlVolumes: [] as number[],
  howlHtml5: [] as boolean[],
  failNextLocalAudio: false,
  webAudioSources: [] as Array<{
    buffer: AudioBuffer | null;
    onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>,
  webAudioGainNodes: [] as Array<{
    gain: { value: number };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>,
}));

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

vi.mock("@/lib/api-client", () => ({
  fetchPronunciation: mocks.fetchPronunciation,
}));

vi.mock("@/lib/language-audio-pack-cache", () => ({
  getLanguageAudioPackEntry: mocks.getLanguageAudioPackEntry,
}));

vi.mock("@/lib/static-language-audio-pack", () => ({
  getStaticLanguageAudioPackEntry: mocks.getStaticLanguageAudioPackEntry,
}));

vi.mock("@/lib/audio-normalization", () => ({
  calculateAudioNormalization: mocks.calculateAudioNormalization,
  getLocalAudioPlaybackVolume: mocks.getLocalAudioPlaybackVolume,
  selectPeakSafePlaybackGain: mocks.selectPeakSafePlaybackGain,
  shouldNormalizeLocalAudioSrc: (src: string) =>
    src.startsWith("/audio/words/") || src.startsWith("/audio/language-packs/"),
}));

vi.mock("howler", () => ({
  Howler: {
    ctx: {
      state: "suspended",
      resume: mocks.resumeAudioContext,
      destination: {},
      decodeAudioData: mocks.decodeAudioData,
      createBufferSource: vi.fn(() => {
        const source = {
          buffer: null,
          onended: null,
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        mocks.webAudioSources.push(source);
        return source;
      }),
      createGain: vi.fn(() => {
        const gainNode = {
          gain: { value: 1 },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
        mocks.webAudioGainNodes.push(gainNode);
        return gainNode;
      }),
    },
  },
  Howl: vi.fn().mockImplementation(function (
    this: unknown,
    options: {
      src: string[];
      volume?: number;
      html5?: boolean;
      onplay?: () => void;
      onloaderror?: () => void;
    },
  ) {
    return {
      play: () => {
        const src = options.src[0];
        mocks.howlSources.push(src);
        mocks.howlVolumes.push(options.volume ?? 1);
        mocks.howlHtml5.push(options.html5 ?? false);
        if (mocks.failNextLocalAudio && src.startsWith("/audio/words/")) {
          mocks.failNextLocalAudio = false;
          options.onloaderror?.();
        } else {
          options.onplay?.();
        }
        return 1;
      },
      unload: vi.fn(),
    };
  }),
}));

describe("useWordPronunciation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.howlSources.length = 0;
    mocks.howlVolumes.length = 0;
    mocks.howlHtml5.length = 0;
    mocks.fetchSources.length = 0;
    mocks.webAudioSources.length = 0;
    mocks.webAudioGainNodes.length = 0;
    mocks.failNextLocalAudio = false;
    mocks.calculateAudioNormalization.mockReturnValue({
      rms: 0.02,
      peak: 0.08,
      sampleCount: 2,
      gain: 3,
    });
    mocks.decodeAudioData.mockResolvedValue({
      numberOfChannels: 1,
      getChannelData: () => Float32Array.from([0.01, -0.01]),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (src: string) => {
        mocks.fetchSources.push(String(src));
        if (
          mocks.failNextLocalAudio &&
          String(src).startsWith("/audio/words/")
        ) {
          mocks.failNextLocalAudio = false;
          return {
            ok: false,
            status: 404,
            arrayBuffer: async () => new ArrayBuffer(0),
          };
        }
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8),
        };
      }),
    );
    mocks.fetchPronunciation.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    );
    mocks.getLanguageAudioPackEntry.mockResolvedValue(null);
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue(null);
    mocks.getLocalAudioPlaybackVolume.mockReturnValue(1);
    mocks.selectPeakSafePlaybackGain.mockImplementation(
      (normalization: { gain: number }, fallbackGain: number) =>
        Math.max(normalization.gain, fallbackGain),
    );
    mocks.resumeAudioContext.mockResolvedValue(undefined);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:pronunciation"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("uses bundled static language audio before installed packs and APIs", async () => {
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue({
      audioSrc: "/audio/language-packs/es-ES/hola.mp3",
    });
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hola", "blue", "es-ES");
    });

    await waitFor(() => {
      expect(mocks.getStaticLanguageAudioPackEntry).toHaveBeenCalledWith(
        "es-ES",
        "hola",
        "blue",
      );
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.getLanguageAudioPackEntry).not.toHaveBeenCalled();
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
    expect(mocks.fetchSources).toEqual([
      "/audio/language-packs/es-ES/hola.mp3",
    ]);
    expect(mocks.webAudioSources).toHaveLength(1);
    expect(mocks.webAudioGainNodes[0]?.gain.value).toBe(3);
    expect(mocks.howlSources).toEqual([]);
  });

  it("passes the requested voice slot to bundled non-English packs", async () => {
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue({
      audioSrc: "/audio/language-packs/fr-FR/bonjour-pink.mp3",
      voiceSlot: "pink",
    });
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("bonjour", "pink", "fr-FR");
    });

    await waitFor(() => {
      expect(mocks.getStaticLanguageAudioPackEntry).toHaveBeenCalledWith(
        "fr-FR",
        "bonjour",
        "pink",
      );
    });
    expect(mocks.getLanguageAudioPackEntry).not.toHaveBeenCalled();
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
    expect(mocks.fetchSources).toEqual([
      "/audio/language-packs/fr-FR/bonjour-pink.mp3",
    ]);
    expect(mocks.webAudioSources).toHaveLength(1);
    expect(mocks.howlSources).toEqual([]);
  });

  it("applies local Web Audio gain to bundled non-English A/B voices", async () => {
    mocks.calculateAudioNormalization.mockReturnValue({
      rms: 0.05,
      peak: 0.3,
      sampleCount: 2,
      gain: 1.4,
    });
    mocks.getLocalAudioPlaybackVolume.mockReturnValue(1.8);
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue({
      audioSrc: "/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
      voiceSlot: "blue",
    });
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("accueil", "blue", "fr-FR");
    });

    expect(mocks.getLocalAudioPlaybackVolume).toHaveBeenCalledWith(
      "/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
    );
    expect(mocks.selectPeakSafePlaybackGain).toHaveBeenCalledWith(
      {
        rms: 0.05,
        peak: 0.3,
        sampleCount: 2,
        gain: 1.4,
      },
      1.8,
    );
    expect(mocks.fetchSources).toEqual([
      "/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
    ]);
    expect(mocks.webAudioGainNodes[0]?.gain.value).toBe(1.8);
    expect(mocks.howlSources).toEqual([]);
  });

  it("uses the active non-English language audio pack before Youdao fallback", async () => {
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/mpeg" });
    mocks.getLanguageAudioPackEntry.mockResolvedValue({ audioBlob });
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("bonjour", "blue", "fr-FR");
    });

    await waitFor(() => {
      expect(mocks.getLanguageAudioPackEntry).toHaveBeenCalledWith(
        "fr-FR",
        "bonjour",
      );
    });
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
    expect(mocks.howlSources).toEqual(["blob:pronunciation"]);
    expect(mocks.getLocalAudioPlaybackVolume).not.toHaveBeenCalled();
    expect(mocks.howlHtml5).toEqual([true]);
  });

  it("does not silently fall back to Youdao for missing non-English local audio", async () => {
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("j’aime", "blue", "fr-FR");
    });

    await waitFor(() => {
      expect(result.current.error).toContain("暂无");
    });
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
    expect(mocks.fetchSources).toEqual([]);
    expect(mocks.howlSources).toEqual([]);
  });

  it("plays bundled English word audio before calling Youdao", async () => {
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "blue", "en-US");
    });

    expect(mocks.fetchSources).toEqual(["/audio/words/blue/hello.mp3"]);
    expect(mocks.webAudioSources).toHaveLength(1);
    expect(mocks.webAudioGainNodes[0]?.gain.value).toBe(3);
    expect(mocks.howlSources).toEqual([]);
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
  });

  it("applies local Web Audio gain to bundled English A/B voices", async () => {
    mocks.calculateAudioNormalization.mockReturnValue({
      rms: 0.04,
      peak: 0.2,
      sampleCount: 2,
      gain: 2.4,
    });
    mocks.getLocalAudioPlaybackVolume.mockReturnValue(1);
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "pink", "en-US");
    });

    expect(mocks.getLocalAudioPlaybackVolume).toHaveBeenCalledWith(
      "/audio/words/pink/hello.mp3",
    );
    expect(mocks.fetchSources).toEqual(["/audio/words/pink/hello.mp3"]);
    expect(mocks.webAudioGainNodes[0]?.gain.value).toBe(2.4);
    expect(mocks.howlSources).toEqual([]);
  });

  it("uses the peak-safe gain selected by the normalization helper", async () => {
    mocks.calculateAudioNormalization.mockReturnValue({
      rms: 0.03,
      peak: 0.5,
      sampleCount: 2,
      gain: 1.4,
    });
    mocks.getLocalAudioPlaybackVolume.mockReturnValue(5);
    mocks.selectPeakSafePlaybackGain.mockReturnValue(1.88);
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue({
      audioSrc: "/audio/language-packs/ru-RU/slovo.mp3",
      voiceSlot: "blue",
    });
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("слово", "blue", "ru-RU");
    });

    expect(mocks.selectPeakSafePlaybackGain).toHaveBeenCalledWith(
      {
        rms: 0.03,
        peak: 0.5,
        sampleCount: 2,
        gain: 1.4,
      },
      5,
    );
    expect(mocks.webAudioGainNodes[0]?.gain.value).toBe(1.88);
  });

  it("falls back to Youdao when bundled English word audio is missing", async () => {
    mocks.failNextLocalAudio = true;
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "blue", "en-US");
    });

    await waitFor(() => {
      expect(mocks.fetchPronunciation).toHaveBeenCalledWith("hello");
    });
    expect(mocks.fetchSources).toEqual(["/audio/words/blue/hello.mp3"]);
    expect(mocks.howlSources).toEqual(["blob:pronunciation"]);
  });

  it("ignores stale online fallback errors after a newer word starts playing", async () => {
    const deferred = createDeferred<Blob>();
    mocks.failNextLocalAudio = true;
    mocks.fetchPronunciation.mockReturnValueOnce(deferred.promise);
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "blue", "en-US");
    });

    await waitFor(() => {
      expect(mocks.fetchPronunciation).toHaveBeenCalledWith("hello");
    });

    await act(async () => {
      result.current.playWord("world", "blue", "en-US");
    });

    await waitFor(() => {
      expect(mocks.fetchSources).toEqual([
        "/audio/words/blue/hello.mp3",
        "/audio/words/blue/world.mp3",
      ]);
    });
    await waitFor(() => {
      expect(result.current.isPlaying).toBe(true);
    });

    await act(async () => {
      deferred.reject(new Error("Failed to fetch"));
      await deferred.promise.catch(() => undefined);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isPlaying).toBe(true);
    expect(mocks.howlSources).toEqual([]);
  });

  it("shows the online dictionary failure reason when English fallback fails", async () => {
    mocks.failNextLocalAudio = true;
    mocks.fetchPronunciation.mockRejectedValueOnce(
      new Error(
        "无法连接在线词典发音，请检查网络后重试；已内置的本地音频不受影响。",
      ),
    );
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "blue", "en-US");
    });

    await waitFor(() => {
      expect(result.current.error).toContain("在线发音兜底失败");
    });
    expect(result.current.error).toContain("无法连接在线词典发音");
  });
});
