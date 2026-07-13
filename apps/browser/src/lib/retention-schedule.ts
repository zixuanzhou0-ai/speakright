"use client";

import {
  createRetentionSchedule,
  getDueRetentionTasks,
  type RetentionReviewAttempt,
  type RetentionReviewTask,
  type RetentionScheduleV1,
  recordRetentionReviewAttempt,
} from "@speakright/core/scheduling/retention";
import { quarantineLocalDataValue } from "./local-data-migrations";

export const RETENTION_SCHEDULE_STORAGE_KEY =
  "speakright_retention_schedule_v1";

function emptySchedule(now = Date.now()): RetentionScheduleV1 {
  return { version: 1, updatedAt: now, tasks: [] };
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isSchedule(value: unknown): value is RetentionScheduleV1 {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Partial<RetentionScheduleV1>;
  return (
    schedule.version === 1 &&
    typeof schedule.updatedAt === "number" &&
    Array.isArray(schedule.tasks)
  );
}

export function loadRetentionSchedule(): RetentionScheduleV1 {
  if (!hasStorage()) return emptySchedule();
  const raw = localStorage.getItem(RETENTION_SCHEDULE_STORAGE_KEY);
  if (!raw) return emptySchedule();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isSchedule(parsed)) return parsed;
  } catch {
    // Quarantine below.
  }
  quarantineLocalDataValue(
    RETENTION_SCHEDULE_STORAGE_KEY,
    "Invalid retention schedule",
  );
  return emptySchedule();
}

export function saveRetentionSchedule(schedule: RetentionScheduleV1): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(
      RETENTION_SCHEDULE_STORAGE_KEY,
      JSON.stringify({ ...schedule, version: 1, updatedAt: Date.now() }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: RETENTION_SCHEDULE_STORAGE_KEY }),
    );
    return true;
  } catch {
    return false;
  }
}

export function scheduleRetentionAfterTransfer(input: {
  packId: string;
  transferEvidenceId: string;
  observedAt: number;
  materialIdsByDelay: Record<24 | 168 | 504, string[]>;
}): boolean {
  const current = loadRetentionSchedule();
  if (
    current.tasks.some(
      (task) =>
        task.sourceTransferEvidenceId === input.transferEvidenceId &&
        task.packId === input.packId,
    )
  ) {
    return true;
  }
  const created = createRetentionSchedule({
    packId: input.packId,
    sourceTransferEvidenceId: input.transferEvidenceId,
    observedAt: input.observedAt,
    materialIdsByDelay: input.materialIdsByDelay,
  });
  return saveRetentionSchedule({
    version: 1,
    updatedAt: input.observedAt,
    tasks: [...current.tasks, ...created.tasks].slice(-200),
  });
}

export function dueRetentionReviews(now = Date.now()): RetentionReviewTask[] {
  return getDueRetentionTasks(loadRetentionSchedule(), now);
}

export function recordRetentionAttempt(
  taskId: string,
  attempt: RetentionReviewAttempt,
): boolean {
  return saveRetentionSchedule(
    recordRetentionReviewAttempt(loadRetentionSchedule(), taskId, attempt),
  );
}
