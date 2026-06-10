import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";

const mocks = vi.hoisted(() => ({
  fetchPronunciation: vi.fn(),
  getLanguageAudioPackEntry: vi.fn(),
  getStaticLanguageAudioPackEntry: vi.fn(),
  resumeAudioContext: vi.fn(),
  howlSources: [] as string[],
  failNextLocalAudio: false,
}));

vi.mock("@/lib/api-client", () => ({
  fetchPronunciation: mocks.fetchPronunciation,
}));

vi.mock("@/lib/language-audio-pack-cache", () => ({
  getLanguageAudioPackEntry: mocks.getLanguageAudioPackEntry,
}));

vi.mock("@/lib/static-language-audio-pack", () => ({
  getStaticLanguageAudioPackEntry: mocks.getStaticLanguageAudioPackEntry,
}));

vi.mock("howler", () => ({
  Howler: {
    ctx: {
      state: "suspended",
      resume: mocks.resumeAudioContext,
    },
  },
  Howl: vi.fn().mockImplementation(function (
    this: unknown,
    options: {
      src: string[];
      onplay?: () => void;
      onloaderror?: () => void;
    },
  ) {
    return {
      play: () => {
        const src = options.src[0];
        mocks.howlSources.push(src);
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
    mocks.failNextLocalAudio = false;
    mocks.fetchPronunciation.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    );
    mocks.getLanguageAudioPackEntry.mockResolvedValue(null);
    mocks.getStaticLanguageAudioPackEntry.mockResolvedValue(null);
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
      );
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.getLanguageAudioPackEntry).not.toHaveBeenCalled();
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
    expect(mocks.howlSources).toEqual(["/audio/language-packs/es-ES/hola.mp3"]);
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
  });

  it("plays bundled English word audio before calling Youdao", async () => {
    const { result } = renderHook(() => useWordPronunciation());

    await act(async () => {
      result.current.playWord("hello", "blue", "en-US");
    });

    expect(mocks.howlSources).toEqual(["/audio/words/blue/hello.mp3"]);
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
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
    expect(mocks.howlSources).toEqual([
      "/audio/words/blue/hello.mp3",
      "blob:pronunciation",
    ]);
  });
});
