import { beforeEach, describe, expect, it } from "vitest";
import { readCorruptLocalData } from "@/lib/local-data-migrations";
import {
  getTrainingMaterialNovelty,
  loadTrainingExposureState,
  markCourseItemExposed,
  presentCourseItem,
  TRAINING_EXPOSURE_STORAGE_KEY,
} from "@/lib/training-exposure";

describe("training exposure storage", () => {
  beforeEach(() => localStorage.clear());

  it("treats the first migrated transfer check as unknown", () => {
    expect(loadTrainingExposureState().hasHistoricalExposureData).toBe(false);
    expect(getTrainingMaterialNovelty("far-1")).toBe("unknown");
  });

  it("records only material explicitly presented by the app", () => {
    expect(
      markCourseItemExposed({
        materialId: "ee-ih:word:feel",
        packId: "ee-ih",
        role: "practice",
        seenAt: 100,
      }),
    ).toBe(true);

    const state = loadTrainingExposureState();
    expect(state.hasHistoricalExposureData).toBe(true);
    expect(state.store.exposures).toEqual([
      expect.objectContaining({
        materialId: "ee-ih:word:feel",
        attemptCount: 1,
      }),
    ]);
    expect(getTrainingMaterialNovelty("ee-ih:word:feel")).toBe("exposed");
    expect(getTrainingMaterialNovelty("ee-ih:far:new")).toBe(
      "confirmed-untrained",
    );
  });

  it("quarantines malformed exposure data without deleting the evidence copy", () => {
    localStorage.setItem(TRAINING_EXPOSURE_STORAGE_KEY, "{broken");

    const state = loadTrainingExposureState();

    expect(state.hasHistoricalExposureData).toBe(false);
    expect(localStorage.getItem(TRAINING_EXPOSURE_STORAGE_KEY)).toBeNull();
    expect(readCorruptLocalData()).toEqual([
      expect.objectContaining({
        key: TRAINING_EXPOSURE_STORAGE_KEY,
        raw: "{broken",
      }),
    ]);
  });

  it("captures novelty before exposure and never reuses it on a retry", () => {
    markCourseItemExposed({
      materialId: "practice-seed",
      packId: "ee-ih",
      role: "practice",
      seenAt: 50,
    });

    const first = presentCourseItem({
      materialId: "retention-held-out",
      packId: "ee-ih",
      role: "retention",
      seenAt: 100,
    });
    const retry = presentCourseItem({
      materialId: "retention-held-out",
      packId: "ee-ih",
      role: "retention",
      seenAt: 200,
    });

    expect(first.noveltyBeforeExposure).toBe("confirmed-untrained");
    expect(retry.noveltyBeforeExposure).toBe("exposed");
  });
});
