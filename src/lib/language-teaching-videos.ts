import type { LanguageId } from "@/types/language";

export type TeachingVideoLanguageId = Exclude<LanguageId, "en-US">;

export interface LanguageTeachingVideoAsset {
  id: string;
  languageId: TeachingVideoLanguageId;
  title: string;
  author: string;
  sourceUrl: string;
  videoSrc: string;
  durationSeconds: number;
  soundUnitSlugs: string[];
  exactSoundUnitSlugs?: string[];
  focus: "overview" | "vowels" | "stress" | "rhythm" | "rule" | "contrast";
}

const spanishVowels = ["es-a", "es-e", "es-i", "es-o", "es-u"];
const spanishLettersAndSounds = [
  "es-p",
  "es-t",
  "es-k",
  "es-f",
  "es-m",
  "es-n",
  "es-theta",
  "es-x",
  "es-ny",
  "es-tap-r",
  "es-trill-r",
  "es-s",
  "es-ch",
  "es-l",
  "es-bv",
  "es-d",
  "es-g",
  "es-y-ll",
  "es-nasal-place",
  "es-diphthongs-j",
  "es-diphthongs-w",
];

const frenchVowels = [
  "fr-i",
  "fr-y",
  "fr-u",
  "fr-e",
  "fr-e-open",
  "fr-eu-close",
  "fr-eu-open",
  "fr-a",
  "fr-o-close",
  "fr-o-open",
  "fr-an",
  "fr-in",
  "fr-on",
  "fr-un",
  "fr-schwa",
];
const frenchConsonantsAndGlides = [
  "fr-r",
  "fr-p",
  "fr-b",
  "fr-t",
  "fr-d",
  "fr-k",
  "fr-g",
  "fr-f",
  "fr-v",
  "fr-s",
  "fr-z",
  "fr-m",
  "fr-n",
  "fr-l",
  "fr-sh",
  "fr-zh",
  "fr-ny",
  "fr-glide-j",
  "fr-glide-hui",
  "fr-glide-w",
];

const russianOverviewUnits = [
  "ru-a",
  "ru-o",
  "ru-e",
  "ru-i",
  "ru-y",
  "ru-u",
  "ru-r",
  "ru-x",
  "ru-sh-zh",
  "ru-ts-ch-shch",
  "ru-ts",
  "ru-ch",
  "ru-shch",
  "ru-j",
];
const russianHardSoftExactUnits = [
  "ru-hard-soft",
  "ru-soft-t-d",
  "ru-soft-s-z",
  "ru-soft-n-l-r",
  "ru-soft-labials",
  "ru-soft-sign",
];
const russianHardSoftUnits = [
  ...russianHardSoftExactUnits,
  "ru-t-tj",
  "ru-d-dj",
  "ru-p-pj",
  "ru-b-bj",
  "ru-m-mj",
  "ru-f-fj",
  "ru-v-vj",
  "ru-iotated-vowels",
];

