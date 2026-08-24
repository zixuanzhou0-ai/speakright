import {
  isKnownEnglishChartAudioStem,
  isPlayableHeaderAudioSrc,
} from "@/lib/audio-playback-policy";
import { expandLanguageKeywordOptions } from "@/lib/language-keyword-expansions";
import { attachLanguagePhonemeResources } from "@/lib/language-phoneme-resources";
import { FRENCH_PHONEMES } from "@/lib/language-sound-units/french";
import { RUSSIAN_PHONEMES } from "@/lib/language-sound-units/russian";
import { SPANISH_PHONEMES } from "@/lib/language-sound-units/spanish";
import { PHONEMES } from "@/lib/phoneme-data";
import type { LanguageId } from "@/types/language";
import type { PhonemeCategory, PhonemeData } from "@/types/phoneme";

const ENGLISH_PHONEMES: PhonemeData[] = attachLanguagePhonemeResources(
  "en-US",
  PHONEMES.map((phoneme) => ({
    ...phoneme,
    languageId: "en-US",
    soundUnitType: "phoneme",
    video: {
      // The Rachel's English clips are reference-only and are intentionally
      // absent from the public Browser asset mirror.
      status: "planned",
      label: "Rachel's English 视频未随 Browser 发行包提供",
    },
  })),
);

export const LANGUAGE_PHONEMES: Record<LanguageId, PhonemeData[]> = {
  "en-US": ENGLISH_PHONEMES,
  "es-ES": attachLanguagePhonemeResources(
    "es-ES",
    expandLanguageKeywordOptions("es-ES", SPANISH_PHONEMES),
  ),
  "fr-FR": attachLanguagePhonemeResources(
    "fr-FR",
    expandLanguageKeywordOptions("fr-FR", FRENCH_PHONEMES),
  ),
  "ru-RU": attachLanguagePhonemeResources(
    "ru-RU",
    expandLanguageKeywordOptions("ru-RU", RUSSIAN_PHONEMES),
  ),
};

export function getLanguagePhonemes(languageId: LanguageId): PhonemeData[] {
  return LANGUAGE_PHONEMES[languageId];
}

export function getLanguagePhonemesByCategory(
  languageId: LanguageId,
  category: PhonemeCategory,
): PhonemeData[] {
  return LANGUAGE_PHONEMES[languageId].filter(
    (phoneme) => phoneme.category === category,
  );
}

export function getLanguagePhonemeBySlug(
  languageId: LanguageId,
  slug: string,
): PhonemeData | undefined {
  return LANGUAGE_PHONEMES[languageId].find((phoneme) => phoneme.slug === slug);
}

export function getAnyLanguagePhonemeBySlug(
  slug: string,
): PhonemeData | undefined {
  return Object.values(LANGUAGE_PHONEMES)
    .flat()
    .find((phoneme) => phoneme.slug === slug);
}

export function getAllLanguagePhonemeSlugs(): string[] {
  return Object.values(LANGUAGE_PHONEMES)
    .flat()
    .map((phoneme) => phoneme.slug);
}

export function hasLocalPhonemeAssets(phoneme: PhonemeData): boolean {
  if (phoneme.languageId === "en-US" || !phoneme.languageId) {
    return isKnownEnglishChartAudioStem(phoneme.chartWord);
  }

  return isPlayableHeaderAudioSrc(phoneme.phonemeAudio?.localSrc);
}
