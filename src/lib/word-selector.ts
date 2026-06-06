import type { KeywordEntry } from "@/types/phoneme";
import type { LanguageId } from "@/types/language";
import { DEFAULT_LANGUAGE_ID } from "@/lib/language-profiles";
import {
  getPracticedWords,
  getPracticedWordsForLanguage,
} from "./practice-tracker";

/**
 * Weighted random selection for next word.
 * Unpracticed words get 3x weight. Current word is excluded.
 */
export function selectNextWord(
  slug: string,
  pool: KeywordEntry[],
  currentWord?: string,
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): KeywordEntry {
  if (pool.length === 0) throw new Error("Word pool is empty");
  if (pool.length === 1) return pool[0];

  const practiced = new Set(
    languageId === DEFAULT_LANGUAGE_ID
      ? getPracticedWords(slug)
      : getPracticedWordsForLanguage(languageId, slug),
  );
  const candidates = currentWord
    ? pool.filter((w) => w.word.toLowerCase() !== currentWord.toLowerCase())
    : pool;

  // If filtering removed everything (single word pool), use full pool
  if (candidates.length === 0) return pool[0];

  // Build weighted array
  const weights = candidates.map((w) =>
    practiced.has(w.word.toLowerCase()) ? 1 : 3,
  );
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < candidates.length; i++) {
    random -= weights[i];
    if (random <= 0) return candidates[i];
  }

  return candidates[candidates.length - 1];
}
