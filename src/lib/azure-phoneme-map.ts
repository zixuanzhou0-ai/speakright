import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { getAssessmentSegmentAudioInfo } from "@/lib/assessment-segment-audio";
import {
  getEnglishHeaderPhonemeAudioSrc,
  getSoundUnitHeaderPlaybackOptions,
} from "@/lib/audio-playback-policy";
import type { LanguageId } from "@/types/language";

/**
 * Azure Speech 美式英语音素编码 → IPA 符号映射表
 *
 * Azure Pronunciation Assessment 返回的 phoneme 字段使用 SAPI 编码（如 "eh"、"th"、"iy"），
 * 而非标准 IPA 符号。此模块提供完整的 40 音素映射及转换工具函数。
 *
 * 参考：https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
 */

/** 40 个美式英语音素：Azure SAPI 编码 → IPA 符号 */
export const azureToIpa: Record<string, string> = {
  // 元音 (13)
  iy: "iː",
  ih: "ɪ",
  ey: "eɪ",
  eh: "ɛ",
  ae: "æ",
  aa: "ɑː",
  ao: "ɔː",
  ow: "oʊ",
  uh: "ʊ",
  uw: "uː",
  ah: "ʌ",
  ax: "ə",
  er: "ɝː",
  // 双元音 (3)
  ay: "aɪ",
  aw: "aʊ",
  oy: "ɔɪ",
  // 辅音 (24)
  p: "p",
  b: "b",
  t: "t",
  d: "d",
  k: "k",
  g: "ɡ",
  f: "f",
  v: "v",
  th: "θ",
  dh: "ð",
  s: "s",
  z: "z",
  sh: "ʃ",
  zh: "ʒ",
  ch: "tʃ",
  jh: "dʒ",
  m: "m",
  n: "n",
  ng: "ŋ",
  l: "l",
  r: "r",
  w: "w",
  y: "j",
  hh: "h",
};

/**
 * Azure 音素编码 → IPA Chart 音频文件名（chartWord）
 * 音频路径: /audio/ipa/phoneme/{chartWord}.mp3
 */
export const azureToChartWord: Record<string, string> = {
  // 元音
  iy: "green",
  ih: "pink",
  ey: "jade",
  eh: "red",
  ae: "sand",
  aa: "coffee",
  ao: "mauve",
  ow: "gold",
  uh: "wood",
  uw: "blue",
  ah: "cup",
  ax: "dust",
  er: "purple",
  // 双元音
  ay: "lime",
  aw: "brown",
  oy: "turquoise",
  // 辅音
  p: "pig",
  b: "bear",
  t: "turtle",
  d: "dog",
  k: "cat",
  g: "goat",
  f: "frog",
  v: "beaver",
  th: "panther",
  dh: "feather",
  s: "snake",
  z: "zebra",
  sh: "sheep",
  zh: "television",
  ch: "chicken",
  jh: "giraffe",
  m: "mouse",
  n: "dinosaur",
  ng: "penguin",
  l: "lion",
  r: "rabbit",
  w: "wolf",
  y: "yak",
  hh: "horse",
};

/**
 * 获取 Azure 音素编码对应的 IPA Chart / 本地拆解音频信息。
 *
 * 非英语评分 tile 只复用左侧/详情页同一 sound unit 的本地 header clip。
 * 没有精确 header clip 映射时返回 null，让 tile 保留分数但不可点击，
 * 避免把示例词、rule/prosody/contrast 或代理素材误播成单音标。
 */
export interface PhonemeAudioInfo {
  url: string;
  kind: "chart" | "sound-unit";
  label: string;
  description?: string;
  startMs?: number;
  maxDurationMs?: number;
  fadeOutMs?: number;
}

