import { describe, expect, it } from "vitest";
import {
  getCenteredCompactTextClassName,
  getCenteredMonoTextClassName,
  getCenteredProminentTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextPresentation,
  getSoundUnitReadableLabel,
} from "@/lib/practice-text-presentation";
import type { PhonemeData } from "@/types/phoneme";

const spanishRhythmUnit: PhonemeData = {
  languageId: "es-ES",
  ipa: "syllable timing",
  symbol: "syllable timing",
  slug: "es-syllable-rhythm",
  name: "Spanish syllable timing",
  category: "prosody",
  soundUnitType: "prosody",
  example: "Buenos dias",
  keywords: [],
  difficulty: "medium",
};

describe("practice text presentation", () => {
  it("uses Chinese rule labels for non-English rule units", () => {
    expect(getSoundUnitReadableLabel(spanishRhythmUnit)).toBe("音节节奏");
  });

  it("keeps a non-English reading task complete and rule-aware", () => {
    const presentation = getPracticeTextPresentation(
      {
        word: "Buenos dias, muchas gracias.",
        ipa: "/ˈbwenos ˈdias ˈmutʃas ˈɣɾaθjas/",
      },
      spanishRhythmUnit,
      "es-ES",
    );

    expect(presentation).toMatchObject({
      mode: "rule",
      density: "sentence",
      titleLabel: "规则训练 · 音节节奏",
      primaryText: "Buenos dias, muchas gracias.",
      secondaryText: "/ˈbwenos ˈdias ˈmutʃas ˈɣɾaθjas/",
      textAlign: "center",
      isNonEnglish: true,
    });
  });

  it("keeps every shared target-text class centered, wrapping, and untruncated", () => {
    const classNames = [
      getCenteredReadableTextClassName("sentence"),
      getCenteredProminentTextClassName("long"),
      getCenteredMonoTextClassName("sentence"),
      getCenteredCompactTextClassName("long"),
    ];

    for (const className of classNames) {
      expect(className).toContain("text-center");
      expect(className).toContain("whitespace-normal");
      expect(className).toContain("break-words");
      expect(className).toContain("[overflow-wrap:anywhere]");
      expect(className).not.toContain("truncate");
      expect(className).not.toContain("line-clamp");
      expect(className).not.toContain("whitespace-nowrap");
    }
  });

  it("treats long Cyrillic rule text as a centered full sentence", () => {
    const russianStressUnit: PhonemeData = {
      languageId: "ru-RU",
      ipa: "/ˈ + ə ɐ/",
      symbol: "/ˈ + ə ɐ/",
      slug: "ru-stress-reduction",
      name: "Russian stress and vowel reduction",
      category: "prosody",
      soundUnitType: "prosody",
      example: "молоко",
      keywords: [],
      difficulty: "high",
    };

    const presentation = getPracticeTextPresentation(
      {
        word: "Здравствуйте, встретиться с сестрой трудно.",
        ipa: "/ˈzdrastvʊjtʲe ˈfstrʲetʲɪt͡sə s sʲɪˈstroj ˈtrudnə/",
      },
      russianStressUnit,
      "ru-RU",
    );

    expect(presentation).toMatchObject({
      mode: "rule",
      density: "sentence",
      titleLabel: "规则训练 · 重音弱化",
      primaryText: "Здравствуйте, встретиться с сестрой трудно.",
      textAlign: "center",
    });
  });
});
