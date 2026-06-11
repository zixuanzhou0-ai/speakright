import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import type { DeckLanguageId } from "@/lib/language-learning-decks";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

export const MULTILINGUAL_AUDIO_PARITY_LANGUAGES = [
  "es-ES",
  "fr-FR",
  "ru-RU",
] as const satisfies readonly DeckLanguageId[];

export const MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT = 24;
export const MULTILINGUAL_AUDIO_PARITY_RULE_PHRASE_TARGET = 16;
export const MULTILINGUAL_AUDIO_PARITY_RULE_ANCHOR_TARGET = 8;

export type MultilingualAudioParityLanguageId =
  (typeof MULTILINGUAL_AUDIO_PARITY_LANGUAGES)[number];

export type MultilingualPracticeItemKind =
  | "word"
  | "phrase"
  | "sentence"
  | "contrast";

export type MultilingualPracticeItemSource =
  | "phoneme-keyword"
  | "diagnostic-word"
  | "diagnostic-passage"
  | "contrast"
  | "sentence";

export interface MultilingualPracticeItem {
  languageId: MultilingualAudioParityLanguageId;
  text: string;
  ipa: string;
  soundUnitSlugs: string[];
  kind: MultilingualPracticeItemKind;
  source: MultilingualPracticeItemSource;
}

export interface MultilingualAudioParityUnitSummary {
  languageId: MultilingualAudioParityLanguageId;
  slug: string;
  label: string;
  category: PhonemeData["category"];
  soundUnitType: NonNullable<PhonemeData["soundUnitType"]>;
  requiredItems: number;
  totalItems: number;
  wordLikeItems: number;
  phraseLikeItems: number;
  missingItems: number;
  missingAudioTexts: string[];
  kindCounts: Record<MultilingualPracticeItemKind, number>;
}

export interface MultilingualAudioParityLanguageSummary {
  languageId: MultilingualAudioParityLanguageId;
  soundUnits: number;
  requiredItems: number;
  totalPracticeItems: number;
  uniquePracticeTexts: number;
  existingAudioItems: number;
  missingAudioItems: number;
  estimatedNewCharacters: number;
  units: MultilingualAudioParityUnitSummary[];
}

export interface MultilingualAudioParityReport {
  generatedAt: string;
  targetItemsPerUnit: number;
  rulePhraseTarget: number;
  languages: MultilingualAudioParityLanguageSummary[];
  totals: {
    soundUnits: number;
    requiredItems: number;
    totalPracticeItems: number;
    uniquePracticeTexts: number;
    existingAudioItems: number;
    missingAudioItems: number;
    estimatedNewCharacters: number;
  };
}

function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function isSentenceLike(text: string): boolean {
  const trimmed = cleanText(text);
  return /[.!?。？！]$/.test(trimmed) || trimmed.split(/\s+/).length >= 5;
}

function inferKind(
  text: string,
  source: MultilingualPracticeItemSource,
): MultilingualPracticeItemKind {
  if (source === "contrast") return "contrast";
  if (source === "sentence" || source === "diagnostic-passage") return "sentence";
  if (isSentenceLike(text)) return "sentence";
  return cleanText(text).includes(" ") ? "phrase" : "word";
}

function splitContrastIpa(ipa: string): [string, string] {
  const parts = ipa.split("~").map((part) => part.trim());
  if (parts.length >= 2) return [parts[0], parts[1]];
  return [ipa, ipa];
}

function itemKey(item: MultilingualPracticeItem): string {
  return [
    item.languageId,
    normalizeAudioPackText(item.text),
    [...item.soundUnitSlugs].sort().join("|"),
    item.source,
  ].join("::");
}

function practiceItem(
  languageId: MultilingualAudioParityLanguageId,
  text: string,
  ipa: string | undefined,
  soundUnitSlugs: string[],
  source: MultilingualPracticeItemSource,
): MultilingualPracticeItem | null {
  const cleanedText = cleanText(text);
  const cleanedIpa = cleanText(ipa ?? "");
  const slugs = [...new Set(soundUnitSlugs.filter(Boolean))];

  if (!cleanedText || !cleanedIpa || slugs.length === 0) {
    return null;
  }

  return {
    languageId,
    text: cleanedText,
    ipa: cleanedIpa,
    soundUnitSlugs: slugs,
    kind: inferKind(cleanedText, source),
    source,
  };
}

function keywordToItem(
  languageId: MultilingualAudioParityLanguageId,
  slug: string,
  keyword: KeywordEntry,
): MultilingualPracticeItem | null {
  return practiceItem(
    languageId,
    keyword.word,
    keyword.ipa,
    [slug],
    "phoneme-keyword",
  );
}

