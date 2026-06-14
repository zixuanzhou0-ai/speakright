import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeAudioLevel,
  calculateAudioNormalization,
  calculateNormalizationGain,
  clearAudioNormalizationCache,
  getLocalAudioPlaybackVolume,
  getNormalizedPlaybackVolume,
  selectPeakSafePlaybackGain,
  shouldNormalizeLocalAudioSrc,
  toSafeHowlerVolume,
  toSafePlaybackGain,
} from "@/lib/audio-normalization";

function makeBuffer(channels: number[][]) {
  return {
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => Float32Array.from(channels[channel] ?? []),
  };
}

describe("audio normalization", () => {
  afterEach(() => {
    clearAudioNormalizationCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("targets bundled word and multilingual pack audio only", () => {
    expect(shouldNormalizeLocalAudioSrc("/audio/words/blue/hello.mp3")).toBe(
      true,
    );
    expect(
      shouldNormalizeLocalAudioSrc(
        "/audio/language-packs/fr-FR/accueil-pink-acf26f7271.mp3",
      ),
    ).toBe(true);
    expect(shouldNormalizeLocalAudioSrc("blob:pronunciation")).toBe(false);
    expect(shouldNormalizeLocalAudioSrc("https://example.com/audio.mp3")).toBe(
      false,
    );
  });

  it("measures RMS and peak across every channel", () => {
    const analysis = analyzeAudioLevel(
      makeBuffer([
        [0.5, -0.5],
        [0.25, -0.25],
      ]),
    );

    expect(analysis.sampleCount).toBe(4);
    expect(analysis.peak).toBe(0.5);
    expect(analysis.rms).toBeCloseTo(0.395, 3);
  });

  it("boosts quiet audio but caps the gain", () => {
    expect(calculateNormalizationGain({ rms: 0.01, peak: 0.05 })).toBe(12);
  });

  it("keeps Howler fallback volume capped while Web Audio gain can amplify", () => {
    expect(toSafeHowlerVolume(4.25)).toBe(1);
    expect(toSafeHowlerVolume(0.2)).toBe(0.2);
    expect(toSafeHowlerVolume(0.001)).toBe(0.08);

    expect(toSafePlaybackGain(4.25)).toBe(4.25);
    expect(toSafePlaybackGain(7)).toBe(7);
    expect(toSafePlaybackGain(13)).toBe(12);
    expect(toSafePlaybackGain(0.001)).toBe(0.08);
  });

  it("uses synchronous safe volume compensation for known A/B pack imbalances", () => {
    expect(
      getLocalAudioPlaybackVolume(
        "/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
      ),
    ).toBe(2.2);
    expect(
      getLocalAudioPlaybackVolume(
        "/audio/language-packs/fr-FR/accueil-pink-acf26f7271.mp3",
      ),
    ).toBe(12);
    expect(
      getLocalAudioPlaybackVolume("/audio/language-packs/es-ES/adios.mp3"),
    ).toBe(1.25);
    expect(
      getLocalAudioPlaybackVolume(
        "/audio/language-packs/ru-RU/word-ec7b3cc207.mp3",
      ),
    ).toBe(5);
    expect(getLocalAudioPlaybackVolume("/audio/words/pink/hello.mp3")).toBe(
      1.15,
    );
    expect(getLocalAudioPlaybackVolume("/audio/words/blue/hello.mp3")).toBe(
      1.25,
    );
  });

  it("prevents clipping when the source already has high peaks", () => {
    expect(calculateNormalizationGain({ rms: 0.02, peak: 0.8 })).toBeCloseTo(
      1.175,
      3,
    );
  });

  it("keeps fallback gain inside the decoded peak-safe range", () => {
    expect(
      selectPeakSafePlaybackGain(
        { gain: 1.4, peak: 0.5 },
        5,
      ),
    ).toBeCloseTo(1.88, 2);

    expect(
      selectPeakSafePlaybackGain(
        { gain: 1.4, peak: 0.05 },
        2.2,
      ),
    ).toBe(2.2);
  });

  it("allows very quiet local word audio to reach a video-like range when peaks permit it", () => {
    expect(
      selectPeakSafePlaybackGain(
        { gain: 12, peak: 0.05 },
        getLocalAudioPlaybackVolume(
          "/audio/language-packs/fr-FR/accueil-pink-acf26f7271.mp3",
        ),
      ),
    ).toBe(12);
  });

  it("keeps silent or invalid audio at neutral gain", () => {
    expect(calculateNormalizationGain({ rms: 0, peak: 0 })).toBe(1);
  });

  it("returns a complete normalization result for decoded buffers", () => {
    const result = calculateAudioNormalization(makeBuffer([[0.01, -0.01]]));

    expect(result.rms).toBeCloseTo(0.01, 3);
    expect(result.peak).toBeCloseTo(0.01, 3);
    expect(result.gain).toBe(12);
  });

  it("uses language-pack fallback gain when selecting decoded playback volume", async () => {
    const close = vi.fn(async () => undefined);

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: class {
        decodeAudioData = vi.fn(async () => makeBuffer([[0.5, -0.5]]));
        close = close;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );

    await expect(
      getNormalizedPlaybackVolume(
        "/audio/language-packs/fr-FR/accueil-pink-acf26f7271.mp3",
      ),
    ).resolves.toBeCloseTo(1.88, 2);
    expect(close).toHaveBeenCalled();
  });

  it("keeps known pack gain when local decoding is unavailable", async () => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    await expect(
      getNormalizedPlaybackVolume(
        "/audio/language-packs/ru-RU/word-ec7b3cc207.mp3",
      ),
    ).resolves.toBe(5);
  });
});
