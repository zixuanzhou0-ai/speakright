import { LANGUAGE_PHONEMES, getLanguagePhonemes } from "@/lib/language-phonemes";
import type { LanguageConfig, LanguageId, LanguageProfile } from "@/types/language";

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
      wordAudio: false,
      wordPractice: false,
      sentencePractice: false,
      diagnosis: false,
      evidenceMastery: false,
      localVideos: false,
    },
    learnerFocus: [
      "five pure vowels",
      "/b β/ and /d ð/ allophones",
      "tap /ɾ/ vs trill /r/",
      "Castilian /θ/",
      "/x/",
    ],
    knownGaps: [
      "现在只有发音单位和 starter word list，还没有西语最小对立、句子、诊断文本和 mastery gate。",
      "当前 profile 是 es-ES；拉美西语 seseo、yeísmo 等变体需要单独 profile 或方言开关。",
      "单词发音暂走有道实验音源，尚未建立西语专用 TTS/词典 provider。",
    ],
  },
  "fr-FR": {
    id: "fr-FR",
    displayName: "法语",
    nativeName: "Français",
    shortLabel: "法语",
    azureLocale: "fr-FR",
    status: "draft",
    defaultPhonemeSlug: "fr-i",
    soundUnitLabel: "发音单位",
    pronunciationTestWord: "bonjour",
    phonemeInventory: LANGUAGE_PHONEMES["fr-FR"],
    readiness: {
      phonemeInventory: true,
      wordAudio: false,
      wordPractice: false,
      sentencePractice: false,
      diagnosis: false,
      evidenceMastery: false,
      localVideos: false,
    },
    learnerFocus: [
      "/y/",
      "/ø/-/œ/",
      "nasal vowels",
      "uvular /ʁ/",
      "liaison and enchaînement",
    ],
    knownGaps: [
      "法语现在只到核心元音/鼻化元音/法语 r/连诵 starter list，远没达到完整课程。",
      "鼻化元音需要专门的听辨和录音质量门槛，不能用英语式音素评分直接升级 mastery。",
      "连诵和静音词尾是句子层规则，需要单独内容引擎。",
    ],
  },
  "ru-RU": {
    id: "ru-RU",
    displayName: "俄语",
    nativeName: "Русский",
    shortLabel: "俄语",
    azureLocale: "ru-RU",
    status: "draft",
    defaultPhonemeSlug: "ru-a",
    soundUnitLabel: "发音单位",
    pronunciationTestWord: "привет",
    phonemeInventory: LANGUAGE_PHONEMES["ru-RU"],
    readiness: {
      phonemeInventory: true,
      wordAudio: false,
      wordPractice: false,
      sentencePractice: false,
      diagnosis: false,
      evidenceMastery: false,
      localVideos: false,
    },
    learnerFocus: [
      "/ɨ/",
      "hard vs soft consonants",
      "trilled /r/",
      "ш/ж/щ/ч/ц",
      "stress and vowel reduction",
      "consonant clusters",
    ],
    knownGaps: [
      "俄语现在把硬软辅音、重音、辅音丛作为训练单位显示，不应叫单纯音标表。",
      "需要把硬/软辅音拆成更细的成对训练，否则学习路径仍然太粗。",
      "俄语重音会改变元音质量，诊断必须先有重音标注和词级 evidence。",
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