export function getPhonemeAudioInfo(
  azureCode: string,
  languageId: LanguageId = "en-US",
): PhonemeAudioInfo | null {
  if (languageId !== "en-US") {
    const segmentAudio = getAssessmentSegmentAudioInfo(azureCode, languageId);
    if (segmentAudio) {
      const playback = getSoundUnitHeaderPlaybackOptions({
        phonemeAudio: {
          kind: "local",
          label: segmentAudio.soundUnitLabel,
          source: "local header clip",
          localSrc: segmentAudio.audioUrl,
          languageId,
        },
      });
      if (!playback) return null;

      return {
        url: segmentAudio.audioUrl,
        kind: segmentAudio.kind,
        label: segmentAudio.displayIpa,
        description: segmentAudio.note,
        ...playback,
      };
    }

    return null;
  }

  const chartWord = azureToChartWord[azureCode.toLowerCase()];
  const audioUrl = getEnglishHeaderPhonemeAudioSrc(chartWord);
  if (!audioUrl) return null;

  return {
    url: audioUrl,
    kind: "chart",
    label: toIpa(azureCode),
    description: "IPA Chart 本地音频",
    ...getSoundUnitHeaderPlaybackOptions({ chartWord }),
  };
}

/**
 * 获取 Azure 音素编码对应的可播放音频 URL。
 * @returns 音频 URL 或 null（未映射的音素）
 */
export function getPhonemeAudioUrl(
  azureCode: string,
  languageId: LanguageId = "en-US",
): string | null {
  return getPhonemeAudioInfo(azureCode, languageId)?.url ?? null;
}

export function getAssessmentPhonemeLabel(
  azureCode: string,
  languageId: LanguageId = "en-US",
): string {
  if (languageId === "en-US") return toIpa(azureCode);

  const normalized = normalizeAssessmentPhoneme(azureCode);
  if (!normalized) return "—";

  const segmentAudio = getAssessmentSegmentAudioInfo(azureCode, languageId);
  if (segmentAudio?.displayIpa) return segmentAudio.displayIpa;

  const englishMappedIpa = azureToIpa[normalized];
  return `/${englishMappedIpa ?? normalized}/`;
}

/**
 * 内部 slug → Azure SAPI 编码反向映射（用于从 Azure 评分结果中
 * 提取特定音素的 accuracyScore）。
 */
const slugToAzure: Record<string, string> = {
  ee: "iy",
  ih: "ih",
  ey: "ey",
  eh: "eh",
  ae: "ae",
  ah: "aa",
  aw: "ao",
  oh: "ow",
  uh: "uh",
  oo: "uw",
  uh2: "ah",
  schwa: "ax",
  er: "er",
  ai: "ay",
  au: "aw",
  oi: "oy",
  p: "p",
  b: "b",
  t: "t",
  d: "d",
  k: "k",
  g: "g",
  f: "f",
  v: "v",
  th: "th",
  dh: "dh",
  s: "s",
  z: "z",
  sh: "sh",
  zh: "zh",
  ch: "ch",
  dj: "jh",
  m: "m",
  n: "n",
  ng: "ng",
  l: "l",
  r: "r",
  w: "w",
  y: "y",
  h: "hh",
};

export interface AssessmentExemption {
  reason: string;
  suggestedEvidence: string;
}

type AssessmentAliasMap = Record<string, string[]>;

const englishAssessmentAliases: AssessmentAliasMap = Object.fromEntries(
  Object.entries(slugToAzure).map(([slug, azureCode]) => [slug, [azureCode]]),
);

