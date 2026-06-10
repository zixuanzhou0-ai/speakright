/**
 * 音节重音解析模块
 *
 * 重音数据来源（按优先级）：
 * 1. 静态词库 IPA（phoneme-data + word-bank，约 100+ 多音节词已标注 ˈ/ˌ）
 * 2. 旧版本地缓存（不再请求外部词典）
 * 3. 优雅降级（无数据时不显示重音）
 */

import { PHONEMES } from "@/lib/phoneme-data";
import { WORD_BANK } from "@/lib/word-bank";
import type { StressLevel } from "@/types/azure";

// IPA 元音符号集（用于按元音计数分割音节）
const IPA_VOWELS = new Set([
  "iː",
  "ɪ",
  "eɪ",
  "ɛ",
  "e",
  "æ",
  "ɑː",
  "ɔː",
  "oʊ",
  "ʊ",
  "uː",
  "ʌ",
  "ə",
  "ɝː",
  "aɪ",
  "aʊ",
  "ɔɪ",
  // 单字符元音（用于逐字���匹配）
  "i",
  "ɪ",
  "e",
  "ɛ",
  "æ",
  "ɑ",
  "ɔ",
  "o",
  "ʊ",
  "u",
  "ʌ",
  "ə",
  "ɝ",
  "a",
]);

/**
 * 构建 word → IPA 静态查找表
 * 从 phoneme-data.ts 和 word-bank.ts 中收集所有含重音标记的 IPA 条目
 */
export function buildStaticStressMap(): Map<string, string> {
  const map = new Map<string, string>();

  // phoneme-data.ts keywords
  for (const phoneme of PHONEMES) {
    for (const kw of phoneme.keywords) {
      if (kw.ipa.includes("ˈ") || kw.ipa.includes("ˌ")) {
        map.set(kw.word.toLowerCase(), kw.ipa);
      }
    }
  }

  // word-bank.ts extended pool
  for (const words of Object.values(WORD_BANK)) {
    for (const kw of words) {
      if (kw.ipa.includes("ˈ") || kw.ipa.includes("ˌ")) {
        map.set(kw.word.toLowerCase(), kw.ipa);
      }
    }
  }

  return map;
}

/**
 * 从 IPA 字符串解析重音位置
 *
 * 算法：扫描 IPA 字符串中的 ˈ 和 ˌ 标记，
 * 通��计数元音来确定标记对应的音节索引，
 * 然后映射到 Azure 返回的 syllableCount 个���节。
 *
 * @example parseIpaStress("/ˈʃʊɡər/", 2) → ["primary", "none"]
 * @example parseIpaStress("/əˈbʌv/", 2) → ["none", "primary"]
 * @example parseIpaStress("/ˌæftərˈnuːn/", 3) → ["secondary", "none", "primary"]
 */
export function parseIpaStress(
  ipa: string,
  syllableCount: number,
): StressLevel[] | null {
  if (syllableCount <= 1) return null;

  // 去掉首尾 /
  const clean = ipa.replace(/^\/|\/$/g, "");
  if (!clean.includes("ˈ") && !clean.includes("ˌ")) return null;

  // 扫描：记录每个重音标记出现时，前面有多��个元音（= 音节索引）
  const stressMarks: Array<{ index: number; level: StressLevel }> = [];
  let vowelCount = 0;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (ch === "ˈ" || ch === "ˌ") {
      stressMarks.push({
        index: vowelCount, // 标记在这个元音（音节���之前
        level: ch === "ˈ" ? "primary" : "secondary",
      });
      continue;
    }

    // 检查是否是元音字符
    if (IPA_VOWELS.has(ch)) {
      vowelCount++;
    }
  }

  if (stressMarks.length === 0) return null;

  // 构建结果数组
  const result: StressLevel[] = Array.from<StressLevel>({
    length: syllableCount,
  }).fill("none");

  for (const mark of stressMarks) {
    if (mark.index < syllableCount) {
      result[mark.index] = mark.level;
    }
  }

  return result;
}

/**
 * 从旧版词典音节字符串解析重音
 *
 * 旧版词典缓存用 `-` 分隔音节，ˈ/ˌ 标记紧贴在重读音节前。
 *
 * @example parseDictionaryStress("ˌaf-tər-ˈnün") → ["secondary", "none", "primary"]
 * @example parseDictionaryStress("ˈshü-gər") → ["primary", "none"]
 */
export function parseDictionaryStress(value: string): StressLevel[] {
  const parts = value.split("-");

  return parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("ˈ")) return "primary";
    if (trimmed.startsWith("ˌ")) return "secondary";
    return "none";
  });
}

/**
 * 主入口：解析一个词的重音模式
 *
 * @returns StressLevel[] 或 null（无数据时）
 */
export function resolveStressFromStatic(
  word: string,
  syllableCount: number,
  staticMap: Map<string, string>,
): StressLevel[] | null {
  if (syllableCount <= 1) return null;

  const ipa = staticMap.get(word.toLowerCase());
  if (!ipa) return null;

  return parseIpaStress(ipa, syllableCount);
}

// localStorage 缓存 key
const STRESS_CACHE_KEY = "speakright_stress_cache";

/** 从 localStorage 读取缓存 */
export function getCachedStress(word: string): StressLevel[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STRESS_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, StressLevel[]>;
    return cache[word.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/** 写入 localStorage 缓存 */
export function setCachedStress(word: string, stress: StressLevel[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STRESS_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, StressLevel[]>) : {};
    cache[word.toLowerCase()] = stress;
    localStorage.setItem(STRESS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}
