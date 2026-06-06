// ── Session config ──
import type { LanguageId } from "@/types/language";

export type DrillKind = "word" | "sentence";

export interface DrillSessionConfig {
  kind: DrillKind;
  phonemeSlug: string;
  languageId?: LanguageId;
  itemCount: number;
  passThreshold: number;
}

// ── Items ──

export interface DrillItem {
  text: string;
  ipa?: string;
  phoneme: string;
  /** Chinese pronunciation guidance */
  description?: string;
}

// ── Attempts & progress ──

export interface DrillAttemptScore {
  pronunciationScore: number;
  accuracyScore: number;
  targetScore?: number;
  overallScore?: number;
  usedTargetFallback?: boolean;
}

export interface DrillAttempt {
  attemptNumber: number;
  score: DrillAttemptScore;
  passed: boolean;
}

export interface DrillProgressItem {
  item: DrillItem;
  attempts: DrillAttempt[];
  passed: boolean;
  skipped: boolean;
  bestScore: number;
}

// ── Summary ──

export interface DrillSummary {
  config: DrillSessionConfig;
  startedAt: number;
  completedAt: number;
  totalItems: number;
  passedItems: number;
  skippedItems: number;
  firstPassRate: number;
  averageScore: number;
  weakItems: DrillProgressItem[];
  items: DrillProgressItem[];
}

// ── State machine phases ──

export type DrillPhase =
  | { type: "configuring" }
  | { type: "phonemeLesson" }
  | { type: "teaching"; index: number; item: DrillItem }
  | { type: "readyToRecord"; index: number; item: DrillItem }
  | { type: "recording"; index: number; item: DrillItem }
  | { type: "assessing"; index: number; item: DrillItem }
  | {
      type: "feedback";
      index: number;
      item: DrillItem;
      attempt: DrillAttempt;
      passed: boolean;
      attemptCount: number;
    }
  | { type: "completed"; summary: DrillSummary }
  | { type: "error"; message: string };

// ── Reducer events ──

export type DrillEvent =
  | { type: "START"; items: DrillItem[]; config: DrillSessionConfig }
  | { type: "FINISH_PHONEME_LESSON" }
  | { type: "FINISH_TEACHING" }
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "ASSESS_SUCCESS"; score: DrillAttemptScore }
  | { type: "ASSESS_ERROR"; message: string }
  | { type: "NEXT_ITEM" }
  | { type: "RETRY_ITEM" }
  | { type: "SKIP_ITEM" }
  | { type: "RESET" };

// ── Reducer state ──

export interface DrillState {
  phase: DrillPhase;
  config: DrillSessionConfig | null;
  items: DrillItem[];
  progress: DrillProgressItem[];
  currentIndex: number;
  currentAttempts: DrillAttempt[];
  startedAt: number;
}
