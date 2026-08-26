import { normalizeLanguageId } from "@/lib/language-profiles";
import type {
  AzureConfig,
  ElevenLabsConfig,
  LanguageConfig,
  LLMConfig,
  MimoTtsConfig,
  MiniMaxTtsConfig,
  PronunciationConfig,
  StandardTtsConfig,
  VertexGeminiTtsConfig,
} from "@/types/api-keys";

export type CoachMode = "easy" | "normal" | "hard" | "strict";

const STORAGE_KEYS = {
  azure: "speakright_azure_config",
  elevenlabs: "speakright_elevenlabs_config",
  minimaxTts: "speakright_minimax_tts_config",
  mimoTts: "speakright_mimo_tts_config",
  standardTts: "speakright_standard_tts_config",
  vertexGeminiTts: "speakright_vertex_gemini_tts_config",
  llm: "speakright_llm_config",
  pronunciation: "speakright_pronunciation_config",
  language: "speakright_language_config",
  coachMode: "speakright_coach_mode",
} as const;

const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);
export const API_KEY_STORAGE_KEYS = [
  STORAGE_KEYS.azure,
  STORAGE_KEYS.elevenlabs,
  STORAGE_KEYS.minimaxTts,
  STORAGE_KEYS.mimoTts,
  STORAGE_KEYS.llm,
] as const;
export const APP_PREFERENCE_STORAGE_KEYS = [
  STORAGE_KEYS.standardTts,
  STORAGE_KEYS.vertexGeminiTts,
  STORAGE_KEYS.language,
  STORAGE_KEYS.coachMode,
] as const;
export const API_KEY_STORAGE_ERROR_EVENT = "speakright:api-key-storage-error";
export const API_KEY_PERSISTENCE_STORAGE_KEY = "speakright_api_key_persistence";
export type ApiKeyPersistence = "session" | "local";
const DEFAULT_PRONUNCIATION_CONFIG: PronunciationConfig = { source: "youdao" };
const DEFAULT_STANDARD_TTS_CONFIG: StandardTtsConfig = {
  provider: "elevenlabs",
};
const DEFAULT_VERTEX_GEMINI_TTS_CONFIG: VertexGeminiTtsConfig = {
  voiceName: "Kore",
};
let vertexGeminiTtsSnapshot = DEFAULT_VERTEX_GEMINI_TTS_CONFIG;
const SECRET_STORAGE_KEYS = new Set<string>(API_KEY_STORAGE_KEYS);
const LANGUAGE_CONFIG_SNAPSHOTS: Record<
  LanguageConfig["languageId"],
  LanguageConfig
> = {
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

interface JsonSnapshot {
  raw: string;
  value: unknown;
}

declare global {
  interface WindowEventMap {
    [API_KEY_STORAGE_ERROR_EVENT]: CustomEvent<ApiKeyStorageErrorDetail>;
  }
}

const jsonSnapshotCache = new Map<string, JsonSnapshot>();

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

function getBrowserStorage(kind: ApiKeyPersistence): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getApiKeyPersistence(): ApiKeyPersistence {
  if (typeof window === "undefined") return "session";
  return localStorage.getItem(API_KEY_PERSISTENCE_STORAGE_KEY) === "local"
    ? "local"
    : "session";
}

function getTargetStorageForKey(key: string): Storage | null {
  return getBrowserStorage(getTargetStorageKindForKey(key));
}

function getFallbackStorageForKey(key: string): Storage | null {
  const kind = getFallbackStorageKindForKey(key);
  return kind ? getBrowserStorage(kind) : null;
}

function getTargetStorageKindForKey(key: string): ApiKeyPersistence {
  if (!isSecretKey(key)) return "local";
  return getApiKeyPersistence();
}

function getFallbackStorageKindForKey(key: string): ApiKeyPersistence | null {
  if (!isSecretKey(key)) return null;
  return getApiKeyPersistence() === "local" ? "session" : "local";
}

function getSnapshotCacheKey(kind: ApiKeyPersistence, key: string): string {
  return `${kind}:${key}`;
}

function clearSnapshotCache(kind: ApiKeyPersistence, key: string): void {
  jsonSnapshotCache.delete(getSnapshotCacheKey(kind, key));
}

function readStorageJson<T>(
  storage: Storage | null,
  kind: ApiKeyPersistence,
  key: string,
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    const cacheKey = getSnapshotCacheKey(kind, key);
    if (!raw) {
      jsonSnapshotCache.delete(cacheKey);
      return null;
    }
    const cached = jsonSnapshotCache.get(cacheKey);
    if (cached?.raw === raw) return cached.value as T;
    const value = JSON.parse(raw) as T;
    jsonSnapshotCache.set(cacheKey, { raw, value });
    return value;
  } catch {
    clearSnapshotCache(kind, key);
    return null;
  }
}

