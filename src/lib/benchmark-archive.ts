"use client";

import { getCurrentLanguageId } from "@/lib/api-keys";
import { languageScopedStorageKey } from "@/lib/language-storage";
import {
  DEFAULT_LANGUAGE_ID,
  isLanguageId,
  type LanguageId,
} from "@/types/language";

export interface BenchmarkRecordingMeta {
  id: string;
  languageId: LanguageId;
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

function metaStorageKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(META_KEY, languageId);
}

function languageIdFromMetaKey(key: string): LanguageId {
  const suffix = key.startsWith(`${META_KEY}:`)
    ? key.slice(META_KEY.length + 1)
    : "";
  return isLanguageId(suffix) ? suffix : DEFAULT_LANGUAGE_ID;
}

function benchmarkMetaKeys(): string[] {
  if (typeof window === "undefined")
    return [metaStorageKey(DEFAULT_LANGUAGE_ID)];
  const keys = new Set<string>([metaStorageKey(DEFAULT_LANGUAGE_ID)]);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === META_KEY || key?.startsWith(`${META_KEY}:`)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function normalizeMeta(
  item: Partial<BenchmarkRecordingMeta>,
  fallbackLanguageId: LanguageId,
): BenchmarkRecordingMeta | null {
  if (
    typeof item.id !== "string" ||
    typeof item.createdAt !== "number" ||
    typeof item.source !== "string" ||
    typeof item.title !== "string" ||
    typeof item.text !== "string" ||
    typeof item.score !== "number" ||
    typeof item.targetLabel !== "string"
  ) {
    return null;
  }
  return {
    ...item,
    languageId: isLanguageId(item.languageId)
      ? item.languageId
      : fallbackLanguageId,
  } as BenchmarkRecordingMeta;
}

function readMeta(
  languageId: LanguageId = getCurrentLanguageId(),
): BenchmarkRecordingMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(metaStorageKey(languageId));
    const parsed = raw
      ? (JSON.parse(raw) as Array<Partial<BenchmarkRecordingMeta>>)
      : [];
    return parsed
      .map((item) => normalizeMeta(item, languageId))
      .filter((item): item is BenchmarkRecordingMeta => item !== null);
  } catch {
    return [];
  }
}

function readAllMeta(): BenchmarkRecordingMeta[] {
  if (typeof window === "undefined") return [];
  return benchmarkMetaKeys().flatMap((key) => {
    try {
      const raw = localStorage.getItem(key);
      const languageId = languageIdFromMetaKey(key);
      const parsed = raw
        ? (JSON.parse(raw) as Array<Partial<BenchmarkRecordingMeta>>)
        : [];
      return parsed
        .map((item) => normalizeMeta(item, languageId))
        .filter((item): item is BenchmarkRecordingMeta => item !== null);
    } catch {
      return [];
    }
  });
}

function writeMeta(
  items: BenchmarkRecordingMeta[],
  languageId: LanguageId = getCurrentLanguageId(),
): void {
  if (typeof window === "undefined") return;
  const key = metaStorageKey(languageId);
  localStorage.setItem(key, JSON.stringify(items.slice(0, 80)));
  window.dispatchEvent(new StorageEvent("storage", { key }));
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
  meta: Omit<BenchmarkRecordingMeta, "id" | "createdAt" | "languageId"> & {
    id?: string;
    createdAt?: number;
    languageId?: LanguageId;
  },
  languageId: LanguageId = meta.languageId ?? getCurrentLanguageId(),
): Promise<BenchmarkRecordingMeta> {
  const item: BenchmarkRecordingMeta = {
    ...meta,
    languageId,
    id:
      meta.id ??
      `benchmark-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: meta.createdAt ?? Date.now(),
  };
  if (typeof indexedDB !== "undefined") {
    await putBlob(item.id, blob);
  }
  writeMeta(
    [
      item,
      ...readMeta(languageId).filter((existing) => existing.id !== item.id),
    ],
    languageId,
  );
  return item;
}

export function listBenchmarkRecordings(
  languageId: LanguageId = getCurrentLanguageId(),
): BenchmarkRecordingMeta[] {
  return readMeta(languageId).sort((a, b) => b.createdAt - a.createdAt);
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
  const meta = readAllMeta().sort((a, b) => b.createdAt - a.createdAt);
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
  const languageId =
    readAllMeta().find((item) => item.id === id)?.languageId ??
    getCurrentLanguageId();
  writeMeta(
    readMeta(languageId).filter((item) => item.id !== id),
    languageId,
  );
}

export async function clearBenchmarkRecordings(
  languageId: LanguageId = getCurrentLanguageId(),
): Promise<void> {
  const items = readMeta(languageId);
  await Promise.all(items.map((item) => deleteBlob(item.id)));
  writeMeta([], languageId);
}

export async function clearAllBenchmarkRecordings(): Promise<void> {
  await clearBlobs();
  if (typeof window === "undefined") return;
  for (const key of benchmarkMetaKeys()) {
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }
}

export function normalizeBenchmarkText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}'\s]+/gu, " ")
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
    item.languageId,
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
