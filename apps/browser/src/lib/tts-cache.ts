const DB_NAME = "speakright_tts_cache";
const STORE_NAME = "tts_audio";
const MAX_ENTRIES = 50;
const DB_VERSION = 1;
const DEFAULT_LANGUAGE_ID = "en-US";
const CACHE_KEY_NAMESPACE = "v2";

interface TtsCacheEntry {
  cacheKey: string;
  audioBlob: Blob;
  alignment: unknown;
  createdAt: number;
  textLength: number;
}

export function buildCacheKey(
  text: string,
  voiceIdentity: string,
  speed: number,
  languageId = DEFAULT_LANGUAGE_ID,
): string {
  return `${CACHE_KEY_NAMESPACE}:${languageId}:${text.trim().toLowerCase()}:${voiceIdentity}:${speed.toFixed(2)}`;
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
): Promise<void> {
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

    // Evict if over limit
    const readTx = db.transaction(STORE_NAME, "readonly");
    const readReq = readTx.objectStore(STORE_NAME).getAll();
    let allEntries: TtsCacheEntry[] = [];
    readReq.onsuccess = () => {
      allEntries = readReq.result ?? [];
    };
    await waitForTransaction(readTx);

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    if (allEntries.length >= MAX_ENTRIES) {
      // LRU eviction: remove oldest entries
      const sorted = allEntries.sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = sorted.slice(0, allEntries.length - MAX_ENTRIES + 1);
      for (const old of toRemove) {
        store.delete(old.cacheKey);
      }
    }

    store.put(entry);
    await waitForTransaction(tx);
  } catch {
    // Graceful fallback if IndexedDB unavailable (e.g., private browsing)
  } finally {
    db?.close();
  }
}

export async function clearTtsCache(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await waitForTransaction(tx);
  } catch {
    // Ignore
  } finally {
    db?.close();
  }
}
