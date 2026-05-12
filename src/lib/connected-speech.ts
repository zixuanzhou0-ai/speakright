/**
 * Connected speech annotation engine.
 * Marks linking, elision, reduction, and flapping in English text.
 * All rules are approximate — annotations are marked as "potential" (not mandatory).
 */

export type AnnotationType = "linking" | "elision" | "reduction" | "flapping";

export interface SpeechAnnotation {
  /** Word index in the sentence */
  wordIndex: number;
  type: AnnotationType;
  /** Chinese description */
  tip: string;
}

// Vowel-starting detection (simplified)
const VOWEL_START = /^[aeiouAEIOU]/;
// Consonant-ending detection (simplified)
const CONSONANT_END = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]$/;

// Function words that commonly reduce to schwa
const WEAK_FORMS = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "for",
  "and",
  "but",
  "or",
  "at",
  "in",
  "on",
  "as",
  "is",
  "am",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "can",
  "could",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "must",
  "that",
  "than",
  "from",
  "not",
  "been",
  "be",
  "he",
  "she",
  "we",
  "you",
  "them",
  "him",
  "her",
  "us",
  "it",
]);

// Words with intervocalic /t/ that flap (American English)
const FLAP_WORDS = new Set([
  "water",
  "better",
  "butter",
  "letter",
  "matter",
  "later",
  "city",
  "pretty",
  "little",
  "bottle",
  "meeting",
  "getting",
  "eating",
  "writing",
  "waiting",
  "sitting",
  "putting",
  "hitting",
  "data",
  "metal",
  "total",
  "hotel",
  "auto",
  "photo",
  "beautiful",
  "whatever",
  "computer",
  "internet",
]);

/**
 * Annotate a sentence with connected speech markers.
 * Returns annotations per word index.
 */
export function annotateConnectedSpeech(text: string): SpeechAnnotation[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return [];

  const annotations: SpeechAnnotation[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:'"]/g, "");
    const nextWord =
      i + 1 < words.length ? words[i + 1].replace(/[.,!?;:'"]/g, "") : null;

    // 1. Reduction: function words
    if (WEAK_FORMS.has(word.toLowerCase()) && words.length > 2) {
      annotations.push({
        wordIndex: i,
        type: "reduction",
        tip: `"${word}" \u53EF\u5F31\u8BFB\u4E3A schwa\uFF0C\u4E0D\u9700\u8981\u91CD\u8BFB`,
      });
    }

    // 2. Flapping: intervocalic /t/
    if (FLAP_WORDS.has(word.toLowerCase())) {
      annotations.push({
        wordIndex: i,
        type: "flapping",
        tip: `"${word}" \u4E2D\u7684 t \u53EF\u8BFB\u4E3A\u5F39\u820C\u97F3 [\u027E]\uFF0C\u7C7B\u4F3C\u5FEB\u901F\u7684 d`,
      });
    }

    if (!nextWord) continue;

    // 3. Linking: consonant ending + vowel starting
    if (CONSONANT_END.test(word) && VOWEL_START.test(nextWord)) {
      annotations.push({
        wordIndex: i,
        type: "linking",
        tip: `"${word}" \u7ED3\u5C3E\u8F85\u97F3\u53EF\u4E0E "${nextWord}" \u5F00\u5934\u5143\u97F3\u8FDE\u8BFB`,
      });
    }

    // 4. Elision: same or similar consonant at boundary
    const lastChar = word.slice(-1).toLowerCase();
    const firstChar = nextWord[0].toLowerCase();
    if (
      lastChar === firstChar &&
      CONSONANT_END.test(word) &&
      /^[bcdfghjklmnpqrstvwxyz]/i.test(nextWord)
    ) {
      annotations.push({
        wordIndex: i,
        type: "elision",
        tip: `"${word} ${nextWord}" \u8FB9\u754C\u7684\u8F85\u97F3\u53EF\u5408\u5E76\uFF0C\u4E0D\u9700\u8981\u8BFB\u4E24\u6B21`,
      });
    }
  }

  return annotations;
}

/**
 * Get annotation display symbol and color for UI rendering.
 */
export function getAnnotationStyle(type: AnnotationType): {
  symbol: string;
  color: string;
  label: string;
} {
  switch (type) {
    case "linking":
      return {
        symbol: "\u2040",
        color: "text-blue-500",
        label: "\u53EF\u8FDE\u8BFB",
      };
    case "elision":
      return {
        symbol: "\u00D7",
        color: "text-orange-500",
        label: "\u53EF\u7701\u7565",
      };
    case "reduction":
      return {
        symbol: "\u0259",
        color: "text-gray-400",
        label: "\u53EF\u5F31\u8BFB",
      };
    case "flapping":
      return {
        symbol: "\u027E",
        color: "text-purple-500",
        label: "\u5F39\u820C\u97F3",
      };
  }
}
