import { storeDelete, storeGet, storeSet } from "@/lib/tauri-store";
import type {
  AzureConfig,
  ElevenLabsConfig,
  LLMConfig,
  MerriamWebsterConfig,
  PronunciationConfig,
} from "@/types/api-keys";

export type CoachMode = "easy" | "normal" | "hard" | "strict";

const STORAGE_KEYS = {
  azure: "speakright_azure_config",
  elevenlabs: "speakright_elevenlabs_config",
  llm: "speakright_llm_config",
  merriamWebster: "speakright_mw_config",
  pronunciation: "speakright_pronunciation_config",
  coachMode: "speakright_coach_mode",
} as const;

const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);

function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
  // Write-through to Tauri store for persistence across app updates
  // and XSS-resilient storage. Fire-and-forget — failure falls back
  // gracefully inside storeSet.
  void storeSet(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/**
 * Remove a key from both localStorage and Tauri store.
 */
export function clearItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
  void storeDelete(key);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/**
 * Hydrate localStorage from Tauri store on app startup.
 *
 * Behavior:
 * - If Tauri store has a value for a key → copy to localStorage (hot read cache)
 * - If Tauri store is empty but localStorage has a value → migrate localStorage → store
 * - After each write, dispatch a storage event so useSyncExternalStore consumers
 *   re-render with the freshly hydrated data.
 *
 * Safe to call multiple times — idempotent by key.
 * In non-Tauri (browser dev) mode this is a no-op because storeGet returns
 * the same localStorage it's reading.
 */
export async function hydrateKeys(): Promise<void> {
  if (typeof window === "undefined") return;

  for (const key of ALL_STORAGE_KEYS) {
    try {
      const storeValue = await storeGet<unknown>(key);
      const localRaw = localStorage.getItem(key);

      if (storeValue !== null && storeValue !== undefined) {
        // Tauri store is the source of truth on disk.
        const serialized = JSON.stringify(storeValue);
        if (serialized !== localRaw) {
          localStorage.setItem(key, serialized);
          window.dispatchEvent(new StorageEvent("storage", { key }));
        }
      } else if (localRaw) {
        // First-run migration: promote legacy localStorage value to Tauri store.
        try {
          const parsed = JSON.parse(localRaw);
          await storeSet(key, parsed);
        } catch {
          // Malformed legacy value — skip rather than corrupt the store.
        }
      }
    } catch {
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

// Merriam-Webster
export function getMerriamWebsterConfig(): MerriamWebsterConfig | null {
  return getItem<MerriamWebsterConfig>(STORAGE_KEYS.merriamWebster);
}

export function setMerriamWebsterConfig(config: MerriamWebsterConfig): void {
  setItem(STORAGE_KEYS.merriamWebster, config);
}

// Pronunciation source
export function getPronunciationConfig(): PronunciationConfig {
  return (
    getItem<PronunciationConfig>(STORAGE_KEYS.pronunciation) ?? {
      source: "youdao",
    }
  );
}

export function setPronunciationConfig(config: PronunciationConfig): void {
  setItem(STORAGE_KEYS.pronunciation, config);
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
      e.key === STORAGE_KEYS.merriamWebster ||
      e.key === STORAGE_KEYS.pronunciation ||
      e.key === STORAGE_KEYS.coachMode
    ) {
      callback();
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
