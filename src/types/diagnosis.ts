import type { AzureAssessmentResult } from "@/types/azure";
import type { AssessmentWord } from "@/types/assessment";
import type { TrainingPrescription } from "@/types/training";

export type DiagnosisIssueSeverity = "critical" | "major" | "minor";

export type DiagnosisIssueType =
  | "phoneme"
  | "contrast"
  | "stress"
  | "rhythm"
  | "fluency"
  | "final-consonant"
  | "connected-speech";

export interface DiagnosisEvidence {
  text: string;
  score: number;
  detail: string;
  phoneme?: string;
  ipa?: string;
  source: "word" | "paragraph" | "adaptive";
}

export interface DiagnosisIssue {
  id: string;
  severity: DiagnosisIssueSeverity;
  type: DiagnosisIssueType;
  title: string;
  targetPhonemes: string[];
  suspectedSubstitution?: string;
  evidence: Array<{ text: string; score: number; detail: string }>;
  impact: string;
  fixCue: string;
  recommendedPackIds: string[];
  confidence?: "low" | "medium" | "high";
  evidenceStrength?: "thin" | "fair" | "strong";
  errorPatternIds?: string[];
  nextLesson?: {
    packId: string;
    levelId: string;
    reason: string;
  };
}

export interface DiagnosisReport {
  version: 2;
  timestamp: number;
  overallScore: number;
  dimensions: {
    vowels: number;
    consonants: number;
    stress: number;
    rhythm: number;
    fluency: number;
    connectedSpeech: number;
  };
  phonemeScores: Record<string, { score: number; sampleCount: number }>;
  issues: DiagnosisIssue[];
  prescription: TrainingPrescription;
  rawEvidence: DiagnosisEvidence[];
}

export interface AssessmentRecording {
  prompt: AssessmentWord;
  result: AzureAssessmentResult;
  source: "word" | "adaptive";
}

export interface DiagnosisBuildInput {
  wordRecordings: AssessmentRecording[];
  paragraphResult: AzureAssessmentResult;
  paragraphText: string;
}
