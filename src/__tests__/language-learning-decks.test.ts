import { describe, expect, it } from "vitest";
import {
  getLanguagePhonemeBySlug,
  getLanguagePhonemes,
} from "@/lib/language-phonemes";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import type { DeckLanguageId } from "@/lib/language-learning-decks";

const DECK_LANGUAGES = Object.keys(LANGUAGE_LEARNING_DECKS) as DeckLanguageId[];
const DECK_TARGETS: Record<
  DeckLanguageId,
  { diagnosticWords: number; contrastDeck: number; sentenceDeck: number }
> = {
  "es-ES": { diagnosticWords: 22, contrastDeck: 16, sentenceDeck: 16 },
  "fr-FR": { diagnosticWords: 26, contrastDeck: 16, sentenceDeck: 16 },
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

  it("covers every language sound unit in at least one deck entry", () => {
    for (const languageId of DECK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const coveredSlugs = new Set([
        ...deck.diagnosticWords.map((word) => word.targetUnitSlug),
        ...deck.diagnosticPassage.targetUnitSlugs,
        ...deck.contrastDeck.map((item) => item.targetUnitSlug),
        ...deck.sentenceDeck.flatMap((item) => item.targetUnitSlugs),
      ]);
      const missingSlugs = getLanguagePhonemes(languageId)
        .map((phoneme) => phoneme.slug)
        .filter((slug) => !coveredSlugs.has(slug));

      expect(missingSlugs).toEqual([]);
    }
  });

  it("covers every non-English sound unit in diagnosis and sentence practice", () => {
    for (const languageId of DECK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const diagnosisTargets = new Set([
        ...deck.diagnosticWords.map((word) => word.targetUnitSlug),
        ...deck.diagnosticPassage.targetUnitSlugs,
      ]);
      const sentenceTargets = new Set(
        deck.sentenceDeck.flatMap((item) => item.targetUnitSlugs),
      );

      const missingDiagnosis = getLanguagePhonemes(languageId)
        .map((phoneme) => phoneme.slug)
        .filter((slug) => !diagnosisTargets.has(slug));
      const missingSentence = getLanguagePhonemes(languageId)
        .map((phoneme) => phoneme.slug)
        .filter((slug) => !sentenceTargets.has(slug));

      expect(missingDiagnosis).toEqual([]);
      expect(missingSentence).toEqual([]);
    }
  });

  it("does not keep known weak Spanish pseudo-minimal pairs", () => {
    const spanishPairs = LANGUAGE_LEARNING_DECKS["es-ES"].contrastDeck.map(
      (item) => `${item.left}~${item.right}`,
    );

    expect(spanishPairs).not.toContain("bebo~vivo");
    expect(spanishPairs).not.toContain("si~sí");
    expect(spanishPairs).not.toContain("ano~año");
  });
});
