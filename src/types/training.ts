import type { DiagnosisIssueType, EvidenceStrength } from "@/types/diagnosis";
import type { DrillItem } from "@/types/drill";
import type { LanguageId } from "@/types/language";

export type TrainingPackStatus =
  | "new"
  | "recommended"
  | "practicing"
  | "stable"
  | "mastered"
  | "due";

export type MasteryState =
  | "unknown"
  | "suspected"
  | "learning"
  | "controlled"
  | "integrated"
  | "retained"
  | "transferred";

export type MasteryTaskLayer =
  | "isolated"
  | "perception"
  | "articulation"
  | "word"
  | "sentence"
  | "connected"
  | "guided"
  | "spontaneous";

export type TrainingLevelKind =
  | "perception"
  | "articulation"
  | "syllable"
  | "word"
  | "minimal-pair"
  | "sentence"
  | "shadowing"
  | "mixed-review";

export type RemediationStepKind =
  | "listen"
  | "isolate"
  | "slow-repeat"
  | "word-rebuild"
  | "contrast"
  | "retry";

export interface PerceptionItem {
  wordA: string;
  wordB: string;
  audioA: string;
  audioB: string;
}

export interface MinimalPairItem {
  wordA: string;
  ipaA: string;
  phonemeA: string;
  wordB: string;
  ipaB: string;
  phonemeB: string;
}

export interface MasteryRule {
  perceptionCorrectRate: number;
  targetPassScore: number;
  wordRecentPasses: number;
  wordRecentWindow: number;
  sentencePasses: number;
  mixedReviewAverage?: number;
  maxStuckCount?: number;
}

export interface LevelPassRule {
  minCorrectRate?: number;
  minTargetScore?: number;
  minAverageScore?: number;
  requiredPasses?: number;
}

export interface TrainingCourseItem {
  id: string;
  text: string;
  displayText?: string;
  referenceText?: string;
  playbackText?: string;
  ipa?: string;
  targetPhonemes: string[];
  focusPoint: string;
  commonMistake: string;
  successCue: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  position?: "initial" | "medial" | "final" | "mixed";
  isRecordable?: boolean;
  contrastText?: string;
}

export interface TrainingLevel {
  id: string;
  title: string;
  kind: TrainingLevelKind;
  goal: string;
  coachCue: string;
  passRule: LevelPassRule;
  items: TrainingCourseItem[];
}

export interface ErrorPattern {
  id: string;
  title: string;
  appliesToPackIds: string[];
  detection: {
    targetPhonemes: string[];
    minTargetScoreDrop?: number;
    maxTargetScore?: number;
    requiresFinalPosition?: boolean;
    issueTypes?: DiagnosisIssueType[];
  };
  coachExplanation: string;
  immediateCue: string;
  remediationPathId: string;
}

export interface RemediationPath {
  id: string;
  title: string;
  steps: Array<{
    kind: RemediationStepKind;
    prompt: string;
    text: string;
    referenceText?: string;
    playbackText?: string;
    targetPhonemes: string[];
  }>;
}

export interface TrainingPackCourse {
  packId: string;
  levels: TrainingLevel[];
  errorPatterns: ErrorPattern[];
  remediation: RemediationPath[];
}

export interface TrainingPack {
  id: string;
  title: string;
  focus: string;
  targetPhonemes: string[];
  contrastPhonemes?: string[];
  l1Problem: string;
  mouthCue: string;
  perceptionItems: PerceptionItem[];
  wordLadder: DrillItem[];
  minimalPairs: MinimalPairItem[];
  sentenceLadder: DrillItem[];
  masteryRule: MasteryRule;
  estimatedMinutes: number;
  course?: TrainingPackCourse;
}

export interface TrainingPrescriptionItem {
  packId: string;
  levelId?: string;
  action?: "train" | "retest";
  reason: string;
  priority: "critical" | "major" | "maintenance";
  estimatedMinutes: number;
  currentMasteryState?: MasteryState;
  stageScore?: number;
  stageCeiling?: number;
  highestLayer?: MasteryTaskLayer;
  nextRequiredLayer?: MasteryTaskLayer;
  stageReason?: string;
  evidenceStrength?: EvidenceStrength;
  learningObjective?: string;
}

export interface TrainingPrescriptionDay {
  day: number;
  title: string;
  items: TrainingPrescriptionItem[];
}

export interface TrainingPrescription {
  generatedAt: number;
  source: "diagnosis" | "default" | "review";
  days: TrainingPrescriptionDay[];
}

export interface PackMastery {
  packId: string;
  status: Exclude<TrainingPackStatus, "recommended">;
  masteryState?: MasteryState;
  stageScore?: number;
  stageCeiling?: number;
  highestLayer?: MasteryTaskLayer;
  nextRequiredLayer?: MasteryTaskLayer;
  stateRationale?: string;
  retainedReviewCount?: number;
  transferEvidenceCount?: number;
  levelProgress: Record<string, TrainingLevelProgress>;
  bestTargetScore: number;
  perceptionBestRate: number;
  completedSessions: number;
  failureStreak: number;
  lastPracticedAt?: number;
  nextReviewAt?: number;
}