export const phonemeAssessmentAliases: AssessmentAliasMap = {
  ...englishAssessmentAliases,

  // Spanish: only current es-ES sound-unit slugs. Orthographic-only rule units
  // live in phonemeAssessmentExemptions below.
  "es-a": ["a"],
  "es-e": ["e"],
  "es-i": ["i"],
  "es-o": ["o"],
  "es-u": ["u"],
  "es-bv": ["b", "v", "β", "β̞"],
  "es-d": ["d", "ð", "ð̞"],
  "es-g": ["g", "ɡ", "ɣ", "ɣ̞"],
  "es-theta": ["θ"],
  "es-x": ["x", "h"],
  "es-ny": ["ɲ", "ny"],
  "es-tap-r": ["ɾ"],
  "es-trill-r": ["r"],
  "es-s": ["s"],
  "es-ch": ["ch", "tʃ", "t͡ʃ"],
  "es-y-ll": ["ʝ", "ʎ", "j", "y"],
  "es-l": ["l"],
  "es-nasal-place": ["m", "n", "ŋ", "ɱ", "ɲ"],
  "es-diphthongs-j": ["j", "i̯"],
  "es-diphthongs-w": ["w", "u̯"],

  // French current fr-FR sound units.
  "fr-i": ["i"],
  "fr-y": ["y"],
  "fr-u": ["u"],
  "fr-e": ["e"],
  "fr-e-open": ["ɛ", "eh"],
  "fr-eu-close": ["ø"],
  "fr-eu-open": ["œ"],
  "fr-an": ["ɑ̃", "ã"],
  "fr-in": ["ɛ̃"],
  "fr-on": ["ɔ̃", "õ"],
  "fr-a": ["a"],
  "fr-schwa": ["ə", "ax"],
  "fr-o-close": ["o"],
  "fr-o-open": ["ɔ"],
  "fr-un": ["œ̃"],
  "fr-r": ["ʁ", "r", "χ"],
  "fr-sh": ["ʃ", "sh"],
  "fr-zh": ["ʒ", "zh"],
  "fr-ny": ["ɲ", "ny"],
  "fr-glide-j": ["j"],
  "fr-glide-hui": ["ɥ"],
  "fr-glide-w": ["w"],

  // Russian segment and contrast units. Rule/prosody-only units are explicit
  // exemptions so they cannot silently use a whole-word pronunciation score.
  "ru-a": ["a"],
  "ru-o": ["o"],
  "ru-i": ["i"],
  "ru-y": ["ɨ"],
  "ru-u": ["u"],
  "ru-e": ["e", "ɛ"],
  "ru-r": ["r"],
  "ru-x": ["x"],
  "ru-sh-zh": ["ʂ", "ʐ", "ʃ", "ʒ"],
  "ru-ts-ch-shch": ["ts", "t͡s", "tɕ", "t͡ɕ", "ɕː"],
  "ru-hard-soft": [
    "t",
    "tʲ",
    "d",
    "dʲ",
    "s",
    "sʲ",
    "z",
    "zʲ",
    "n",
    "nʲ",
    "l",
    "lʲ",
    "r",
    "rʲ",
    "p",
    "pʲ",
    "b",
    "bʲ",
    "m",
    "mʲ",
    "f",
    "fʲ",
    "v",
    "vʲ",
  ],
  "ru-soft-t-d": ["tʲ", "dʲ"],
  "ru-soft-s-z": ["sʲ", "zʲ"],
  "ru-soft-n-l-r": ["nʲ", "lʲ", "rʲ"],
  "ru-soft-labials": ["pʲ", "bʲ", "mʲ", "fʲ", "vʲ"],
  "ru-ts": ["ts", "t͡s"],
  "ru-ch": ["tɕ", "t͡ɕ", "tʃ"],
  "ru-shch": ["ɕː", "ʃː"],
  "ru-j": ["j"],
  "ru-iotated-vowels": ["j"],
};

