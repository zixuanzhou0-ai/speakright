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
 * 获取 Azure 音素编码对应的 IPA Chart 音频 URL
 * @returns 音频 URL 或 null（未映射的音素）
 */
export function getPhonemeAudioUrl(azureCode: string): string | null {
  const chartWord = azureToChartWord[azureCode.toLowerCase()];
  return chartWord ? `/audio/ipa/phoneme/${chartWord}.mp3` : null;
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

const slugToAzureAliases: Record<string, string[]> = {
  ...Object.fromEntries(
    Object.entries(slugToAzure).map(([slug, azureCode]) => [slug, [azureCode]]),
  ),
  "es-a": ["a"],
  "es-e": ["e"],
  "es-i": ["i"],
  "es-o": ["o"],
  "es-u": ["u"],
  "es-p": ["p"],
  "es-t": ["t"],
  "es-k": ["k", "c"],
  "es-s": ["s"],
  "es-f": ["f"],
  "es-ch": ["ch", "tʃ"],
  "es-l": ["l"],
  "es-m": ["m"],
  "es-n": ["n"],
  "es-tap-r": ["ɾ"],
  "es-trill-r": ["r"],
  "es-x": ["x", "h"],
  "es-ny": ["ɲ", "ny"],
  "es-ll-y": ["ʝ", "ʎ", "j", "y"],
  "es-bv": ["b", "v", "β"],
  "es-d": ["d", "ð"],
  "es-g": ["g", "ɡ", "ɣ"],
  "fr-a": ["a"],
  "fr-i": ["i"],
  "fr-u": ["u"],
  "fr-y": ["y"],
  "fr-e": ["e"],
  "fr-epsilon": ["ɛ", "eh"],
  "fr-schwa": ["ə", "ax"],
  "fr-eu-close": ["ø"],
  "fr-eu-open": ["œ"],
  "fr-o-close": ["o"],
  "fr-o-open": ["ɔ"],
  "fr-an": ["ɑ̃", "an", "ɑ"],
  "fr-in": ["ɛ̃", "in"],
  "fr-on": ["ɔ̃", "on"],
  "fr-un": ["œ̃", "un"],
  "fr-p": ["p"],
  "fr-b": ["b"],
  "fr-t": ["t"],
  "fr-d": ["d"],
  "fr-k": ["k", "c"],
  "fr-g": ["g", "ɡ"],
  "fr-f": ["f"],
  "fr-v": ["v"],
  "fr-s": ["s"],
  "fr-z": ["z"],
  "fr-sh": ["ʃ", "sh"],
  "fr-zh": ["ʒ", "zh"],
  "fr-m": ["m"],
  "fr-n": ["n"],
  "fr-ny": ["ɲ", "ny"],
  "fr-l": ["l"],
  "fr-r": ["ʁ", "r"],
  "fr-j": ["j"],
  "fr-hui": ["ɥ"],
  "fr-w": ["w"],
};

function normalizeAssessmentPhoneme(phoneme: string) {
  return phoneme
    .trim()
    .toLowerCase()
    .replace(/[\/\[\]]/g, "")
    .replace(/[ˈˌ.]/g, "");
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
  const targetCodes = slugToAzureAliases[phonemeSlug]?.map(normalizeAssessmentPhoneme);
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
