"use client";

export interface BenchmarkRecordingMeta {
  id: string;
  createdAt: number;
  source: "prosody" | "coverage" | "scenario" | "free-practice" | "spontaneous";
  title: string;
  text: string;
  score: number;
  targetLabel: string;
}

export interface BenchmarkAudioExport {
  id: string;
  mimeType: string;
  bytes: number;
  dataBase64: string;
}

export interface BenchmarkArchiveExport {
  meta: BenchmarkRecordingMeta[];
  audio: BenchmarkAudioExport[];
  missingAudioIds: string[];
  errors: string[];
}

const META_KEY = "speakright_benchmark_recordings_v1";
const DB_NAME = "speakright-benchmark-audio";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

export function getBenchmarkArchiveSaveErrorMessage(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "UnknownError")
  ) {
    return "本次评分已完成，但本机存储空间不足或 IndexedDB 被系统限制，录音没有保存到 benchmark 归档。可以在设置页清理缓存或稍后重试。";
  }

  return "本次评分已完成，但练习录音没有保存到本机 benchmark 归档。请检查系统存储权限或剩余空间后，下次重新录音保存。";
}

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

async function deleteBlob(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearBlobs(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
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

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) {
      const chunk = bytes.subarray(index, index + 0x8000);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  throw new Error("No base64 encoder is available");
}

export async function encodeBenchmarkAudioBlob(
  id: string,
  blob: Blob,
): Promise<BenchmarkAudioExport> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    id,
    mimeType: blob.type || "application/octet-stream",
    bytes: blob.size,
    dataBase64: bytesToBase64(bytes),
  };
}

export async function exportBenchmarkRecordings(): Promise<BenchmarkArchiveExport> {
  const meta = listBenchmarkRecordings();
  const audio: BenchmarkAudioExport[] = [];
  const missingAudioIds: string[] = [];
  const errors: string[] = [];

  if (typeof indexedDB === "undefined") {
    return {
      meta,
      audio,
      missingAudioIds: meta.map((item) => item.id),
      errors: meta.length > 0 ? ["IndexedDB is unavailable"] : [],
    };
  }

  for (const item of meta) {
    try {
      const blob = await getBenchmarkAudioBlob(item.id);
      if (!blob) {
        missingAudioIds.push(item.id);
        continue;
      }
      audio.push(await encodeBenchmarkAudioBlob(item.id, blob));
    } catch (error) {
      errors.push(
        `${item.id}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return { meta, audio, missingAudioIds, errors };
}

export async function deleteBenchmarkRecording(id: string): Promise<void> {
  await deleteBlob(id);
  writeMeta(readMeta().filter((item) => item.id !== id));
}

export async function clearBenchmarkRecordings(): Promise<void> {
  await clearBlobs();
  writeMeta([]);
}

export function normalizeBenchmarkText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTargetLabel(label: string): string {
  return label
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(", ");
}

export function benchmarkGroupKey(item: BenchmarkRecordingMeta): string {
  return [
    item.source,
    normalizeTargetLabel(item.targetLabel),
    normalizeBenchmarkText(item.text),
  ].join(":");
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

export interface BenchmarkRecordingGroup {
  key: string;
  source: BenchmarkRecordingMeta["source"];
  targetLabel: string;
  text: string;
  title: string;
  recordings: BenchmarkRecordingMeta[];
  trend: ReturnType<typeof summarizeBenchmarkTrend>;
}

export function summarizeBenchmarkGroups(
  items: BenchmarkRecordingMeta[],
): BenchmarkRecordingGroup[] {
  const groups = new Map<string, BenchmarkRecordingMeta[]>();
  for (const item of items) {
    const key = benchmarkGroupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return Array.from(groups.entries())
    .map(([key, recordings]) => {
      const sorted = [...recordings].sort((a, b) => b.createdAt - a.createdAt);
      const latest = sorted[0];
      return {
        key,
        source: latest.source,
        targetLabel: latest.targetLabel,
        text: latest.text,
        title: latest.title,
        recordings: sorted,
        trend: summarizeBenchmarkTrend(sorted),
      };
    })
    .sort((a, b) => b.recordings[0].createdAt - a.recordings[0].createdAt);
}
