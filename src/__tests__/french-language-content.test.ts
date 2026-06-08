import { describe, expect, it } from "vitest";
import { REQUIRED_FRENCH_UNITS } from "@/lib/language-critical-units";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  expectDeckTargetsResolvable,
  expectRequiredUnits,
  expectSourceBackedUnits,
} from "./language-content-helpers";

describe("French pronunciation content", () => {
  it("covers the French IPA-first beta inventory", () => {
    expectRequiredUnits("fr-FR", REQUIRED_FRENCH_UNITS);
  });

  it("keeps French units source-backed and learner-facing", () => {
    expectSourceBackedUnits("fr-FR");
  });

  it("expands French diagnostic, contrast, and sentence decks", () => {
    const deck = LANGUAGE_LEARNING_DECKS["fr-FR"];

    expect(deck.diagnosticWords.length).toBeGreaterThanOrEqual(20);
    expect(deck.contrastDeck.length).toBeGreaterThanOrEqual(16);
    expect(deck.sentenceDeck.length).toBeGreaterThanOrEqual(16);
    expectDeckTargetsResolvable("fr-FR");
  });

  it("treats liaison, enchaînement, elision, and final silence as rule units", () => {
    const ruleSlugs = [
      "fr-final-consonant-silence",
      "fr-liaison",
      "fr-enchainement",
      "fr-elision",
    ];

    for (const slug of ruleSlugs) {
      expect(REQUIRED_FRENCH_UNITS).toContain(slug);
      const unit = getLanguagePhonemeBySlug("fr-FR", slug);
      expect(unit?.soundUnitType, slug).toBe("prosody");
    }
  });
});