export interface PhonemeMastery {
  phoneme: string;
  bestScore: number;
  recentScores: number[];
  status: "new" | "weak" | "stable" | "mastered";
}

export interface ErrorPatternMastery {
  patternId: string;
  seenCount: number;
  stuckCount: number;
  lastSeenAt?: number;
  status: "active" | "improving" | "cleared";
}

export interface TrainingLevelProgress {
  passed: boolean;
  bestScore: number;
  attempts: number;
}

export interface TrainingLevelSummary {
  levelId: string;
  kind: TrainingLevelKind;
  attempts: number;
  passed: boolean;
  bestScore: number;
  stuckCount: number;
}

export interface TrainingEvidenceItem {
  itemId: string;
  levelId: string;
  levelKind: TrainingLevelKind;
  text: string;
  targetPhonemes: string[];
  targetScore: number;
  overallScore: number;
  patternIds: string[];
  nextCue: string;
  passed: boolean;
  usedFallback?: boolean;
  assessmentReliability?: AssessmentReliability;
}

export type TrainingSessionModality =
  | "perception"
  | "production"
  | "prosody"
  | "mixed";

export interface RemediationResult {
  pathId: string;
  stepIndex: number;
  text: string;
  targetPhonemes: string[];
  beforeTargetScore: number;
  targetScore: number;
  overallScore: number;
  passed: boolean;
  usedFallback?: boolean;
}

export interface TransferEvidence {
  layer: "guided" | "spontaneous";
  prompt: string;
  score: number;
  passed: boolean;
  completedAt: number;
}

export interface AssessmentReliability {
  audioQualityScore?: number;
  audioQualityIssues?: string[];
  alignment: "good" | "caution" | "invalid";
  evidenceStrength: "thin" | "fair" | "strong" | "invalid";
  canPromoteMastery: boolean;
  note?: string;
}

export interface MasteryStageSnapshot {
  state: MasteryState;
  stageScore: number;
  stageCeiling: number;
  highestLayer: MasteryTaskLayer;
  nextRequiredLayer: MasteryTaskLayer;
  rationale: string;
}

export type ReviewQueueSource =
  | "due-review"
  | "stuck-pattern"
  | "weak-level"
  | "failed-item"
  | "remediation-failed";

export interface ReviewQueueItem {
  id: string;
  packId: string;
  levelId: string;
  source: ReviewQueueSource;
  reason: string;
  priority: "critical" | "major" | "maintenance";
  dueAt: number;
  errorPatternId?: string;
  itemText?: string;
}

export interface TrainingSessionSummary {
  id: string;
  languageId?: LanguageId;
  packId: string;
  modality?: TrainingSessionModality;
  startedAt: number;
  completedAt: number;
  perceptionCorrect: number;
  perceptionTotal: number;
  targetScores: number[];
  wordScores: number[];
  sentenceScores: number[];
  mastered: boolean;
  mixedReviewScores?: number[];
  levelSummaries?: TrainingLevelSummary[];
  stuckPatternIds?: string[];
  recommendedNextLevelId?: string;
  failedItems?: TrainingEvidenceItem[];
  remediationResults?: RemediationResult[];
  transferEvidence?: TransferEvidence[];
  assessmentReliability?: AssessmentReliability;
  promotionBlockers?: string[];
  isReviewSession?: boolean;
  masteryStateAfter?: MasteryState;
  masteryStageScore?: number;
  reviewItems?: ReviewQueueItem[];
}

export interface MasteryProfile {
  version: 2;
  updatedAt: number;
  packs: Record<string, PackMastery>;
  phonemes: Record<string, PhonemeMastery>;
  errorPatterns: Record<string, ErrorPatternMastery>;
  sessions: TrainingSessionSummary[];
}

export interface AttemptAnalysis {
  itemId: string;
  passed: boolean;
  targetScore: number;
  overallScore: number;
  usedFallback: boolean;
  scoreGap: number;
  detectedPatternIds: string[];
  primaryPatternId?: string;
  nextCue: string;
  remediationPathId?: string;
}

export interface LevelGateResult {
  passed: boolean;
  reason: string;
  focusedReviewItems: TrainingCourseItem[];
}

export interface CourseRunnerState {
  packId: string;
  levelIndex: number;
  itemIndex: number;
  attemptsByItem: Record<string, number>;
  levelProgress: Record<string, TrainingLevelProgress>;
  stuckPatternIds: string[];
  focusedReviewQueue: TrainingCourseItem[];
  phase: "intro" | "level" | "remediation" | "focused-review" | "completed";
}
