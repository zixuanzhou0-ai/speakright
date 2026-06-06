import {
  ADAPTIVE_ASSESSMENT_WORDS,
  ASSESSMENT_PARAGRAPH,
  ASSESSMENT_WORDS,
  TRACKED_PHONEMES,
} from "@/lib/assessment-texts";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { MINIMAL_PAIR_SETS } from "@/lib/minimal-pairs";
import { SENTENCE_BANK } from "@/lib/sentence-bank";
import { WORD_BANK } from "@/lib/word-bank";
import type {
  LanguageAssessmentPack,
  LanguageContentPack,
  LanguageId,
  LanguageMinimalPairSet,
  LanguageSentenceEntry,
} from "@/types/language";
import type { KeywordEntry } from "@/types/phoneme";

const SPANISH_WORD_BANK: Record<string, KeywordEntry[]> = {
  "es-a": [
    { word: "plaza", ipa: "/ˈplaθa/" },
    { word: "claro", ipa: "/ˈklaɾo/" },
    { word: "cámara", ipa: "/ˈkamaɾa/" },
    { word: "palabra", ipa: "/paˈlaβɾa/" },
  ],
  "es-e": [
    { word: "peso", ipa: "/ˈpeso/" },
    { word: "centro", ipa: "/ˈθentɾo/" },
    { word: "cerca", ipa: "/ˈθeɾka/" },
    { word: "semana", ipa: "/seˈmana/" },
  ],
  "es-i": [
    { word: "piso", ipa: "/ˈpiso/" },
    { word: "familia", ipa: "/faˈmilja/" },
    { word: "ciudad", ipa: "/θjuˈðað/" },
    { word: "difícil", ipa: "/diˈfiθil/" },
  ],
  "es-o": [
    { word: "poco", ipa: "/ˈpoko/" },
    { word: "nombre", ipa: "/ˈnombɾe/" },
    { word: "cocina", ipa: "/koˈθina/" },
    { word: "teléfono", ipa: "/teˈlefono/" },
  ],
  "es-u": [
    { word: "tú", ipa: "/tu/" },
    { word: "mucho", ipa: "/ˈmutʃo/" },
    { word: "lunes", ipa: "/ˈlunes/" },
    { word: "universidad", ipa: "/uniβeɾsiˈðað/" },
  ],
  "es-bv": [
    { word: "vivir", ipa: "/biˈβiɾ/" },
    { word: "Barcelona", ipa: "/baɾθeˈlona/" },
    { word: "verano", ipa: "/beˈɾano/" },
    { word: "trabajo", ipa: "/tɾaˈβaxo/" },
  ],
  "es-d": [
    { word: "ciudad", ipa: "/θjuˈðað/" },
    { word: "Madrid", ipa: "/maˈðɾið/" },
    { word: "adiós", ipa: "/aˈðjos/" },
    { word: "estudiar", ipa: "/estuˈðjaɾ/" },
  ],
  "es-g": [
    { word: "guitarra", ipa: "/giˈtara/" },
    { word: "luego", ipa: "/ˈlweɣo/" },
    { word: "domingo", ipa: "/doˈmiŋgo/" },
    { word: "pregunta", ipa: "/pɾeˈɣunta/" },
  ],
  "es-theta": [
    { word: "cero", ipa: "/ˈθeɾo/" },
    { word: "caza", ipa: "/ˈkaθa/" },
    { word: "taza", ipa: "/ˈtaθa/" },
    { word: "Cecilia", ipa: "/θeˈθilja/" },
  ],
  "es-s": [
    { word: "sopa", ipa: "/ˈsopa/" },
    { word: "seis", ipa: "/sejs/" },
    { word: "sien", ipa: "/sjen/" },
    { word: "tasa", ipa: "/ˈtasa/" },
  ],
  "es-x": [
    { word: "ajo", ipa: "/ˈaxo/" },
    { word: "trabajo", ipa: "/tɾaˈβaxo/" },
    { word: "caja", ipa: "/ˈkaxa/" },
    { word: "jueves", ipa: "/ˈxweβes/" },
  ],
  "es-n": [
    { word: "noche", ipa: "/ˈnotʃe/" },
    { word: "nada", ipa: "/ˈnaða/" },
    { word: "mano", ipa: "/ˈmano/" },
    { word: "cana", ipa: "/ˈkana/" },
  ],
  "es-ny": [
    { word: "caña", ipa: "/ˈkaɲa/" },
    { word: "uña", ipa: "/ˈuɲa/" },
    { word: "pequeño", ipa: "/peˈkeɲo/" },
    { word: "cumpleaños", ipa: "/kumpleˈaɲos/" },
  ],
  "es-tap-r": [
    { word: "arroz", ipa: "/aˈroθ/" },
    { word: "hermano", ipa: "/eɾˈmano/" },
    { word: "cierto", ipa: "/ˈθjeɾto/" },
    { word: "profesor", ipa: "/pɾofeˈsoɾ/" },
  ],
  "es-trill-r": [
    { word: "rata", ipa: "/ˈrata/" },
    { word: "reina", ipa: "/ˈreina/" },
    { word: "arriba", ipa: "/aˈriβa/" },
    { word: "carretera", ipa: "/kareˈteɾa/" },
  ],
};

