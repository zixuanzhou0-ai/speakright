/**
 * Tauri-aware persistent store.
 * In Tauri: uses @tauri-apps/plugin-store (disk-backed, persists across updates).
 * In browser: falls back to localStorage.
 */

import type { LazyStore } from "@tauri-apps/plugin-store";

const isTauri = () =>
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

let storeInstance: LazyStore | null = null;

async function getStore(): Promise<LazyStore> {
  if (!storeInstance) {
    const { LazyStore } = await import("@tauri-apps/plugin-store");
    storeInstance = new LazyStore("speakright-settings.json");
  }
  return storeInstance;
}

/**
 * Get a value by key. Returns null if not found.
 */
export async function storeGet<T>(key: string): Promise<T | null> {
  if (!isTauri()) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  try {
    const store = await getStore();
    const val = await store.get<T>(key);
    return val ?? null;
  } catch {
    return null;
  }
}

/**
 * Set a value by key.
 */
export async function storeSet<T>(key: string, value: T): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
    return;
  }

  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
    // Also fire storage event for UI reactivity
    window.dispatchEvent(new StorageEvent("storage", { key }));
  } catch {
    // Fallback to localStorage if store fails
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }
}

/**
 * Delete a key.
 */
export async function storeDelete(key: string): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem(key);
    return;
  }

  try {
    const store = await getStore();
    await store.delete(key);
    await store.save();
  } catch {
    localStorage.removeItem(key);
  }
}

/**
 * Migrate existing localStorage data to Tauri store.
 * Call once on app startup in Tauri mode.
 */
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  if (!isTauri()) return;

  const store = await getStore();
  for (const key of keys) {
    const existing = await store.get(key);
    if (existing != null) continue; // Already migrated

    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        await store.set(key, JSON.parse(raw));
      } catch {
        // skip malformed entries
      }
    }
  }
  await store.save();
}
