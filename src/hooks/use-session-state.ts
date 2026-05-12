"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Drop-in replacement for useState that persists to sessionStorage.
 *
 * - On mount: reads from sessionStorage (if exists), otherwise uses initialValue
 * - On every state change: writes to sessionStorage
 * - sessionStorage auto-clears when browser tab closes
 *
 * @param key sessionStorage key (use page-scoped prefix like "sentences:speed")
 * @param initialValue default value when nothing is saved
 */
export function useSessionState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);

  const initialValueRef = useRef(initialValue);
  const loadedKeyRef = useRef<string | null>(null);
  const skipInitialPersistRef = useRef(false);

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  useEffect(() => {
    const fallback = initialValueRef.current;
    let hasSavedValue = false;
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        hasSavedValue = true;
        setState(JSON.parse(saved) as T);
      } else {
        setState(fallback);
      }
    } catch {
      setState(fallback);
    }

    loadedKeyRef.current = key;
    skipInitialPersistRef.current = hasSavedValue;
  }, [key]);

  useEffect(() => {
    if (loadedKeyRef.current !== key) return;
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }

    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // sessionStorage full or unavailable — ignore
    }
  }, [key, state]);

  return [state, setState];
}

/**
 * Save a value to sessionStorage (for hook state that can't use useSessionState directly)
 */
export function saveSession<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Read a value from sessionStorage
 */
export function loadSession<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Clear all session state for a given prefix
 */
export function clearSessionPrefix(prefix: string): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keysToRemove.push(k);
  }
  for (const k of keysToRemove) {
    sessionStorage.removeItem(k);
  }
}
