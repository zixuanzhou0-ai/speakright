"use client";

export interface BenchmarkRecordingMeta {
  id: string;
  createdAt: number;
  source: "prosody" | "coverage" | "scenario" | "free-practice";
  title: string;
  text: string;
  score: number;
  targetLabel: string;
}

const META_KEY = "speakright_benchmark_recordings_v1";
const DB_NAME = "speakright-benchmark-audio";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function readMeta(): BenchmarkRecordingMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as BenchmarkRecordingMeta[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(items: BenchmarkRecordingMeta[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(META_KEY, JSON.stringify(items.slice(0, 80)));
  window.dispatchEvent(new StorageEvent("storage", { key: META_KEY }));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBenchmarkAudioBlob(id: string): Promise<Blob | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as Blob) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

export async function saveBenchmarkRecording(
  blob: Blob,
  meta: Omit<BenchmarkRecordingMeta, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): Promise<BenchmarkRecordingMeta> {
  const item: BenchmarkRecordingMeta = {
    ...meta,
    id:
      meta.id ??
      `benchmark-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: meta.createdAt ?? Date.now(),
  };
  if (typeof indexedDB !== "undefined") {
    await putBlob(item.id, blob);
  }
  writeMeta([
    item,
    ...readMeta().filter((existing) => existing.id !== item.id),
  ]);
  return item;
}

export function listBenchmarkRecordings(): BenchmarkRecordingMeta[] {
  return readMeta().sort((a, b) => b.createdAt - a.createdAt);
}

export function summarizeBenchmarkTrend(items: BenchmarkRecordingMeta[]): {
  latestScore: number;
  bestScore: number;
  deltaFromFirst: number;
  count: number;
} {
  if (items.length === 0) {
    return { latestScore: 0, bestScore: 0, deltaFromFirst: 0, count: 0 };
  }
  const sorted = [...items].sort((a, b) => a.createdAt - b.createdAt);
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  return {
    latestScore: latest.score,
    bestScore: Math.max(...items.map((item) => item.score)),
    deltaFromFirst: latest.score - first.score,
    count: items.length,
  };
}
