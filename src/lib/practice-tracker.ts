const STORAGE_KEY = "speakright_practice_history";

interface PracticeHistory {
  [slug: string]: {
    words: string[];
    lastUpdated: number;
  };
}

function getHistory(): PracticeHistory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setHistory(history: PracticeHistory): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full — silently ignore
  }
}

export function getPracticedWords(slug: string): string[] {
  const history = getHistory();
  return history[slug]?.words ?? [];
}

export function markWordPracticed(slug: string, word: string): void {
  const history = getHistory();
  const entry = history[slug] ?? { words: [], lastUpdated: 0 };
  const lower = word.toLowerCase();
  if (!entry.words.includes(lower)) {
    entry.words.push(lower);
  }
  entry.lastUpdated = Date.now();
  history[slug] = entry;
  setHistory(history);
}
