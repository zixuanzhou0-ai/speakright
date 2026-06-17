import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_LANGUAGE_PHONEME_ASSETS,
  getLocalLanguagePhonemeAsset,
} from "@/lib/local-language-assets";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { getPhonologyInventoryEntry } from "@/lib/language-phonology-inventory";
import { RUSSIAN_PHONEMES } from "@/lib/language-sound-units/russian";

function publicDiskPath(publicPath: string): string {
  return join(process.cwd(), "public", publicPath.replace(/^\//, ""));
}

const RUSSIAN_SCORE_ONLY_LOCAL_ASSET_GAPS = [
  "ru-p-pj",
  "ru-b-bj",
  "ru-m-mj",
  "ru-f-fj",
  "ru-v-vj",
];

describe("local language assets", () => {
  it("maps every Russian sound unit slug to local primary media or an explicit score-only gap", () => {
    const unmappedRussianSlugs = RUSSIAN_PHONEMES.map(
      (soundUnit) => soundUnit.slug,
    ).filter((slug) => !getLocalLanguagePhonemeAsset("ru-RU", slug));

    expect(unmappedRussianSlugs).toEqual(RUSSIAN_SCORE_ONLY_LOCAL_ASSET_GAPS);
    for (const slug of unmappedRussianSlugs) {
      expect(getPhonologyInventoryEntry("ru-RU", slug)?.tilePolicy).toBe(
        "score-only-unverified",
      );
    }
  });

  it("keeps every local Russian primary video and audio file on disk", () => {
    const missingOrEmptyFiles = LOCAL_LANGUAGE_PHONEME_ASSETS.filter(
      (asset) => asset.languageId === "ru-RU",
    ).flatMap((asset) =>
      [asset.videoSrc, asset.audioSrc]
        .filter((src): src is string => Boolean(src))
        .filter((src) => {
          const diskPath = publicDiskPath(src);
          return !existsSync(diskPath) || statSync(diskPath).size < 1024;
        })
        .map((src) => `${asset.slug}:${src}`),
    );

    expect(missingOrEmptyFiles).toEqual([]);
  });

  it("assembles every Russian sound unit as local ready video and audio", () => {
    const unresolvedRussianUnits = getLanguagePhonemes("ru-RU").flatMap(
      (soundUnit) =>
        soundUnit.video?.status === "ready" &&
        soundUnit.video.localSrc &&
        soundUnit.phonemeAudio?.localSrc
          ? []
          : [`ru-RU:${soundUnit.slug}`],
    );

    expect(unresolvedRussianUnits).toEqual(
      RUSSIAN_SCORE_ONLY_LOCAL_ASSET_GAPS.map((slug) => `ru-RU:${slug}`),
    );
  });

  it("preserves attribution and proxy notes for Russian local assets", () => {
    const russianAssets = LOCAL_LANGUAGE_PHONEME_ASSETS.filter(
      (asset) => asset.languageId === "ru-RU",
    );

    expect(russianAssets).toHaveLength(
      RUSSIAN_PHONEMES.length - RUSSIAN_SCORE_ONLY_LOCAL_ASSET_GAPS.length,
    );
    for (const asset of russianAssets) {
      expect(asset.source).toContain("Seeing Speech");
      expect(asset.sourceUrl).toMatch(/^https:\/\/www\.seeingspeech\.ac\.uk/);
      expect(asset.license).toContain("CC BY-NC-ND 4.0");
      expect(asset.attribution).toContain("University of Glasgow");
      expect(asset.notes?.join(" ").trim()).not.toBe("");
    }
  });
});
