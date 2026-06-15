"use client";

import {
  API_KEY_STORAGE_KEYS,
  APP_PREFERENCE_STORAGE_KEYS,
  clearItem,
  getApiKeySummary,
} from "@/lib/api-keys";
import {
  clearBenchmarkRecordings,
  exportBenchmarkRecordings,
} from "@/lib/benchmark-archive";
import { DESKTOP_MIC_CHECK_KEY } from "@/lib/desktop-readiness";
import { clearAllLanguageAudioPacks } from "@/lib/language-audio-pack-cache";
import {
  CORRUPT_LOCAL_DATA_KEY,
  clearCorruptLocalData,
  getLocalDataSchemaStatus,
  LOCAL_DATA_MIGRATED_AT_KEY,
  LOCAL_DATA_SCHEMA_VERSION_KEY,
} from "@/lib/local-data-migrations";
import { storeGet } from "@/lib/tauri-store";
import { clearTtsCache } from "@/lib/tts-cache";

const ASSESSMENT_STORAGE_KEYS = [
  "speakright_assessment_result_v2",
  "speakright_assessment_result",
] as const;

const LEARNING_STORAGE_KEYS = [
  ...ASSESSMENT_STORAGE_KEYS,
  "speakright_mastery_profile_v2",
  "speakright_mastery_profile_v1",
  "speakright_training_sessions_v2",
  "speakright_practice_history",
  "speakright_score_history",
  "speakright_usage",
  "speakright_benchmark_recordings_v1",
  "speakright_coverage_benchmarks_v1",
  CORRUPT_LOCAL_DATA_KEY,
] as const;

const CACHE_STORAGE_KEYS = [
  "speakright_ipa_cache",
  "speakright_stress_cache",
] as const;

const DEVICE_STORAGE_KEYS = [DESKTOP_MIC_CHECK_KEY] as const;

const CACHE_STORAGE_PREFIXES = ["speakright_mw_words_"] as const;
const LEGACY_APP_PREFERENCE_STORAGE_KEYS = [
  "speakright_pronunciation_config",
] as const;
const RESET_ONLY_STORAGE_KEYS = [
  ...DEVICE_STORAGE_KEYS,
  LOCAL_DATA_SCHEMA_VERSION_KEY,
  LOCAL_DATA_MIGRATED_AT_KEY,
  ...LEGACY_APP_PREFERENCE_STORAGE_KEYS,
  "theme",
] as const;

export interface LocalDataExport {
  schemaVersion: 4;
  exportedAt: string;
  product: "SpeakRight Desktop";
  dataSchema: ReturnType<typeof getLocalDataSchemaStatus>;
  localStorage: Record<string, unknown>;
  appSettings: Record<string, unknown>;
  indexedDb: {
    benchmarkRecordings: Awaited<ReturnType<typeof exportBenchmarkRecordings>>;
  };
  excluded: string[];
}

export interface LocalDataSummary {
  learningKeys: number;
  cacheKeys: number;
  configuredApiKeys: number;
  apiKeySlots: number;
  dataSchemaVersion: number;
  corruptItems: number;
  storageUnavailable?: boolean;
}

export interface DeleteAllLocalDataOptions {
  includeApiKeys: boolean;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function collectKeys(keys: readonly string[]): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const entries: Record<string, unknown> = {};
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      entries[key] = safeParse(raw);
    }
  }
  return entries;
}

async function collectPersistentKeys(
  keys: readonly string[],
): Promise<Record<string, unknown>> {
  const entries: Record<string, unknown> = {};
  for (const key of keys) {
    const persisted = await storeGet<unknown>(key);
    if (persisted !== null && persisted !== undefined) {
      entries[key] = persisted;
    } else if (typeof window !== "undefined") {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        entries[key] = safeParse(raw);
      }
    }
  }
  return entries;
}

function prefixedLocalStorageKeys(prefixes: readonly string[]): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  return keys;
}

function removeLocalStorageKeys(keys: readonly string[]): void {
  if (typeof window === "undefined") return;
  for (const key of keys) {
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }
}

