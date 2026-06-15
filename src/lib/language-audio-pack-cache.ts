import type { ElevenLabsPackLanguageId } from "@/lib/elevenlabs-language-packs";

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

export function normalizeAudioPackText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u0301\u0341]/g, "")
    .replace(/[\u2018\u2019\u201B\u02BC\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?。！？]+$/g, "")
    .trim()
    .toLocaleLowerCase();
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
