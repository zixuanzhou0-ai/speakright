"use client";

import type {
  EvidenceStage,
  LearningEvidenceStoreV3,
  LearningEvidenceV3,
} from "@/types/learning-evidence";

export const LEARNING_EVIDENCE_STORAGE_KEY = "speakright_learning_evidence_v3";
export const DEFAULT_CALIBRATION_VERSION = "pre-pilot-v1";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emptyStore(): LearningEvidenceStoreV3 {
  return {
    version: 3,
    updatedAt: Date.now(),
    evidence: [],
  };
}

function isEvidence(value: unknown): value is LearningEvidenceV3 {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LearningEvidenceV3>;
  return (
    item.version === 3 &&
    typeof item.id === "string" &&
    typeof item.languageId === "string" &&
    typeof item.taskType === "string" &&
    Array.isArray(item.targetUnits) &&
    Array.isArray(item.observations) &&
    typeof item.createdAt === "number"
  );
}

export function loadLearningEvidence(): LearningEvidenceStoreV3 {
  if (!hasStorage()) return emptyStore();
  const raw = localStorage.getItem(LEARNING_EVIDENCE_STORAGE_KEY);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<LearningEvidenceStoreV3>;
    if (parsed.version !== 3 || !Array.isArray(parsed.evidence)) {
      return emptyStore();
    }
    return {
      version: 3,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      evidence: parsed.evidence.filter(isEvidence),
    };
  } catch {
    return emptyStore();
  }
}

export function saveLearningEvidence(store: LearningEvidenceStoreV3): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(
      LEARNING_EVIDENCE_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        updatedAt: Date.now(),
        evidence: store.evidence,
      }),
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
  const current = loadLearningEvidence();
  const withoutDuplicate = current.evidence.filter(
    (item) => item.id !== evidence.id,
  );
  return saveLearningEvidence({
    version: 3,
    updatedAt: Date.now(),
    evidence: [evidence, ...withoutDuplicate].slice(0, 2000),
  });
}

function stageFromLegacy(value: unknown): EvidenceStage {
  if (value === "retained") return "retention_observed";
  if (value === "transferred") return "transfer_observed";
  if (value === "integrated") return "varied";
  if (value === "controlled") return "controlled";
  return "introduced";
}

export function migrateLegacyMasteryEvidence(): boolean {
  if (!hasStorage()) return false;
  if (localStorage.getItem(LEARNING_EVIDENCE_STORAGE_KEY)) return false;
  const raw = localStorage.getItem("speakright_mastery_profile_v2");
  if (!raw) return false;

  try {
    const legacy = JSON.parse(raw) as {
      updatedAt?: number;
      packs?: Record<
        string,
        {
          masteryState?: unknown;
          bestTargetScore?: number;
          completedSessions?: number;
        }
      >;
    };
    if (!legacy.packs || typeof legacy.packs !== "object") return false;
    const createdAt =
      typeof legacy.updatedAt === "number" ? legacy.updatedAt : Date.now();
    const evidence: LearningEvidenceV3[] = Object.entries(legacy.packs).map(
      ([packId, pack]) => ({
        id: `legacy-${packId}-${createdAt}`,
        version: 3,
        languageId: "en-US",
        taskType: "controlled-word",
        targetUnits: [packId],
        observations:
          typeof pack.bestTargetScore === "number"
            ? [
                {
                  metric: "target-unit",
                  score: pack.bestTargetScore,
                  source: "legacy",
                },
              ]
            : [],
        recordingQuality: {
          status: "unknown",
          reasons: ["Legacy profile did not retain recording quality."],
        },
        alignmentQuality: {
          status: "unknown",
          reasons: ["Legacy profile did not retain alignment quality."],
        },
        sampleCount:
          typeof pack.completedSessions === "number"
            ? pack.completedSessions
            : 0,
        contextCount: 0,
        source: "legacy-migration",
        confidence: "low",
        evidenceStage: stageFromLegacy(pack.masteryState),
        calibrationVersion: "legacy-unvalidated",
        createdAt,
      }),
    );
    if (evidence.length === 0) return false;
    return saveLearningEvidence({
      version: 3,
      updatedAt: Date.now(),
      evidence,
    });
  } catch {
    return false;
  }
}
export type { LearningEvidenceStageSummary } from "@speakright/core/evidence/summary";
export { summarizeLearningEvidence } from "@speakright/core/evidence/summary";
