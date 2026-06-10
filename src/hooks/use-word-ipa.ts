"use client";

import { useMemo } from "react";
import { getStaticIpaMap } from "@/lib/static-ipa-map";

const IPA_CACHE_KEY = "speakright_ipa_cache";

function getCachedIpa(word: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IPA_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, string>;
    return cache[word] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch IPA for a word with three-layer lookup:
 * 1. Static word bank (sync, ~800+ words)
 * 2. legacy localStorage cache (sync)
 *
 * @returns IPA string like "/ˈbjuːtɪfl/" or null if unavailable
 */
export function useWordIpa(word: string): string | null {
  const staticMap = useMemo(() => getStaticIpaMap(), []);
  const lowerWord = word.trim().toLowerCase();

  // Static lookup (sync)
  const staticIpa = lowerWord ? (staticMap.get(lowerWord) ?? null) : null;
  const cachedIpa = lowerWord && !staticIpa ? getCachedIpa(lowerWord) : null;

  return staticIpa ?? cachedIpa;
}
