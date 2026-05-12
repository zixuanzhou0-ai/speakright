/**
 * Complete static word → IPA lookup table
 * Built from phoneme-data.ts keywords + word-bank.ts extended pool
 * Covers ~800+ words including single-syllable words
 */

import { PHONEMES } from "@/lib/phoneme-data";
import { WORD_BANK } from "@/lib/word-bank";

let cachedMap: Map<string, string> | null = null;

/**
 * Build a complete word → IPA map from all static data sources.
 * Cached after first call.
 */
export function getStaticIpaMap(): Map<string, string> {
  if (cachedMap) return cachedMap;

  const map = new Map<string, string>();

  for (const phoneme of PHONEMES) {
    for (const kw of phoneme.keywords) {
      map.set(kw.word.toLowerCase(), kw.ipa);
    }
  }

  for (const words of Object.values(WORD_BANK)) {
    for (const kw of words) {
      if (!map.has(kw.word.toLowerCase())) {
        map.set(kw.word.toLowerCase(), kw.ipa);
      }
    }
  }

  cachedMap = map;
  return map;
}
