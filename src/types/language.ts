import type { AssessmentWord } from "@/types/assessment";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

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

export type LanguageDisplayMode =
  | "ipa-primary"
  | "orthography-primary"
  | "hybrid";

export type LanguageEvidencePolicy =
  | "mastery-ready"
  | "feedback-only"
  | "human-validation";

export interface LanguageMinimalPairSet {
  id: string;
  phonemeA: string;
  phonemeB: string;
  label: string;
  pairs: Array<{ wordA: string; ipaA: string; wordB: string; ipaB: string }>;
}

export interface LanguageSentenceEntry {
  text: string;
  phonemes: string[];
  category: "tongue-twister" | "minimal-pair" | "daily" | "interview";
}

export interface LanguageAssessmentPack {
  screeningWords: AssessmentWord[];
  adaptiveWords: AssessmentWord[];
  paragraph: string;
  trackedPhonemes: string[];
}

export interface LanguageContentPack {
  languageId: LanguageId;
  azureLocale: string;
  displayMode: LanguageDisplayMode;
  phonemeUnits: PhonemeData[];
  wordBank: Record<string, KeywordEntry[]>;
  minimalPairs: LanguageMinimalPairSet[];
  sentenceBank: LanguageSentenceEntry[];
  assessment: LanguageAssessmentPack;
  evidencePolicy: Record<string, LanguageEvidencePolicy>;
  llmPromptProfile: {
    coachLanguageNameZh: string;
    outputWarnings: string[];
  };
}
