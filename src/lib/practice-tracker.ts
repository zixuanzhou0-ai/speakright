import type { LanguageId } from "@/types/language";
import { languageScopedStorageKey } from "./language-storage";

const STORAGE_KEY = "speakright_practice_history";

interface PracticeHistory {
  [slug: string]: {
    words: string[];
    lastUpdated: number;
  };
}

function scopedKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(STORAGE_KEY, languageId);
}

function getHistory(languageId?: LanguageId): PracticeHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(scopedKey(languageId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setHistory(history: PracticeHistory, languageId?: LanguageId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(scopedKey(languageId), JSON.stringify(history));
  } catch {
    // localStorage full — silently ignore
  }
}

export function getPracticedWords(
  slug: string,
  languageId?: LanguageId,
): string[] {
  const history = getHistory(languageId);
  return history[slug]?.words ?? [];
}

export function markWordPracticed(
  slug: string,
  word: string,
  languageId?: LanguageId,
): void {
  const history = getHistory(languageId);
  const entry = history[slug] ?? { words: [], lastUpdated: 0 };
  const lower = word.toLowerCase();
  if (!entry.words.includes(lower)) {
    entry.words.push(lower);
  }
  entry.lastUpdated = Date.now();
  history[slug] = entry;
  setHistory(history, languageId);
}
