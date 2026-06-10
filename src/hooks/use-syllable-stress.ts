"use client";

import { useMemo } from "react";
import {
  buildStaticStressMap,
  getCachedStress,
  resolveStressFromStatic,
} from "@/lib/syllable-stress";
import type { AzureSyllable } from "@/types/azure";

/**
 * 为 Azure 音节标注重音信息
 *
 * - syllables.length ≤ 1 → 返回空数组（隐藏音节区域）
 * - 先查静态词库（同步，零延迟）
 * - 再查旧版 localStorage 缓存
 * - 不再请求外部词典
 */
export function useSyllableStress(
  word: string | null,
  syllables: AzureSyllable[],
): AzureSyllable[] {
  const staticMap = useMemo(() => buildStaticStressMap(), []);

  const syllableCount = syllables.length;
  const lowerWord = word?.toLowerCase() ?? "";

  // 静态解析（同步）
  const staticStress = useMemo(() => {
    if (!lowerWord || syllableCount <= 1) return null;
    return resolveStressFromStatic(lowerWord, syllableCount, staticMap);
  }, [lowerWord, syllableCount, staticMap]);

  const cachedStress =
    lowerWord && syllableCount > 1 && !staticStress
      ? getCachedStress(lowerWord)
      : null;

  // 单音节：返回空数组（UI 据此隐藏音节区域）
  if (syllableCount <= 1) return [];

  // 选择最佳重音数据
  const stressData = staticStress ?? cachedStress;

  // 无重音数据：原样返回
  if (!stressData) return syllables;

  // 标注重音
  return syllables.map((s, i) => ({
    ...s,
    stress: i < stressData.length ? stressData[i] : ("none" as const),
  }));
}
