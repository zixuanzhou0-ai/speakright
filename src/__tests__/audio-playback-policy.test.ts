import { describe, expect, it } from "vitest";
import {
  getAssessmentTilePlaybackOptions,
  getChartWordPlaybackOptions,
  getSoundUnitHeaderPlaybackOptions,
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
        localSrc: "/audio/language-packs/fr-FR/accueil-63acf559f5.mp3",
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
