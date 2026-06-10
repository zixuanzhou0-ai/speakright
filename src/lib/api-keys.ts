import { isTauriEnvironment } from "@/lib/tauri-runtime";
import {
  secureStoreDelete,
  secureStoreGet,
  secureStoreSet,
} from "@/lib/secure-store";
import { storeDelete, storeGet, storeSet } from "@/lib/tauri-store";
import type {
  AzureConfig,
  ElevenLabsConfig,
  LanguageConfig,
  LLMConfig,
  PronunciationConfig,
} from "@/types/api-keys";
import { normalizeLanguageId } from "@/lib/language-profiles";

export type CoachMode = "easy" | "normal" | "hard" | "strict";

const STORAGE_KEYS = {
  azure: "speakright_azure_config",
  elevenlabs: "speakright_elevenlabs_config",
  llm: "speakright_llm_config",
  pronunciation: "speakright_pronunciation_config",
  language: "speakright_language_config",
  coachMode: "speakright_coach_mode",
} as const;

const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);
export const API_KEY_STORAGE_KEYS = [
  STORAGE_KEYS.azure,
  STORAGE_KEYS.elevenlabs,
  STORAGE_KEYS.llm,
] as const;
export const APP_PREFERENCE_STORAGE_KEYS = [
  STORAGE_KEYS.language,
  STORAGE_KEYS.coachMode,
] as const;
export const API_KEY_STORAGE_ERROR_EVENT = "speakright:api-key-storage-error";
const runtimeCache = new Map<string, unknown>();
const SECRET_STORAGE_KEYS = new Set<string>(API_KEY_STORAGE_KEYS);
const DEFAULT_PRONUNCIATION_CONFIG: PronunciationConfig = { source: "youdao" };
const LANGUAGE_CONFIG_SNAPSHOTS: Record<LanguageConfig["languageId"], LanguageConfig> =
  {
    "en-US": { languageId: "en-US" },
    "es-ES": { languageId: "es-ES" },
    "fr-FR": { languageId: "fr-FR" },
    "ru-RU": { languageId: "ru-RU" },
  };

export interface ApiKeyStorageErrorDetail {
  key: string;
  operation: "save" | "delete" | "hydrate";
  message: string;
}

export interface ApiKeySummary {
  configured: number;
  totalSlots: number;
}

declare global {
  interface WindowEventMap {
    [API_KEY_STORAGE_ERROR_EVENT]: CustomEvent<ApiKeyStorageErrorDetail>;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "本机密钥存储失败";
}

function dispatchStorageError(
  key: string,
  operation: ApiKeyStorageErrorDetail["operation"],
  error: unknown,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ApiKeyStorageErrorDetail>(API_KEY_STORAGE_ERROR_EVENT, {
      detail: {
        key,
        operation,
        message: errorMessage(error),
      },
    }),
  );
}

function isSecretKey(key: string): boolean {
  return SECRET_STORAGE_KEYS.has(key);
}

async function persistentGet<T>(key: string): Promise<T | null> {
  return isSecretKey(key) ? secureStoreGet<T>(key) : storeGet<T>(key);
}

async function persistentSet<T>(key: string, value: T): Promise<void> {
  if (isSecretKey(key)) {
    await secureStoreSet(key, value);
  } else {
    await storeSet(key, value);
  }
}

async function persistentDelete(key: string): Promise<void> {
  if (isSecretKey(key)) {
    await secureStoreDelete(key);
  } else {
    await storeDelete(key);
  }
}

