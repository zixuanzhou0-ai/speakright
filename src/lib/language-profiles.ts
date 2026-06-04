import {
  ADAPTIVE_ASSESSMENT_WORDS,
  ASSESSMENT_PARAGRAPH,
  ASSESSMENT_WORDS,
  TRACKED_PHONEMES,
} from "@/lib/assessment-texts";
import { DEFAULT_RECOMMENDED_PACK_IDS } from "@/lib/training-packs";
import {
  DEFAULT_LANGUAGE_ID,
  type AzureCapabilityProfile,
  type LanguageId,
  type LanguageProfile,
} from "@/types/language";

const LATIN_WORD_PATTERN = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;
const CYRILLIC_WORD_PATTERN =
  /[\p{Script=Cyrillic}\p{M}]+(?:-[\p{Script=Cyrillic}\p{M}]+)*/gu;

function splitByPattern(pattern: RegExp, text: string): string[] {
  return Array.from(
    text.normalize("NFC").matchAll(pattern),
    (match) => match[0],
  );
}

const latinTokenizer = {
  wordPattern: LATIN_WORD_PATTERN,
  splitWords: (text: string) => splitByPattern(LATIN_WORD_PATTERN, text),
};

const cyrillicTokenizer = {
  wordPattern: CYRILLIC_WORD_PATTERN,
  splitWords: (text: string) => splitByPattern(CYRILLIC_WORD_PATTERN, text),
};

const SPANISH_TRACKED_PHONEMES = [
  "es-a",
  "es-e",
  "es-i",
  "es-o",
  "es-u",
  "es-s",
  "es-theta",
  "es-p",
  "es-t",
  "es-k",
  "es-tap-r",
  "es-trill-r",
  "es-x",
  "es-ny",
  "es-ll-y",
  "es-bv",
  "es-d",
  "es-g",
  "es-l",
  "es-n",
] as const;

const SPANISH_ASSESSMENT_WORDS = [
  {
    word: "mesa",
    ipa: "/ˈmesa/",
    targetPhonemes: ["es-e", "es-s", "es-a"],
    purpose: "检测西语纯元音 /e a/ 和清晰 /s/",
  },
  {
    word: "cinco",
    ipa: "/ˈθiŋko/",
    targetPhonemes: ["es-theta", "es-i", "es-k", "es-o"],
    purpose: "检测西班牙本土 /θ/ 和元音稳定性",
  },
  {
    word: "zapato",
    ipa: "/θaˈpato/",
    targetPhonemes: ["es-theta", "es-p", "es-t", "es-a", "es-o"],
    purpose: "检测 /θ/、不送气 /p t/ 和重音",
  },
  {
    word: "pero",
    ipa: "/ˈpeɾo/",
    targetPhonemes: ["es-tap-r"],
    purpose: "检测单击 /ɾ/",
  },
  {
    word: "perro",
    ipa: "/ˈpero/",
    targetPhonemes: ["es-trill-r"],
    purpose: "检测颤音 /r/",
  },
  {
    word: "año",
    ipa: "/ˈaɲo/",
    targetPhonemes: ["es-ny"],
    purpose: "检测腭鼻音 /ɲ/",
  },
  {
    word: "calle",
    ipa: "/ˈkaʝe/",
    targetPhonemes: ["es-ll-y", "es-k", "es-e"],
    purpose: "检测 ll/y 的近似音",
  },
  {
    word: "jamón",
    ipa: "/xaˈmon/",
    targetPhonemes: ["es-x", "es-o", "es-n"],
    purpose: "检测 /x/ 和重音",
  },
  {
    word: "bebida",
    ipa: "/beˈβiða/",
    targetPhonemes: ["es-bv", "es-d"],
    purpose: "检测 b/v 与 intervocalic /d/",
  },
  {
    word: "tren",
    ipa: "/tɾen/",
    targetPhonemes: ["es-t", "es-tap-r", "es-n"],
    purpose: "检测辅音丛 tr，避免插入元音",
  },
];

const SPANISH_ADAPTIVE_ASSESSMENT_WORDS = [
  {
    word: "casa",
    ipa: "/ˈkasa/",
    targetPhonemes: ["es-k", "es-a", "es-s"],
    purpose: "补测 /s/ 与纯元音",
  },
  {
    word: "caza",
    ipa: "/ˈkaθa/",
    targetPhonemes: ["es-k", "es-a", "es-theta"],
    purpose: "补测 /s/ vs /θ/",
  },
  {
    word: "caro",
    ipa: "/ˈkaɾo/",
    targetPhonemes: ["es-tap-r"],
    purpose: "补测单击 /ɾ/",
  },
  {
    word: "carro",
    ipa: "/ˈkaro/",
    targetPhonemes: ["es-trill-r"],
    purpose: "补测颤音 /r/",
  },
];

