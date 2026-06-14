const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/;

export function getSettingsUserFacingError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && CJK_TEXT_PATTERN.test(error.message)) {
    return error.message;
  }
  return fallback;
}