function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  if (isTauriEnvironment()) {
    return (runtimeCache.get(key) as T | undefined) ?? null;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function hasTextSecret(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function setItem<T>(key: string, value: T): void {
  const tauri = isTauriEnvironment();
  const hadRuntimeValue = runtimeCache.has(key);
  const previousRuntimeValue = runtimeCache.get(key);
  const previousLocalValue =
    typeof window === "undefined" ? null : localStorage.getItem(key);

  if (tauri) {
    runtimeCache.set(key, value);
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
  void persistentSet(key, value).catch((error: unknown) => {
    if (tauri) {
      if (hadRuntimeValue) {
        runtimeCache.set(key, previousRuntimeValue);
      } else {
        runtimeCache.delete(key);
      }
      if (previousLocalValue !== null) {
        localStorage.setItem(key, previousLocalValue);
      } else {
        localStorage.removeItem(key);
      }
      window.dispatchEvent(new StorageEvent("storage", { key }));
    }
    dispatchStorageError(key, "save", error);
  });
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/**
 * Remove a key from every runtime and persistent backend.
 */
export async function clearItem(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  const hadRuntimeValue = runtimeCache.has(key);
  const previousRuntimeValue = runtimeCache.get(key);
  const previousLocalValue = localStorage.getItem(key);
  runtimeCache.delete(key);
  localStorage.removeItem(key);
  try {
    await persistentDelete(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch (error) {
    if (hadRuntimeValue) {
      runtimeCache.set(key, previousRuntimeValue);
    }
    if (previousLocalValue !== null) {
      localStorage.setItem(key, previousLocalValue);
    }
    dispatchStorageError(key, "delete", error);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    throw error;
  }
}

/**
 * Hydrate app settings from the persistent desktop backends on startup.
 *
 * Behavior:
 * - In Tauri, secret keys load from the OS credential store into runtimeCache.
 * - In Tauri, non-secret settings load from the Tauri settings store.
 * - Legacy localStorage values are promoted to the right persistent backend and
 *   then removed from localStorage when the app is running under Tauri.
 * - Each changed key dispatches a storage event so useSyncExternalStore
 *   consumers re-render with the freshly hydrated data.
 *
 * Safe to call multiple times — idempotent by key.
 * In non-Tauri (browser dev) mode localStorage remains the persistence backend.
 */
export async function hydrateKeys(): Promise<void> {
  if (typeof window === "undefined") return;
  const tauri = isTauriEnvironment();

  for (const key of ALL_STORAGE_KEYS) {
    try {
      const storeValue = await persistentGet<unknown>(key);
      const localRaw = localStorage.getItem(key);

      if (storeValue !== null && storeValue !== undefined) {
        if (tauri) {
          runtimeCache.set(key, storeValue);
          localStorage.removeItem(key);
          window.dispatchEvent(new StorageEvent("storage", { key }));
        } else {
          const serialized = JSON.stringify(storeValue);
          if (serialized !== localRaw) {
            localStorage.setItem(key, serialized);
            window.dispatchEvent(new StorageEvent("storage", { key }));
          }
        }
      } else if (localRaw) {
        // First-run migration: promote legacy localStorage value to Tauri store.
        try {
          const parsed = JSON.parse(localRaw);
          await persistentSet(key, parsed);
          if (tauri) {
            runtimeCache.set(key, parsed);
            localStorage.removeItem(key);
            window.dispatchEvent(new StorageEvent("storage", { key }));
          }
        } catch (error) {
          dispatchStorageError(key, "hydrate", error);
          // Malformed legacy value — skip rather than corrupt the store.
        }
      } else if (tauri && isSecretKey(key)) {
        const legacyStoreValue = await storeGet<unknown>(key);
        if (legacyStoreValue !== null && legacyStoreValue !== undefined) {
          await secureStoreSet(key, legacyStoreValue);
          await storeDelete(key);
          runtimeCache.set(key, legacyStoreValue);
          window.dispatchEvent(new StorageEvent("storage", { key }));
        }
      }
    } catch (error) {
      dispatchStorageError(key, "hydrate", error);
      // Never let a single bad key block the rest of hydration.
    }
  }
}

// Azure
export function getAzureConfig(): AzureConfig | null {
  return getItem<AzureConfig>(STORAGE_KEYS.azure);
}

export function setAzureConfig(config: AzureConfig): void {
  setItem(STORAGE_KEYS.azure, config);
}

// ElevenLabs
export function getElevenLabsConfig(): ElevenLabsConfig | null {
  return getItem<ElevenLabsConfig>(STORAGE_KEYS.elevenlabs);
}

export function setElevenLabsConfig(config: ElevenLabsConfig): void {
  setItem(STORAGE_KEYS.elevenlabs, config);
}

// LLM
export function getLlmConfig(): LLMConfig | null {
  return getItem<LLMConfig>(STORAGE_KEYS.llm);
}

export function setLlmConfig(config: LLMConfig): void {
  setItem(STORAGE_KEYS.llm, config);
}

export function getApiKeySummary(): ApiKeySummary {
  const configs = [
    hasTextSecret(getAzureConfig()?.subscriptionKey),
    hasTextSecret(getElevenLabsConfig()?.apiKey),
    hasTextSecret(getLlmConfig()?.apiKey),
  ];
  return {
    configured: configs.filter(Boolean).length,
    totalSlots: API_KEY_STORAGE_KEYS.length,
  };
}

// Pronunciation source
export function getPronunciationConfig(): PronunciationConfig {
  return DEFAULT_PRONUNCIATION_CONFIG;
}

export function setPronunciationConfig(config: PronunciationConfig): void {
  setItem(STORAGE_KEYS.pronunciation, { source: config.source });
}

// Learning language
export function getLanguageConfig(): LanguageConfig {
  const saved =
    getItem<LanguageConfig & { targetLanguage?: unknown }>(STORAGE_KEYS.language);
  return LANGUAGE_CONFIG_SNAPSHOTS[
    normalizeLanguageId(saved?.languageId ?? saved?.targetLanguage)
  ];
}

export function setLanguageConfig(config: LanguageConfig): void {
  setItem(STORAGE_KEYS.language, {
    languageId: normalizeLanguageId(config.languageId),
  });
}

// Coach mode
export function getCoachMode(): CoachMode {
  return getItem<CoachMode>(STORAGE_KEYS.coachMode) ?? "normal";
}

export function setCoachMode(mode: CoachMode): void {
  setItem(STORAGE_KEYS.coachMode, mode);
}

// For useSyncExternalStore
export function subscribeToStorage(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (
      e.key === null ||
      e.key === STORAGE_KEYS.azure ||
      e.key === STORAGE_KEYS.elevenlabs ||
      e.key === STORAGE_KEYS.llm ||
      e.key === STORAGE_KEYS.pronunciation ||
      e.key === STORAGE_KEYS.language ||
      e.key === STORAGE_KEYS.coachMode
    ) {
      callback();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
