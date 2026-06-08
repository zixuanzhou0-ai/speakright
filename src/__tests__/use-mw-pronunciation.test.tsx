import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";

const mocks = vi.hoisted(() => ({
  fetchPronunciation: vi.fn(),
  getPronunciationConfig: vi.fn(),
  getMerriamWebsterConfig: vi.fn(),
  getLanguageAudioPackEntry: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  fetchPronunciation: mocks.fetchPronunciation,
}));

vi.mock("@/lib/api-keys", () => ({
  getPronunciationConfig: mocks.getPronunciationConfig,
  getMerriamWebsterConfig: mocks.getMerriamWebsterConfig,
}));

vi.mock("@/lib/language-audio-pack-cache", () => ({
  getLanguageAudioPackEntry: mocks.getLanguageAudioPackEntry,
}));

vi.mock("howler", () => ({
  Howl: vi.fn().mockImplementation(function (
    this: unknown,
    options: { onplay?: () => void },
  ) {
    return {
      play: () => {
        options.onplay?.();
        return 1;
      },
      unload: vi.fn(),
    };
  }),
}));

describe("useMwPronunciation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPronunciationConfig.mockReturnValue({ source: "youdao" });
    mocks.getMerriamWebsterConfig.mockReturnValue(null);
    mocks.fetchPronunciation.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:pronunciation"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("uses the active non-English language audio pack before pronunciation fallback", async () => {
    const audioBlob = new Blob([new Uint8Array([1])], { type: "audio/mpeg" });
    mocks.getLanguageAudioPackEntry.mockResolvedValue({ audioBlob });
    const { result } = renderHook(() => useMwPronunciation());

    await act(async () => {
      await (result.current.playWord(
        "bonjour",
        "blue",
        "fr-FR",
      ) as unknown as Promise<void>);
    });

    await waitFor(() => {
      expect(mocks.getLanguageAudioPackEntry).toHaveBeenCalledWith(
        "fr-FR",
        "bonjour",
      );
    });
    expect(mocks.fetchPronunciation).not.toHaveBeenCalled();
  });

  it("passes English words through the configured pronunciation source", async () => {
    const { result } = renderHook(() => useMwPronunciation());

    await act(async () => {
      await (result.current.playWord(
        "hello",
        "blue",
        "en-US",
      ) as unknown as Promise<void>);
    });

    await waitFor(() => {
      expect(mocks.fetchPronunciation).toHaveBeenCalledWith(
        "hello",
        "youdao",
        undefined,
      );
    });
  });
});
