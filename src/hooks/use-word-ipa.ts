"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMwStress } from "@/lib/api-client";
import { getStaticIpaMap } from "@/lib/static-ipa-map";
import { useMerriamWebsterConfig } from "./use-api-keys";

const IPA_CACHE_KEY = "speakright_ipa_cache";
const DEBOUNCE_MS = 300;

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

function setCachedIpa(word: string, ipa: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(IPA_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    cache[word] = ipa;
    localStorage.setItem(IPA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Fetch IPA for a word with three-layer lookup:
 * 1. Static word bank (sync, ~800+ words)
 * 2. localStorage cache (sync)
 * 3. MW stress API (async, debounced 300ms)
 *
 * @returns IPA string like "/ˈbjuːtɪfl/" or null if unavailable
 */
export function useWordIpa(word: string): string | null {
  const staticMap = useMemo(() => getStaticIpaMap(), []);
  const [mwIpa, setMwIpa] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mwConfig = useMerriamWebsterConfig();
  const lowerWord = word.trim().toLowerCase();

  // Static lookup (sync)
  const staticIpa = lowerWord ? (staticMap.get(lowerWord) ?? null) : null;

  // MW API lookup (debounced)
  useEffect(() => {
    setMwIpa(null);

    if (!lowerWord || staticIpa) return;

    // Check localStorage cache first
    const cached = getCachedIpa(lowerWord);
    if (cached) {
      setMwIpa(cached);
      return;
    }

    // Debounced MW API call
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (!mwConfig?.apiKey) return;

      try {
        const data = await fetchMwStress(lowerWord, mwConfig.apiKey);
        if (data.mw) {
          const displayIpa = `/${data.mw}/`;
          setCachedIpa(lowerWord, displayIpa);
          setMwIpa(displayIpa);
        }
      } catch {
        // silent fail
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lowerWord, mwConfig?.apiKey, staticIpa]);

  return staticIpa ?? mwIpa;
}
