import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LOCAL_LANGUAGE_PHONEME_ASSETS,
  getLocalLanguagePhonemeAsset,
} from "@/lib/local-language-assets";
import { getAllAssessmentSegmentAudioRegistryEntries } from "@/lib/assessment-segment-audio";
import { attachLanguagePhonemeResources } from "@/lib/language-phoneme-resources";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import {
  getLanguagePhonemes,
  hasLocalPhonemeAssets,
} from "@/lib/language-phonemes";
import { getPhonologyInventoryEntry } from "@/lib/language-phonology-inventory";
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
const RUSSIAN_SCORE_ONLY_LOCAL_ASSET_GAPS = [
  "ru-t-tj",
  "ru-d-dj",
  "ru-s-sj",
  "ru-z-zj",
  "ru-n-nj",
  "ru-l-lj",
  "ru-r-rj",
  "ru-p-pj",
  "ru-b-bj",
  "ru-m-mj",
  "ru-f-fj",
  "ru-v-vj",
  "ru-k-kj",
  "ru-g-gj",
  "ru-x-xj",
];

function baseEnglishPhoneme(overrides: Partial<PhonemeData> = {}): PhonemeData {
  return {
    ipa: "/x/",
    symbol: "x",
    slug: "unsafe-chart-word",
    name: "unsafe chart word",
    category: "consonant",
    example: "example",
    keywords: [{ word: "example", ipa: "/example/" }],
    difficulty: "high",
    description: "test sound",
    languageId: "en-US",
    soundUnitType: "phoneme",
    ...overrides,
  };
}

describe("non-English phoneme resource parity", () => {
  it("only attaches known English chart audio stems as local header clips", () => {
    const [known] = attachLanguagePhonemeResources("en-US", [
      baseEnglishPhoneme({ chartWord: "cat" }),
    ]);
    const [unsafe] = attachLanguagePhonemeResources("en-US", [
      baseEnglishPhoneme({ chartWord: "fr-schwa" }),
    ]);

    expect(known.phonemeAudio?.localSrc).toBe("/audio/ipa/phoneme/cat.mp3");
    expect(hasLocalPhonemeAssets(known)).toBe(true);
    expect(unsafe.phonemeAudio?.localSrc).toBeUndefined();
    expect(hasLocalPhonemeAssets(unsafe)).toBe(false);
  });

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

  it("maps every current Russian sound unit to bundled local media or an explicit score-only gap", () => {
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

  it("never exposes local videos as header phoneme audio sources", () => {
    const videoBackedAudioSources = NON_ENGLISH_LANGUAGES.flatMap((languageId) =>
      getLanguagePhonemes(languageId)
        .map((soundUnit) => soundUnit as ResourceBackedPhoneme)
        .filter((soundUnit) =>
          /\.(mp4|m4v|webm)(?:$|\?)/i.test(
            soundUnit.phonemeAudio?.localSrc ?? "",
          ),
        )
        .map((soundUnit) => `${languageId}:${soundUnit.slug}`),
    );

    expect(videoBackedAudioSources).toEqual([]);
  });

  it("only marks exact local header clips as assessment scoring audio", () => {
    const registry = getAllAssessmentSegmentAudioRegistryEntries();
    const registryKeys = new Set(
      registry.map((entry) => `${entry.languageId}:${entry.soundUnitSlug}`),
    );

    for (const asset of LOCAL_LANGUAGE_PHONEME_ASSETS) {
      if (asset.isProxyForAssessment) {
        expect(asset.exactAssessmentAliases ?? []).toEqual([]);
        expect(registryKeys.has(`${asset.languageId}:${asset.slug}`)).toBe(
          false,
        );
        continue;
      }

      if (!asset.exactAssessmentAliases?.length) continue;

      expect(asset.audioIpa, `${asset.languageId}:${asset.slug}`).toMatch(
        /^\/.+\/$/,
      );
      expect(asset.audioSrc, `${asset.languageId}:${asset.slug}`).toMatch(
        /^\/audio\/language-assets\/.+\/header-clips\/.+\.m4a$/,
      );
      expect(registryKeys.has(`${asset.languageId}:${asset.slug}`)).toBe(true);
    }
  });

  it("does not reuse proxy/rule clips for right-side single-phoneme playback", () => {
    const blockedSlugs = [
      "es-nasal-place",
      "ru-hard-soft",
      "ru-soft-sign",
      "ru-iotated-vowels",
      "ru-soft-t-d",
      "ru-soft-s-z",
      "ru-soft-n-l-r",
      "ru-soft-labials",
      "ru-t-tj",
      "ru-d-dj",
      "ru-s-sj",
      "ru-z-zj",
      "ru-n-nj",
      "ru-l-lj",
      "ru-r-rj",
      "ru-p-pj",
      "ru-b-bj",
      "ru-m-mj",
      "ru-f-fj",
      "ru-v-vj",
      "ru-k-kj",
      "ru-g-gj",
      "ru-x-xj",
      "ru-stress-reduction",
      "ru-unstressed-o-a",
      "ru-unstressed-e-ya",
      "ru-final-devoicing",
      "ru-voicing-assimilation",
      "ru-clusters",
    ];

    const playableSlugs = new Set(
      getAllAssessmentSegmentAudioRegistryEntries().map(
        (entry) => entry.soundUnitSlug,
      ),
    );

    for (const slug of blockedSlugs) {
      expect(playableSlugs.has(slug), slug).toBe(false);
    }
  });

  it("surfaces local asset notes and known source metadata through video metadata", () => {
    const missingVideoMetadata = LOCAL_LANGUAGE_PHONEME_ASSETS.flatMap(
      (asset) => {
        const soundUnit = getLanguagePhonemes(asset.languageId).find(
          (candidate) => candidate.slug === asset.slug,
        );

        return soundUnit?.video?.source &&
          soundUnit.video.sourceUrl &&
          soundUnit.video.notes?.length &&
          (!asset.license || soundUnit.video.license === asset.license) &&
          (!asset.attribution ||
            soundUnit.video.attribution === asset.attribution)
          ? []
          : [`${asset.languageId}:${asset.slug}`];
      },
    );

    expect(missingVideoMetadata).toEqual([]);
  });

  it("keeps Russian proxy and rule assets visibly marked in video notes", () => {
    const markedRussianUnits = getLanguagePhonemes("ru-RU")
      .filter((soundUnit) =>
        soundUnit.video?.notes?.some((note) =>
          /proxy|rule\/prosody|cluster unit|final devoicing|voicing assimilation|soft consonants|soft sign|iotated vowels/i.test(
            note,
          ),
        ),
      )
      .map((soundUnit) => soundUnit.slug);

    expect(markedRussianUnits).toEqual(
      expect.arrayContaining([
        "ru-ch",
        "ru-shch",
        "ru-hard-soft",
        "ru-soft-sign",
        "ru-stress-reduction",
        "ru-final-devoicing",
        "ru-voicing-assimilation",
        "ru-clusters",
      ]),
    );
  });

  it("keeps Russian final-devoicing resource notes aligned with current practice", () => {
    const finalDevoicingAsset = LOCAL_LANGUAGE_PHONEME_ASSETS.find(
      (asset) =>
        asset.languageId === "ru-RU" && asset.slug === "ru-final-devoicing",
    );
    const notes = finalDevoicingAsset?.notes?.join(" ") ?? "";

    expect(notes).toContain("Final devoicing proxy");
    expect(notes).toContain("Нож тупой");
    expect(notes).toContain("/noʂ tʊˈpoj/");
    expect(notes).not.toContain("current example друг");
  });

  it("preserves Russian Seeing Speech attribution metadata", () => {
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