export const phonemeAssessmentExemptions: Record<string, AssessmentExemption> =
  {
    "es-lexical-stress": {
      reason:
        "Spanish lexical stress is a suprasegmental rule/context target, not a single stable segment alias.",
      suggestedEvidence:
        "Use word-level stress placement, syllable timing, and repeated minimal stress pairs.",
    },
    "es-syllable-rhythm": {
      reason:
        "Spanish syllable rhythm is a prosody/timing target and cannot be represented by one phoneme alias.",
      suggestedEvidence:
        "Use phrase-level timing evidence across multiple syllables and recordings.",
    },
    "fr-liaison": {
      reason:
        "French liaison is a context-dependent sandhi rule, not an independent phoneme target.",
      suggestedEvidence:
        "Use phrase-level before/after-vowel contexts and alignment confidence.",
    },
    "fr-final-consonant-silence": {
      reason:
        "French final-consonant silence is an orthography-to-speech rule/context target.",
      suggestedEvidence:
        "Use word/phrase completion plus expected silent-letter checks, not segment score fallback.",
    },
    "fr-enchainement": {
      reason:
        "French enchainement is a connected-speech rule across word boundaries.",
      suggestedEvidence:
        "Use phrase-level boundary timing and repeated connected-speech examples.",
    },
    "fr-elision": {
      reason:
        "French elision is a rule/context target involving orthography and vowel contact.",
      suggestedEvidence:
        "Use phrase-level examples such as j'aime/l'ami with alignment review.",
    },
    "ru-soft-sign": {
      reason:
        "Russian soft sign is an orthographic palatalization marker, not an independent segment.",
      suggestedEvidence:
        "Use neighboring consonant palatalization evidence instead of a soft-sign phoneme score.",
    },
    "ru-stress-reduction": {
      reason:
        "Russian stress reduction is a word-level prosody and vowel-reduction rule.",
      suggestedEvidence:
        "Use stressed/unstressed vowel pairs and word-level stress evidence.",
    },
    "ru-unstressed-o-a": {
      reason:
        "Russian unstressed о/а reduction is a vowel-reduction rule tied to stress context.",
      suggestedEvidence:
        "Use stress-aware word contexts and avoid single-segment promotion.",
    },
    "ru-unstressed-e-ya": {
      reason:
        "Russian unstressed е/я reduction depends on stress and palatalizing context.",
      suggestedEvidence:
        "Use stress-aware words with soft-context checks.",
    },
    "ru-final-devoicing": {
      reason:
        "Russian final devoicing is a position/context rule rather than one phoneme target.",
      suggestedEvidence:
        "Use final-position word pairs and word-final voicing checks.",
    },
    "ru-voicing-assimilation": {
      reason:
        "Russian voicing assimilation is a consonant-cluster context rule.",
      suggestedEvidence:
        "Use cluster/phrase contexts with explicit neighboring-consonant evidence.",
    },
    "ru-clusters": {
      reason:
        "Russian consonant clusters are a sequence-level articulation target, not a single phoneme.",
      suggestedEvidence:
        "Use word/phrase-level cluster fluency and completeness evidence.",
    },
  };

export function normalizeAssessmentPhoneme(phoneme: string): string {
  return phoneme
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[/[\]]/g, "")
    .replace(/[ˈˌ.]/g, "")
    .replace(/[͜͡]/g, "");
}

export function getAssessmentAliasesForSlug(slug: string): string[] {
  return [
    ...new Set(
      (phonemeAssessmentAliases[slug] ?? []).map(normalizeAssessmentPhoneme),
    ),
  ];
}

export function getAssessmentExemptionForSlug(
  slug: string,
): AssessmentExemption | undefined {
  return phonemeAssessmentExemptions[slug];
}

type LanguagePhonemeUnit = ReturnType<typeof getLanguagePhonemes>[number];

