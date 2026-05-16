import type { AssessmentWord } from "@/types/assessment";
import type { AzureAssessmentResult } from "@/types/azure";
import type { TrainingPrescription } from "@/types/training";

export type DiagnosisIssueSeverity = "critical" | "major" | "minor";
export type EvidenceStrength = "invalid" | "thin" | "fair" | "strong";
export type EvidenceRecommendedAction =
  | "use-for-diagnosis"
  | "use-with-caution"
  | "request-more-samples"
  | "request-retry";

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
  position?: "initial" | "medial" | "final" | "unknown";
  evidenceStrength?: EvidenceStrength;
  recommendedAction?: EvidenceRecommendedAction;
  invalidationReason?: string;
  source:
    | "word"
    | "paragraph"
    | "adaptive"
    | "coverage-segment"
    | "coverage-probe";
}

export interface DiagnosisEvidenceSummary {
  overallStrength: EvidenceStrength;
  recommendedAction: EvidenceRecommendedAction;
  usableRecordings: number;
  invalidRecordings: number;
  thinFeatureCount: number;
  lowConfidenceFeatures: string[];
  notes: string[];
}

export interface RecordingQualitySnapshot {
  score: number;
  canSubmit: boolean;
  issues: Array<{
    code: string;
    severity: "blocker" | "warning" | "info";
    title: string;
    detail: string;
  }>;
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
  source?: "quick-word-check" | "coverage-passage";
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
  evidenceSummary?: DiagnosisEvidenceSummary;
}

export interface AssessmentRecording {
  prompt: AssessmentWord;
  result: AzureAssessmentResult;
  source: "word" | "adaptive";
  recordingQuality?: RecordingQualitySnapshot;
}

export interface DiagnosisBuildInput {
  wordRecordings: AssessmentRecording[];
  paragraphResult: AzureAssessmentResult;
  paragraphText: string;
  paragraphRecordingQuality?: RecordingQualitySnapshot;
}

export interface CoveragePassageRecording {
  text: string;
  result: AzureAssessmentResult;
  source: "coverage-segment" | "coverage-probe";
  label?: string;
  recordingQuality?: RecordingQualitySnapshot;
}

export interface CoveragePassageBuildInput {
  recordings: CoveragePassageRecording[];
}
