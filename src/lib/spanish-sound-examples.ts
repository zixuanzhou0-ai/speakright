import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

export interface HighlightedIpaPart {
  text: string;
  highlight: boolean;
}

const SPECIAL_TARGETS: Record<string, string[]> = {
  "es-bv": ["b", "β"],
  "es-d": ["d", "ð"],
  "es-g": ["g", "ɡ", "ɣ"],
  "es-ch": ["tʃ", "t͡ʃ"],
  "es-ny": ["ɲ"],
  "es-y-ll": ["ʝ", "ʎ", "j"],
  "es-diphthongs-j": ["j", "i̯"],
  "es-diphthongs-w": ["w", "u̯"],
  "es-theta": ["θ"],
  "es-tap-r": ["ɾ"],
  "es-trill-r": ["r"],
};

function normalizedWord(word: string): string {
  return word.trim().toLocaleLowerCase();
}

function dedupeWords(wordPool: KeywordEntry[]): KeywordEntry[] {
  const deduped: KeywordEntry[] = [];
  const seen = new Set<string>();

  for (const item of wordPool) {
    const key = normalizedWord(item.word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function getSpanishExampleWindow(
  wordPool: KeywordEntry[],
  currentWord: KeywordEntry | null,
  size = 4,
): KeywordEntry[] {
  const deduped = dedupeWords(wordPool);
  if (deduped.length <= size) return deduped;

  const currentKey = currentWord ? normalizedWord(currentWord.word) : "";
  const foundIndex = deduped.findIndex(
    (item) => normalizedWord(item.word) === currentKey,
  );
  const startIndex = foundIndex >= 0 ? foundIndex : 0;
  const result: KeywordEntry[] = [];

  for (
    let offset = 0;
    offset < deduped.length && result.length < size;
    offset++
  ) {
    result.push(deduped[(startIndex + offset) % deduped.length]);
  }

  return result;
}

export function getAdjacentSpanishWord(
  wordPool: KeywordEntry[],
  currentWord: KeywordEntry | null,
  direction: 1 | -1,
): KeywordEntry | null {
  const deduped = dedupeWords(wordPool);
  if (deduped.length === 0) return null;
  if (!currentWord) return deduped[0];

  const currentKey = normalizedWord(currentWord.word);
  const foundIndex = deduped.findIndex(
    (item) => normalizedWord(item.word) === currentKey,
  );
  const safeIndex = foundIndex >= 0 ? foundIndex : 0;

  return deduped[(safeIndex + direction + deduped.length) % deduped.length];
}

export function getSpanishTargetSymbols(phoneme: PhonemeData): string[] {
  const specialTargets = SPECIAL_TARGETS[phoneme.slug];
  if (specialTargets) return specialTargets;

  return phoneme.ipa
    .replace(/\//g, "")
    .split(/\s*~\s*|\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function highlightSpanishTargetInIpa(
  ipa: string,
  phoneme: PhonemeData,
): HighlightedIpaPart[] {
  const targets = getSpanishTargetSymbols(phoneme).sort(
    (a, b) => b.length - a.length,
  );
  const match = targets
    .map((target) => ({ target, index: ipa.indexOf(target) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index || b.target.length - a.target.length)[0];

  if (!match) return [{ text: ipa, highlight: false }];

  return [
    { text: ipa.slice(0, match.index), highlight: false },
    {
      text: ipa.slice(match.index, match.index + match.target.length),
      highlight: true,
    },
    { text: ipa.slice(match.index + match.target.length), highlight: false },
  ].filter((part) => part.text.length > 0);
}