const SPANISH_MINIMAL_PAIRS: LanguageMinimalPairSet[] = [
  {
    id: "es-e-i",
    phonemeA: "es-e",
    phonemeB: "es-i",
    label: "/e/ vs /i/",
    pairs: [
      { wordA: "peso", ipaA: "/ˈpeso/", wordB: "piso", ipaB: "/ˈpiso/" },
      { wordA: "mesa", ipaA: "/ˈmesa/", wordB: "misa", ipaB: "/ˈmisa/" },
      { wordA: "leche", ipaA: "/ˈletʃe/", wordB: "litchi", ipaB: "/ˈlitʃi/" },
    ],
  },
  {
    id: "es-o-u",
    phonemeA: "es-o",
    phonemeB: "es-u",
    label: "/o/ vs /u/ near contrast",
    pairs: [
      { wordA: "poco", ipaA: "/ˈpoko/", wordB: "pudo", ipaB: "/ˈpuðo/" },
      { wordA: "tomo", ipaA: "/ˈtomo/", wordB: "tubo", ipaB: "/ˈtuβo/" },
      { wordA: "solo", ipaA: "/ˈsolo/", wordB: "subo", ipaB: "/ˈsuβo/" },
    ],
  },
  {
    id: "es-tap-trill-r",
    phonemeA: "es-tap-r",
    phonemeB: "es-trill-r",
    label: "/ɾ/ vs /r/",
    pairs: [
      { wordA: "pero", ipaA: "/ˈpeɾo/", wordB: "perro", ipaB: "/ˈpero/" },
      { wordA: "caro", ipaA: "/ˈkaɾo/", wordB: "carro", ipaB: "/ˈkaro/" },
      { wordA: "coro", ipaA: "/ˈkoɾo/", wordB: "corro", ipaB: "/ˈkoro/" },
    ],
  },
  {
    id: "es-s-theta",
    phonemeA: "es-theta",
    phonemeB: "es-s",
    label: "/θ/ vs /s/ spelling contrast",
    pairs: [
      { wordA: "caza", ipaA: "/ˈkaθa/", wordB: "casa", ipaB: "/ˈkasa/" },
      { wordA: "taza", ipaA: "/ˈtaθa/", wordB: "tasa", ipaB: "/ˈtasa/" },
      { wordA: "cien", ipaA: "/θjen/", wordB: "sien", ipaB: "/sjen/" },
    ],
  },
  {
    id: "es-n-ny",
    phonemeA: "es-n",
    phonemeB: "es-ny",
    label: "/n/ vs /ɲ/",
    pairs: [
      { wordA: "cana", ipaA: "/ˈkana/", wordB: "caña", ipaB: "/ˈkaɲa/" },
      { wordA: "una", ipaA: "/ˈuna/", wordB: "uña", ipaB: "/ˈuɲa/" },
      { wordA: "ano", ipaA: "/ˈano/", wordB: "año", ipaB: "/ˈaɲo/" },
    ],
  },
];

const SPANISH_SENTENCE_BANK: LanguageSentenceEntry[] = [
  {
    text: "La mesa está en casa.",
    phonemes: ["es-a", "es-e"],
    category: "daily",
  },
  {
    text: "Poco a poco estudio español.",
    phonemes: ["es-o", "es-u"],
    category: "daily",
  },
  {
    text: "Pero el perro corre rápido.",
    phonemes: ["es-tap-r", "es-trill-r"],
    category: "minimal-pair",
  },
  {
    text: "El carro rojo está en la carretera.",
    phonemes: ["es-trill-r", "es-x"],
    category: "daily",
  },
  {
    text: "Gracias, Cecilia, por la taza de café.",
    phonemes: ["es-theta", "es-e"],
    category: "daily",
  },
  {
    text: "José come jamón los jueves.",
    phonemes: ["es-x", "es-o"],
    category: "daily",
  },
  {
    text: "La niña viene mañana a España.",
    phonemes: ["es-ny", "es-a"],
    category: "daily",
  },
  {
    text: "Vivo en Bilbao durante el verano.",
    phonemes: ["es-bv", "es-d"],
    category: "daily",
  },
  {
    text: "Mi amigo paga luego.",
    phonemes: ["es-g", "es-tap-r"],
    category: "daily",
  },
  {
    text: "Casa o caza, tasa o taza.",
    phonemes: ["es-theta", "es-a"],
    category: "minimal-pair",
  },
  {
    text: "Caro, carro; pero, perro; coro, corro.",
    phonemes: ["es-tap-r", "es-trill-r"],
    category: "minimal-pair",
  },
  {
    text: "Mi profesor pregunta por la palabra clara.",
    phonemes: ["es-tap-r", "es-bv"],
    category: "daily",
  },
];

