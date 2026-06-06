"use client";

import type {
  MasteryProfile,
  PackMastery,
  PhonemeMastery,
  TrainingSessionSummary,
} from "@/types/training";
import { DEFAULT_LANGUAGE_ID } from "@/lib/language-profiles";

export const LOCAL_DATA_SCHEMA_VERSION = 2;
export const LOCAL_DATA_SCHEMA_VERSION_KEY =
  "speakright_local_data_schema_version";
export const LOCAL_DATA_MIGRATED_AT_KEY = "speakright_local_data_migrated_at";
export const CORRUPT_LOCAL_DATA_KEY = "speakright_corrupt_data_v1";

export const LOCAL_DATA_MIGRATION_EVENT =
  "speakright:local-data-migration";

const MASTERY_V2_KEY = "speakright_mastery_profile_v2";
const MASTERY_V1_KEY = "speakright_mastery_profile_v1";
const TRAINING_SESSIONS_V2_KEY = "speakright_training_sessions_v2";

const KNOWN_JSON_STORAGE_KEYS = [
  "speakright_assessment_result_v2",
  "speakright_assessment_result",
  MASTERY_V2_KEY,
  MASTERY_V1_KEY,
  TRAINING_SESSIONS_V2_KEY,
  "speakright_practice_history",
  "speakright_score_history",
  "speakright_usage",
  "speakright_benchmark_recordings_v1",
  "speakright_coverage_benchmarks_v1",
  "speakright_ipa_cache",
  "speakright_stress_cache",
] as const;

const KNOWN_JSON_STORAGE_PREFIXES = ["speakright_mw_words_"] as const;

export interface CorruptLocalDataItem {
  key: string;
  raw: string;
  reason: string;
  detectedAt: string;
  schemaVersion: number;
}

export interface LocalDataMigrationResult {
  previousVersion: number;
  currentVersion: number;
  migratedKeys: string[];
  quarantinedKeys: string[];
  ranAt: string;
}

export interface LocalDataSchemaStatus {
  storedVersion: number;
  currentVersion: number;
  needsMigration: boolean;
  lastMigratedAt: string | null;
  corruptItems: number;
}

declare global {
  interface WindowEventMap {
    [LOCAL_DATA_MIGRATION_EVENT]: CustomEvent<LocalDataMigrationResult>;
  }
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readStoredVersion(): number {
  if (!hasStorage()) return LOCAL_DATA_SCHEMA_VERSION;
  const raw = localStorage.getItem(LOCAL_DATA_SCHEMA_VERSION_KEY);
  const version = raw ? Number(raw) : 0;
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

function prefixedJsonKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (
      key &&
      KNOWN_JSON_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      keys.push(key);
    }
  }
  return keys;
}

export function readCorruptLocalData(): CorruptLocalDataItem[] {
  if (!hasStorage()) return [];
  const raw = localStorage.getItem(CORRUPT_LOCAL_DATA_KEY);
  if (!raw) return [];
  const parsed = parseJson<CorruptLocalDataItem[]>(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item) =>
      typeof item.key === "string" &&
      typeof item.raw === "string" &&
      typeof item.reason === "string" &&
      typeof item.detectedAt === "string",
  );
}

function writeCorruptLocalData(items: CorruptLocalDataItem[]): void {
  localStorage.setItem(
    CORRUPT_LOCAL_DATA_KEY,
    JSON.stringify(items.slice(0, 50)),
  );
}

function quarantineMalformedJson(key: string, reason: string): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return false;
  try {
    JSON.parse(raw);
    return false;
  } catch {
    const existing = readCorruptLocalData().filter(
      (item) => !(item.key === key && item.raw === raw),
    );
    writeCorruptLocalData([
      {
        key,
        raw,
        reason,
        detectedAt: new Date().toISOString(),
        schemaVersion: LOCAL_DATA_SCHEMA_VERSION,
      },
      ...existing,
    ]);
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent("storage", { key }));
    return true;
  }
}

function quarantineMalformedKnownJson(): string[] {
  const quarantined: string[] = [];
  const keys = [...KNOWN_JSON_STORAGE_KEYS, ...prefixedJsonKeys()];
  for (const key of keys) {
    if (quarantineMalformedJson(key, "Malformed JSON")) {
      quarantined.push(key);
    }
  }
  return quarantined;
}

