"use client";

import {
  emptyLearningEvidenceStore,
  migrateLegacyMasteryStore,
  parseLearningEvidenceStore,
  upsertLearningEvidence,
} from "@speakright/core/evidence/store";
import type {
  LearningEvidenceStoreV3,
  LearningEvidenceV3,
} from "@/types/learning-evidence";

export type { LearningEvidenceStageSummary } from "@speakright/core/evidence/summary";
export { summarizeLearningEvidence } from "@speakright/core/evidence/summary";

export const LEARNING_EVIDENCE_STORAGE_KEY = "speakright_learning_evidence_v3";
export const DEFAULT_CALIBRATION_VERSION = "pre-pilot-v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadLearningEvidence(): LearningEvidenceStoreV3 {
  if (!hasStorage()) return emptyLearningEvidenceStore();
  return parseLearningEvidenceStore(
    localStorage.getItem(LEARNING_EVIDENCE_STORAGE_KEY),
  );
}

export function saveLearningEvidence(store: LearningEvidenceStoreV3): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(
      LEARNING_EVIDENCE_STORAGE_KEY,
      JSON.stringify({ ...store, version: 3, updatedAt: Date.now() }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: LEARNING_EVIDENCE_STORAGE_KEY }),
    );
    return true;
  } catch {
    return false;
  }
}

export function appendLearningEvidence(evidence: LearningEvidenceV3): boolean {
  return saveLearningEvidence(
    upsertLearningEvidence(loadLearningEvidence(), evidence),
  );
}

export function migrateLegacyMasteryEvidence(): boolean {
  if (!hasStorage()) return false;
  if (localStorage.getItem(LEARNING_EVIDENCE_STORAGE_KEY)) return false;
  const raw =
    localStorage.getItem("speakright_mastery_profile_v2") ??
    localStorage.getItem("speakright_mastery_profile_v1");
  const migrated = migrateLegacyMasteryStore(raw);
  return migrated ? saveLearningEvidence(migrated) : false;
}
