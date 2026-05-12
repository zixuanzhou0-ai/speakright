import type { DiagnosisReport } from "@/types/diagnosis";

export interface AssessmentResult {
  timestamp: number;
  phonemeScores: Record<string, number>;
  overallScore: number;
  weakPhonemes: string[];
  dimensions: {
    vowels: number;
    consonants: number;
    stress: number;
    rhythm: number;
    fluency: number;
  };
}

export interface AssessmentWord {
  word: string;
  ipa: string;
  targetPhonemes: string[];
  purpose?: string;
}

export type AssessmentPhase =
  | { type: "intro" }
  | { type: "words"; index: number }
  | { type: "paragraph" }
  | { type: "adaptive"; index: number; words: AssessmentWord[] }
  | { type: "analyzing" }
  | { type: "report"; result: DiagnosisReport }
  | { type: "error"; message: string };