const SPANISH_ASSESSMENT: LanguageAssessmentPack = {
  screeningWords: [
    {
      word: "cinco",
      ipa: "/ˈθinko/",
      targetPhonemes: ["es-theta", "es-i"],
      purpose: "检测 es-ES /θ/ 和纯 /i/",
    },
    {
      word: "gracias",
      ipa: "/ˈgɾaθjas/",
      targetPhonemes: ["es-g", "es-tap-r", "es-theta"],
      purpose: "检测 /g/、单击 r 和 /θ/",
    },
    {
      word: "cero",
      ipa: "/ˈθeɾo/",
      targetPhonemes: ["es-theta", "es-e", "es-tap-r", "es-o"],
      purpose: "检测 /θ/、/e/ 和单击 r",
    },
    {
      word: "casa",
      ipa: "/ˈkasa/",
      targetPhonemes: ["es-a", "es-s"],
      purpose: "检测稳定纯 /a/ 和 /s/",
    },
    {
      word: "pero",
      ipa: "/ˈpeɾo/",
      targetPhonemes: ["es-e", "es-tap-r", "es-o"],
      purpose: "检测单击 /ɾ/",
    },
    {
      word: "perro",
      ipa: "/ˈpero/",
      targetPhonemes: ["es-e", "es-trill-r", "es-o"],
      purpose: "检测颤音 /r/",
    },
    {
      word: "guitarra",
      ipa: "/giˈtara/",
      targetPhonemes: ["es-g", "es-trill-r", "es-a"],
      purpose: "检测 /g/ 和 rr 颤音",
    },
    {
      word: "joven",
      ipa: "/ˈxoβen/",
      targetPhonemes: ["es-x", "es-bv", "es-e"],
      purpose: "检测 /x/ 和 b/v 近音",
    },
    {
      word: "mañana",
      ipa: "/maˈɲana/",
      targetPhonemes: ["es-ny", "es-n", "es-a"],
      purpose: "检测 /ɲ/ 与普通 /n/ 的区别",
    },
    {
      word: "abogado",
      ipa: "/aβoˈɣaðo/",
      targetPhonemes: ["es-bv", "es-g", "es-d", "es-o"],
      purpose: "检测 b/d/g 元音间放松",
    },
  ],
  adaptiveWords: [
    { word: "caro", ipa: "/ˈkaɾo/", targetPhonemes: ["es-tap-r"] },
    { word: "carro", ipa: "/ˈkaro/", targetPhonemes: ["es-trill-r"] },
    { word: "caza", ipa: "/ˈkaθa/", targetPhonemes: ["es-theta"] },
    { word: "sien", ipa: "/sjen/", targetPhonemes: ["es-s"] },
    { word: "José", ipa: "/xoˈse/", targetPhonemes: ["es-x", "es-e"] },
    { word: "caña", ipa: "/ˈkaɲa/", targetPhonemes: ["es-ny"] },
    { word: "vivir", ipa: "/biˈβiɾ/", targetPhonemes: ["es-bv", "es-tap-r"] },
    { word: "lago", ipa: "/ˈlaɣo/", targetPhonemes: ["es-g", "es-o"] },
  ],
  paragraph:
    "Cada mañana, Cecilia compra pan cerca del centro. Luego llama a su amigo José y camina por la carretera roja. El perro corre rápido, pero ella habla despacio y claro. Quiere arroz, ajo y una taza de café.",
  trackedPhonemes: [
    "es-a",
    "es-e",
    "es-i",
    "es-o",
    "es-u",
    "es-bv",
    "es-d",
    "es-g",
    "es-theta",
    "es-s",
    "es-x",
    "es-n",
    "es-ny",
    "es-tap-r",
    "es-trill-r",
  ],
};

const EMPTY_ASSESSMENT: LanguageAssessmentPack = {
  screeningWords: [],
  adaptiveWords: [],
  paragraph: "",
  trackedPhonemes: [],
};