const SPANISH_PARAGRAPH =
  "Ana vive en Sevilla y toma café con leche antes de salir. " +
  "Luego lee una nota corta y vuelve a casa a las ocho. " +
  "Pero Ramón corre rápido por la carretera y prepara arroz para Roberto.";

const FRENCH_ASSESSMENT_WORDS = [
  {
    word: "tu",
    ipa: "/ty/",
    targetPhonemes: ["fr-t", "fr-y"],
    purpose: "检测前圆唇元音 /y/",
  },
  {
    word: "tout",
    ipa: "/tu/",
    targetPhonemes: ["fr-t", "fr-u"],
    purpose: "建立 /y/ vs /u/ 基线",
  },
  {
    word: "rue",
    ipa: "/ʁy/",
    targetPhonemes: ["fr-r", "fr-y"],
    purpose: "检测法语小舌 /ʁ/ 和 /y/",
  },
  {
    word: "pain",
    ipa: "/pɛ̃/",
    targetPhonemes: ["fr-p", "fr-in"],
    purpose: "检测鼻化元音 /ɛ̃/",
  },
  {
    word: "bonjour",
    ipa: "/bɔ̃ʒuʁ/",
    targetPhonemes: ["fr-b", "fr-on", "fr-zh", "fr-u", "fr-r"],
    purpose: "检测鼻化元音、/ʒ/、/ʁ/",
  },
];

const RUSSIAN_ASSESSMENT_WORDS = [
  {
    word: "мама",
    ipa: "/ˈmamə/",
    targetPhonemes: ["ru-m", "ru-a"],
    purpose: "检测基础元音与重音",
  },
  {
    word: "мир",
    ipa: "/mʲir/",
    targetPhonemes: ["ru-soft-m", "ru-i", "ru-r"],
    purpose: "检测软辅音和颤音",
  },
  {
    word: "борщ",
    ipa: "/borɕː/",
    targetPhonemes: ["ru-o", "ru-r", "ru-shch"],
    purpose: "检测辅音丛和 /ɕː/",
  },
];

const ENGLISH_AZURE_CAPABILITIES: AzureCapabilityProfile = {
  status: "verified",
  scriptedAssessment: true,
  wordLevel: true,
  phonemeLevel: true,
  prosody: true,
  spontaneousTranscription: true,
  evidenceMasteryAllowed: true,
  lastReviewed: "2026-06-04",
  notes: [
    "Existing en-US evidence loop depends on word-level and phoneme-level Azure signals.",
    "Prosody is only enabled for sentence assessment.",
  ],
};

const UNPROBED_AZURE_CAPABILITIES: AzureCapabilityProfile = {
  status: "not-probed",
  scriptedAssessment: false,
  wordLevel: false,
  phonemeLevel: false,
  prosody: false,
  spontaneousTranscription: false,
  evidenceMasteryAllowed: false,
  lastReviewed: "2026-06-04",
  notes: [
    "No live Azure pronunciation-assessment probe has confirmed reliable scoring signals yet.",
    "This language must stay outside evidence-driven mastery until scripted, word-level, and segment/phoneme-level signals are verified.",
  ],
};

