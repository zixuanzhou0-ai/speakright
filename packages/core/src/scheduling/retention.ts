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