function migrateLegacyMasteryProfile(): string[] {
  if (localStorage.getItem(MASTERY_V2_KEY)) return [];
  const raw = localStorage.getItem(MASTERY_V1_KEY);
  if (!raw) return [];
  const legacy = parseJson<{
    version?: number;
    updatedAt?: number;
    packs?: Record<
      string,
      Omit<PackMastery, "levelProgress" | "status"> & {
        status?: PackMastery["status"] | "recommended";
      }
    >;
    phonemes?: Record<string, PhonemeMastery>;
    sessions?: TrainingSessionSummary[];
  }>(raw);
  if (legacy?.version !== 1 || !legacy.packs || !legacy.phonemes) return [];

  const packs: Record<string, PackMastery> = {};
  for (const [packId, mastery] of Object.entries(legacy.packs)) {
    packs[packId] = {
      ...mastery,
      status:
        !mastery.status || mastery.status === "recommended"
          ? "new"
          : mastery.status,
      levelProgress: {},
    };
  }

  const next: MasteryProfile = {
    version: 2,
    languageId: DEFAULT_LANGUAGE_ID,
    updatedAt: legacy.updatedAt ?? Date.now(),
    packs,
    phonemes: legacy.phonemes,
    errorPatterns: {},
    sessions: Array.isArray(legacy.sessions)
      ? legacy.sessions.map((session) => ({
          ...session,
          languageId: session.languageId ?? DEFAULT_LANGUAGE_ID,
        }))
      : [],
  };

  localStorage.setItem(MASTERY_V2_KEY, JSON.stringify(next));
  localStorage.setItem(TRAINING_SESSIONS_V2_KEY, JSON.stringify(next.sessions));
  window.dispatchEvent(new StorageEvent("storage", { key: MASTERY_V2_KEY }));
  window.dispatchEvent(
    new StorageEvent("storage", { key: TRAINING_SESSIONS_V2_KEY }),
  );
  return [MASTERY_V2_KEY, TRAINING_SESSIONS_V2_KEY];
}

function backfillTrainingSessionsFromMastery(): string[] {
  if (localStorage.getItem(TRAINING_SESSIONS_V2_KEY)) return [];
  const raw = localStorage.getItem(MASTERY_V2_KEY);
  if (!raw) return [];
  const profile = parseJson<Partial<MasteryProfile>>(raw);
  if (!Array.isArray(profile?.sessions)) return [];
  localStorage.setItem(
    TRAINING_SESSIONS_V2_KEY,
    JSON.stringify(profile.sessions),
  );
  window.dispatchEvent(
    new StorageEvent("storage", { key: TRAINING_SESSIONS_V2_KEY }),
  );
  return [TRAINING_SESSIONS_V2_KEY];
}

export function getLocalDataSchemaStatus(): LocalDataSchemaStatus {
  if (!hasStorage()) {
    return {
      storedVersion: LOCAL_DATA_SCHEMA_VERSION,
      currentVersion: LOCAL_DATA_SCHEMA_VERSION,
      needsMigration: false,
      lastMigratedAt: null,
      corruptItems: 0,
    };
  }
  const storedVersion = readStoredVersion();
  return {
    storedVersion,
    currentVersion: LOCAL_DATA_SCHEMA_VERSION,
    needsMigration: storedVersion < LOCAL_DATA_SCHEMA_VERSION,
    lastMigratedAt: localStorage.getItem(LOCAL_DATA_MIGRATED_AT_KEY),
    corruptItems: readCorruptLocalData().length,
  };
}

export function clearCorruptLocalData(): void {
  if (!hasStorage()) return;
  localStorage.removeItem(CORRUPT_LOCAL_DATA_KEY);
  window.dispatchEvent(
    new StorageEvent("storage", { key: CORRUPT_LOCAL_DATA_KEY }),
  );
}

export function runLocalDataMigrations(): LocalDataMigrationResult {
  const ranAt = new Date().toISOString();
  if (!hasStorage()) {
    return {
      previousVersion: LOCAL_DATA_SCHEMA_VERSION,
      currentVersion: LOCAL_DATA_SCHEMA_VERSION,
      migratedKeys: [],
      quarantinedKeys: [],
      ranAt,
    };
  }

  const previousVersion = readStoredVersion();
  const quarantinedKeys = quarantineMalformedKnownJson();
  const migratedKeys = [
    ...migrateLegacyMasteryProfile(),
    ...backfillTrainingSessionsFromMastery(),
  ];

  localStorage.setItem(
    LOCAL_DATA_SCHEMA_VERSION_KEY,
    String(LOCAL_DATA_SCHEMA_VERSION),
  );
  localStorage.setItem(LOCAL_DATA_MIGRATED_AT_KEY, ranAt);

  const result: LocalDataMigrationResult = {
    previousVersion,
    currentVersion: LOCAL_DATA_SCHEMA_VERSION,
    migratedKeys,
    quarantinedKeys,
    ranAt,
  };
  window.dispatchEvent(
    new CustomEvent<LocalDataMigrationResult>(LOCAL_DATA_MIGRATION_EVENT, {
      detail: result,
    }),
  );
  return result;
}
