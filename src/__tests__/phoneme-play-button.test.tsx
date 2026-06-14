import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { getPhonemeAudioInfo } from "@/lib/azure-phoneme-map";
import { getLocalLanguagePhonemeAsset } from "@/lib/local-language-assets";

type MockHowlInstance = {
  play: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  fade: ReturnType<typeof vi.fn>;
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

vi.mock("@/lib/desktop-external-url", () => ({
  openDesktopExternalUrl: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  howlerMock.instances.length = 0;
  howlerMock.Howl.mockImplementation(function MockHowl(options: {
    onplay?: () => void;
    onstop?: () => void;
  }) {
    const instance: MockHowlInstance = {
      play: vi.fn(() => {
        options.onplay?.();
        return 7;
      }),
      seek: vi.fn(),
      fade: vi.fn(),
      stop: vi.fn(() => options.onstop?.()),
      unload: vi.fn(),
    };
    howlerMock.instances.push(instance);
    return instance;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PhonemePlayButton", () => {
  it("plays English header phoneme audio once and stops after the short window", () => {
    render(<PhonemePlayButton chartWord="cat" />);

    fireEvent.click(screen.getByRole("button", { name: "播放发音" }));

    expect(howlerMock.instances).toHaveLength(1);
    expect(howlerMock.instances[0].play).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[0].seek).toHaveBeenCalledWith(0.025, 7);

    act(() => {
      vi.advanceTimersByTime(505);
    });
    expect(howlerMock.instances[0].fade).toHaveBeenCalledWith(1, 0, 55, 7);
    expect(howlerMock.instances[0].stop).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(55);
    });
    expect(howlerMock.instances[0].stop).toHaveBeenCalledWith(7);
    expect(howlerMock.instances[0].unload).toHaveBeenCalledTimes(1);
  });

  it("uses the same one-shot behavior for local non-English header audio", () => {
    render(
      <PhonemePlayButton
        phonemeAudio={{
          kind: "local",
          label: "法语本地音频",
          source: "local",
          localSrc: "/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "播放发音" }));

    expect(howlerMock.instances).toHaveLength(1);
    expect(howlerMock.instances[0].seek).toHaveBeenCalledWith(0.015, 7);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(howlerMock.instances[0].stop).toHaveBeenCalledWith(7);
  });

  it("matches scoring-tile audio to the same localSrc used by the header speaker", () => {
    const localAsset = getLocalLanguagePhonemeAsset("fr-FR", "fr-schwa");
    const scoringAudio = getPhonemeAudioInfo("ax", "fr-FR");

    expect(localAsset?.audioSrc).toBe(
      "/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a",
    );
    expect(scoringAudio?.kind).toBe("sound-unit");
    expect(scoringAudio?.url).toBe(localAsset?.audioSrc);
    expect(scoringAudio).toMatchObject({
      startMs: 15,
      maxDurationMs: 500,
      fadeOutMs: 60,
    });
  });

  it("does not render a header speaker for video-backed local sources", () => {
    render(
      <PhonemePlayButton
        phonemeAudio={{
          kind: "local",
          label: "法语本地视频",
          source: "local",
          localSrc: "/videos/language-assets/fr-FR/articulation/fr-schwa.mp4",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
  });

  it("does not render fake header speakers for external-only audio references", () => {
    render(
      <PhonemePlayButton
        phonemeAudio={{
          kind: "external",
          label: "外部参考",
          source: "external",
          url: "https://example.com/reference",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
  });

  it("does not render browser TTS fallback as a sound-unit header speaker", () => {
    render(
      <PhonemePlayButton
        phonemeAudio={{
          kind: "tts-example",
          label: "浏览器朗读",
          source: "speech-synthesis",
          text: "petit",
          languageId: "fr-FR",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "播放发音" }),
    ).not.toBeInTheDocument();
  });

  it("cleans up the previous header speaker playback on repeat clicks", () => {
    render(<PhonemePlayButton chartWord="blue" />);
    const button = screen.getByRole("button", { name: "播放发音" });

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button"));

    expect(howlerMock.instances).toHaveLength(2);
    expect(howlerMock.instances[0].unload).toHaveBeenCalledTimes(1);
    expect(howlerMock.instances[1].play).toHaveBeenCalledTimes(1);
  });
});
