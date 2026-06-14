import { describe, expect, it } from "vitest";
import { auditLanguageCoverage } from "@/lib/language-content-audit";
import { REQUIRED_RUSSIAN_UNITS } from "@/lib/language-critical-units";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  expectDeckTargetsResolvable,
  expectRequiredUnits,
  expectSourceBackedUnits,
} from "./language-content-helpers";

describe("Russian pronunciation content", () => {
  it("covers the Russian stress-aware IPA beta inventory", () => {
    expectRequiredUnits("ru-RU", REQUIRED_RUSSIAN_UNITS);
  });

  it("keeps Russian units source-backed and learner-facing", () => {
    expectSourceBackedUnits("ru-RU");
  });

  it("requires visible stressText for all Russian multi-syllable keywords", () => {
    const audit = auditLanguageCoverage("ru-RU");

    expect(audit.russianKeywordsWithoutStress).toEqual([]);
  });

  it("explains final devoicing without hiding connected-speech voicing", () => {
    const finalDevoicing = getLanguagePhonemeBySlug(
      "ru-RU",
      "ru-final-devoicing",
    );

    expect(finalDevoicing?.description).toContain("停顿或清辅音前");
    expect(finalDevoicing?.description).toContain("连到浊辅音、响音或元音前");
    expect(finalDevoicing?.description).not.toContain("在词尾不保持浊音");
  });

  it("expands Russian diagnostic, contrast, and sentence decks", () => {
    const deck = LANGUAGE_LEARNING_DECKS["ru-RU"];

    expect(deck.diagnosticWords.length).toBeGreaterThanOrEqual(24);
    expect(deck.contrastDeck.length).toBeGreaterThanOrEqual(18);
    expect(deck.sentenceDeck.length).toBeGreaterThanOrEqual(18);
    expectDeckTargetsResolvable("ru-RU");
  });
});
