"use client";

import { useSyncExternalStore } from "react";
import {
  getAzureConfig,
  getCoachMode,
  getElevenLabsConfig,
  getLanguageConfig,
  getLlmConfig,
  getPronunciationConfig,
  getStandardTtsConfig,
  getVertexGeminiTtsConfig,
  subscribeToStorage,
} from "@/lib/api-keys";
import { DEFAULT_LANGUAGE_CONFIG } from "@/lib/language-profiles";
import type {
  PronunciationConfig,
  StandardTtsConfig,
  VertexGeminiTtsConfig,
} from "@/types/api-keys";

const emptySubscribe = () => () => {};
const serverSnapshot = () => null;
const pronunciationServerSnapshot = (): PronunciationConfig => ({
  source: "youdao",
});
const STANDARD_TTS_SERVER_SNAPSHOT: StandardTtsConfig = {
  provider: "elevenlabs",
};
const standardTtsServerSnapshot = () => STANDARD_TTS_SERVER_SNAPSHOT;
const VERTEX_GEMINI_TTS_SERVER_SNAPSHOT: VertexGeminiTtsConfig = {
  voiceName: "Kore",
};
const vertexGeminiTtsServerSnapshot = () =>
  VERTEX_GEMINI_TTS_SERVER_SNAPSHOT;
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

export function useStandardTtsConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getStandardTtsConfig,
    standardTtsServerSnapshot,
  );
}

export function useVertexGeminiTtsConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getVertexGeminiTtsConfig,
    vertexGeminiTtsServerSnapshot,
  );
}

export function useLlmConfig() {
  return useSyncExternalStore(
    typeof window !== "undefined" ? subscribeToStorage : emptySubscribe,
    getLlmConfig,
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