export const LANGUAGE_TEACHING_VIDEO_ASSETS: LanguageTeachingVideoAsset[] = [
  {
    id: "hsLYD1Jyf3A",
    languageId: "es-ES",
    title: "Spanish letters and sounds",
    author: "Butterfly Spanish",
    sourceUrl: "https://www.youtube.com/watch?v=hsLYD1Jyf3A",
    videoSrc: "/videos/language-assets/es-ES/youtube-lessons/hsLYD1Jyf3A.mp4",
    durationSeconds: 715,
    soundUnitSlugs: spanishLettersAndSounds,
    focus: "overview",
  },
  {
    id: "orOW9eRQfpE",
    languageId: "es-ES",
    title: "Spanish vowel sounds A E I O U",
    author: "Butterfly Spanish",
    sourceUrl: "https://www.youtube.com/watch?v=orOW9eRQfpE",
    videoSrc: "/videos/language-assets/es-ES/youtube-lessons/orOW9eRQfpE.mp4",
    durationSeconds: 375,
    soundUnitSlugs: spanishVowels,
    focus: "vowels",
  },
  {
    id: "MqQWUsHbmdI",
    languageId: "es-ES",
    title: "Spanish syllable stress",
    author: "Spanish Syllable Stress",
    sourceUrl: "https://www.youtube.com/watch?v=MqQWUsHbmdI",
    videoSrc: "/videos/language-assets/es-ES/youtube-lessons/MqQWUsHbmdI.mp4",
    durationSeconds: 472,
    soundUnitSlugs: ["es-lexical-stress"],
    exactSoundUnitSlugs: ["es-lexical-stress"],
    focus: "stress",
  },
  {
    id: "a_y0qGSC-ZY",
    languageId: "es-ES",
    title: "Spanish rhythm and unreduced vowels",
    author: "Ten Minute Spanish",
    sourceUrl: "https://www.youtube.com/watch?v=a_y0qGSC-ZY",
    videoSrc: "/videos/language-assets/es-ES/youtube-lessons/a_y0qGSC-ZY.mp4",
    durationSeconds: 323,
    soundUnitSlugs: ["es-syllable-rhythm"],
    exactSoundUnitSlugs: ["es-syllable-rhythm"],
    focus: "rhythm",
  },
  {
    id: "hI2Pso1dDjM",
    languageId: "fr-FR",
    title: "The sounds of French",
    author: "Fluent Forever",
    sourceUrl: "https://www.youtube.com/watch?v=hI2Pso1dDjM",
    videoSrc: "/videos/language-assets/fr-FR/youtube-lessons/hI2Pso1dDjM.mp4",
    durationSeconds: 883,
    soundUnitSlugs: frenchConsonantsAndGlides,
    focus: "overview",
  },
  {
    id: "Ihh8xoLXrrU",
    languageId: "fr-FR",
    title: "French vowel sounds",
    author: "Learn French with Lexie",
    sourceUrl: "https://www.youtube.com/watch?v=Ihh8xoLXrrU",
    videoSrc: "/videos/language-assets/fr-FR/youtube-lessons/Ihh8xoLXrrU.mp4",
    durationSeconds: 490,
    soundUnitSlugs: frenchVowels,
    focus: "vowels",
  },
  {
    id: "yRCD8vgohZo",
    languageId: "fr-FR",
    title: "French liaisons",
    author: "Learn French With Alexa",
    sourceUrl: "https://www.youtube.com/watch?v=yRCD8vgohZo",
    videoSrc: "/videos/language-assets/fr-FR/youtube-lessons/yRCD8vgohZo.mp4",
    durationSeconds: 534,
    soundUnitSlugs: ["fr-liaison"],
    exactSoundUnitSlugs: ["fr-liaison"],
    focus: "rule",
  },
  {
    id: "sSbOX4sMdLA",
    languageId: "fr-FR",
    title: "Elision, enchainement and liaisons",
    author: "French Simplified",
    sourceUrl: "https://www.youtube.com/watch?v=sSbOX4sMdLA",
    videoSrc: "/videos/language-assets/fr-FR/youtube-lessons/sSbOX4sMdLA.mp4",
    durationSeconds: 445,
    soundUnitSlugs: ["fr-enchainement", "fr-elision"],
    exactSoundUnitSlugs: ["fr-enchainement", "fr-elision"],
    focus: "rule",
  },
  {
    id: "7bjno3LPyfA",
    languageId: "fr-FR",
    title: "French silent letters",
    author: "The perfect French with Dylane",
    sourceUrl: "https://www.youtube.com/watch?v=7bjno3LPyfA",
    videoSrc: "/videos/language-assets/fr-FR/youtube-lessons/7bjno3LPyfA.mp4",
    durationSeconds: 1345,
    soundUnitSlugs: ["fr-final-consonant-silence"],
    exactSoundUnitSlugs: ["fr-final-consonant-silence"],
    focus: "rule",
  },
  {
    id: "yQ8jQ_Lr60M",
    languageId: "ru-RU",
    title: "Russian pronunciation overview",
    author: "Russian for Beginners",
    sourceUrl: "https://www.youtube.com/watch?v=yQ8jQ_Lr60M",
    videoSrc: "/videos/language-assets/ru-RU/youtube-lessons/yQ8jQ_Lr60M.mp4",
    durationSeconds: 1130,
    soundUnitSlugs: russianOverviewUnits,
    focus: "overview",
  },
  {
    id: "YrOFy4u7cyM",
    languageId: "ru-RU",
    title: "Russian hard vs soft consonants",
    author: "Russian Comprehensive",
    sourceUrl: "https://www.youtube.com/watch?v=YrOFy4u7cyM",
    videoSrc: "/videos/language-assets/ru-RU/youtube-lessons/YrOFy4u7cyM.mp4",
    durationSeconds: 553,
    soundUnitSlugs: russianHardSoftUnits,
    exactSoundUnitSlugs: russianHardSoftExactUnits,
    focus: "contrast",
  },
  {
    id: "QWTQUD8wzyM",
    languageId: "ru-RU",
    title: "Russian vowel reduction",
    author: "Real Russian Club",
    sourceUrl: "https://www.youtube.com/watch?v=QWTQUD8wzyM",
    videoSrc: "/videos/language-assets/ru-RU/youtube-lessons/QWTQUD8wzyM.mp4",
    durationSeconds: 678,
    soundUnitSlugs: [
      "ru-stress-reduction",
      "ru-unstressed-o-a",
      "ru-unstressed-e-ya",
    ],
    exactSoundUnitSlugs: [
      "ru-stress-reduction",
      "ru-unstressed-o-a",
      "ru-unstressed-e-ya",
    ],
    focus: "stress",
  },
  {
    id: "imiXGhO-Kc0",
    languageId: "ru-RU",
    title: "Russian voicing assimilation",
    author: "Russian Comprehensive",
    sourceUrl: "https://www.youtube.com/watch?v=imiXGhO-Kc0",
    videoSrc: "/videos/language-assets/ru-RU/youtube-lessons/imiXGhO-Kc0.mp4",
    durationSeconds: 760,
    soundUnitSlugs: ["ru-final-devoicing", "ru-voicing-assimilation"],
    exactSoundUnitSlugs: ["ru-voicing-assimilation"],
    focus: "rule",
  },
  {
    id: "XtRFEQfrQJw",
    languageId: "ru-RU",
    title: "Russian consonant clusters",
    author: "Connect with Russian",
    sourceUrl: "https://www.youtube.com/watch?v=XtRFEQfrQJw",
    videoSrc: "/videos/language-assets/ru-RU/youtube-lessons/XtRFEQfrQJw.mp4",
    durationSeconds: 583,
    soundUnitSlugs: ["ru-clusters"],
    exactSoundUnitSlugs: ["ru-clusters"],
    focus: "rule",
  },
];

export function getTeachingVideosForSoundUnit(
  languageId: LanguageId,
  slug: string,
): LanguageTeachingVideoAsset[] {
  if (languageId === "en-US") return [];

  return LANGUAGE_TEACHING_VIDEO_ASSETS.filter(
    (asset) =>
      asset.languageId === languageId && asset.soundUnitSlugs.includes(slug),
  );
}

export function getExactTeachingVideosForSoundUnit(
  languageId: LanguageId,
  slug: string,
): LanguageTeachingVideoAsset[] {
  if (languageId === "en-US") return [];

  return LANGUAGE_TEACHING_VIDEO_ASSETS.filter(
    (asset) =>
      asset.languageId === languageId &&
      (asset.exactSoundUnitSlugs ?? []).includes(slug),
  );
}

export function getPrimaryTeachingVideoForSoundUnit(
  languageId: LanguageId,
  slug: string,
): LanguageTeachingVideoAsset | undefined {
  return getTeachingVideosForSoundUnit(languageId, slug)[0];
}

export function getAllTeachingVideoAssets(): LanguageTeachingVideoAsset[] {
  return LANGUAGE_TEACHING_VIDEO_ASSETS;
}
