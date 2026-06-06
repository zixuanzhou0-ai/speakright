import type { KeywordEntry } from "@/types/phoneme";
import type { LanguageId } from "@/types/language";
import { DEFAULT_LANGUAGE_ID } from "@/lib/language-profiles";
import { getLanguageExtendedWords } from "@/lib/language-content-packs";
import { getExtendedWords } from "./word-bank";

const CACHE_PREFIX = "speakright_mw_words_";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedWordPool {
  words: KeywordEntry[];
  fetchedAt: number;
}

export function getWordPool(
  slug: string,
  staticKeywords: KeywordEntry[],
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): KeywordEntry[] {
  const extended =
    languageId === DEFAULT_LANGUAGE_ID
      ? getExtendedWords(slug)
      : getLanguageExtendedWords(languageId, slug);
  const cached = getCachedWords(slug, languageId);

  // Merge static + extended + cached, deduplicate by word (case-insensitive)
  const seen = new Set(staticKeywords.map((k) => k.word.toLowerCase()));
  const result = [...staticKeywords];

  for (const w of extended) {
    if (!seen.has(w.word.toLowerCase())) {
      seen.add(w.word.toLowerCase());
      result.push(w);
    }
  }

  if (cached) {
    for (const w of cached) {
      if (!seen.has(w.word.toLowerCase())) {
        seen.add(w.word.toLowerCase());
        result.push(w);
      }
    }
  }

  return result;
}

function cacheKey(slug: string, languageId: LanguageId): string {
  return `${CACHE_PREFIX}${languageId}:${slug}`;
}

export function getCachedWords(
  slug: string,
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): KeywordEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(slug, languageId));
    if (!raw) return null;
    const cached: CachedWordPool = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(slug, languageId));
      return null;
    }
    return cached.words;
  } catch {
    return null;
  }
}

export function setCachedWords(
  slug: string,
  words: KeywordEntry[],
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): void {
  if (typeof window === "undefined") return;
  const entry: CachedWordPool = {
    words,
    fetchedAt: Date.now(),
  };
  try {
    localStorage.setItem(cacheKey(slug, languageId), JSON.stringify(entry));
  } catch {
    // localStorage full — silently ignore
  }
}

export function isCacheExpired(
  slug: string,
  languageId: LanguageId = DEFAULT_LANGUAGE_ID,
): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(cacheKey(slug, languageId));
    if (!raw) return true;
    const cached: CachedWordPool = JSON.parse(raw);
    return Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  } catch {
    return true;
  }
}
