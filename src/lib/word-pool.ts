import type { KeywordEntry } from "@/types/phoneme";
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
): KeywordEntry[] {
  const extended = getExtendedWords(slug);
  const cached = getCachedWords(slug);

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

export function getCachedWords(slug: string): KeywordEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const cached: CachedWordPool = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + slug);
      return null;
    }
    return cached.words;
  } catch {
    return null;
  }
}

export function setCachedWords(slug: string, words: KeywordEntry[]): void {
  if (typeof window === "undefined") return;
  const entry: CachedWordPool = {
    words,
    fetchedAt: Date.now(),
  };
  try {
    localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify(entry));
  } catch {
    // localStorage full — silently ignore
  }
}

export function isCacheExpired(slug: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return true;
    const cached: CachedWordPool = JSON.parse(raw);
    return Date.now() - cached.fetchedAt > CACHE_TTL_MS;
  } catch {
    return true;
  }
}
