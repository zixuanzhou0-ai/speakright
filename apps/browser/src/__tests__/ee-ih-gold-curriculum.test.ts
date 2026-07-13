import {
  EE_IH_GOLD_CURRICULUM,
  validateEnglishDepthCurriculum,
} from "@speakright/core/training/deep-curriculum";
import { describe, expect, it } from "vitest";

describe("ee-ih gold curriculum", () => {
  it("meets the minimum depth contract before it can ship", () => {
    const result = validateEnglishDepthCurriculum(EE_IH_GOLD_CURRICULUM);

    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        issues: [],
      }),
    );
    expect(result.counts.practice).toBeGreaterThanOrEqual(44);
    expect(result.counts["near-transfer"]).toBeGreaterThanOrEqual(6);
    expect(result.counts["far-transfer"]).toBeGreaterThanOrEqual(3);
    expect(result.counts.retention).toBeGreaterThanOrEqual(9);
  });

  it("keeps held-out and retention IDs out of practice", () => {
    const practice = new Set(
      EE_IH_GOLD_CURRICULUM.materials
        .filter((item) => item.role === "practice")
        .map((item) => item.id),
    );
    const heldOut = EE_IH_GOLD_CURRICULUM.materials.filter(
      (item) =>
        item.role === "near-transfer" ||
        item.role === "far-transfer" ||
        item.role === "retention",
    );

    expect(heldOut.every((item) => !practice.has(item.id))).toBe(true);
    expect(new Set(heldOut.map((item) => item.id)).size).toBe(heldOut.length);
  });

  it("reserves three new materials for every delayed retest", () => {
    for (const delay of [24, 168, 504]) {
      expect(
        EE_IH_GOLD_CURRICULUM.materials.filter(
          (item) =>
            item.role === "retention" && item.scheduledDelayHours === delay,
        ),
      ).toHaveLength(3);
    }
  });
});