async function removePersistentKeys(keys: readonly string[]): Promise<void> {
  if (typeof window === "undefined") return;
  await Promise.all(keys.map((key) => clearItem(key)));
}

export const LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE =
  "本机数据摘要暂时无法读取。你仍可以导出诊断包或尝试重置本机数据；如果刚刚打开应用，请重启后再试。";

function safeApiKeySummary() {
  try {
    return getApiKeySummary();
  } catch {
    return {
      configured: 0,
      totalSlots: API_KEY_STORAGE_KEYS.length,
    };
  }
}

export async function buildLocalDataExport(): Promise<LocalDataExport> {
  const cacheKeys = prefixedLocalStorageKeys(CACHE_STORAGE_PREFIXES);
  return {
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    product: "SpeakRight Desktop",
    dataSchema: getLocalDataSchemaStatus(),
    localStorage: {
      ...collectKeys(LEARNING_STORAGE_KEYS),
      ...collectKeys(CACHE_STORAGE_KEYS),
      ...collectKeys(DEVICE_STORAGE_KEYS),
      ...collectKeys(cacheKeys),
      ...collectKeys([
        LOCAL_DATA_SCHEMA_VERSION_KEY,
        LOCAL_DATA_MIGRATED_AT_KEY,
      ]),
    },
    appSettings: await collectPersistentKeys(APP_PREFERENCE_STORAGE_KEYS),
    indexedDb: {
      benchmarkRecordings: await exportBenchmarkRecordings(),
    },
    excluded: [
      "API keys",
      "ElevenLabs TTS audio cache",
      "Legacy generated language audio cache",
      "Theme preference",
    ],
  };
}

export function getLocalDataSummary(): LocalDataSummary {
  const apiKeys = safeApiKeySummary();
  try {
    const cacheKeys = [
      ...CACHE_STORAGE_KEYS,
      ...prefixedLocalStorageKeys(CACHE_STORAGE_PREFIXES),
    ];
    const dataSchema = getLocalDataSchemaStatus();
    return {
      learningKeys: Object.keys(collectKeys(LEARNING_STORAGE_KEYS)).length,
      cacheKeys: Object.keys(collectKeys(cacheKeys)).length,
      configuredApiKeys: apiKeys.configured,
      apiKeySlots: apiKeys.totalSlots,
      dataSchemaVersion: dataSchema.storedVersion,
      corruptItems: dataSchema.corruptItems,
    };
  } catch {
    return {
      learningKeys: 0,
      cacheKeys: 0,
      configuredApiKeys: apiKeys.configured,
      apiKeySlots: apiKeys.totalSlots,
      dataSchemaVersion: 0,
      corruptItems: 0,
      storageUnavailable: true,
    };
  }
}

export async function downloadLocalDataExport(): Promise<void> {
  if (typeof document === "undefined") return;
  const snapshot = await buildLocalDataExport();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `speakright-data-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deleteLearningData(): Promise<void> {
  const cacheKeys = prefixedLocalStorageKeys(CACHE_STORAGE_PREFIXES);
  await clearBenchmarkRecordings();
  await clearTtsCache();
  await clearAllLanguageAudioPacks();
  removeLocalStorageKeys([
    ...LEARNING_STORAGE_KEYS,
    ...CACHE_STORAGE_KEYS,
    ...cacheKeys,
  ]);
  clearCorruptLocalData();
}

export async function deleteBenchmarkAudioData(): Promise<void> {
  await clearBenchmarkRecordings();
  removeLocalStorageKeys(["speakright_benchmark_recordings_v1"]);
}

export async function deleteApiKeys(): Promise<void> {
  await Promise.all(API_KEY_STORAGE_KEYS.map((key) => clearItem(key)));
}

export async function deleteAllLocalData({
  includeApiKeys,
}: DeleteAllLocalDataOptions): Promise<void> {
  await deleteLearningData();
  removeLocalStorageKeys(RESET_ONLY_STORAGE_KEYS);
  await removePersistentKeys([
    ...APP_PREFERENCE_STORAGE_KEYS,
    ...LEGACY_APP_PREFERENCE_STORAGE_KEYS,
  ]);
  if (includeApiKeys) {
    await deleteApiKeys();
  }
}
