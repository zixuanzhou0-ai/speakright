import { LANGUAGE_PROFILES } from "@/lib/language-profiles";
import { REQUIRED_LANGUAGE_UNITS } from "@/lib/language-critical-units";
import { getLanguageResourceSite } from "@/lib/language-resource-sites";
import {
  hasVisibleRussianStress,
  needsVisibleRussianStress,
} from "@/lib/russian-stress";
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
  unitsWithoutTeachingResources: string[];
  unitsWithoutPhonemeAudio: string[];
  unitsWithoutSourceRefs: string[];
  unitsWithUnknownSourceRefs: string[];
  unitsWithoutLearnerNotes: string[];
  keywordsWithoutSourceRefs: string[];
  keywordsNeedingReview: string[];
  russianKeywordsWithoutStress: string[];
  missingLanguageCriticalUnits: string[];
  missingCapabilities: string[];
  coverageScore: number;
}

const MIN_ENGLISH_KEYWORDS_PER_UNIT = 6;
const MIN_NON_ENGLISH_KEYWORDS_PER_UNIT = 20;

function capabilityLabel(key: string): string {
  const labels: Record<string, string> = {
    wordAudio: "专用单词音频",
    wordPractice: "单词训练闭环",
    sentencePractice: "句子训练闭环",
    diagnosis: "发音诊断",
    evidenceMastery: "证据驱动 mastery",
    localVideos: "本地授权教学视频",
    externalArticulationResources: "外部口型/舌位资源",
  };
  return labels[key] ?? key;
}

function keywordId(phoneme: PhonemeData, word: string): string {
  return `${phoneme.slug}:${word}`;
}

function auditUnits(languageId: LanguageId, phonemes: PhonemeData[]) {
  const isNonEnglish = languageId !== "en-US";
  const existingSlugs = new Set(phonemes.map((phoneme) => phoneme.slug));
  const minKeywords = isNonEnglish
    ? MIN_NON_ENGLISH_KEYWORDS_PER_UNIT
    : MIN_ENGLISH_KEYWORDS_PER_UNIT;

  return {
    keywordTotal: phonemes.reduce(
      (sum, phoneme) => sum + phoneme.keywords.length,
      0,
    ),
    unitsWithTooFewKeywords: phonemes
      .filter((phoneme) => phoneme.keywords.length < minKeywords)
      .map((phoneme) => phoneme.slug),
    unitsWithoutDescription: phonemes
      .filter((phoneme) => !phoneme.description?.trim())
      .map((phoneme) => phoneme.slug),
    unitsWithoutLocalVideo: phonemes
      .filter((phoneme) => phoneme.video?.status !== "ready")
      .map((phoneme) => phoneme.slug),
    unitsWithoutTeachingResources: phonemes
      .filter(
        (phoneme) =>
          phoneme.languageId !== "en-US" && !phoneme.teachingResources?.length,
      )
      .map((phoneme) => phoneme.slug),
    unitsWithoutPhonemeAudio: phonemes
      .filter(
        (phoneme) =>
          !phoneme.phonemeAudio?.localSrc &&
          !phoneme.phonemeAudio?.url &&
          !phoneme.phonemeAudio?.text,
      )
      .map((phoneme) => phoneme.slug),
    unitsWithoutSourceRefs: phonemes
      .filter((phoneme) => isNonEnglish && !phoneme.sourceRefs?.length)
      .map((phoneme) => phoneme.slug),
    unitsWithUnknownSourceRefs: phonemes
      .filter(
        (phoneme) =>
          isNonEnglish &&
          (phoneme.sourceRefs ?? []).some((ref) => !getLanguageResourceSite(ref)),
      )
      .map((phoneme) => phoneme.slug),
    unitsWithoutLearnerNotes: phonemes
      .filter((phoneme) => isNonEnglish && !phoneme.notes?.length)
      .map((phoneme) => phoneme.slug),
    keywordsWithoutSourceRefs: phonemes.flatMap((phoneme) =>
      isNonEnglish
        ? phoneme.keywords
            .filter((keyword) => !keyword.sourceRefs?.length)
            .map((keyword) => keywordId(phoneme, keyword.word))
        : [],
    ),
    keywordsNeedingReview: phonemes.flatMap((phoneme) =>
      phoneme.keywords
        .filter((keyword) => keyword.needsReview)
        .map((keyword) => keywordId(phoneme, keyword.word)),
    ),
    russianKeywordsWithoutStress:
      languageId === "ru-RU"
        ? phonemes.flatMap((phoneme) =>
            phoneme.keywords
              .filter((keyword) => needsVisibleRussianStress(keyword.word))
              .filter((keyword) => !hasVisibleRussianStress(keyword.stressText))
              .map((keyword) => keywordId(phoneme, keyword.word)),
          )
        : [],
    missingLanguageCriticalUnits:
      REQUIRED_LANGUAGE_UNITS[languageId]?.filter(
        (slug) => !existingSlugs.has(slug),
      ) ?? [],
  };
}

export function auditLanguageCoverage(
  languageId: LanguageId,
): LanguageCoverageAudit {
  const profile = LANGUAGE_PROFILES[languageId];
  const phonemes = profile.phonemeInventory;
  const unitAudit = auditUnits(languageId, phonemes);
  const missingCapabilities = Object.entries(profile.readiness)
    .filter(([key, value]) => key !== "phonemeInventory" && !value)
    .map(([key]) => capabilityLabel(key));
  const contentCompleteness =
    phonemes.length === 0
      ? 0
      : (phonemes.length - unitAudit.unitsWithTooFewKeywords.length) /
        phonemes.length;
  const capabilityCompleteness =
    Object.values(profile.readiness).filter(Boolean).length /
    Object.values(profile.readiness).length;
  const coverageScore = Math.round(
    (contentCompleteness * 0.45 + capabilityCompleteness * 0.55) * 100,
  );

  return {
    languageId,
    soundUnits: phonemes.length,
    keywordTotal: unitAudit.keywordTotal,
    averageKeywordsPerUnit:
      phonemes.length === 0
        ? 0
        : Number((unitAudit.keywordTotal / phonemes.length).toFixed(1)),
    unitsWithTooFewKeywords: unitAudit.unitsWithTooFewKeywords,
    unitsWithoutDescription: unitAudit.unitsWithoutDescription,
    unitsWithoutLocalVideo: unitAudit.unitsWithoutLocalVideo,
    unitsWithoutTeachingResources: unitAudit.unitsWithoutTeachingResources,
    unitsWithoutPhonemeAudio: unitAudit.unitsWithoutPhonemeAudio,
    unitsWithoutSourceRefs: unitAudit.unitsWithoutSourceRefs,
    unitsWithUnknownSourceRefs: unitAudit.unitsWithUnknownSourceRefs,
    unitsWithoutLearnerNotes: unitAudit.unitsWithoutLearnerNotes,
    keywordsWithoutSourceRefs: unitAudit.keywordsWithoutSourceRefs,
    keywordsNeedingReview: unitAudit.keywordsNeedingReview,
    russianKeywordsWithoutStress: unitAudit.russianKeywordsWithoutStress,
    missingLanguageCriticalUnits: unitAudit.missingLanguageCriticalUnits,
    missingCapabilities,
    coverageScore,
  };
}

export function auditAllLanguages(): LanguageCoverageAudit[] {
  return Object.keys(LANGUAGE_PROFILES).map((languageId) =>
    auditLanguageCoverage(languageId as LanguageId),
  );
}
