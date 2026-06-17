import { describe, expect, it } from "vitest";
import {
  LANGUAGE_SOUND_UNIT_GROUPS,
  getLanguageSoundUnitGroups,
  getSoundUnitCardLabel,
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

    expect(groups.map((group) => group.label)).toEqual(["元音", "辅音"]);
    expect(groups.every((group) => group.displayType === "phoneme")).toBe(true);
    expect(groups.flatMap((group) => group.units)).toHaveLength(40);
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

  it("labels non-English cards by sound unit type instead of vowel/consonant fallback", () => {
    const units = getLanguagePhonemes("fr-FR");
    const liaison = units.find((unit) => unit.slug === "fr-liaison");
    const nasalVowel = units.find((unit) => unit.slug === "fr-an");

    expect(liaison).toBeDefined();
    expect(nasalVowel).toBeDefined();
    if (!liaison || !nasalVowel) {
      throw new Error("Expected French test fixtures to exist.");
    }
    expect(getSoundUnitCardLabel(liaison)).toBe("规则");
    expect(getSoundUnitCardLabel(nasalVowel)).toBe("音素");
  });
});
