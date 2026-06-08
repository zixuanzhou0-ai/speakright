"use client";

import { useSyncExternalStore } from "react";
import {
  getAzureConfig,
  getCoachMode,
  getElevenLabsConfig,
  getLanguageConfig,
  getLlmConfig,
  getMerriamWebsterConfig,
  getPronunciationConfig,
  subscribeToStorage,
} from "@/lib/api-keys";
import { DEFAULT_LANGUAGE_CONFIG } from "@/lib/language-profiles";
import type { PronunciationConfig } from "@/types/api-keys";

const emptySubscribe = () => () => {};
const serverSnapshot = () => null;
const pronunciationServerSnapshot = (): PronunciationConfig => ({ source: "youdao" });
const languageServerSnapshot = () => DEFAULT_LANGUAGE_CONFIG;
const coachModeServerSnapshot = () => "normal" as const;

export function useAzureConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getAzureConfig,
    () => serverSnapshot(),
  );
}

export function useElevenLabsConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getElevenLabsConfig,
    () => serverSnapshot(),
  );
}

export function useLlmConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getLlmConfig,
    () => serverSnapshot(),
  );
}

export function useMerriamWebsterConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getMerriamWebsterConfig,
    () => serverSnapshot(),
  );
}

export function usePronunciationConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getPronunciationConfig,
    pronunciationServerSnapshot,
  );
}

export function useLanguageConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getLanguageConfig,
    languageServerSnapshot,
  );
}

export function useCoachMode() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getCoachMode,
    coachModeServerSnapshot,
  );
}
