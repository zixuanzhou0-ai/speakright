import type { LanguageId } from "@/types/language";

export function canRecordFormalMastery(languageId: LanguageId): boolean {
  return languageId === "en-US";
}

export function getExperimentalMasteryBlocker(
  languageId: LanguageId,
): string | null {
  if (canRecordFormalMastery(languageId)) return null;
  return "当前语言为 experimental，本轮只作为练习观察，不生成正式 mastery。";
}
