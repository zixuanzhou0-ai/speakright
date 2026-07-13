import type { TrainingMaterialRole } from "./materials";

export type TrainingMaterialNovelty =
  | "confirmed-untrained"
  | "exposed"
  | "unknown";

export interface TrainingMaterialExposure {
  materialId: string;
  packId: string;
  role: TrainingMaterialRole;
  firstSeenAt: number;
  lastSeenAt: number;
  attemptCount: number;
}

export interface TrainingExposureStoreV1 {
  version: 1;
  updatedAt: number;
  exposures: TrainingMaterialExposure[];
}

const DEFAULT_MAX_EXPOSURES = 2000;

export function emptyTrainingExposureStore(
  now = Date.now(),
): TrainingExposureStoreV1 {
  return { version: 1, updatedAt: now, exposures: [] };
}

function isTrainingMaterialExposure(
  value: unknown,
): value is TrainingMaterialExposure {
  if (!value || typeof value !== "object") return false;
  const exposure = value as Partial<TrainingMaterialExposure>;
  return (
    typeof exposure.materialId === "string" &&
    typeof exposure.packId === "string" &&
    typeof exposure.role === "string" &&
    typeof exposure.firstSeenAt === "number" &&
    typeof exposure.lastSeenAt === "number" &&
    typeof exposure.attemptCount === "number"
  );
}

export function parseTrainingExposureStore(
  raw: string | null | undefined,
  now = Date.now(),
): TrainingExposureStoreV1 {
  if (!raw) return emptyTrainingExposureStore(now);
  try {
    const parsed = JSON.parse(raw) as Partial<TrainingExposureStoreV1>;
    if (parsed.version !== 1 || !Array.isArray(parsed.exposures)) {
      return emptyTrainingExposureStore(now);
    }
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : now,
      exposures: parsed.exposures.filter(isTrainingMaterialExposure),
    };
  } catch {
    return emptyTrainingExposureStore(now);
  }
}

export function recordTrainingMaterialExposure(
  store: TrainingExposureStoreV1,
  input: Omit<
    TrainingMaterialExposure,
    "firstSeenAt" | "lastSeenAt" | "attemptCount"
  > & { seenAt?: number },
  options: { maxItems?: number } = {},
): TrainingExposureStoreV1 {
  const seenAt = input.seenAt ?? Date.now();
  const current = store.exposures.find(
    (exposure) => exposure.materialId === input.materialId,
  );
  const next: TrainingMaterialExposure = {
    materialId: input.materialId,
    packId: input.packId,
    role: input.role,
    firstSeenAt: current?.firstSeenAt ?? seenAt,
    lastSeenAt: seenAt,
    attemptCount: (current?.attemptCount ?? 0) + 1,
  };
  const maxItems = Math.max(1, options.maxItems ?? DEFAULT_MAX_EXPOSURES);
  return {
    version: 1,
    updatedAt: seenAt,
    exposures: [
      next,
      ...store.exposures.filter(
        (exposure) => exposure.materialId !== input.materialId,
      ),
    ].slice(0, maxItems),
  };
}

export function hasTrainingMaterialExposure(
  store: TrainingExposureStoreV1,
  materialId: string,
): boolean {
  return store.exposures.some((exposure) => exposure.materialId === materialId);
}

export function trainingMaterialNovelty(
  store: TrainingExposureStoreV1 | null | undefined,
  materialId: string,
  hasHistoricalExposureData: boolean,
): TrainingMaterialNovelty {
  if (!hasHistoricalExposureData) return "unknown";
  return hasTrainingMaterialExposure(
    store ?? emptyTrainingExposureStore(),
    materialId,
  )
    ? "exposed"
    : "confirmed-untrained";
}