function removeFromStorage(
  storage: Storage | null,
  kind: ApiKeyPersistence,
  key: string,
  strict = false,
): void {
  try {
    if (!storage) {
      if (strict) throw new Error("浏览器本机存储暂时不可用");
      return;
    }
    storage.removeItem(key);
  } catch (error) {
    if (strict) throw error;
    // Persistence migration cleanup remains best effort.
  } finally {
    clearSnapshotCache(kind, key);
  }
}

function writeStorageJson<T>(
  storage: Storage | null,
  kind: ApiKeyPersistence,
  key: string,
  value: T,
) {
  if (!storage) {
    throw new Error(
      "\u6d4f\u89c8\u5668\u672c\u673a\u5b58\u50a8\u6682\u65f6\u4e0d\u53ef\u7528",
    );
  }
  const raw = JSON.stringify(value);
  storage.setItem(key, raw);
  jsonSnapshotCache.set(getSnapshotCacheKey(kind, key), { raw, value });
}

function dispatchKeyStorageEvent(key: string): void {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

function readAnyApiKeyValue<T>(key: string): T | null {
  return (
    readStorageJson<T>(getBrowserStorage("session"), "session", key) ??
    readStorageJson<T>(getBrowserStorage("local"), "local", key)
  );
}

function moveApiKeyStorage(key: string, mode: ApiKeyPersistence): void {
  const value = readAnyApiKeyValue<unknown>(key);
  const target = getBrowserStorage(mode);
  const otherKind = mode === "local" ? "session" : "local";
  const other = getBrowserStorage(otherKind);

  if (value !== null && value !== undefined) {
    writeStorageJson(target, mode, key, value);
  }
  removeFromStorage(other, otherKind, key);
  dispatchKeyStorageEvent(key);
}

export function setApiKeyPersistence(mode: ApiKeyPersistence): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY_PERSISTENCE_STORAGE_KEY, mode);
  for (const key of API_KEY_STORAGE_KEYS) {
    moveApiKeyStorage(key, mode);
  }
  dispatchKeyStorageEvent(API_KEY_PERSISTENCE_STORAGE_KEY);
}

function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const targetKind = getTargetStorageKindForKey(key);
  const fallbackKind = getFallbackStorageKindForKey(key);
  return (
    readStorageJson<T>(getTargetStorageForKey(key), targetKind, key) ??
    (fallbackKind
      ? readStorageJson<T>(getFallbackStorageForKey(key), fallbackKind, key)
      : null)
  );
}

function hasTextSecret(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  const targetKind = getTargetStorageKindForKey(key);
  const fallbackKind = getFallbackStorageKindForKey(key);
  const target = getBrowserStorage(targetKind);
  const fallback = fallbackKind ? getBrowserStorage(fallbackKind) : null;
  try {
    writeStorageJson(target, targetKind, key, value);
    if (fallbackKind) {
      removeFromStorage(fallback, fallbackKind, key);
    }
    dispatchKeyStorageEvent(key);
  } catch (error) {
    dispatchStorageError(key, "save", error);
    throw error;
  }
}

/**
 * Remove a key from Browser Edition local storage.
 */
export async function clearItem(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    let deletionError: unknown = null;
    for (const kind of ["session", "local"] as const) {
      try {
        removeFromStorage(getBrowserStorage(kind), kind, key, true);
      } catch (error) {
        deletionError ??= error;
      }
    }
    dispatchKeyStorageEvent(key);
    if (deletionError) throw deletionError;
  } catch (error) {
    dispatchStorageError(key, "delete", error);
    throw error;
  }
}

/**
 * Validate Browser Edition local settings on startup.
 */
