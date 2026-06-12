import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import {
  getAllTeachingVideoAssets,
  getExactTeachingVideosForSoundUnit,
  getTeachingVideosForSoundUnit,
} from "@/lib/language-teaching-videos";
import {
  getSoundUnitSourceAlignment,
  shouldShowLocalVideoAsPrimary,
} from "@/lib/language-source-alignment";
import type { LanguageId } from "@/types/language";

const NON_ENGLISH_LANGUAGES: Exclude<LanguageId, "en-US">[] = [
  "es-ES",
  "fr-FR",
  "ru-RU",
];

describe("language teaching video registry", () => {
  it("declares source alignment for every non-English sound unit", () => {
    const missing = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId)
        .filter(
          (soundUnit) =>
            !getSoundUnitSourceAlignment(languageId, soundUnit.slug)
              ?.ruleSummary,
        )
        .map((soundUnit) => `${languageId}:${soundUnit.slug}`),
    );

    expect(missing).toEqual([]);
  });

  it("adds a local teaching video entry to every Spanish, French, and Russian sound unit", () => {
    const missing = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId)
        .filter(
          (soundUnit) =>
            getTeachingVideosForSoundUnit(languageId, soundUnit.slug).length ===
            0,
        )
        .map((soundUnit) => `${languageId}:${soundUnit.slug}`),
    );

    expect(missing).toEqual([]);
  });

  it("only points at real bundled mp4 files", () => {
    const missingOrEmpty = getAllTeachingVideoAssets()
      .map((asset) => asset.videoSrc.replace(/^\//, ""))
      .filter((publicPath) => {
        const diskPath = join(process.cwd(), "public", publicPath);
        return !existsSync(diskPath) || statSync(diskPath).size < 1024;
      });

    expect(missingOrEmpty).toEqual([]);
  });

  it("only treats exact local or lesson videos as primary practice videos", () => {
    const exactLessons = [
      ["es-ES", "es-lexical-stress"],
      ["es-ES", "es-syllable-rhythm"],
      ["fr-FR", "fr-final-consonant-silence"],
      ["fr-FR", "fr-liaison"],
      ["fr-FR", "fr-enchainement"],
      ["fr-FR", "fr-elision"],
      ["ru-RU", "ru-stress-reduction"],
      ["ru-RU", "ru-unstressed-o-a"],
      ["ru-RU", "ru-unstressed-e-ya"],
      ["ru-RU", "ru-voicing-assimilation"],
      ["ru-RU", "ru-clusters"],
    ] as const;

    for (const [languageId, slug] of exactLessons) {
      const videos = getExactTeachingVideosForSoundUnit(languageId, slug);
      expect(videos.length, `${languageId}:${slug}`).toBeGreaterThan(0);
      expect(videos[0].videoSrc).toMatch(/\/youtube-lessons\/.+\.mp4$/);
    }
  });

  it("does not use generic or proxy videos as exact rule-unit videos", () => {
    const ruleUnits = [
      ["ru-RU", "ru-final-devoicing"],
      ["ru-RU", "ru-iotated-vowels"],
    ] as const;

    for (const [languageId, slug] of ruleUnits) {
      expect(getTeachingVideosForSoundUnit(languageId, slug).length).toBeGreaterThan(0);
      expect(getExactTeachingVideosForSoundUnit(languageId, slug)).toEqual([]);
      expect(shouldShowLocalVideoAsPrimary(languageId, slug)).toBe(false);
      expect(getSoundUnitSourceAlignment(languageId, slug)?.primaryVideoCoverage).not.toBe("exact");
    }
  });

  it("keeps broad overview videos out of exact teaching coverage", () => {
    expect(getExactTeachingVideosForSoundUnit("es-ES", "es-diphthongs-j")).toEqual([]);
    expect(getExactTeachingVideosForSoundUnit("es-ES", "es-diphthongs-w")).toEqual([]);
  });
});
