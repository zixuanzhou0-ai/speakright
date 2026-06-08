import { expect } from "vitest";
import { getLanguagePhonemeBySlug, getLanguagePhonemes } from "@/lib/language-phonemes";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import { LANGUAGE_LEARNING_DECKS, type DeckLanguageId } from "@/lib/language-learning-decks";
import type { LanguageId } from "@/types/language";

export function expectRequiredUnits(
  languageId: LanguageId,
  requiredSlugs: readonly string[],
) {
  for (const slug of requiredSlugs) {
    expect(getLanguagePhonemeBySlug(languageId, slug), slug).toBeDefined();
  }
}

export function expectSourceBackedUnits(languageId: LanguageId) {
  for (const unit of getLanguagePhonemes(languageId)) {
    expect(unit.description?.trim(), unit.slug).toBeTruthy();
    expect(unit.notes?.length ?? 0, unit.slug).toBeGreaterThan(0);
    expect(unit.sourceRefs?.length ?? 0, unit.slug).toBeGreaterThan(0);
    expect(unit.teachingResources?.length ?? 0, unit.slug).toBeGreaterThan(0);
    expect(unit.phonemeAudio, unit.slug).toBeDefined();
    expect(unit.keywords.length, unit.slug).toBeGreaterThanOrEqual(20);

    for (const ref of unit.sourceRefs ?? []) {
      expect(getLanguageResourceSite(ref), `${unit.slug}:${ref}`).toBeDefined();
    }
  }
}

export function expectDeckTargetsResolvable(languageId: DeckLanguageId) {
  const deck = LANGUAGE_LEARNING_DECKS[languageId];
  const targetSlugs = [
    ...deck.diagnosticWords.map((word) => word.targetUnitSlug),
    ...deck.diagnosticPassage.targetUnitSlugs,
    ...deck.contrastDeck.map((item) => item.targetUnitSlug),
    ...deck.sentenceDeck.flatMap((item) => item.targetUnitSlugs),
  ];

  for (const slug of targetSlugs) {
    expect(getLanguagePhonemeBySlug(languageId, slug), slug).toBeDefined();
  }
}