export async function hydrateKeys(): Promise<void> {
  if (typeof window === "undefined") return;

  for (const key of ALL_STORAGE_KEYS) {
    for (const storage of [
      getBrowserStorage("session"),
      getBrowserStorage("local"),
    ]) {
      if (!storage) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        JSON.parse(raw);
      } catch (error) {
        dispatchStorageError(key, "hydrate", error);
      }
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

// MiniMax Speech TTS (BYOK)
export function getMiniMaxTtsConfig(): MiniMaxTtsConfig | null {
  return getItem<MiniMaxTtsConfig>(STORAGE_KEYS.minimaxTts);
}

export function setMiniMaxTtsConfig(config: MiniMaxTtsConfig): void {
  setItem(STORAGE_KEYS.minimaxTts, config);
}

// Xiaomi MiMo TTS (BYOK)
export function getMimoTtsConfig(): MimoTtsConfig | null {
  return getItem<MimoTtsConfig>(STORAGE_KEYS.mimoTts);
}

export function setMimoTtsConfig(config: MimoTtsConfig): void {
  setItem(STORAGE_KEYS.mimoTts, config);
}

// Standard demonstration TTS provider (non-sensitive preference)
export function getStandardTtsConfig(): StandardTtsConfig {
  const saved = getItem<{ provider?: unknown }>(STORAGE_KEYS.standardTts);
  if (
    saved?.provider === "elevenlabs" ||
    saved?.provider === "minimax" ||
    saved?.provider === "mimo" ||
    saved?.provider === "hermes-grok" ||
    saved?.provider === "vertex-gemini"
  ) {
    return saved as StandardTtsConfig;
  }
  return DEFAULT_STANDARD_TTS_CONFIG;
}

export function setStandardTtsConfig(config: StandardTtsConfig): void {
  setItem(STORAGE_KEYS.standardTts, {
    provider: [
      "elevenlabs",
      "minimax",
      "mimo",
      "hermes-grok",
      "vertex-gemini",
    ].includes(config.provider)
      ? config.provider
      : "elevenlabs",
  });
}

export function getVertexGeminiTtsConfig(): VertexGeminiTtsConfig {
  const saved = getItem<{ voiceName?: unknown }>(STORAGE_KEYS.vertexGeminiTts);
  const voiceName =
    typeof saved?.voiceName === "string" ? saved.voiceName.trim() : "";
  if (!voiceName) return DEFAULT_VERTEX_GEMINI_TTS_CONFIG;
  if (vertexGeminiTtsSnapshot.voiceName !== voiceName) {
    vertexGeminiTtsSnapshot = { voiceName };
  }
  return vertexGeminiTtsSnapshot;
}

export function setVertexGeminiTtsConfig(config: VertexGeminiTtsConfig): void {
  setItem(STORAGE_KEYS.vertexGeminiTts, {
    voiceName:
      config.voiceName.trim() || DEFAULT_VERTEX_GEMINI_TTS_CONFIG.voiceName,
  });
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
    hasTextSecret(getMiniMaxTtsConfig()?.apiKey),
    hasTextSecret(getMimoTtsConfig()?.apiKey),
    hasTextSecret(getLlmConfig()?.apiKey),
  ];
  return {
    configured: configs.filter(Boolean).length,
    totalSlots: API_KEY_STORAGE_KEYS.length,
  };
}

// Pronunciation source
export function getPronunciationConfig(): PronunciationConfig {
  return (
    getItem<PronunciationConfig>(STORAGE_KEYS.pronunciation) ??
    DEFAULT_PRONUNCIATION_CONFIG
  );
}

export function setPronunciationConfig(config: PronunciationConfig): void {
  setItem(STORAGE_KEYS.pronunciation, { source: config.source });
}

// Learning language
export function getLanguageConfig(): LanguageConfig {
  const saved = getItem<LanguageConfig & { targetLanguage?: unknown }>(
    STORAGE_KEYS.language,
  );
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
      e.key === STORAGE_KEYS.minimaxTts ||
      e.key === STORAGE_KEYS.mimoTts ||
      e.key === STORAGE_KEYS.standardTts ||
      e.key === STORAGE_KEYS.vertexGeminiTts ||
      e.key === STORAGE_KEYS.llm ||
      e.key === STORAGE_KEYS.pronunciation ||
      e.key === STORAGE_KEYS.language ||
      e.key === STORAGE_KEYS.coachMode ||
      e.key === API_KEY_PERSISTENCE_STORAGE_KEY
    ) {
      callback();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
