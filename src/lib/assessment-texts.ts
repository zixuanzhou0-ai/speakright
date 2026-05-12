import type { AssessmentWord } from "@/types/assessment";

/**
 * 10 diagnostic words covering the most confused phoneme contrasts
 * for Chinese L1 speakers. Each word targets specific phonemes.
 */
export const ASSESSMENT_WORDS: AssessmentWord[] = [
  {
    word: "think",
    ipa: "/θɪŋk/",
    targetPhonemes: ["th", "ih", "ng"],
    purpose: "检测 /θ/、/ɪ/ 和词尾 /ŋk/",
  },
  {
    word: "visa",
    ipa: "/ˈviːzə/",
    targetPhonemes: ["v", "ee", "z", "schwa"],
    purpose: "检测 /v/、长元音 /iː/ 和弱读 /ə/",
  },
  {
    word: "world",
    ipa: "/wɜːrld/",
    targetPhonemes: ["w", "er", "l", "d"],
    purpose: "检测 /w/、卷舌元音、dark L 和词尾 /d/",
  },
  {
    word: "father",
    ipa: "/ˈfɑːðər/",
    targetPhonemes: ["f", "ah", "dh", "er"],
    purpose: "检测有声齿间音 /ð/ 和重音",
  },
  {
    word: "pleasure",
    ipa: "/ˈpleʒər/",
    targetPhonemes: ["p", "l", "eh", "zh", "er"],
    purpose: "检测 /ʒ/、/l/ 和弱读音节",
  },
  {
    word: "church",
    ipa: "/tʃɜːrtʃ/",
    targetPhonemes: ["ch", "er"],
    purpose: "检测 /tʃ/ 和卷舌元音",
  },
  {
    word: "language",
    ipa: "/ˈlæŋɡwɪdʒ/",
    targetPhonemes: ["l", "ae", "ng", "w", "ih", "dj"],
    purpose: "检测 /æ/、/ŋɡ/、/w/ 和 /dʒ/",
  },
  {
    word: "breathe",
    ipa: "/briːð/",
    targetPhonemes: ["b", "r", "ee", "dh"],
    purpose: "检测词尾有声齿间音 /ð/",
  },
  {
    word: "usually",
    ipa: "/ˈjuːʒuəli/",
    targetPhonemes: ["y", "oo", "zh", "schwa", "l", "ee"],
    purpose: "检测 /juː/、/ʒ/、弱读和尾部 /li/",
  },
  {
    word: "asked",
    ipa: "/æskt/",
    targetPhonemes: ["ae", "s", "k", "t"],
    purpose: "检测 /æ/ 和词尾辅音群 /skt/",
  },
];

/**
 * Optional follow-up words. The diagnosis engine picks at most 4 only when
 * first-pass evidence is weak but sample count is too low.
 */
export const ADAPTIVE_ASSESSMENT_WORDS: AssessmentWord[] = [
  {
    word: "three",
    ipa: "/θriː/",
    targetPhonemes: ["th", "r", "ee"],
    purpose: "补测 /θ/ 接 /r/ 的稳定性",
  },
  {
    word: "mouth",
    ipa: "/maʊθ/",
    targetPhonemes: ["au", "th"],
    purpose: "补测词尾 /θ/",
  },
  {
    word: "this",
    ipa: "/ðɪs/",
    targetPhonemes: ["dh", "ih", "s"],
    purpose: "补测有声齿间音 /ð/",
  },
  {
    word: "very",
    ipa: "/ˈveri/",
    targetPhonemes: ["v", "eh", "r", "ee"],
    purpose: "补测 /v/ 和 /r/",
  },
  {
    word: "water",
    ipa: "/ˈwɔːtər/",
    targetPhonemes: ["w", "aw", "t", "er"],
    purpose: "补测 /w/、美式 t 和卷舌音",
  },
  {
    word: "ship",
    ipa: "/ʃɪp/",
    targetPhonemes: ["sh", "ih", "p"],
    purpose: "补测短元音 /ɪ/",
  },
  {
    word: "sheep",
    ipa: "/ʃiːp/",
    targetPhonemes: ["sh", "ee", "p"],
    purpose: "补测长元音 /iː/",
  },
  {
    word: "bad",
    ipa: "/bæd/",
    targetPhonemes: ["b", "ae", "d"],
    purpose: "补测 /æ/ 的开口",
  },
  {
    word: "look",
    ipa: "/lʊk/",
    targetPhonemes: ["l", "uh", "k"],
    purpose: "补测短元音 /ʊ/",
  },
  {
    word: "sing",
    ipa: "/sɪŋ/",
    targetPhonemes: ["s", "ih", "ng"],
    purpose: "补测后鼻音 /ŋ/",
  },
  {
    word: "help",
    ipa: "/help/",
    targetPhonemes: ["h", "eh", "l", "p"],
    purpose: "补测词尾 /lp/",
  },
  {
    word: "books",
    ipa: "/bʊks/",
    targetPhonemes: ["b", "uh", "k", "s"],
    purpose: "补测词尾辅音群 /ks/",
  },
];

/**
 * Diagnostic paragraph (~80 words). Designed to cover all major
 * phoneme contrasts and common L1 error triggers for Chinese speakers.
 * Includes: th/s contrast, v/w contrast, r/l contrast, dark L,
 * final consonant clusters, weak forms, linking opportunities.
 */
export const ASSESSMENT_PARAGRAPH =
  "Last Thursday, my brother and I visited the three largest libraries in the city. " +
  "We walked through the vast reading rooms, where several volunteers were helping " +
  "young children choose their favorite books. The weather was very pleasant, " +
  "so we decided to sit outside on a wooden bench near the river. " +
  "I asked my brother whether he thought the library would close at five or six. " +
  "He laughed and said he wasn't sure, but we should probably leave before it gets dark.";

/** All phoneme slugs to track in the assessment */
export const TRACKED_PHONEMES = [
  "ee",
  "ih",
  "ey",
  "eh",
  "ae",
  "ah",
  "aw",
  "oh",
  "uh",
  "oo",
  "uh2",
  "schwa",
  "er",
  "ai",
  "au",
  "oi",
  "p",
  "b",
  "t",
  "d",
  "k",
  "g",
  "f",
  "v",
  "th",
  "dh",
  "s",
  "z",
  "sh",
  "zh",
  "ch",
  "dj",
  "m",
  "n",
  "ng",
  "l",
  "r",
  "w",
  "y",
  "h",
];
