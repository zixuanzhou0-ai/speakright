import type { AssessmentWord } from "@/types/assessment";

export const LANGUAGE_IDS = ["en-US", "es-ES", "fr-FR", "ru-RU"] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];
export type LanguageStatus = "active" | "experimental" | "planned";

export const DEFAULT_LANGUAGE_ID: LanguageId = "en-US";

export interface LanguageTokenizer {
  wordPattern: RegExp;
  splitWords: (text: string) => string[];
}

export interface LanguageErrorPattern {
  id: string;
  targetPhonemes: string[];
  suspectedSubstitution: string;
  example: string;
  cue: string;
}

export interface StarterTrainingPlan {
  id: string;
  title: string;
  targetPhonemes: string[];
  focus: string;
  minimalPairs?: Array<[string, string, string, string]>;
  sentenceLadder?: string[];
}

export interface LanguageProfile {
  id: LanguageId;
  displayName: string;
  nativeName: string;
  learnerL1: "zh-CN";
  azureLocale: string;
  status: LanguageStatus;
  readiness: {
    diagnosis: boolean;
    training: boolean;
    evidenceMastery: boolean;
    requiresAzureProbe: boolean;
  };
  tokenizer: LanguageTokenizer;
  trackedPhonemes: string[];
  assessmentWords: AssessmentWord[];
  adaptiveAssessmentWords: AssessmentWord[];
  assessmentParagraph: string;
  recommendedPackIds: string[];
  starterTrainingPlans: StarterTrainingPlan[];
  errorPatterns: LanguageErrorPattern[];
  notes: string[];
}

export function isLanguageId(value: unknown): value is LanguageId {
  return (
    typeof value === "string" &&
    LANGUAGE_IDS.includes(value as LanguageId)
  );
}
