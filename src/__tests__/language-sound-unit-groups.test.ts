import { describe, expect, it } from "vitest";
import {
  LANGUAGE_SOUND_UNIT_GROUPS,
  getDefaultPhonemePracticeSlug,
  getLanguagePhonemePracticeGroups,
  getLanguageSoundUnitGroups,
  getSoundUnitCardLabel,
  isVisibleInPhonemePractice,
  isRuleLikeSoundUnit,
} from "@/lib/language-sound-unit-groups";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import type { LanguageId } from "@/types/language";

const LANGUAGE_IDS = ["en-US", "es-ES", "fr-FR", "ru-RU"] as const;

function expectCompleteSingleCoverage(languageId: LanguageId) {
  const units = getLanguagePhonemes(languageId);
  const actualSlugs = new Set(units.map((unit) => unit.slug));
  const groupedSlugs = LANGUAGE_SOUND_UNIT_GROUPS[languageId].flatMap(
    (group) => group.slugs,
  );

  expect(groupedSlugs.filter((slug) => !actualSlugs.has(slug))).toEqual([]);
  expect(new Set(groupedSlugs).size).toBe(groupedSlugs.length);
  expect(groupedSlugs.sort()).toEqual([...actualSlugs].sort());
}

describe("language sound unit groups", () => {
  it("covers every sound unit exactly once per language", () => {
    for (const languageId of LANGUAGE_IDS) {
      expectCompleteSingleCoverage(languageId);
    }
  });

  it("keeps English grouped as vowels and consonants only", () => {
    const groups = getLanguageSoundUnitGroups("en-US");
    const practiceGroups = getLanguagePhonemePracticeGroups("en-US");

    expect(groups.map((group) => group.label)).toEqual(["元音", "辅音"]);
    expect(groups.every((group) => group.displayType === "phoneme")).toBe(true);
    expect(groups.flatMap((group) => group.units)).toHaveLength(40);
    expect(practiceGroups.map((group) => group.label)).toEqual(["元音", "辅音"]);
    expect(practiceGroups.flatMap((group) => group.units).map((unit) => unit.slug)).toEqual(
      groups.flatMap((group) => group.units).map((unit) => unit.slug),
    );
  });

  it("uses language-specific Spanish group labels", () => {
    const groups = getLanguageSoundUnitGroups("es-ES");

    expect(groups.map((group) => group.label)).toEqual([
      "纯元音",
      "核心辅音",
      "对比/变体",
      "双元音/滑音",
      "重音与节奏",
    ]);
  });

  it("uses language-specific French group labels", () => {
    const groups = getLanguageSoundUnitGroups("fr-FR");

    expect(groups.map((group) => group.label)).toEqual([
      "口腔元音",
      "鼻化元音",
      "辅音与滑音",
      "连读/静音规则",
      "短语韵律",
    ]);
  });

  it("uses language-specific Russian group labels", () => {
    const groups = getLanguageSoundUnitGroups("ru-RU");

    expect(groups.map((group) => group.label)).toEqual([
      "元音",
      "硬软辅音",
      "核心辅音",
      "重音与弱化",
      "拼写到发音规则",
    ]);
  });

  it("keeps non-English phoneme practice lists limited to single-sound trainable units", () => {
    const hiddenByLanguage = {
      "es-ES": ["es-nasal-place", "es-lexical-stress", "es-syllable-rhythm"],
      "fr-FR": [
        "fr-final-consonant-silence",
        "fr-liaison",
        "fr-enchainement",
        "fr-elision",
        "fr-phrase-final-prominence",
      ],
      "ru-RU": [
        "ru-hard-soft",
        "ru-soft-t-d",
        "ru-soft-s-z",
        "ru-soft-n-l-r",
        "ru-soft-labials",
        "ru-soft-sign",
        "ru-stress-reduction",
        "ru-unstressed-o-a",
        "ru-unstressed-e-ya",
        "ru-iotated-vowels",
        "ru-final-devoicing",
        "ru-voicing-assimilation",
        "ru-clusters",
      ],
    } as const;

    const retainedByLanguage = {
      "es-ES": ["es-bv", "es-d", "es-g", "es-diphthongs-j", "es-diphthongs-w"],
      "fr-FR": ["fr-schwa", "fr-an", "fr-glide-hui"],
      "ru-RU": ["ru-t-tj", "ru-d-dj", "ru-r-rj", "ru-ts-ch-shch", "ru-j"],
    } as const;

    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const practiceSlugs = getLanguagePhonemePracticeGroups(languageId)
        .flatMap((group) => group.units)
        .map((unit) => unit.slug);

      for (const slug of hiddenByLanguage[languageId]) {
        const unit = getLanguagePhonemes(languageId).find(
          (candidate) => candidate.slug === slug,
        );
        expect(unit, slug).toBeDefined();
        if (!unit) continue;
        expect(practiceSlugs).not.toContain(slug);
        expect(isVisibleInPhonemePractice(languageId, unit)).toBe(false);
      }

      for (const slug of retainedByLanguage[languageId]) {
        const unit = getLanguagePhonemes(languageId).find(
          (candidate) => candidate.slug === slug,
        );
        expect(unit, slug).toBeDefined();
        if (!unit) continue;
        expect(practiceSlugs).toContain(slug);
        expect(isVisibleInPhonemePractice(languageId, unit)).toBe(true);
      }
    }
  });

  it("uses the first visible single-sound unit as each language phoneme practice default", () => {
    expect(getDefaultPhonemePracticeSlug("en-US")).toBe("ee");
    expect(getDefaultPhonemePracticeSlug("es-ES")).toBe("es-a");
    expect(getDefaultPhonemePracticeSlug("fr-FR")).toBe("fr-i");
    expect(getDefaultPhonemePracticeSlug("ru-RU")).toBe("ru-a");
  });

  it("does not put non-English rule-like units in ordinary phoneme groups", () => {
    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const groups = getLanguageSoundUnitGroups(languageId);
      const ordinaryGroups = groups.filter(
        (group) => group.displayType === "phoneme",
      );

      expect(
        ordinaryGroups
          .flatMap((group) => group.units)
          .filter((unit) => isRuleLikeSoundUnit(unit))
          .map((unit) => unit.slug),
      ).toEqual([]);
    }
  });

  it("keeps non-English units inside the approved product type model", () => {
    const approvedTypes = new Set([
      "phoneme",
      "allophone",
      "contrast",
      "connected-speech-rule",
      "prosody",
    ]);

    for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
      const invalidTypes = getLanguagePhonemes(languageId)
        .filter((unit) => !approvedTypes.has(unit.soundUnitType ?? "phoneme"))
        .map((unit) => `${unit.slug}:${unit.soundUnitType}`);
      const deprecatedTypes = getLanguagePhonemes(languageId)
        .filter(
          (unit) =>
            (unit.category as string) === "cluster" ||
            (unit.soundUnitType as string | undefined) === "cluster",
        )
        .map((unit) => unit.slug);

      expect(invalidTypes).toEqual([]);
      expect(deprecatedTypes).toEqual([]);
    }

    expect(
      getLanguagePhonemes("es-ES").find((unit) => unit.slug === "es-bv")
        ?.soundUnitType,
    ).toBe("allophone");
    expect(
      getLanguagePhonemes("es-ES").find((unit) => unit.slug === "es-nasal-place")
        ?.soundUnitType,
    ).toBe("connected-speech-rule");
    expect(
      getLanguagePhonemes("fr-FR").find((unit) => unit.slug === "fr-liaison")
        ?.soundUnitType,
    ).toBe("connected-speech-rule");
    expect(
      getLanguagePhonemes("ru-RU").find(
        (unit) => unit.slug === "ru-final-devoicing",
      )?.soundUnitType,
    ).toBe("connected-speech-rule");

    const russianClusters = getLanguagePhonemes("ru-RU").find(
      (unit) => unit.slug === "ru-clusters",
    );

    expect(russianClusters).toBeDefined();
    if (!russianClusters) {
      throw new Error("Expected Russian cluster rule unit to exist.");
    }
    expect(russianClusters?.category).toBe("prosody");
    expect(russianClusters?.soundUnitType).toBe("connected-speech-rule");
    expect(isRuleLikeSoundUnit(russianClusters)).toBe(true);
  });

  it("labels non-English cards by sound unit type instead of vowel/consonant fallback", () => {
    const frenchUnits = getLanguagePhonemes("fr-FR");
    const spanishUnits = getLanguagePhonemes("es-ES");
    const liaison = frenchUnits.find((unit) => unit.slug === "fr-liaison");
    const nasalVowel = frenchUnits.find((unit) => unit.slug === "fr-an");
    const approximant = spanishUnits.find((unit) => unit.slug === "es-bv");

    expect(liaison).toBeDefined();
    expect(nasalVowel).toBeDefined();
    expect(approximant).toBeDefined();
    if (!liaison || !nasalVowel || !approximant) {
      throw new Error("Expected French test fixtures to exist.");
    }
    expect(getSoundUnitCardLabel(liaison)).toBe("语流规则");
    expect(getSoundUnitCardLabel(nasalVowel)).toBe("音素");
    expect(getSoundUnitCardLabel(approximant)).toBe("实现音");
  });
});
