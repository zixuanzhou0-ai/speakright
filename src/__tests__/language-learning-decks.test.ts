import { describe, expect, it } from "vitest";
import {
  getLanguagePhonemeBySlug,
  getLanguagePhonemes,
} from "@/lib/language-phonemes";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import type { DeckLanguageId } from "@/lib/language-learning-decks";

const DECK_LANGUAGES = Object.keys(LANGUAGE_LEARNING_DECKS) as DeckLanguageId[];
const PRACTICE_TOKEN_REPEAT_LIMIT = 3;
const DECK_TARGETS: Record<
  DeckLanguageId,
  { diagnosticWords: number; contrastDeck: number; sentenceDeck: number }
> = {
  "es-ES": { diagnosticWords: 22, contrastDeck: 16, sentenceDeck: 16 },
  "fr-FR": { diagnosticWords: 26, contrastDeck: 16, sentenceDeck: 16 },
  "ru-RU": { diagnosticWords: 24, contrastDeck: 18, sentenceDeck: 18 },
};
const SOUND_UNIT_TARGETS: Record<DeckLanguageId, number> = {
  "es-ES": 22,
  "fr-FR": 26,
  "ru-RU": 27,
};

function displayKey(text: string): string {
  return text.trim().toLocaleLowerCase();
}

const TOKEN_STOP_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "con",
  "dans",
  "de",
  "del",
  "des",
  "du",
  "el",
  "elle",
  "en",
  "et",
  "i",
  "il",
  "la",
  "le",
  "les",
  "mi",
  "moi",
  "no",
  "por",
  "que",
  "qui",
  "se",
  "tu",
  "un",
  "una",
  "une",
  "y",
  "yo",
  "в",
  "и",
  "к",
  "на",
  "но",
  "с",
  "у",
  "я",
]);

function practiceTokens(text: string): string[] {
  return text
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token));
}

describe("language learning decks", () => {
  it("keeps the audited non-English sound-unit scope explicit", () => {
    for (const languageId of DECK_LANGUAGES) {
      expect(getLanguagePhonemes(languageId).length, languageId).toBe(
        SOUND_UNIT_TARGETS[languageId],
      );
    }
  });

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

  it("keeps final non-English practice options unique within each sound unit", () => {
    for (const languageId of DECK_LANGUAGES) {
      for (const soundUnit of getLanguagePhonemes(languageId)) {
        const keys = soundUnit.keywords.map((keyword) => displayKey(keyword.word));
        const duplicateKeys = keys.filter(
          (key, index) => keys.indexOf(key) !== index,
        );

        expect(duplicateKeys, `${languageId}:${soundUnit.slug}`).toEqual([]);
      }
    }
  });

  it("keeps non-English practice carousels capped and free of known noisy repeats", () => {
    for (const languageId of DECK_LANGUAGES) {
      for (const soundUnit of getLanguagePhonemes(languageId)) {
        expect(soundUnit.keywords.length, `${languageId}:${soundUnit.slug}`).toBeLessThanOrEqual(24);
      }
    }

    const spanishStressWords =
      getLanguagePhonemeBySlug("es-ES", "es-lexical-stress")?.keywords.map(
        (keyword) => keyword.word,
      ) ?? [];
    const spanishRhythmWords =
      getLanguagePhonemeBySlug("es-ES", "es-syllable-rhythm")?.keywords.map(
        (keyword) => keyword.word,
      ) ?? [];
    const frenchFinalWords =
      getLanguagePhonemeBySlug(
        "fr-FR",
        "fr-final-consonant-silence",
      )?.keywords.map((keyword) => keyword.word) ?? [];

    expect(spanishStressWords).not.toContain("papá habló");
    expect(spanishStressWords).not.toContain("médico práctico");
    expect(spanishRhythmWords).not.toContain("Buenos días, muchas gracias.");
    expect(frenchFinalWords).not.toContain("petit chat");
    expect(frenchFinalWords).not.toContain("grand tapis");
    expect(frenchFinalWords).not.toContain("beaucoup trop");
  });

  it("keeps repeated core words from dominating a non-English sound unit", () => {
    for (const languageId of DECK_LANGUAGES) {
      for (const soundUnit of getLanguagePhonemes(languageId)) {
        const tokenCounts = new Map<string, number>();

        for (const keyword of soundUnit.keywords) {
          for (const token of practiceTokens(keyword.word)) {
            tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
          }
        }

        const overusedTokens = Array.from(tokenCounts.entries()).filter(
          ([, count]) => count > PRACTICE_TOKEN_REPEAT_LIMIT,
        );

        expect(overusedTokens, `${languageId}:${soundUnit.slug}`).toEqual([]);
      }
    }
  });

  it("keeps Spanish keyword IPA phoneme-first for b/d/g allophones", () => {
    const spanishUnits = getLanguagePhonemes("es-ES");
    const realizationLayerKeywords = spanishUnits.flatMap((soundUnit) =>
      soundUnit.keywords
        .filter((keyword) => /[βðɣ]/.test(keyword.ipa))
        .map((keyword) => `${soundUnit.slug}:${keyword.word}:${keyword.ipa}`),
    );

    expect(realizationLayerKeywords).toEqual([]);

    const expectedIpaByUnitAndWord = new Map([
      ["es-a:agua", "/ˈagwa/"],
      ["es-a:nada", "/ˈnada/"],
      ["es-bv:bebé", "/beˈbe/"],
      ["es-bv:saber", "/saˈbeɾ/"],
      ["es-d:dedo", "/ˈdedo/"],
      ["es-d:verde", "/ˈbeɾde/"],
      ["es-g:lago", "/ˈlago/"],
      ["es-g:juego", "/ˈxwego/"],
    ]);

    for (const [key, expectedIpa] of expectedIpaByUnitAndWord) {
      const [slug, word] = key.split(":");
      const keyword = getLanguagePhonemeBySlug("es-ES", slug)?.keywords.find(
        (candidate) => candidate.word === word,
      );

      expect(keyword?.ipa, key).toBe(expectedIpa);
    }
  });

  it("does not show diagnostic passages as carousel practice words", () => {
    for (const languageId of DECK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const passageKey = displayKey(deck.diagnosticPassage.text);

      for (const soundUnit of getLanguagePhonemes(languageId)) {
        const keys = soundUnit.keywords.map((keyword) =>
          displayKey(keyword.word),
        );

        expect(keys, `${languageId}:${soundUnit.slug}`).not.toContain(
          passageKey,
        );
      }
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
