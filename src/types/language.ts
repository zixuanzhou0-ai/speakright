import type { PhonemeData } from "@/types/phoneme";

export type LanguageId = "en-US" | "es-ES" | "fr-FR" | "ru-RU";
export type LanguageStatus = "stable" | "experimental" | "draft";

export interface LanguageReadiness {
  phonemeInventory: boolean;
  wordAudio: boolean;
  wordPractice: boolean;
  sentencePractice: boolean;
  diagnosis: boolean;
  evidenceMastery: boolean;
  localVideos: boolean;
}

export interface LanguageProfile {
  id: LanguageId;
  displayName: string;
  nativeName: string;
  shortLabel: string;
  azureLocale: string;
  status: LanguageStatus;
  defaultPhonemeSlug: string;
  soundUnitLabel: string;
  pronunciationTestWord: string;
  phonemeInventory: PhonemeData[];
  readiness: LanguageReadiness;
  learnerFocus: string[];
  knownGaps: string[];
}

export interface LanguageConfig {
  languageId: LanguageId;
}
