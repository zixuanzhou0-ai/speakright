"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMwStress as fetchMwStressApi } from "@/lib/api-client";
import { getMerriamWebsterConfig } from "@/lib/api-keys";
import {
  buildStaticStressMap,
  getCachedStress,
  resolveStressFromStatic,
  setCachedStress,
} from "@/lib/syllable-stress";
import type { AzureSyllable, StressLevel } from "@/types/azure";

/**
 * 为 Azure 音节标注重音信息
 *
 * - syllables.length ≤ 1 → 返回空数组（隐藏音节区域）
 * - 先查静态词库（同步，零延迟）
 * - 再查 localStorage 缓存
 * - 最后尝试韦氏词典 API（需配置 API Key）
 */
export function useSyllableStress(
  word: string | null,
  syllables: AzureSyllable[],
): AzureSyllable[] {
  const staticMap = useMemo(() => buildStaticStressMap(), []);
  const [mwStress, setMwStress] = useState<StressLevel[] | null>(null);

  const syllableCount = syllables.length;
  const lowerWord = word?.toLowerCase() ?? "";

  // 静态解析（同步）
  const staticStress = useMemo(() => {
    if (!lowerWord || syllableCount <= 1) return null;
    return resolveStressFromStatic(lowerWord, syllableCount, staticMap);
  }, [lowerWord, syllableCount, staticMap]);

  // MW API 异步查询
  const fetchMwStress = useCallback(async () => {
    if (!lowerWord || syllableCount <= 1 || staticStress) return;

    // 先查缓存
    const cached = getCachedStress(lowerWord);
    if (cached) {
      setMwStress(cached);
      return;
    }

    // 检查 MW 是否配置
    const mwConfig = getMerriamWebsterConfig();
    if (!mwConfig?.apiKey) return;

    try {
      const data = await fetchMwStressApi(lowerWord, mwConfig.apiKey);
      if (data.stress && Array.isArray(data.stress)) {
        setCachedStress(lowerWord, data.stress);
        setMwStress(data.stress);
      }
    } catch {
      // 静默失败，降级为无重音
    }
  }, [lowerWord, syllableCount, staticStress]);

  useEffect(() => {
    setMwStress(null);
    fetchMwStress();
  }, [fetchMwStress]);

  // 单音节：返回空数组（UI 据此隐藏音节区域）
  if (syllableCount <= 1) return [];

  // 选择最佳重音数据
  const stressData = staticStress ?? mwStress;

  // 无重音数据：原样返回
  if (!stressData) return syllables;

  // 标注重音
  return syllables.map((s, i) => ({
    ...s,
    stress: i < stressData.length ? stressData[i] : ("none" as const),
  }));
}
