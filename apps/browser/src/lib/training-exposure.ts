"use client";

import {
  emptyTrainingExposureStore,
  parseTrainingExposureStore,
  recordTrainingMaterialExposure,
  type TrainingExposureStoreV1,
  type TrainingMaterialNovelty,
  trainingMaterialNovelty,
} from "@speakright/core/training/exposure";
import type {
  TrainingMaterialDescriptor,
  TrainingMaterialRole,
} from "@speakright/core/training/materials";
import { quarantineLocalDataValue } from "./local-data-migrations";

export const TRAINING_EXPOSURE_STORAGE_KEY = "speakright_training_exposure_v1";

export interface TrainingExposureState {
  store: TrainingExposureStoreV1;
  hasHistoricalExposureData: boolean;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isValidExposureEnvelope(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as {
      version?: unknown;
      exposures?: unknown;
    };
    return parsed.version === 1 && Array.isArray(parsed.exposures);
  } catch {
    return false;
  }
}

export function loadTrainingExposureState(): TrainingExposureState {
  if (!hasStorage()) {
    return {
      store: emptyTrainingExposureStore(),
      hasHistoricalExposureData: false,
    };
  }
  const raw = localStorage.getItem(TRAINING_EXPOSURE_STORAGE_KEY);
  if (!raw) {
    return {
      store: emptyTrainingExposureStore(),
      hasHistoricalExposureData: false,
    };
  }
  if (!isValidExposureEnvelope(raw)) {
    quarantineLocalDataValue(
      TRAINING_EXPOSURE_STORAGE_KEY,
      "Invalid training exposure store",
    );
    return {
      store: emptyTrainingExposureStore(),
      hasHistoricalExposureData: false,
    };
  }
  return {
    store: parseTrainingExposureStore(raw),
    hasHistoricalExposureData: true,
  };
}

export function saveTrainingExposureStore(
  store: TrainingExposureStoreV1,
): boolean {
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(TRAINING_EXPOSURE_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(
      new StorageEvent("storage", { key: TRAINING_EXPOSURE_STORAGE_KEY }),
    );
    return true;
  } catch {
    return false;
  }
}

export function markTrainingMaterialExposed(
  material: Pick<TrainingMaterialDescriptor, "id" | "packId" | "role">,
  seenAt = Date.now(),
): boolean {
  const state = loadTrainingExposureState();
  return saveTrainingExposureStore(
    recordTrainingMaterialExposure(state.store, {
      materialId: material.id,
      packId: material.packId,
      role: material.role,
      seenAt,
    }),
  );
}

export function getTrainingMaterialNovelty(
  materialId: string,
): TrainingMaterialNovelty {
  const state = loadTrainingExposureState();
  return trainingMaterialNovelty(
    state.store,
    materialId,
    state.hasHistoricalExposureData,
  );
}

export function markCourseItemExposed(input: {
  materialId: string;
  packId: string;
  role: TrainingMaterialRole;
  seenAt?: number;
}): boolean {
  return markTrainingMaterialExposed(
    {
      id: input.materialId,
      packId: input.packId,
      role: input.role,
    },
    input.seenAt,
  );
}
