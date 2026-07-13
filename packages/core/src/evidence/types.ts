export type LearningLanguageId = "en-US" | "es-ES" | "fr-FR" | "ru-RU";

export type EvidenceTaskType =
  | "perception"
  | "articulation"
  | "controlled-word"
  | "minimal-pair"
  | "sentence"
  | "connected-speech"
  | "guided-transfer"
  | "spontaneous-transfer"
  | "delayed-retention";

export type EvidenceStage =
  | "introduced"
  | "discriminated"
  | "controlled"
  | "varied"
  | "transfer_observed"
  | "retention_observed";

export type EvidenceConfidence = "low" | "medium" | "high";

export interface EvidenceObservation {
  metric:
    | "accuracy"
    | "perception-rate"
    | "fluency"
    | "completeness"
    | "prosody"
    | "target-unit"
    | "human-intelligibility"
    | "task-completion";
  score?: number;
  text?: string;
  source: "azure" | "task" | "human" | "legacy";
}

export interface LearningEvidenceV3 {
  id: string;
  version: 3;
  languageId: LearningLanguageId;
  taskType: EvidenceTaskType;
  targetUnits: string[];
  observations: EvidenceObservation[];
  recordingQuality: {
    status: "good" | "caution" | "invalid" | "unknown";
    score?: number;
    reasons: string[];
  };
  alignmentQuality: {
    status: "good" | "caution" | "invalid" | "unknown";
    score?: number;
    reasons: string[];
  };
  sampleCount: number;
  contextCount: number;
  source:
    | "assessment"
    | "training"
    | "free-practice"
    | "human-review"
    | "legacy-migration";
  confidence: EvidenceConfidence;
  evidenceStage: EvidenceStage;
  calibrationVersion: string;
  createdAt: number;
}

export interface LearningEvidenceStoreV3 {
  version: 3;
  updatedAt: number;
  evidence: LearningEvidenceV3[];
}
