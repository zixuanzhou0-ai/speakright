import { getCurrentLanguageId } from "@/lib/api-keys";
import { DEFAULT_LANGUAGE_ID, type LanguageId } from "@/types/language";

export const LANGUAGE_SCOPED_STORAGE_BASE_KEYS = [
  "speakright_assessment_result_v2",
  "speakright_assessment_result",
  "speakright_mastery_profile_v2",
  "speakright_mastery_profile_v1",
  "speakright_training_sessions_v2",
  "speakright_practice_history",
  "speakright_score_history",
  "speakright_benchmark_recordings_v1",
  "speakright_coverage_benchmarks_v1",
] as const;

export function languageScopedStorageKey(
  baseKey: string,
  languageId: LanguageId = getCurrentLanguageId(),
): string {
  return languageId === DEFAULT_LANGUAGE_ID ? baseKey : `${baseKey}:${languageId}`;
}

export function languageScopedStoragePrefix(baseKey: string): string {
  return `${baseKey}:`;
}

export function isLanguageScopedStorageKey(key: string): boolean {
  return LANGUAGE_SCOPED_STORAGE_BASE_KEYS.some(
    (baseKey) => key === baseKey || key.startsWith(languageScopedStoragePrefix(baseKey)),
  );
}
