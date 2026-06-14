import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import type { DeckLanguageId } from "@/lib/language-learning-decks";

export type NonEnglishIpaAuditLanguageId = DeckLanguageId;
export type NonEnglishIpaAuditDisplayType = "word" | "phrase" | "sentence";
export type NonEnglishIpaAuditRole =
  | "ipa-transcription"
  | "deck-focus-hint";

export interface NonEnglishIpaAuditRow {
  languageId: NonEnglishIpaAuditLanguageId;
  languageName: string;
  unitSlug: string;
  unitTitle: string;
  unitCategory: string;
  unitType: string;
  unitDisplayIpa: string;
  itemIndex: number;
  text: string;
  currentIpa: string;
  currentDisplayType: NonEnglishIpaAuditDisplayType;
  auditRole: NonEnglishIpaAuditRole;
  sourceFile: string;
  sourceNotes: string;
}

export interface NonEnglishIpaAuditInput {
  generatedAt: string;
  purpose: string;
  confirmedPolicy: {
    global: string;
    spanish: string;
    french: string;
    russian: string;
  };
  requiredOutputFields: string[];
  rowCount: number;
  rows: NonEnglishIpaAuditRow[];
}

const AUDIT_LANGUAGES: NonEnglishIpaAuditLanguageId[] = [
  "es-ES",
  "fr-FR",
  "ru-RU",
];

const LANGUAGE_NAMES: Record<NonEnglishIpaAuditLanguageId, string> = {
  "es-ES": "Spanish",
  "fr-FR": "French",
  "ru-RU": "Russian",
};

const BASE_SOURCE_NOTES =
  "Final expanded UI corpus from language-sound-units, language-keyword-expansions, and language-learning-decks.";

const DECK_FOCUS_HINT_SOURCE_NOTES =
  "language-learning-decks sentenceDeck.ipaHint focus cue. Audit the target text and hint role, but do not treat currentIpa as a full sentence transcription.";

function getDisplayType(text: string): NonEnglishIpaAuditDisplayType {
  if (/[.!?。？！]/.test(text.trim())) return "sentence";
  if (/\s/.test(text.trim())) return "phrase";
  return "word";
}

function deckSentenceHintKeys(): Set<string> {
  const keys = new Set<string>();

  for (const languageId of AUDIT_LANGUAGES) {
    const deck = LANGUAGE_LEARNING_DECKS[languageId];

    for (const sentence of deck.sentenceDeck) {
      for (const slug of sentence.targetUnitSlugs) {
        keys.add(rowIdentity(languageId, slug, sentence.text, sentence.ipaHint));
      }
    }
  }

  return keys;
}

function rowIdentity(
  languageId: NonEnglishIpaAuditLanguageId,
  unitSlug: string,
  text: string,
  currentIpa: string,
): string {
  return [languageId, unitSlug, text.trim(), currentIpa.trim()].join("\u0000");
}

export function buildNonEnglishIpaAuditRows(): NonEnglishIpaAuditRow[] {
  const focusHintKeys = deckSentenceHintKeys();

  return AUDIT_LANGUAGES.flatMap((languageId) =>
    getLanguagePhonemes(languageId).flatMap((soundUnit) =>
      soundUnit.keywords.map((keyword, itemIndex) => {
        const isDeckFocusHint = focusHintKeys.has(
          rowIdentity(languageId, soundUnit.slug, keyword.word, keyword.ipa),
        );

        return {
          languageId,
          languageName: LANGUAGE_NAMES[languageId],
          unitSlug: soundUnit.slug,
          unitTitle: soundUnit.name,
          unitCategory: soundUnit.category,
          unitType: soundUnit.soundUnitType ?? "phoneme",
          unitDisplayIpa: soundUnit.ipa,
          itemIndex,
          text: keyword.word,
          currentIpa: keyword.ipa,
          currentDisplayType: getDisplayType(keyword.word),
          auditRole: isDeckFocusHint ? "deck-focus-hint" : "ipa-transcription",
          sourceFile: isDeckFocusHint
            ? "src/lib/language-learning-decks.ts"
            : "src/lib/language-phonemes.ts",
          sourceNotes: isDeckFocusHint
            ? DECK_FOCUS_HINT_SOURCE_NOTES
            : BASE_SOURCE_NOTES,
        } satisfies NonEnglishIpaAuditRow;
      }),
    ),
  );
}

export function buildNonEnglishIpaAuditInput(
  generatedAt = new Date().toISOString(),
): NonEnglishIpaAuditInput {
  const rows = buildNonEnglishIpaAuditRows();

  return {
    generatedAt,
    purpose:
      "SpeakRight Desktop final user-visible es-ES/fr-FR/ru-RU IPA audit input for GPT Research or expert review",
    confirmedPolicy: {
      global:
        "two-layer display: phoneme or dictionary anchor plus learner-facing training realization",
      spanish:
        "es-ES, phoneme-first; allophones only as realization notes unless exact training unit exists",
      french:
        "dictionary pronunciation for words; connected-speech realization for phrases and sentences",
      russian:
        "stress and broad training realization must be visible; lexical phoneme layer may be secondary",
    },
    requiredOutputFields: [
      "languageId",
      "unitSlug",
      "text",
      "currentIpa",
      "auditRole",
      "recommendedIpa",
      "ipaType",
      "accentStandard",
      "source1Name",
      "source1Url",
      "source1Evidence",
      "source2Name",
      "source2Url",
      "source2Evidence",
      "verdict",
      "notes",
    ],
    rowCount: rows.length,
    rows,
  };
}
