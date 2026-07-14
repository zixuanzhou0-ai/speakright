export const RETENTION_INTERVAL_DAYS = [1, 7, 21] as const;

export function getNextRetentionReviewAt(
  observedAt: number,
  completedIntervals: number,
): number | null {
  const days = RETENTION_INTERVAL_DAYS[completedIntervals];
  if (days === undefined) return null;
  return observedAt + days * 24 * 60 * 60 * 1000;
}

export function isRetentionReviewDue(
  observedAt: number,
  completedIntervals: number,
  now: number,
): boolean {
  const dueAt = getNextRetentionReviewAt(observedAt, completedIntervals);
  return dueAt !== null && now >= dueAt;
}
export interface RetentionReviewAttempt {
  attemptedAt: number;
  passed: boolean;
  evidenceId?: string;
}

export interface RetentionReviewTask {
  id: string;
  packId: string;
  sourceTransferEvidenceId: string;
  scheduledDelayHours: 24 | 168 | 504;
  dueAt: number;
  materialIds: string[];
  attempts: RetentionReviewAttempt[];
  completedAt?: number;
}

export interface RetentionScheduleV1 {
  version: 1;
  updatedAt: number;
  tasks: RetentionReviewTask[];
}

export function createRetentionSchedule(input: {
  packId: string;
  sourceTransferEvidenceId: string;
  observedAt: number;
  materialIdsByDelay: Record<24 | 168 | 504, string[]>;
}): RetentionScheduleV1 {
  const delays = [24, 168, 504] as const;
  return {
    version: 1,
    updatedAt: input.observedAt,
    tasks: delays.map((scheduledDelayHours) => ({
      id: `${input.packId}-retention-${scheduledDelayHours}-${input.observedAt}`,
      packId: input.packId,
      sourceTransferEvidenceId: input.sourceTransferEvidenceId,
      scheduledDelayHours,
      dueAt: input.observedAt + scheduledDelayHours * 60 * 60 * 1000,
      materialIds: [...(input.materialIdsByDelay[scheduledDelayHours] ?? [])],
      attempts: [],
    })),
  };
}

export function getDueRetentionTasks(
  schedule: RetentionScheduleV1,
  now: number,
): RetentionReviewTask[] {
  return schedule.tasks
    .filter((task) => !task.completedAt && task.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function recordRetentionReviewAttempt(
  schedule: RetentionScheduleV1,
  taskId: string,
  attempt: RetentionReviewAttempt,
): RetentionScheduleV1 {
  return {
    version: 1,
    updatedAt: attempt.attemptedAt,
    tasks: schedule.tasks.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        attempts: [...task.attempts, attempt],
        // A due review is resolved once the learner completes it, even when
        // the evidence does not pass. Re-presenting the same material would
        // no longer be an untrained retention check. Failed observations stay
        // in history while the next scheduled interval uses fresh material.
        completedAt: task.completedAt ?? attempt.attemptedAt,
      };
    }),
  };
}

export function completedRetentionReviewCount(
  schedule: RetentionScheduleV1,
  packId: string,
): number {
  return schedule.tasks.filter(
    (task) => task.packId === packId && task.completedAt !== undefined,
  ).length;
}
