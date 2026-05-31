"use client";

import { useSyncExternalStore } from "react";
import {
  getAzureConfig,
  getElevenLabsConfig,
  getLlmConfig,
  getMerriamWebsterConfig,
  getPronunciationConfig,
  subscribeToStorage,
} from "@/lib/api-keys";

const emptySubscribe = () => () => {};
const serverSnapshot = () => null;

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
    getPronunciationConfig,
  );
}
