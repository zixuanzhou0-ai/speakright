import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import type { DeckLanguageId } from "@/lib/language-learning-decks";
import { getLanguagePhonemePracticeGroups } from "@/lib/language-sound-unit-groups";
import type { LanguageId } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

export type PhonemePracticeIpaAuditLanguageId = LanguageId;
export type PhonemePracticeIpaAuditDisplayType =
  | "word"
  | "phrase"
  | "sentence";
export type PhonemePracticeIpaAuditRole =
  | "ipa-transcription"
  | "deck-focus-hint";
export type PhonemePracticeIpaAuditVerdict =
  | "pending-review"
  | "ok"
  | "update"
  | "variant-accepted"
  | "needs-review";

export interface PhonemePracticeIpaAuditEvidence {
  name: string;
  url: string;
  note: string;
}

export interface PhonemePracticeIpaAuditRow {
  languageId: PhonemePracticeIpaAuditLanguageId;
  languageName: string;
  groupId: string;
  groupLabel: string;
  unitSlug: string;
  unitTitle: string;
  unitCategory: string;
  unitType: string;
  unitDisplayIpa: string;
  itemIndex: number;
  text: string;
  currentIpa: string;
  currentDisplayType: PhonemePracticeIpaAuditDisplayType;
  auditRole: PhonemePracticeIpaAuditRole;
  sourceFile: string;
  sourceNotes: string;
  recommendedIpa: string;
  verdict: PhonemePracticeIpaAuditVerdict;
  evidence: PhonemePracticeIpaAuditEvidence[];
}

export interface PhonemePracticeIpaAuditInput {
  generatedAt: string;
  purpose: string;
  confirmedPolicy: {
    global: string;
    english: string;
    spanish: string;
    french: string;
    russian: string;
  };
  requiredOutputFields: string[];
  rowCount: number;
  rows: PhonemePracticeIpaAuditRow[];
}

export const PHONEME_PRACTICE_IPA_AUDIT_LANGUAGES = [
  "en-US",
  "es-ES",
  "fr-FR",
  "ru-RU",
] as const satisfies readonly PhonemePracticeIpaAuditLanguageId[];

export const IPA_FIELD_PATTERN = /^\/.+\/$/;

const LANGUAGE_NAMES: Record<PhonemePracticeIpaAuditLanguageId, string> = {
  "en-US": "American English",
  "es-ES": "Spanish",
  "fr-FR": "French",
  "ru-RU": "Russian",
};

const BASE_SOURCE_NOTES =
  "Visible phoneme-practice corpus after getLanguagePhonemePracticeGroups filtering.";

const DECK_FOCUS_HINT_SOURCE_NOTES =
  "language-learning-decks sentenceDeck.ipaHint focus cue. Audit the target text and hint role, but do not treat currentIpa as a full sentence transcription.";

function getDisplayType(text: string): PhonemePracticeIpaAuditDisplayType {
  const normalized = text.trim();
  if (/[.!?。？！]/.test(normalized)) return "sentence";
  if (/\s/.test(normalized)) return "phrase";
  return "word";
}

function rowIdentity(
  languageId: LanguageId,
  unitSlug: string,
  text: string,
  currentIpa: string,
): string {
  return [languageId, unitSlug, text.trim(), currentIpa.trim()].join("\u0000");
}

function buildDeckFocusHintKeys(): Set<string> {
  const keys = new Set<string>();

  for (const languageId of ["es-ES", "fr-FR", "ru-RU"] as const) {
    const deck = LANGUAGE_LEARNING_DECKS[languageId satisfies DeckLanguageId];

    for (const sentence of deck.sentenceDeck) {
      for (const slug of sentence.targetUnitSlugs) {
        keys.add(rowIdentity(languageId, slug, sentence.text, sentence.ipaHint));
      }
    }
  }

  return keys;
}

function buildRow(
  languageId: PhonemePracticeIpaAuditLanguageId,
  groupId: string,
  groupLabel: string,
  soundUnit: PhonemeData,
  keyword: KeywordEntry,
  itemIndex: number,
  deckFocusHintKeys: Set<string>,
): PhonemePracticeIpaAuditRow {
  const isDeckFocusHint = deckFocusHintKeys.has(
    rowIdentity(languageId, soundUnit.slug, keyword.word, keyword.ipa),
  );

  return {
    languageId,
    languageName: LANGUAGE_NAMES[languageId],
    groupId,
    groupLabel,
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
    recommendedIpa: keyword.ipa,
    verdict: "pending-review",
    evidence: [],
  };
}

export function buildPhonemePracticeIpaAuditRows(): PhonemePracticeIpaAuditRow[] {
  const deckFocusHintKeys = buildDeckFocusHintKeys();

  return PHONEME_PRACTICE_IPA_AUDIT_LANGUAGES.flatMap((languageId) =>
    getLanguagePhonemePracticeGroups(languageId).flatMap((group) =>
      group.units.flatMap((soundUnit) =>
        soundUnit.keywords.map((keyword, itemIndex) =>
          buildRow(
            languageId,
            group.id,
            group.label,
            soundUnit,
            keyword,
            itemIndex,
            deckFocusHintKeys,
          ),
        ),
      ),
    ),
  );
}

export function buildPhonemePracticeIpaAuditInput(
  generatedAt = new Date().toISOString(),
): PhonemePracticeIpaAuditInput {
  const rows = buildPhonemePracticeIpaAuditRows();

  return {
    generatedAt,
    purpose:
      "SpeakRight Desktop visible en-US/es-ES/fr-FR/ru-RU phoneme-practice IPA audit input for conservative expert review",
    confirmedPolicy: {
      global:
        "Audit only currently visible phoneme-practice entries; hidden rule units stay out of this corpus.",
      english:
        "Keep the existing General American chart/course convention and only fix clear spelling-to-IPA mismatches.",
      spanish:
        "es-ES stays phoneme-first for ordinary word rows; allophone symbols are reserved for explicit allophone or implementation units.",
      french:
        "Use dictionary-style IPA for words; phrase and sentence rows may show connected-speech realization when that is what learners should say.",
      russian:
        "Stress, reduction, hard/soft consonants, final devoicing, and voicing assimilation must stay visible when they affect the learner-facing reading.",
    },
    requiredOutputFields: [
      "languageId",
      "unitSlug",
      "groupId",
      "text",
      "currentIpa",
      "currentDisplayType",
      "auditRole",
      "recommendedIpa",
      "verdict",
      "evidence",
    ],
    rowCount: rows.length,
    rows,
  };
}
