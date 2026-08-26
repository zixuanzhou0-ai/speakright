const DB_NAME = "speakright_tts_cache";
const STORE_NAME = "tts_audio";
const MAX_ENTRIES = 50;
const DB_VERSION = 1;
const DEFAULT_LANGUAGE_ID = "en-US";
const CACHE_KEY_NAMESPACE = "v3";
const CACHE_EPOCH_STORAGE_KEY = "speakright-cache-epoch:tts";
const CACHE_EPOCH_RECORD_KEY = "__speakright_tts_cache_epoch__";
const CACHE_INVALIDATED_EVENT = "speakright:tts-cache-invalidated";

let localCacheEpoch: TtsCacheEpochToken | null = null;

interface TtsCacheEntry {
  cacheKey: string;
  audioBlob: Blob;
  alignment: unknown;
  createdAt: number;
  textLength: number;
}

interface TtsCacheEpochRecord {
  cacheKey: typeof CACHE_EPOCH_RECORD_KEY;
  epoch: TtsCacheEpochToken;
}

function isCacheEpochRecord(value: unknown): value is TtsCacheEpochRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TtsCacheEpochRecord>;
  return (
    record.cacheKey === CACHE_EPOCH_RECORD_KEY &&
    typeof record.epoch === "string" &&
    record.epoch.length > 0 &&
    record.epoch.length <= 128
  );
}

function isTtsCacheEntry(value: unknown): value is TtsCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<TtsCacheEntry>;
  return (
    typeof entry.cacheKey === "string" &&
    entry.cacheKey !== CACHE_EPOCH_RECORD_KEY &&
    typeof entry.createdAt === "number" &&
    Number.isFinite(entry.createdAt)
  );
}

function readSharedCacheEpoch(): TtsCacheEpochToken | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem(CACHE_EPOCH_STORAGE_KEY);
    return stored && stored.length <= 128 ? stored : null;
  } catch {
    return null;
  }
}

function getCacheEpoch(): TtsCacheEpochToken {
  localCacheEpoch = readSharedCacheEpoch() ?? localCacheEpoch ?? "initial";
  return localCacheEpoch;
}

function createCacheEpochToken(): TtsCacheEpochToken {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function publishCacheEpoch(
  token: TtsCacheEpochToken,
  notifyCurrentDocument = false,
): void {
  localCacheEpoch = token;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CACHE_EPOCH_STORAGE_KEY, token);
    }
  } catch {
    // The in-memory epoch still protects this tab when storage is unavailable.
  }
  if (notifyCurrentDocument && typeof window !== "undefined") {
    window.dispatchEvent(new Event(CACHE_INVALIDATED_EVENT));
  }
}

function advanceCacheEpoch(): TtsCacheEpochToken {
  const token = createCacheEpochToken();
  publishCacheEpoch(token, true);
  return token;
}

export type TtsCacheEpochToken = string;

export function captureTtsCacheEpoch(): TtsCacheEpochToken {
  return getCacheEpoch();
}

export function subscribeToTtsCacheInvalidation(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handleCurrentDocument = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === CACHE_EPOCH_STORAGE_KEY &&
      event.newValue !== event.oldValue
    ) {
      callback();
    }
  };
  window.addEventListener(CACHE_INVALIDATED_EVENT, handleCurrentDocument);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CACHE_INVALIDATED_EVENT, handleCurrentDocument);
    window.removeEventListener("storage", handleStorage);
  };
}

export function buildCacheKey(
  text: string,
  voiceIdentity: string,
  speed: number,
  languageId = DEFAULT_LANGUAGE_ID,
): string {
  const normalizedText = text.trim().normalize("NFC");
  return `${CACHE_KEY_NAMESPACE}:${languageId}:${normalizedText}:${voiceIdentity}:${speed.toFixed(2)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getTtsFromCache(
  text: string,
  voiceIdentity: string,
  speed: number,
  languageId = DEFAULT_LANGUAGE_ID,
): Promise<TtsCacheEntry | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const key = buildCacheKey(text, voiceIdentity, speed, languageId);
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    let result: TtsCacheEntry | null = null;
    req.onsuccess = () => {
      result = req.result ?? null;
    };
    await waitForTransaction(tx);
    return result;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

export async function setTtsToCache(
  text: string,
  voiceIdentity: string,
  speed: number,
  audioBlob: Blob,
  alignment: unknown,
  languageId = DEFAULT_LANGUAGE_ID,
  cacheEpochToken: TtsCacheEpochToken = captureTtsCacheEpoch(),
): Promise<void> {
  const writeEpoch = cacheEpochToken;
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const key = buildCacheKey(text, voiceIdentity, speed, languageId);

    const entry: TtsCacheEntry = {
      cacheKey: key,
      audioBlob,
      alignment,
      createdAt: Date.now(),
      textLength: text.length,
    };

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const epochRequest = store.get(CACHE_EPOCH_RECORD_KEY);
    const entriesRequest = store.getAll();
    let epochLoaded = false;
    let entriesLoaded = false;
    const commitIfCurrent = () => {
      if (!epochLoaded || !entriesLoaded) return;
      const persistedEpoch = isCacheEpochRecord(epochRequest.result)
        ? epochRequest.result.epoch
        : writeEpoch;
      if (persistedEpoch !== writeEpoch) return;

      if (!isCacheEpochRecord(epochRequest.result)) {
        store.put({
          cacheKey: CACHE_EPOCH_RECORD_KEY,
          epoch: writeEpoch,
        } satisfies TtsCacheEpochRecord);
      }

      const allEntries = Array.isArray(entriesRequest.result)
        ? entriesRequest.result.filter(isTtsCacheEntry)
        : [];
      if (allEntries.length >= MAX_ENTRIES) {
        const sorted = allEntries.sort((a, b) => a.createdAt - b.createdAt);
        const toRemove = sorted.slice(0, allEntries.length - MAX_ENTRIES + 1);
        for (const old of toRemove) {
          store.delete(old.cacheKey);
        }
      }

      store.put(entry);
    };
    epochRequest.onsuccess = () => {
      epochLoaded = true;
      commitIfCurrent();
    };
    entriesRequest.onsuccess = () => {
      entriesLoaded = true;
      commitIfCurrent();
    };
    await waitForTransaction(tx);
  } catch {
    // Graceful fallback if IndexedDB unavailable (e.g., private browsing)
  } finally {
    db?.close();
  }
}

export async function deleteTtsFromCache(
  text: string,
  voiceIdentity: string,
  speed: number,
  languageId = DEFAULT_LANGUAGE_ID,
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const key = buildCacheKey(text, voiceIdentity, speed, languageId);
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await waitForTransaction(tx);
  } catch {
    // Graceful fallback if IndexedDB is unavailable.
  } finally {
    db?.close();
  }
}

export async function clearTtsCache(): Promise<void> {
  // Immediately invalidate requests already in flight. The committed token is
  // deliberately different so requests started while clear is pending cannot
  // become valid again if concurrent tabs complete their clears out of order.
  advanceCacheEpoch();
  const clearEpoch = createCacheEpochToken();
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    store.put({
      cacheKey: CACHE_EPOCH_RECORD_KEY,
      epoch: clearEpoch,
    } satisfies TtsCacheEpochRecord);
    await waitForTransaction(tx);
    // Re-publish after the serialized IDB transaction commits so every tab
    // converges on the generation belonging to the last completed clear.
    publishCacheEpoch(clearEpoch, true);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("TTS cache could not be cleared");
  } finally {
    db?.close();
  }
}
