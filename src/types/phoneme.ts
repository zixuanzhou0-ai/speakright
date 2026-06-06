import type { LanguageId } from "@/types/language";

export type PhonemeCategory = "vowel" | "consonant" | "prosody" | "cluster";
export type Difficulty = "high" | "medium" | "easy";
export type SoundUnitType = "phoneme" | "contrast" | "prosody" | "cluster";

export interface KeywordEntry {
  word: string;
  ipa: string;
  emoji?: string;
}

export interface PhonemeData {
  languageId?: LanguageId;
  ipa: string;
  symbol: string;
  slug: string;
  name: string;
  category: PhonemeCategory;
  soundUnitType?: SoundUnitType;
  example: string;
  keywords: KeywordEntry[];
  difficulty: Difficulty;
  chartWord?: string;
  chartImage?: string;
  chartIpa?: string;
  chartIpaHighlight?: string;
  description?: string;
  notes?: string[];
  video?: {
    localSrc?: string;
    status: "ready" | "planned";
    label?: string;
  };
}
