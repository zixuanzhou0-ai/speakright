import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import {
  getAllTeachingVideoAssets,
  getTeachingVideosForSoundUnit,
} from "@/lib/language-teaching-videos";
import type { LanguageId } from "@/types/language";

const NON_ENGLISH_LANGUAGES: Exclude<LanguageId, "en-US">[] = [
  "es-ES",
  "fr-FR",
  "ru-RU",
];

describe("language teaching video registry", () => {
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

  it("uses teaching videos as local coverage for rule-like units", () => {
    const ruleUnits = [
      ["es-ES", "es-lexical-stress"],
      ["es-ES", "es-syllable-rhythm"],
      ["fr-FR", "fr-final-consonant-silence"],
      ["fr-FR", "fr-liaison"],
      ["fr-FR", "fr-enchainement"],
      ["fr-FR", "fr-elision"],
      ["ru-RU", "ru-stress-reduction"],
      ["ru-RU", "ru-final-devoicing"],
      ["ru-RU", "ru-voicing-assimilation"],
      ["ru-RU", "ru-clusters"],
    ] as const;

    for (const [languageId, slug] of ruleUnits) {
      const videos = getTeachingVideosForSoundUnit(languageId, slug);
      expect(videos.length, `${languageId}:${slug}`).toBeGreaterThan(0);
      expect(videos[0].videoSrc).toMatch(/\/youtube-lessons\/.+\.mp4$/);
    }
  });
});
