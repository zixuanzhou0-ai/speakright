export type PhonemeCategory = "vowel" | "consonant";
export type Difficulty = "high" | "medium" | "easy";

export interface KeywordEntry {
  word: string;
  ipa: string;
  emoji?: string;
}

export interface PhonemeData {
  ipa: string;
  symbol: string;
  slug: string;
  name: string;
  category: PhonemeCategory;
  example: string;
  keywords: KeywordEntry[];
  difficulty: Difficulty;
  chartWord?: string;
  chartImage?: string;
  chartIpa?: string;
  chartIpaHighlight?: string;
  description?: string;
}
