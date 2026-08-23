import { isFormalEvidenceEnabled } from "@/lib/language-capability-policy";
import type { LanguageId } from "@/types/language";

export function canRecordFormalMastery(languageId: LanguageId): boolean {
  return isFormalEvidenceEnabled(languageId);
}

export function getExperimentalMasteryBlocker(
  languageId: LanguageId,
): string | null {
  if (canRecordFormalMastery(languageId)) return null;
  return "当前语言为 experimental，本轮只作为练习观察，不生成正式 mastery。";
}