export const LANGUAGE_CONTENT_PACKS: Record<LanguageId, LanguageContentPack> = {
  "en-US": {
    languageId: "en-US",
    azureLocale: "en-US",
    displayMode: "ipa-primary",
    phonemeUnits: getLanguagePhonemes("en-US"),
    wordBank: WORD_BANK,
    minimalPairs: MINIMAL_PAIR_SETS,
    sentenceBank: SENTENCE_BANK,
    assessment: {
      screeningWords: ASSESSMENT_WORDS,
      adaptiveWords: ADAPTIVE_ASSESSMENT_WORDS,
      paragraph: ASSESSMENT_PARAGRAPH,
      trackedPhonemes: TRACKED_PHONEMES,
    },
    evidencePolicy: {},
    llmPromptProfile: {
      coachLanguageNameZh: "美式英语",
      outputWarnings: [],
    },
  },
  "es-ES": {
    languageId: "es-ES",
    azureLocale: "es-ES",
    displayMode: "hybrid",
    phonemeUnits: getLanguagePhonemes("es-ES"),
    wordBank: SPANISH_WORD_BANK,
    minimalPairs: SPANISH_MINIMAL_PAIRS,
    sentenceBank: SPANISH_SENTENCE_BANK,
    assessment: SPANISH_ASSESSMENT,
    evidencePolicy: {
      "es-a": "feedback-only",
      "es-e": "feedback-only",
      "es-i": "feedback-only",
      "es-o": "feedback-only",
      "es-u": "feedback-only",
      "es-theta": "feedback-only",
      "es-s": "feedback-only",
      "es-x": "feedback-only",
      "es-n": "feedback-only",
      "es-ny": "feedback-only",
      "es-tap-r": "human-validation",
      "es-trill-r": "human-validation",
      "es-bv": "human-validation",
      "es-d": "human-validation",
      "es-g": "human-validation",
    },
    llmPromptProfile: {
      coachLanguageNameZh: "西班牙语",
      outputWarnings: [
        "西语实验版评分先作为反馈，不直接升级 mastery。",
        "当前 profile 是 es-ES，/θ/ 按西班牙本土发音处理。",
      ],
    },
  },
  "fr-FR": {
    languageId: "fr-FR",
    azureLocale: "fr-FR",
    displayMode: "ipa-primary",
    phonemeUnits: getLanguagePhonemes("fr-FR"),
    wordBank: {},
    minimalPairs: [],
    sentenceBank: [],
    assessment: EMPTY_ASSESSMENT,
    evidencePolicy: {},
    llmPromptProfile: {
      coachLanguageNameZh: "法语",
      outputWarnings: ["法语仍在内容准备中，暂不开放完整训练闭环。"],
    },
  },
  "ru-RU": {
    languageId: "ru-RU",
    azureLocale: "ru-RU",
    displayMode: "orthography-primary",
    phonemeUnits: getLanguagePhonemes("ru-RU"),
    wordBank: {},
    minimalPairs: [],
    sentenceBank: [],
    assessment: EMPTY_ASSESSMENT,
    evidencePolicy: {},
    llmPromptProfile: {
      coachLanguageNameZh: "俄语",
      outputWarnings: ["俄语仍在 Azure 与重音/软硬音验证中，暂不开放完整训练闭环。"],
    },
  },
};

export function getLanguageContentPack(
  languageId: LanguageId,
): LanguageContentPack {
  return LANGUAGE_CONTENT_PACKS[languageId];
}

export function getLanguageExtendedWords(
  languageId: LanguageId,
  slug: string,
): KeywordEntry[] {
  return LANGUAGE_CONTENT_PACKS[languageId].wordBank[slug] ?? [];
}

export function getLanguageSentenceBank(
  languageId: LanguageId,
): LanguageSentenceEntry[] {
  return LANGUAGE_CONTENT_PACKS[languageId].sentenceBank;
}

export function getLanguageAssessmentPack(
  languageId: LanguageId,
): LanguageAssessmentPack {
  return LANGUAGE_CONTENT_PACKS[languageId].assessment;
}

export function getLanguageMinimalPairSets(
  languageId: LanguageId,
): LanguageMinimalPairSet[] {
  return LANGUAGE_CONTENT_PACKS[languageId].minimalPairs;
}

export function countLanguageTrainingWords(languageId: LanguageId): number {
  const pack = LANGUAGE_CONTENT_PACKS[languageId];
  return pack.phonemeUnits.reduce((sum, unit) => {
    const words = new Set(unit.keywords.map((item) => item.word.toLowerCase()));
    for (const item of pack.wordBank[unit.slug] ?? []) {
      words.add(item.word.toLowerCase());
    }
    return sum + words.size;
  }, 0);
}