function dedupeItems(
  items: Array<MultilingualPracticeItem | null>,
): MultilingualPracticeItem[] {
  const seen = new Set<string>();
  const deduped: MultilingualPracticeItem[] = [];

  for (const item of items) {
    if (!item) continue;
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function getMultilingualPracticeItems(
  languageId: MultilingualAudioParityLanguageId,
): MultilingualPracticeItem[] {
  const units = getLanguagePhonemes(languageId);
  const deck = LANGUAGE_LEARNING_DECKS[languageId];
  const items: Array<MultilingualPracticeItem | null> = [];

  for (const unit of units) {
    for (const keyword of unit.keywords) {
      items.push(keywordToItem(languageId, unit.slug, keyword));
    }
  }

  for (const word of deck.diagnosticWords) {
    items.push(
      practiceItem(
        languageId,
        word.text,
        word.ipa,
        [word.targetUnitSlug],
        "diagnostic-word",
      ),
    );
  }

  items.push(
    practiceItem(
      languageId,
      deck.diagnosticPassage.text,
      deck.diagnosticPassage.stressText ?? deck.diagnosticPassage.text,
      deck.diagnosticPassage.targetUnitSlugs,
      "diagnostic-passage",
    ),
  );

  for (const contrast of deck.contrastDeck) {
    const [leftIpa, rightIpa] = splitContrastIpa(contrast.ipa);
    items.push(
      practiceItem(
        languageId,
        contrast.left,
        leftIpa,
        [contrast.targetUnitSlug],
        "contrast",
      ),
    );
    items.push(
      practiceItem(
        languageId,
        contrast.right,
        rightIpa,
        [contrast.targetUnitSlug],
        "contrast",
      ),
    );
  }

  for (const sentence of deck.sentenceDeck) {
    items.push(
      practiceItem(
        languageId,
        sentence.text,
        sentence.ipaHint,
        sentence.targetUnitSlugs,
        "sentence",
      ),
    );
  }

  return dedupeItems(items);
}

export function getTextsMissingFromStaticAudioPack(
  items: MultilingualPracticeItem[],
  audioKeys: ReadonlySet<string>,
): string[] {
  const missing = new Set<string>();

  for (const item of items) {
    const key = normalizeAudioPackText(item.text);
    if (!audioKeys.has(key)) {
      missing.add(item.text);
    }
  }

  return [...missing].sort((a, b) => a.localeCompare(b));
}

function isRuleLikeUnit(unit: PhonemeData): boolean {
  return (
    unit.category === "prosody" ||
    unit.category === "cluster" ||
    unit.soundUnitType === "prosody" ||
    unit.soundUnitType === "cluster"
  );
}

function summarizeUnit(
  languageId: MultilingualAudioParityLanguageId,
  unit: PhonemeData,
  allItems: MultilingualPracticeItem[],
  audioKeys?: ReadonlySet<string>,
): MultilingualAudioParityUnitSummary {
  const unitItems = allItems.filter((item) =>
    item.soundUnitSlugs.includes(unit.slug),
  );
  const missingAudioTexts = audioKeys
    ? getTextsMissingFromStaticAudioPack(unitItems, audioKeys)
    : [];
  const kindCounts = {
    word: 0,
    phrase: 0,
    sentence: 0,
    contrast: 0,
  } satisfies Record<MultilingualPracticeItemKind, number>;

  for (const item of unitItems) {
    kindCounts[item.kind] += 1;
  }

  const phraseLikeItems =
    kindCounts.phrase + kindCounts.sentence + kindCounts.contrast;
  const totalItems = unitItems.length;

  return {
    languageId,
    slug: unit.slug,
    label: unit.ipa,
    category: unit.category,
    soundUnitType: unit.soundUnitType ?? "phoneme",
    requiredItems: MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    totalItems,
    wordLikeItems: kindCounts.word,
    phraseLikeItems,
    missingItems: Math.max(
      0,
      MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT - totalItems,
    ),
    missingAudioTexts,
    kindCounts,
  };
}

export function summarizeMultilingualAudioParity(
  languageId: MultilingualAudioParityLanguageId,
  audioKeys?: ReadonlySet<string>,
): MultilingualAudioParityLanguageSummary {
  const units = getLanguagePhonemes(languageId);
  const items = getMultilingualPracticeItems(languageId);
  const unitSummaries = units.map((unit) =>
    summarizeUnit(languageId, unit, items, audioKeys),
  );
  const uniqueTexts = new Set(items.map((item) => normalizeAudioPackText(item.text)));
  const missingAudio = audioKeys
    ? getTextsMissingFromStaticAudioPack(items, audioKeys)
    : [];

  return {
    languageId,
    soundUnits: units.length,
    requiredItems: units.length * MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    totalPracticeItems: items.length,
    uniquePracticeTexts: uniqueTexts.size,
    existingAudioItems: audioKeys?.size ?? 0,
    missingAudioItems: missingAudio.length,
    estimatedNewCharacters: missingAudio.reduce(
      (sum, text) => sum + Array.from(text).length,
      0,
    ),
    units: unitSummaries,
  };
}

export function buildMultilingualAudioParityReport(
  audioKeysByLanguage: Partial<
    Record<MultilingualAudioParityLanguageId, ReadonlySet<string>>
  > = {},
): MultilingualAudioParityReport {
  const languages = MULTILINGUAL_AUDIO_PARITY_LANGUAGES.map((languageId) =>
    summarizeMultilingualAudioParity(languageId, audioKeysByLanguage[languageId]),
  );

  return {
    generatedAt: new Date().toISOString(),
    targetItemsPerUnit: MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    rulePhraseTarget: MULTILINGUAL_AUDIO_PARITY_RULE_PHRASE_TARGET,
    languages,
    totals: {
      soundUnits: languages.reduce((sum, item) => sum + item.soundUnits, 0),
      requiredItems: languages.reduce((sum, item) => sum + item.requiredItems, 0),
      totalPracticeItems: languages.reduce(
        (sum, item) => sum + item.totalPracticeItems,
        0,
      ),
      uniquePracticeTexts: languages.reduce(
        (sum, item) => sum + item.uniquePracticeTexts,
        0,
      ),
      existingAudioItems: languages.reduce(
        (sum, item) => sum + item.existingAudioItems,
        0,
      ),
      missingAudioItems: languages.reduce(
        (sum, item) => sum + item.missingAudioItems,
        0,
      ),
      estimatedNewCharacters: languages.reduce(
        (sum, item) => sum + item.estimatedNewCharacters,
        0,
      ),
    },
  };
}

export function isRuleLikeParityUnit(
  unit: Pick<PhonemeData, "category" | "soundUnitType">,
): boolean {
  return isRuleLikeUnit(unit as PhonemeData);
}
