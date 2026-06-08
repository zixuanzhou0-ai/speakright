import {
  LANGUAGE_PHONEMES,
  getLanguagePhonemes,
} from "@/lib/language-phonemes";
import type {
  LanguageConfig,
  LanguageId,
  LanguageProfile,
} from "@/types/language";

export const DEFAULT_LANGUAGE_ID: LanguageId = "en-US";
export const DEFAULT_LANGUAGE_CONFIG: LanguageConfig = {
  languageId: DEFAULT_LANGUAGE_ID,
};

export const LANGUAGE_PROFILES: Record<LanguageId, LanguageProfile> = {
  "en-US": {
    id: "en-US",
    displayName: "美式英语",
    nativeName: "American English",
    shortLabel: "英语",
    azureLocale: "en-US",
    status: "stable",
    defaultPhonemeSlug: "ee",
    soundUnitLabel: "音标",
    pronunciationTestWord: "hello",
    phonemeInventory: LANGUAGE_PHONEMES["en-US"],
    readiness: {
      phonemeInventory: true,
      wordAudio: true,
      wordPractice: true,
      sentencePractice: true,
      diagnosis: true,
      evidenceMastery: true,
      localVideos: true,
      externalArticulationResources: true,
    },
    learnerFocus: [
      "/iː/-/ɪ/",
      "/e/-/æ/",
      "/θ/-/s/",
      "/ð/-/z/",
      "/l/-/r/",
      "word stress",
    ],
    knownGaps: [
      "英语内容是当前基线；后续仍需要补 schwa、弱读、flap T、dark L 等高频语流训练。",
    ],
  },
  "es-ES": {
    id: "es-ES",
    displayName: "西班牙语",
    nativeName: "Español (España)",
    shortLabel: "西语",
    azureLocale: "es-ES",
    status: "experimental",
    defaultPhonemeSlug: "es-a",
    soundUnitLabel: "发音单位",
    pronunciationTestWord: "hola",
    phonemeInventory: LANGUAGE_PHONEMES["es-ES"],
    readiness: {
      phonemeInventory: true,
      wordAudio: true,
      wordPractice: true,
      sentencePractice: true,
      diagnosis: true,
      evidenceMastery: false,
      localVideos: true,
      externalArticulationResources: true,
    },
    resourceSiteIds: [
      "easypronunciation-es-ipa",
      "ipatics-es-ipa",
      "spanishdict-pronunciation",
      "wiktionary-es",
      "forvo-es",
      "sounds-of-speech-es",
    ],
    learnerFocus: [
      "five pure vowels",
      "/b β/ and /d ð/ allophones",
      "tap /ɾ/ vs trill /r/",
      "Castilian /θ/",
      "/x/",
    ],
    knownGaps: [
      "西语单词音频通过 ElevenLabs 多语言发音包安装到本地缓存；未安装时仍退回实验性在线音源。",
      "证据驱动 mastery 还没有完整覆盖多语言 languageId + soundUnitSlug 晋级闭环。",
      "核心音素已接入 Sounds of Speech Spanish 本地口型/舌位素材；重音、音节节奏等韵律单元仍需要本地教学素材。",
      "当前 profile 是 es-ES；拉美西语 seseo、yeísmo 等变体需要单独 profile 或方言开关。",
    ],
  },
  "fr-FR": {
    id: "fr-FR",
    displayName: "法语",
    nativeName: "Français",
    shortLabel: "法语",
    azureLocale: "fr-FR",
    status: "experimental",
    defaultPhonemeSlug: "fr-i",
    soundUnitLabel: "发音单位",
    pronunciationTestWord: "bonjour",
    phonemeInventory: LANGUAGE_PHONEMES["fr-FR"],
    readiness: {
      phonemeInventory: true,
      wordAudio: true,
      wordPractice: true,
      sentencePractice: true,
      diagnosis: true,
      evidenceMastery: false,
      localVideos: true,
      externalArticulationResources: true,
    },
    resourceSiteIds: [
      "easypronunciation-fr-ipa",
      "openipa-fr",
      "ipatics-fr-ipa",
      "wiktionary-fr",
      "forvo-fr",
      "lawless-french-ipa",
      "phonetique-ca",
    ],
    learnerFocus: [
      "/y/",
      "/ø/-/œ/",
      "nasal vowels",
      "uvular /ʁ/",
      "liaison and enchaînement",
    ],
    knownGaps: [
      "法语单词音频通过 ElevenLabs 多语言发音包安装到本地缓存；未安装时仍退回实验性在线音源。",
      "鼻化元音、连诵、enchaînement、elision 已作为 beta 训练单位开放，但 mastery 晋级仍需语言专属证据规则。",
      "核心元音、辅音和 glide 已接入 Phonétique.ca / Sheffield 本地口型视频；liaison、enchaînement、elision、词尾静音仍需要短语级教学素材。",
    ],
  },
  "ru-RU": {
    id: "ru-RU",
    displayName: "俄语",
    nativeName: "Русский",
    shortLabel: "俄语",
    azureLocale: "ru-RU",
    status: "experimental",
    defaultPhonemeSlug: "ru-a",
    soundUnitLabel: "发音单位",
    pronunciationTestWord: "привет",
    phonemeInventory: LANGUAGE_PHONEMES["ru-RU"],
    readiness: {
      phonemeInventory: true,
      wordAudio: true,
      wordPractice: true,
      sentencePractice: true,
      diagnosis: true,
      evidenceMastery: false,
      localVideos: true,
      externalArticulationResources: true,
    },
    resourceSiteIds: [
      "easypronunciation-ru-ipa",
      "ipatics-ru-ipa",
      "easypronunciation-ru-trainer",
      "forvo-ru",
      "wiktionary-ru-pronunciation-appendix",
      "wiktionary-ru",
      "seeing-speech-ru",
    ],
    learnerFocus: [
      "/ɨ/",
      "hard vs soft consonants",
      "trilled /r/",
      "ш/ж/щ/ч/ц",
      "stress and vowel reduction",
      "consonant clusters",
    ],
    knownGaps: [
      "俄语单词音频通过 ElevenLabs 多语言发音包安装到本地缓存；未安装时仍退回实验性在线音源。",
      "俄语重音、弱化、硬软辅音和清浊同化已作为 beta 训练单位开放，但 mastery 晋级仍需语言专属证据规则。",
      "当前 27 个俄语 sound units 已接入 Seeing Speech / Wikimedia Commons 本地视频与音频；硬软辅音、重音弱化、词尾清化、清浊同化和辅音丛仍需要 SpeakRight 自制规则讲解视频。",
    ],
  },
};

export function getLanguageProfile(languageId: LanguageId): LanguageProfile {
  return LANGUAGE_PROFILES[languageId];
}

export function getEnabledLanguageProfiles(): LanguageProfile[] {
  return Object.values(LANGUAGE_PROFILES);
}

export function isLanguageId(value: string): value is LanguageId {
  return value in LANGUAGE_PROFILES;
}

export function normalizeLanguageId(value: unknown): LanguageId {
  return typeof value === "string" && isLanguageId(value)
    ? value
    : DEFAULT_LANGUAGE_ID;
}

export function getDefaultPhonemeSlug(languageId: LanguageId): string {
  return getLanguageProfile(languageId).defaultPhonemeSlug;
}

export function getProfilePhonemes(languageId: LanguageId) {
  return getLanguagePhonemes(languageId);
}
