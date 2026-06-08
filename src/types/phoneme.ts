import type { LanguageId } from "@/types/language";

export type PhonemeCategory = "vowel" | "consonant" | "prosody" | "cluster";
export type Difficulty = "high" | "medium" | "easy";
export type SoundUnitType = "phoneme" | "contrast" | "prosody" | "cluster";
export type PhonemeTeachingResourceKind =
  | "video"
  | "ipa"
  | "dictionary"
  | "articulation"
  | "audio";
export type PhonemeAudioKind = "local" | "external" | "tts-example";

export interface KeywordEntry {
  word: string;
  ipa: string;
  emoji?: string;
  stressText?: string;
  dialect?: LanguageId | "es-419";
  sourceRefs?: string[];
  needsReview?: boolean;
}

export interface PhonemeTeachingResource {
  title: string;
  url: string;
  kind: PhonemeTeachingResourceKind;
  source?: string;
  description?: string;
}

export interface PhonemeAudioSource {
  kind: PhonemeAudioKind;
  label: string;
  source?: string;
  description?: string;
  localSrc?: string;
  url?: string;
  text?: string;
  languageId?: LanguageId;
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
  sourceRefs?: string[];
  needsReview?: boolean;
  teachingResources?: PhonemeTeachingResource[];
  phonemeAudio?: PhonemeAudioSource;
  video?: {
    localSrc?: string;
    status: "ready" | "planned";
    label?: string;
  };
}
