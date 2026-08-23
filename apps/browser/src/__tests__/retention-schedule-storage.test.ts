import { beforeEach, describe, expect, it } from "vitest";
import { readCorruptLocalData } from "@/lib/local-data-migrations";
import {
  dueRetentionReviews,
  loadRetentionSchedule,
  RETENTION_SCHEDULE_STORAGE_KEY,
  recordRetentionAttempt,
  scheduleRetentionAfterTransfer,
} from "@/lib/retention-schedule";

describe("retention schedule storage", () => {
  beforeEach(() => localStorage.clear());

  it("schedules 1, 7, and 21 day tasks once per transfer evidence", () => {
    const input = {
      packId: "ee-ih",
      transferEvidenceId: "transfer-1",
      observedAt: 1_000,
      materialIdsByDelay: {
        24: ["d1a", "d1b", "d1c"],
        168: ["d7a", "d7b", "d7c"],
        504: ["d21a", "d21b", "d21c"],
      },
    };
    expect(scheduleRetentionAfterTransfer(input)).toBe(true);
    expect(scheduleRetentionAfterTransfer(input)).toBe(true);
    expect(loadRetentionSchedule().tasks).toHaveLength(3);
    expect(dueRetentionReviews(1_000 + 24 * 60 * 60 * 1000)).toHaveLength(1);
  });

  it("stores a failed review and keeps exposed material out of the due queue", () => {
    scheduleRetentionAfterTransfer({
      packId: "ee-ih",
      transferEvidenceId: "transfer-1",
      observedAt: 1_000,
      materialIdsByDelay: {
        24: ["d1a", "d1b", "d1c"],
        168: ["d7a", "d7b", "d7c"],
        504: ["d21a", "d21b", "d21c"],
      },
    });
    const task = loadRetentionSchedule().tasks[0];
    expect(
      recordRetentionAttempt(task.id, {
        attemptedAt: task.dueAt,
        passed: false,
      }),
    ).toBe(true);
    const storedTask = loadRetentionSchedule().tasks[0];
    expect(storedTask.attempts).toHaveLength(1);
    expect(storedTask.completedAt).toBe(task.dueAt);
    expect(dueRetentionReviews(task.dueAt + 1)).toEqual([]);
  });

  it("quarantines a corrupt schedule", () => {
    localStorage.setItem(RETENTION_SCHEDULE_STORAGE_KEY, "{broken");
    expect(loadRetentionSchedule().tasks).toEqual([]);
    expect(readCorruptLocalData()).toEqual([
      expect.objectContaining({
        key: RETENTION_SCHEDULE_STORAGE_KEY,
        raw: "{broken",
      }),
    ]);
  });
});
