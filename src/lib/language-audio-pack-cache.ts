import type {
  ElevenLabsAudioPackMode,
  ElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";

const DB_NAME = "speakright_language_audio_packs";
const AUDIO_STORE = "audio";
const STATUS_STORE = "pack_status";
const DB_VERSION = 1;
export const LANGUAGE_AUDIO_PACK_VERSION = 1;

export interface LanguageAudioPackEntry {
  cacheKey: string;
  languageId: ElevenLabsPackLanguageId;
  text: string;
  ipa?: string;
  audioBlob: Blob;
  voiceId: string;
  voiceName: string;
  modelId: string;
  languageCode: string;
  createdAt: number;
  byteLength: number;
  packVersion: number;
}

export interface LanguageAudioPackStatus {
  languageId: ElevenLabsPackLanguageId;
  mode: ElevenLabsAudioPackMode;
  installedCount: number;
  totalCount: number;
  estimatedCredits: number;
  voiceId: string;
  voiceName: string;
  modelId: string;
  languageCode: string;
  updatedAt: number;
  packVersion: number;
}

export function normalizeAudioPackText(text: string): string {
  return text.trim().toLocaleLowerCase();
}

function audioCacheKey(languageId: ElevenLabsPackLanguageId, text: string): string {
  return `${languageId}:${normalizeAudioPackText(text)}`;
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
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: "cacheKey" });
      }
      if (!db.objectStoreNames.contains(STATUS_STORE)) {
        db.createObjectStore(STATUS_STORE, { keyPath: "languageId" });
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

export async function getLanguageAudioPackEntry(
  languageId: ElevenLabsPackLanguageId,
  text: string,
): Promise<LanguageAudioPackEntry | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(AUDIO_STORE, "readonly");
    const req = tx.objectStore(AUDIO_STORE).get(audioCacheKey(languageId, text));
    let result: LanguageAudioPackEntry | null = null;
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

export async function hasLanguageAudioPackEntry(
  languageId: ElevenLabsPackLanguageId,
  text: string,
): Promise<boolean> {
  return (await getLanguageAudioPackEntry(languageId, text)) !== null;
}

export async function setLanguageAudioPackEntry(
  entry: Omit<LanguageAudioPackEntry, "cacheKey" | "createdAt" | "byteLength" | "packVersion">,
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(AUDIO_STORE, "readwrite");
    const audioBytes = await entry.audioBlob.arrayBuffer();
    tx.objectStore(AUDIO_STORE).put({
      ...entry,
      cacheKey: audioCacheKey(entry.languageId, entry.text),
      createdAt: Date.now(),
      byteLength: audioBytes.byteLength,
      packVersion: LANGUAGE_AUDIO_PACK_VERSION,
    } satisfies LanguageAudioPackEntry);
    await waitForTransaction(tx);
  } finally {
    db?.close();
  }
}

export async function getLanguageAudioPackStatus(
  languageId: ElevenLabsPackLanguageId,
): Promise<LanguageAudioPackStatus | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(STATUS_STORE, "readonly");
    const req = tx.objectStore(STATUS_STORE).get(languageId);
    let result: LanguageAudioPackStatus | null = null;
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

export async function setLanguageAudioPackStatus(
  status: Omit<LanguageAudioPackStatus, "updatedAt" | "packVersion">,
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction(STATUS_STORE, "readwrite");
    tx.objectStore(STATUS_STORE).put({
      ...status,
      updatedAt: Date.now(),
      packVersion: LANGUAGE_AUDIO_PACK_VERSION,
    } satisfies LanguageAudioPackStatus);
    await waitForTransaction(tx);
  } finally {
    db?.close();
  }
}

export async function clearLanguageAudioPack(
  languageId: ElevenLabsPackLanguageId,
): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const readTx = db.transaction(AUDIO_STORE, "readonly");
    const allReq = readTx.objectStore(AUDIO_STORE).getAll();
    let entries: LanguageAudioPackEntry[] = [];
    allReq.onsuccess = () => {
      entries = allReq.result ?? [];
    };
    await waitForTransaction(readTx);

    const writeTx = db.transaction([AUDIO_STORE, STATUS_STORE], "readwrite");
    const audioStore = writeTx.objectStore(AUDIO_STORE);
    for (const entry of entries) {
      if (entry.languageId === languageId) {
        audioStore.delete(entry.cacheKey);
      }
    }
    writeTx.objectStore(STATUS_STORE).delete(languageId);
    await waitForTransaction(writeTx);
  } finally {
    db?.close();
  }
}

export async function clearAllLanguageAudioPacks(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openDb();
    const tx = db.transaction([AUDIO_STORE, STATUS_STORE], "readwrite");
    tx.objectStore(AUDIO_STORE).clear();
    tx.objectStore(STATUS_STORE).clear();
    await waitForTransaction(tx);
  } catch {
    // Keep local-data deletion resilient when IndexedDB is unavailable.
  } finally {
    db?.close();
  }
}
