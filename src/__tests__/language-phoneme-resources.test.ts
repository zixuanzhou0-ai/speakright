import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LOCAL_LANGUAGE_PHONEME_ASSETS,
  getLocalLanguagePhonemeAsset,
} from "@/lib/local-language-assets";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { RUSSIAN_PHONEMES } from "@/lib/language-sound-units/russian";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";

type ResourceBackedPhoneme = PhonemeData & {
  teachingResources?: {
    title: string;
    url: string;
    kind: string;
  }[];
  phonemeAudio?: {
    label: string;
    url?: string;
    localSrc?: string;
    kind: string;
  };
};

const NON_ENGLISH_LANGUAGES: LanguageId[] = ["es-ES", "fr-FR", "ru-RU"];

describe("non-English phoneme resource parity", () => {
  it("adds teaching resources to every Spanish, French, and Russian sound unit", () => {
    const missingResources = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId)
        .map((soundUnit) => soundUnit as ResourceBackedPhoneme)
        .filter((soundUnit) => !soundUnit.teachingResources?.length)
        .map((soundUnit) => `${languageId}:${soundUnit.slug}`),
    );

    expect(missingResources).toEqual([]);
  });

  it("adds a launchable phoneme-audio reference to every non-English sound unit", () => {
    const missingAudio = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId)
        .map((soundUnit) => soundUnit as ResourceBackedPhoneme)
        .filter(
          (soundUnit) =>
            !soundUnit.phonemeAudio ||
            !(soundUnit.phonemeAudio.localSrc || soundUnit.phonemeAudio.url),
        )
        .map((soundUnit) => `${languageId}:${soundUnit.slug}`),
    );

    expect(missingAudio).toEqual([]);
  });

  it("keeps bundled local language media present on disk", () => {
    const missingOrEmptyFiles = LOCAL_LANGUAGE_PHONEME_ASSETS.flatMap(
      (asset) => {
        const publicRelativePaths = [
          asset.videoSrc,
          asset.audioSrc && asset.audioSrc !== asset.videoSrc
            ? asset.audioSrc
            : undefined,
        ].filter((value): value is string => Boolean(value));

        return publicRelativePaths
          .map((src) => src.replace(/^\//, ""))
          .filter((src) => {
            const diskPath = join(process.cwd(), "public", src);
            return !existsSync(diskPath) || statSync(diskPath).size < 1024;
          })
          .map((src) => `${asset.languageId}:${asset.slug}:${src}`);
      },
    );

    expect(missingOrEmptyFiles).toEqual([]);
  });

  it("maps every current Russian sound unit to bundled local media", () => {
    const unmappedRussianSlugs = RUSSIAN_PHONEMES.map(
      (soundUnit) => soundUnit.slug,
    ).filter((slug) => !getLocalLanguagePhonemeAsset("ru-RU", slug));

    expect(unmappedRussianSlugs).toEqual([]);
  });

  it("promotes bundled media units to local ready video/audio", () => {
    const unresolvedLocalUnits = LOCAL_LANGUAGE_PHONEME_ASSETS.flatMap(
      (asset) => {
        const soundUnit = getLanguagePhonemes(asset.languageId).find(
          (candidate) => candidate.slug === asset.slug,
        );

        return soundUnit?.video?.status === "ready" &&
          soundUnit.video.localSrc &&
          soundUnit.phonemeAudio?.localSrc
          ? []
          : [`${asset.languageId}:${asset.slug}`];
      },
    );

    expect(unresolvedLocalUnits).toEqual([]);
  });

  it("preserves Russian Seeing Speech attribution metadata", () => {
    const russianAssets = LOCAL_LANGUAGE_PHONEME_ASSETS.filter(
      (asset) => asset.languageId === "ru-RU",
    );

    expect(russianAssets).toHaveLength(RUSSIAN_PHONEMES.length);
    for (const asset of russianAssets) {
      expect(asset.source).toContain("Seeing Speech");
      expect(asset.sourceUrl).toMatch(/^https:\/\/www\.seeingspeech\.ac\.uk/);
      expect(asset.license).toContain("CC BY-NC-ND 4.0");
      expect(asset.attribution).toContain("University of Glasgow");
      expect(asset.notes?.join(" ")).toMatch(
        /noncommercial educational|proxy|primary local asset|Rule\/prosody|Cluster unit|Final devoicing|Voicing assimilation/,
      );
    }
  });

  it("keeps external pronunciation resources explicit and safe to open", () => {
    for (const languageId of NON_ENGLISH_LANGUAGES) {
      for (const soundUnit of getLanguagePhonemes(
        languageId,
      ) as ResourceBackedPhoneme[]) {
        for (const resource of soundUnit.teachingResources ?? []) {
          expect(resource.title.trim()).not.toBe("");
          expect(resource.url).toMatch(/^https:\/\//);
          expect([
            "video",
            "ipa",
            "dictionary",
            "articulation",
            "audio",
          ]).toContain(resource.kind);
        }

        expect(soundUnit.phonemeAudio?.label.trim()).not.toBe("");
        if (soundUnit.phonemeAudio?.url) {
          expect(soundUnit.phonemeAudio.url).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("connects every non-English sound unit and keyword to registered source references", () => {
    const missingOrUnknownRefs = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId).flatMap((soundUnit) => {
        const unitProblems =
          soundUnit.sourceRefs?.length &&
          soundUnit.sourceRefs.every((ref) => getLanguageResourceSite(ref))
            ? []
            : [`${languageId}:${soundUnit.slug}:unit`];

        const keywordProblems = soundUnit.keywords
          .filter(
            (keyword) =>
              !keyword.sourceRefs?.length ||
              keyword.sourceRefs.some((ref) => !getLanguageResourceSite(ref)),
          )
          .map((keyword) => `${languageId}:${soundUnit.slug}:${keyword.word}`);

        return [...unitProblems, ...keywordProblems];
      }),
    );

    expect(missingOrUnknownRefs).toEqual([]);
  });
});
