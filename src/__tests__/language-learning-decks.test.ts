import { describe, expect, it } from "vitest";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import type { DeckLanguageId } from "@/lib/language-learning-decks";

const DECK_LANGUAGES = Object.keys(LANGUAGE_LEARNING_DECKS) as DeckLanguageId[];
const DECK_TARGETS: Record<
  DeckLanguageId,
  { diagnosticWords: number; contrastDeck: number; sentenceDeck: number }
> = {
  "es-ES": { diagnosticWords: 22, contrastDeck: 16, sentenceDeck: 16 },
  "fr-FR": { diagnosticWords: 20, contrastDeck: 16, sentenceDeck: 16 },
  "ru-RU": { diagnosticWords: 24, contrastDeck: 18, sentenceDeck: 18 },
};

describe("language learning decks", () => {
  it("provides starter diagnostic, contrast, and sentence decks for every non-English language", () => {
    for (const languageId of DECK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const targets = DECK_TARGETS[languageId];

      expect(deck.sourceRefs.length).toBeGreaterThanOrEqual(3);
      expect(deck.diagnosticWords.length).toBeGreaterThanOrEqual(
        targets.diagnosticWords,
      );
      expect(deck.contrastDeck.length).toBeGreaterThanOrEqual(
        targets.contrastDeck,
      );
      expect(deck.sentenceDeck.length).toBeGreaterThanOrEqual(
        targets.sentenceDeck,
      );
      expect(deck.diagnosticPassage.text.trim().split(/\s+/).length).toBeGreaterThan(
        6,
      );
    }
  });

  it("keeps every deck source and target sound unit resolvable", () => {
    for (const languageId of DECK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const targetSlugs = [
        ...deck.diagnosticWords.map((word) => word.targetUnitSlug),
        ...deck.diagnosticPassage.targetUnitSlugs,
        ...deck.contrastDeck.map((item) => item.targetUnitSlug),
        ...deck.sentenceDeck.flatMap((item) => item.targetUnitSlugs),
      ];

      for (const ref of deck.sourceRefs) {
        expect(getLanguageResourceSite(ref)).toBeDefined();
      }

      for (const slug of targetSlugs) {
        expect(getLanguagePhonemeBySlug(languageId, slug)).toBeDefined();
      }
    }
  });
});
