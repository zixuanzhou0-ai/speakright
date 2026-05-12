const STORAGE_KEY = "speakright_score_history";
const MAX_SCORES = 5;

interface ScoreEntry {
  scores: number[];
  lastUpdated: string;
}

type ScoreHistory = Record<string, ScoreEntry>;

function load(): ScoreHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(history: ScoreHistory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full or unavailable
  }
}

export function addScore(key: string, score: number) {
  const history = load();
  const entry = history[key] ?? { scores: [], lastUpdated: "" };
  entry.scores.push(Math.round(score));
  if (entry.scores.length > MAX_SCORES) {
    entry.scores = entry.scores.slice(-MAX_SCORES);
  }
  entry.lastUpdated = new Date().toISOString();
  history[key] = entry;
  save(history);
}

export function getScores(key: string): number[] {
  const history = load();
  return history[key]?.scores ?? [];
}

/** Get best score across all words for a phoneme slug */
export function getBestScore(slug: string): number | null {
  const history = load();
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
