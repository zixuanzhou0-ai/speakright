import {
  completedRetentionReviewCount,
  createRetentionSchedule,
  getDueRetentionTasks,
  recordRetentionReviewAttempt,
} from "@speakright/core/scheduling/retention";
import { describe, expect, it } from "vitest";

describe("retention scheduler", () => {
  const schedule = createRetentionSchedule({
    packId: "ee-ih",
    sourceTransferEvidenceId: "transfer-1",
    observedAt: 1_000,
    materialIdsByDelay: {
      24: ["d1-word", "d1-sentence", "d1-prompt"],
      168: ["d7-word", "d7-sentence", "d7-prompt"],
      504: ["d21-word", "d21-sentence", "d21-prompt"],
    },
  });

  it("never exposes a retention task before 24 hours", () => {
    expect(
      getDueRetentionTasks(schedule, 1_000 + 24 * 60 * 60 * 1000 - 1),
    ).toEqual([]);
    expect(
      getDueRetentionTasks(schedule, 1_000 + 24 * 60 * 60 * 1000),
    ).toHaveLength(1);
  });

  it("keeps a failed attempt and leaves the task due", () => {
    const task = schedule.tasks[0];
    const failed = recordRetentionReviewAttempt(schedule, task.id, {
      attemptedAt: task.dueAt,
      passed: false,
      evidenceId: "failed-observation",
    });

    expect(failed.tasks[0].attempts).toHaveLength(1);
    expect(failed.tasks[0].completedAt).toBeUndefined();
    expect(getDueRetentionTasks(failed, task.dueAt + 1)).toHaveLength(1);
  });

  it("preserves attempt history after success", () => {
    const task = schedule.tasks[0];
    const failed = recordRetentionReviewAttempt(schedule, task.id, {
      attemptedAt: task.dueAt,
      passed: false,
    });
    const passed = recordRetentionReviewAttempt(failed, task.id, {
      attemptedAt: task.dueAt + 1_000,
      passed: true,
      evidenceId: "retention-1",
    });

    expect(passed.tasks[0].attempts).toHaveLength(2);
    expect(passed.tasks[0].completedAt).toBe(task.dueAt + 1_000);
    expect(completedRetentionReviewCount(passed, "ee-ih")).toBe(1);
    expect(getDueRetentionTasks(passed, task.dueAt + 2_000)).toEqual([]);
  });
});
