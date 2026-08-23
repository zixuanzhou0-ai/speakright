"use client";

import type { PerceptionTrial } from "@speakright/core/training/perception";
import { quarantineLocalDataValue } from "./local-data-migrations";
import type {
  CourseAttemptSnapshot,
  CoursePosition,
} from "./training-course-session";

export const DEEP_TRAINING_SESSION_PREFIX =
  "speakright_deep_training_session_v1:";

export interface DeepTrainingSessionSnapshot {
  version: 1;
  packId: string;
  startedAt: number;
  updatedAt: number;
  phase:
    | { type: "intro" }
    | { type: "course"; position: CoursePosition }
    | { type: "completed" };
  perceptionTrials: PerceptionTrial[];
  perceptionCorrect: number;
  perceptionTotal: number;
  perceptionExtraRemaining: number;
  levelStats: Record<string, CourseAttemptSnapshot>;
}

function storageKey(packId: string): string {
  return `${DEEP_TRAINING_SESSION_PREFIX}${packId}`;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isSnapshot(
  value: unknown,
  packId: string,
): value is DeepTrainingSessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<DeepTrainingSessionSnapshot>;
  return (
    snapshot.version === 1 &&
    snapshot.packId === packId &&
    typeof snapshot.startedAt === "number" &&
    typeof snapshot.updatedAt === "number" &&
    !!snapshot.phase &&
    typeof snapshot.phase === "object" &&
    Array.isArray(snapshot.perceptionTrials) &&
    typeof snapshot.perceptionCorrect === "number" &&
    typeof snapshot.perceptionTotal === "number" &&
    typeof snapshot.perceptionExtraRemaining === "number" &&
    !!snapshot.levelStats &&
    typeof snapshot.levelStats === "object"
  );
}

export function loadDeepTrainingSession(
  packId: string,
): DeepTrainingSessionSnapshot | null {
  if (!hasStorage()) return null;
  const key = storageKey(packId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isSnapshot(parsed, packId)) return parsed;
  } catch {
    // Quarantine below.
  }
  quarantineLocalDataValue(key, "Invalid deep training session");
  return null;
}

export function saveDeepTrainingSession(
  snapshot: DeepTrainingSessionSnapshot,
): boolean {
  if (!hasStorage()) return false;
  try {
    const key = storageKey(snapshot.packId);
    localStorage.setItem(
      key,
      JSON.stringify({ ...snapshot, version: 1, updatedAt: Date.now() }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key }));
    return true;
  } catch {
    return false;
  }
}

export function clearDeepTrainingSession(packId: string): void {
  if (!hasStorage()) return;
  const key = storageKey(packId);
  localStorage.removeItem(key);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}
