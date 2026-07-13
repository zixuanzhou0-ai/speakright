import { describe, expect, it } from "vitest";
import { PHONEMES } from "@/lib/phoneme-data";
import {
  PHONEME_CONTENT_REVIEWS,
  TRAINING_PACK_CONTENT_REVIEWS,
} from "@/lib/pronunciation-content-review";
import { TRAINING_PACKS } from "@/lib/training-packs";

describe("pronunciation content review coverage", () => {
  it("tracks review metadata for all 40 English phonemes", () => {
    expect(PHONEMES).toHaveLength(40);
    expect(PHONEME_CONTENT_REVIEWS).toHaveLength(PHONEMES.length);
    expect(
      new Set(PHONEME_CONTENT_REVIEWS.map((item) => item.contentId)).size,
    ).toBe(PHONEMES.length);
    expect(
      PHONEME_CONTENT_REVIEWS.every((item) => item.sourceIds.length >= 2),
    ).toBe(true);
  });

  it("tracks review metadata for every guided training pack", () => {
    expect(TRAINING_PACK_CONTENT_REVIEWS).toHaveLength(TRAINING_PACKS.length);
    expect(
      TRAINING_PACK_CONTENT_REVIEWS.every(
        (item) =>
          item.status === "reviewed" && item.lastReviewedAt.length === 10,
      ),
    ).toBe(true);
  });
});
