const DB_NAME = "speakright_tts_cache";
const STORE_NAME = "tts_audio";
const MAX_ENTRIES = 50;
const DB_VERSION = 1;

interface TtsCacheEntry {
  cacheKey: string;
  audioBlob: Blob;
  alignment: unknown;
  createdAt: number;
  textLength: number;
}

function buildCacheKey(text: string, voiceId: string, speed: number): string {
  return `${text.trim().toLowerCase()}:${voiceId}:${speed.toFixed(1)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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

export async function getTtsFromCache(
  text: string,
  voiceId: string,
  speed: number,
): Promise<TtsCacheEntry | null> {
  try {
    const db = await openDb();
    const key = buildCacheKey(text, voiceId, speed);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setTtsToCache(
  text: string,
  voiceId: string,
  speed: number,
  audioBlob: Blob,
  alignment: unknown,
): Promise<void> {
  try {
    const db = await openDb();
    const key = buildCacheKey(text, voiceId, speed);

    const entry: TtsCacheEntry = {
      cacheKey: key,
      audioBlob,
      alignment,
      createdAt: Date.now(),
      textLength: text.length,
    };

    // Evict if over limit
    const allEntries = await new Promise<TtsCacheEntry[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    });

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
  } catch {
    // Graceful fallback if IndexedDB unavailable (e.g., private browsing)
  }
}

export async function clearTtsCache(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch {
    // Ignore
  }
}
