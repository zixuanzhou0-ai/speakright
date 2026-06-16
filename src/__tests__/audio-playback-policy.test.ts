import { describe, expect, it } from "vitest";
import {
  getAssessmentTilePlaybackOptions,
  getChartWordPlaybackOptions,
  getSoundUnitHeaderPlaybackOptions,
  isPlayableHeaderAudioSrc,
} from "@/lib/audio-playback-policy";

describe("audio playback policy", () => {
  it("caps English header phoneme playback to a short one-shot window", () => {
    const options = getSoundUnitHeaderPlaybackOptions({ chartWord: "cat" });

    expect(options).toEqual({
      startMs: 25,
      maxDurationMs: 560,
      fadeOutMs: 55,
    });
  });

  it("caps local non-English header audio without using external references", () => {
    const options = getSoundUnitHeaderPlaybackOptions({
      phonemeAudio: {
        kind: "local",
        label: "法语本地音频",
        source: "local",
        localSrc: "/audio/language-assets/fr-FR/header-clips/fr-schwa.m4a",
      },
    });

    expect(options).toEqual({
      startMs: 15,
      maxDurationMs: 500,
      fadeOutMs: 60,
    });
  });

  it("refuses video-backed local sources for header speakers", () => {
    const options = getSoundUnitHeaderPlaybackOptions({
      phonemeAudio: {
        kind: "local",
        label: "法语本地视频",
        source: "local",
        localSrc: "/videos/language-assets/fr-FR/articulation/fr-schwa.mp4",
      },
    });

    expect(options).toBeUndefined();
  });

  it("refuses whole-word and language-pack clips as header phoneme audio", () => {
    for (const localSrc of [
      "/audio/words/blue/hello.mp3",
      "/audio/ipa/normal/cat.mp3",
      "/audio/ipa/slow/cat.mp3",
      "/audio/language-packs/fr-FR/bonjour-pink-acf26f7271.mp3",
      "/audio/language-packs/es-ES/hola.mp3",
    ]) {
      expect(isPlayableHeaderAudioSrc(localSrc), localSrc).toBe(false);
      expect(
        getSoundUnitHeaderPlaybackOptions({
          phonemeAudio: {
            kind: "local",
            label: "整词或语言包音频",
            source: "local",
            localSrc,
          },
        }),
        localSrc,
      ).toBeUndefined();
    }
  });

  it("refuses external URLs for header speakers even when a localSrc field is present", () => {
    expect(
      isPlayableHeaderAudioSrc("https://example.com/audio/fr-schwa.m4a"),
    ).toBe(false);
    expect(
      getSoundUnitHeaderPlaybackOptions({
        phonemeAudio: {
          kind: "local",
          label: "外部短音",
          source: "external CDN",
          localSrc: "https://example.com/audio/fr-schwa.m4a",
        },
      }),
    ).toBeUndefined();
  });

  it("does not invent playback options for non-local TTS references", () => {
    expect(
      getSoundUnitHeaderPlaybackOptions({
        phonemeAudio: {
          kind: "tts-example",
          label: "外部参考",
          source: "external",
          text: "petit",
          url: "https://example.com/petit",
        },
      }),
    ).toBeUndefined();
  });

  it("keeps scoring chart tiles on the same short window as English header speakers", () => {
    expect(
      getAssessmentTilePlaybackOptions({
        kind: "chart",
        languageId: "en-US",
      }),
    ).toEqual({
      startMs: 25,
      maxDurationMs: 560,
      fadeOutMs: 55,
    });
  });

  it("keeps scoring sound-unit tiles on the same short window as local header clips", () => {
    expect(
      getAssessmentTilePlaybackOptions({
        kind: "sound-unit",
        languageId: "ru-RU",
      }),
    ).toEqual({
      startMs: 15,
      maxDurationMs: 500,
      fadeOutMs: 60,
    });
  });

  it("keeps every single-phoneme click under a one-shot playback threshold", () => {
    const playbackWindows = [
      getSoundUnitHeaderPlaybackOptions({ chartWord: "cat" }),
      getSoundUnitHeaderPlaybackOptions({
        phonemeAudio: {
          kind: "local",
          label: "本地短音",
          source: "local",
          localSrc: "/audio/language-assets/ru-RU/header-clips/ru-a.m4a",
        },
      }),
      getAssessmentTilePlaybackOptions({
        kind: "chart",
        languageId: "en-US",
      }),
      getAssessmentTilePlaybackOptions({
        kind: "sound-unit",
        languageId: "fr-FR",
      }),
    ];

    for (const options of playbackWindows) {
      expect(options?.maxDurationMs).toBeLessThanOrEqual(560);
    }
  });

  it("boosts IPA chart normal/slow word playback without shortening whole words", () => {
    expect(getChartWordPlaybackOptions()).toEqual({
      volume: 1.6,
    });
    expect(getChartWordPlaybackOptions().maxDurationMs).toBeUndefined();
  });
});
