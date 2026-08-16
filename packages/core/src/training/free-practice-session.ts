export const FREE_PRACTICE_SESSION_VERSION = 1 as const;

export interface TextBoundFreePracticeValue<T> {
  version: typeof FREE_PRACTICE_SESSION_VERSION;
  textFingerprint: string;
  value: T;
}

/**
 * Canonicalizes presentation-only whitespace while preserving punctuation,
 * casing, and wording that can change a pronunciation assessment.
 */
export function normalizeFreePracticeText(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function getFreePracticeTextFingerprint(text: string): string {
  return `v${FREE_PRACTICE_SESSION_VERSION}:${normalizeFreePracticeText(text)}`;
}

export function bindFreePracticeValue<T>(
  textFingerprint: string,
  value: T,
): TextBoundFreePracticeValue<T> {
  return {
    version: FREE_PRACTICE_SESSION_VERSION,
    textFingerprint,
    value,
  };
}

/**
 * Legacy unbound values are intentionally rejected: showing no restored score
 * is safer than attaching an old score or feedback to different practice text.
 */
export function readBoundFreePracticeValue<T>(
  candidate: unknown,
  expectedTextFingerprint: string,
): T | null {
  if (!candidate || typeof candidate !== "object") return null;

  const entry = candidate as Partial<TextBoundFreePracticeValue<T>>;
  if (
    entry.version !== FREE_PRACTICE_SESSION_VERSION ||
    entry.textFingerprint !== expectedTextFingerprint ||
    !("value" in entry)
  ) {
    return null;
  }

  return entry.value ?? null;
}

export function isCurrentFreePracticeRequest(input: {
  requestId: number;
  currentRequestId: number;
  textFingerprint: string;
  currentTextFingerprint: string;
}): boolean {
  return (
    input.requestId === input.currentRequestId &&
    input.textFingerprint === input.currentTextFingerprint
  );
}