export const LANGUAGE_PROFILES: Record<LanguageId, LanguageProfile> = {
  "en-US": {
    id: "en-US",
    displayName: "英语",
    nativeName: "American English",
    learnerL1: "zh-CN",
    azureLocale: "en-US",
    status: "active",
    readiness: {
      diagnosis: true,
      training: true,
      evidenceMastery: true,
      requiresAzureProbe: false,
    },
    azureCapabilities: ENGLISH_AZURE_CAPABILITIES,
    tokenizer: latinTokenizer,
    trackedPhonemes: TRACKED_PHONEMES,
    assessmentWords: ASSESSMENT_WORDS,
    adaptiveAssessmentWords: ADAPTIVE_ASSESSMENT_WORDS,
    assessmentParagraph: ASSESSMENT_PARAGRAPH,
    recommendedPackIds: DEFAULT_RECOMMENDED_PACK_IDS,
    starterTrainingPlans: [],
    errorPatterns: [],
    notes: ["当前完整证据闭环基线。"],
  },
  "es-ES": {
    id: "es-ES",
    displayName: "西班牙语",
    nativeName: "Español (España)",
    learnerL1: "zh-CN",
    azureLocale: "es-ES",
    status: "experimental",
    readiness: {
      diagnosis: false,
      training: false,
      evidenceMastery: false,
      requiresAzureProbe: true,
    },
    azureCapabilities: {
      ...UNPROBED_AZURE_CAPABILITIES,
      status: "experimental",
      scriptedAssessment: false,
      lastReviewed: "2026-06-04",
      notes: [
        "Spanish content seed is ready, but the app has not confirmed stable Azure word-level and phoneme/segment-level signals for es-ES.",
        "Keep the entry as an experimental preparation path until a live probe confirms reliable alignment.",
      ],
    },
    tokenizer: latinTokenizer,
    trackedPhonemes: [...SPANISH_TRACKED_PHONEMES],
    assessmentWords: SPANISH_ASSESSMENT_WORDS,
    adaptiveAssessmentWords: SPANISH_ADAPTIVE_ASSESSMENT_WORDS,
    assessmentParagraph: SPANISH_PARAGRAPH,
    recommendedPackIds: [],
    starterTrainingPlans: [
      {
        id: "es-s-theta",
        title: "区分 casa / caza",
        targetPhonemes: ["es-s", "es-theta"],
        focus: "Castilian /θ/ 不能读成 /s/ 或 /ts/。",
        minimalPairs: [
          ["casa", "/ˈkasa/", "caza", "/ˈkaθa/"],
          ["sima", "/ˈsima/", "cima", "/ˈθima/"],
          ["coser", "/koˈser/", "cocer", "/koˈθer/"],
        ],
      },
      {
        id: "es-tap-trill-r",
        title: "pero / perro",
        targetPhonemes: ["es-tap-r", "es-trill-r"],
        focus: "单击 /ɾ/ 与颤音 /r/ 必须分开。",
        minimalPairs: [
          ["pero", "/ˈpeɾo/", "perro", "/ˈpero/"],
          ["caro", "/ˈkaɾo/", "carro", "/ˈkaro/"],
          ["coro", "/ˈkoɾo/", "corro", "/ˈkoro/"],
        ],
      },
      {
        id: "es-stress-accents",
        title: "重音和书面重音符号",
        targetPhonemes: ["es-stress"],
        focus: "不要用中文声调替代西语词重音。",
        minimalPairs: [
          ["papa", "/ˈpapa/", "papá", "/paˈpa/"],
          ["hablo", "/ˈaβlo/", "habló", "/aˈβlo/"],
        ],
      },
    ],
    errorPatterns: [
      {
        id: "es-err-vowel-diphthongize",
        targetPhonemes: ["es-e", "es-o"],
        suspectedSubstitution: "/e o/ -> /ei ou/",
        example: "mesa /ˈmesa/ 被读成近似 meisa",
        cue: "西语元音保持短、纯、稳定，不滑成双元音。",
      },
      {
        id: "es-err-r-merge",
        targetPhonemes: ["es-tap-r", "es-trill-r"],
        suspectedSubstitution: "/ɾ r/ -> 中文 r/l 或英语 r",
        example: "pero / perro",
        cue: "先做一次轻弹，再练连续颤动；两者不是同一个 r。",
      },
    ],
    notes: [
      "实验版 profile seed 已就绪。",
      "开放训练前要验证 Azure 是否稳定返回可用 segment/phoneme 信号，并补齐西语听辨音频或动态 TTS。",
    ],
  },
  "fr-FR": {
    id: "fr-FR",
    displayName: "法语",
    nativeName: "Français (France)",
    learnerL1: "zh-CN",
    azureLocale: "fr-FR",
    status: "planned",
    readiness: {
      diagnosis: false,
      training: false,
      evidenceMastery: false,
      requiresAzureProbe: true,
    },
    azureCapabilities: {
      ...UNPROBED_AZURE_CAPABILITIES,
      notes: [
        "French needs a live probe for nasal vowels, /y/-/u/, French /r/, liaison, and word-level alignment before mastery evidence is allowed.",
        "Prosody and syllable feedback must not be assumed from en-US behavior.",
      ],
    },
    tokenizer: latinTokenizer,
    trackedPhonemes: [
      "fr-y",
      "fr-u",
      "fr-r",
      "fr-an",
      "fr-in",
      "fr-on",
      "fr-eu-close",
      "fr-eu-open",
      "fr-v",
      "fr-z",
      "fr-zh",
      "fr-ny",
    ],
    assessmentWords: FRENCH_ASSESSMENT_WORDS,
    adaptiveAssessmentWords: [],
    assessmentParagraph:
      "Je vais à Paris avec mes amis. Nous buvons du vin, puis nous parlons doucement dans un petit café.",
    recommendedPackIds: [],
    starterTrainingPlans: [
      {
        id: "fr-y-u",
        title: "tu / tout",
        targetPhonemes: ["fr-y", "fr-u"],
        focus: "/y/ 舌位像 /i/，嘴唇像 /u/。",
      },
      {
        id: "fr-nasal-vowels",
        title: "鼻化元音",
        targetPhonemes: ["fr-an", "fr-in", "fr-on"],
        focus: "鼻化元音不要在词尾加中文式 /n/。",
      },
    ],
    errorPatterns: [
      {
        id: "fr-y-to-u-or-i",
        targetPhonemes: ["fr-y"],
        suspectedSubstitution: "/y/ -> /u/ or /i/",
        example: "tu /ty/ sounds like tout /tu/",
        cue: "舌头保持前高，嘴唇圆起来。",
      },
      {
        id: "fr-nasal-vowel-plus-n",
        targetPhonemes: ["fr-an", "fr-in", "fr-on"],
        suspectedSubstitution: "鼻化元音 -> 口元音 + /n/",
        example: "bon /bɔ̃/ sounds like bonne /bɔn/",
        cue: "让元音鼻化，不要加舌尖 /n/。",
      },
    ],
    notes: [
      "法语 prosody/ syllable 输出不能照搬英语。",
      "联诵和词尾静音需要 profile-level phoneme spans。",
    ],
  },
  "ru-RU": {
    id: "ru-RU",
    displayName: "俄语",
    nativeName: "Русский",
    learnerL1: "zh-CN",
    azureLocale: "ru-RU",
    status: "planned",
    readiness: {
      diagnosis: false,
      training: false,
      evidenceMastery: false,
      requiresAzureProbe: true,
    },
    azureCapabilities: {
      ...UNPROBED_AZURE_CAPABILITIES,
      notes: [
        "Russian needs a live probe for Cyrillic word alignment, stress, hard/soft consonants, and consonant clusters before mastery evidence is allowed.",
        "Until verified, ru-RU remains a planned profile only.",
      ],
    },
    tokenizer: cyrillicTokenizer,
    trackedPhonemes: [
      "ru-stress",
      "ru-hard-soft",
      "ru-r",
      "ru-shch",
      "ru-ts",
      "ru-vowel-reduction",
      "ru-consonant-cluster",
    ],
    assessmentWords: RUSSIAN_ASSESSMENT_WORDS,
    adaptiveAssessmentWords: [],
    assessmentParagraph:
      "Мама читает письмо, а брат говорит быстро. Сегодня мы учим новые слова и повторяем трудные звуки.",
    recommendedPackIds: [],
    starterTrainingPlans: [
      {
        id: "ru-stress-reduction",
        title: "重音和元音弱化",
        targetPhonemes: ["ru-stress", "ru-vowel-reduction"],
        focus: "俄语重音会改变未重读元音质量，不能逐字等重。",
      },
      {
        id: "ru-hard-soft",
        title: "软硬辅音",
        targetPhonemes: ["ru-hard-soft"],
        focus: "软辅音需要舌面抬向硬腭，不是简单加 /j/。",
      },
    ],
    errorPatterns: [
      {
        id: "ru-soft-hard-merge",
        targetPhonemes: ["ru-hard-soft"],
        suspectedSubstitution: "软硬辅音混读",
        example: "мир /mʲir/ vs мэр /mɛr/",
        cue: "软辅音要有舌面抬高的动作。",
      },
    ],
    notes: [
      "本轮不开放训练；先验证 Azure word/segment 信号。",
      "重点风险是重音、软硬辅音、辅音丛和颤音。",
    ],
  },
};

export function getLanguageProfile(languageId: LanguageId): LanguageProfile {
  return (
    LANGUAGE_PROFILES[languageId] ?? LANGUAGE_PROFILES[DEFAULT_LANGUAGE_ID]
  );
}

export function getLanguageProfiles(): LanguageProfile[] {
  return Object.values(LANGUAGE_PROFILES);
}
