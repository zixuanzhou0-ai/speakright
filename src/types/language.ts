import type { PhonemeData } from "@/types/phoneme";

export type LanguageId = "en-US" | "es-ES" | "fr-FR" | "ru-RU";
export type LanguageStatus = "stable" | "experimental" | "draft";
export type LanguageResourceKind =
  | "ipa-converter"
  | "dictionary"
  | "native-audio"
  | "articulation-guide"
  | "pronunciation-trainer"
  | "phonology-rules";
export type LanguageResourceUsagePolicy =
  | "reference-only"
  | "link-out"
  | "manual-verification";

export interface LanguageReadiness {
  phonemeInventory: boolean;
  wordAudio: boolean;
  wordPractice: boolean;
  sentencePractice: boolean;
  diagnosis: boolean;
  evidenceMastery: boolean;
  localVideos: boolean;
  externalArticulationResources?: boolean;
}

export interface LanguageResourceSite {
  id: string;
  languageIds: LanguageId[];
  title: string;
  url: string;
  kind: LanguageResourceKind;
  strengths: string[];
  limitations: string[];
  usagePolicy: LanguageResourceUsagePolicy;
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
  resourceSiteIds?: string[];
}

export interface LanguageConfig {
  languageId: LanguageId;
}
