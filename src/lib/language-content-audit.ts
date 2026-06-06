import { LANGUAGE_PROFILES } from "@/lib/language-profiles";
import { countLanguageTrainingWords } from "@/lib/language-content-packs";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";

export interface LanguageCoverageAudit {
  languageId: LanguageId;
  soundUnits: number;
  keywordTotal: number;
  averageKeywordsPerUnit: number;
  unitsWithTooFewKeywords: string[];
  unitsWithoutDescription: string[];
  unitsWithoutLocalVideo: string[];
  missingCapabilities: string[];
  coverageScore: number;
}

const MIN_KEYWORDS_PER_UNIT = 6;

function capabilityLabel(key: string): string {
  const labels: Record<string, string> = {
    wordAudio: "专用单词音频",
    wordPractice: "单词训练闭环",
    sentencePractice: "句子训练闭环",
    diagnosis: "发音诊断",
    evidenceMastery: "证据驱动 mastery",
    localVideos: "本地授权教学视频",
  };
  return labels[key] ?? key;
}

function auditUnits(phonemes: PhonemeData[]) {
  return {
    keywordTotal: phonemes.reduce((sum, phoneme) => sum + phoneme.keywords.length, 0),
    unitsWithTooFewKeywords: phonemes
      .filter((phoneme) => phoneme.keywords.length < MIN_KEYWORDS_PER_UNIT)
      .map((phoneme) => phoneme.slug),
    unitsWithoutDescription: phonemes
      .filter((phoneme) => !phoneme.description?.trim())
      .map((phoneme) => phoneme.slug),
    unitsWithoutLocalVideo: phonemes
      .filter((phoneme) => phoneme.video?.status !== "ready")
      .map((phoneme) => phoneme.slug),
  };
}

export function auditLanguageCoverage(languageId: LanguageId): LanguageCoverageAudit {
  const profile = LANGUAGE_PROFILES[languageId];
  const phonemes = profile.phonemeInventory;
  const unitAudit = auditUnits(phonemes);
  const trainingWordTotal = countLanguageTrainingWords(languageId);
  const missingCapabilities = Object.entries(profile.readiness)
    .filter(([key, value]) => key !== "phonemeInventory" && !value)
    .map(([key]) => capabilityLabel(key));
  const contentCompleteness =
    phonemes.length === 0
      ? 0
      : (phonemes.length - unitAudit.unitsWithTooFewKeywords.length) / phonemes.length;
  const capabilityCompleteness =
    Object.values(profile.readiness).filter(Boolean).length /
    Object.values(profile.readiness).length;
  const coverageScore = Math.round(
    (contentCompleteness * 0.45 + capabilityCompleteness * 0.55) * 100,
  );

  return {
    languageId,
    soundUnits: phonemes.length,
    keywordTotal: trainingWordTotal || unitAudit.keywordTotal,
    averageKeywordsPerUnit:
      phonemes.length === 0
        ? 0
        : Number((unitAudit.keywordTotal / phonemes.length).toFixed(1)),
    unitsWithTooFewKeywords: unitAudit.unitsWithTooFewKeywords,
    unitsWithoutDescription: unitAudit.unitsWithoutDescription,
    unitsWithoutLocalVideo: unitAudit.unitsWithoutLocalVideo,
    missingCapabilities,
    coverageScore,
  };
}

export function auditAllLanguages(): LanguageCoverageAudit[] {
  return Object.keys(LANGUAGE_PROFILES).map((languageId) =>
    auditLanguageCoverage(languageId as LanguageId),
  );
}