interface ResolvedAssessmentPhonemeUnit {
  slug: string;
  displayIpa: string;
  audioUrl: string | null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function assessmentCodeCandidates(code: string): string[] {
  const normalized = normalizeAssessmentPhoneme(code);
  if (!normalized) return [];

  const englishIpa = azureToIpa[normalized];
  return uniqueStrings([
    normalized,
    englishIpa ? normalizeAssessmentPhoneme(englishIpa) : undefined,
  ]);
}

function unitIpaCandidates(unit: LanguagePhonemeUnit): string[] {
  const rawIpa = unit.ipa
    .replace(/[/[\]]/g, " ")
    .replace(/[ˈˌ.]/g, "")
    .split(/[\s,|~]+/)
    .map(normalizeAssessmentPhoneme);

  return uniqueStrings([normalizeAssessmentPhoneme(unit.ipa), ...rawIpa]);
}

function assessmentCandidatesForUnit(unit: LanguagePhonemeUnit): string[] {
  return uniqueStrings([
    ...getAssessmentAliasesForSlug(unit.slug),
    ...unitIpaCandidates(unit),
  ]);
}

function displayIpaForUnit(
  unit: LanguagePhonemeUnit,
  normalizedCode: string,
): string {
  const unitIpaCandidateSet = new Set(unitIpaCandidates(unit));
  const shouldUseUnitIpa =
    unit.soundUnitType === "phoneme" ||
    unitIpaCandidateSet.has(normalizedCode) ||
    normalizeAssessmentPhoneme(unit.ipa).includes(normalizedCode);

  if (shouldUseUnitIpa) return unit.ipa;

  const englishMappedIpa = azureToIpa[normalizedCode];
  return `/${englishMappedIpa ?? normalizedCode}/`;
}

export function resolveAssessmentPhonemeUnit(
  azureCode: string,
  languageId: LanguageId,
): ResolvedAssessmentPhonemeUnit | null {
  if (languageId === "en-US") return null;

  const candidates = assessmentCodeCandidates(azureCode);
  if (candidates.length === 0) return null;

  const units = getLanguagePhonemes(languageId);
  const exactIpaMatch = units
    .filter((unit) =>
      unitIpaCandidates(unit).some((candidate) =>
        candidates.includes(candidate),
      ),
    )
    .sort(
      (left, right) =>
        unitIpaCandidates(left).length - unitIpaCandidates(right).length,
    )[0];
  const matchingUnit =
    exactIpaMatch ??
    units.find((unit) =>
      assessmentCandidatesForUnit(unit).some((candidate) =>
        candidates.includes(candidate),
      ),
    );

  if (!matchingUnit) return null;

  return {
    slug: matchingUnit.slug,
    displayIpa: displayIpaForUnit(matchingUnit, candidates[0]),
    audioUrl: matchingUnit.phonemeAudio?.localSrc ?? null,
  };
}

/**
 * 从 Azure 评分结果中抽取特定音素（按内部 slug）的平均 accuracyScore。
 *
 * 用于对比训练 / 刻意练习：不用整体 pronunciationScore 判定是否达标，
 * 而是只看目标音素本身的准确度——这才是"发音矫正"的真实信号。
 *
 * @param result - Azure 评分结果
 * @param phonemeSlug - 内部音素 slug（如 "th"、"ih"、"er"）
 * @returns 目标音素的平均 accuracyScore（0-100），没有匹配时返回 null
 */
export function getPhonemeAccuracy(
  result: {
    words: Array<{
      phonemes: Array<{ phoneme: string; accuracyScore: number }>;
    }>;
  },
  phonemeSlug: string,
): number | null {
  const targetCodes = getAssessmentAliasesForSlug(phonemeSlug);
  if (!targetCodes?.length) return null;

  const scores: number[] = [];
  for (const word of result.words) {
    for (const ph of word.phonemes) {
      if (targetCodes.includes(normalizeAssessmentPhoneme(ph.phoneme))) {
        scores.push(ph.accuracyScore);
      }
    }
  }
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/** 所有双字符 Azure 编码（用于贪心分词） */
const TWO_CHAR_CODES = new Set(
  Object.keys(azureToIpa).filter((k) => k.length === 2),
);

/**
 * 将单个 Azure 音素编码转为 IPA 显示格式（带斜杠）
 *
 * @example toIpa("eh") → "/ɛ/"
 * @example toIpa("th") → "/θ/"
 */
export function toIpa(azureCode: string): string {
  const ipa = azureToIpa[azureCode.toLowerCase()];
  if (!ipa) {
    if (typeof window !== "undefined") {
      console.warn(
        `[azure-phoneme-map] Unknown Azure phoneme code: "${azureCode}"`,
      );
    }
    return `/${azureCode}/`;
  }
  return `/${ipa}/`;
}

/**
 * 将单个 Azure 音素编码转为 IPA 符号（不带斜杠，用于拼接）
 */
export function toIpaRaw(azureCode: string): string {
  return azureToIpa[azureCode.toLowerCase()] ?? azureCode;
}

/**
 * 将 Azure 音节字符串转为 IPA
 *
 * Azure 音节是多个音素编码拼接的字符串（如 "heh"、"low"、"wahn"）。
 * 使用贪心匹配：优先匹配双字符编码，再匹配单字符编码。
 *
 * @example syllableToIpa("heh") → "hɛ"
 * @example syllableToIpa("low") → "loʊ"
 * @example syllableToIpa("wahn") → "wɑːn"
 */
export function syllableToIpa(azureSyllable: string): string {
  const lower = azureSyllable.toLowerCase();
  let result = "";
  let i = 0;

  while (i < lower.length) {
    // 优先尝试双字符匹配
    if (i + 1 < lower.length) {
      const twoChar = lower.slice(i, i + 2);
      if (TWO_CHAR_CODES.has(twoChar)) {
        result += azureToIpa[twoChar];
        i += 2;
        continue;
      }
    }
    // 单字符匹配
    const oneChar = lower[i];
    const mapped = azureToIpa[oneChar];
    result += mapped ?? oneChar;
    i++;
  }

  return result;
}
