import type { LanguageId } from "@/types/language";
import { languageScopedStorageKey } from "./language-storage";

const STORAGE_KEY = "speakright_score_history";
const MAX_SCORES = 5;

interface ScoreEntry {
  scores: number[];
  lastUpdated: string;
}

type ScoreHistory = Record<string, ScoreEntry>;

function scopedKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(STORAGE_KEY, languageId);
}

function load(languageId?: LanguageId): ScoreHistory {
  try {
    const raw = localStorage.getItem(scopedKey(languageId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(history: ScoreHistory, languageId?: LanguageId) {
  try {
    localStorage.setItem(scopedKey(languageId), JSON.stringify(history));
  } catch {
    // localStorage full or unavailable
  }
}

export function addScore(key: string, score: number, languageId?: LanguageId) {
  const history = load(languageId);
  const entry = history[key] ?? { scores: [], lastUpdated: "" };
  entry.scores.push(Math.round(score));
  if (entry.scores.length > MAX_SCORES) {
    entry.scores = entry.scores.slice(-MAX_SCORES);
  }
  entry.lastUpdated = new Date().toISOString();
  history[key] = entry;
  save(history, languageId);
}

export function getScores(key: string, languageId?: LanguageId): number[] {
  const history = load(languageId);
  return history[key]?.scores ?? [];
}

/** Get best score across all words for a phoneme slug */
export function getBestScore(
  slug: string,
  languageId?: LanguageId,
): number | null {
  const history = load(languageId);
  let best: number | null = null;
  const prefix = `${slug}:`;
  for (const [key, entry] of Object.entries(history)) {
    if (key.startsWith(prefix) && entry.scores.length > 0) {
      const max = Math.max(...entry.scores);
      if (best === null || max > best) best = max;
    }
  }
  return best;
}
