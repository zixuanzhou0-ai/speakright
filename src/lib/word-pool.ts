import type { KeywordEntry } from "@/types/phoneme";
import { getExtendedWords } from "./word-bank";

export function getWordPool(
  slug: string,
  staticKeywords: KeywordEntry[],
): KeywordEntry[] {
  const extended = getExtendedWords(slug);

  // Merge static + extended, deduplicate by word (case-insensitive).
  const seen = new Set(staticKeywords.map((k) => k.word.toLowerCase()));
  const result = [...staticKeywords];

  for (const w of extended) {
    if (!seen.has(w.word.toLowerCase())) {
      seen.add(w.word.toLowerCase());
      result.push(w);
    }
  }

  return result;
}
