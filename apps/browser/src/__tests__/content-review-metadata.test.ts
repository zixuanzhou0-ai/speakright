import { describe, expect, it } from "vitest";
import {
  ENGLISH_PHONEME_CONTENT_REVIEWS,
  getEnglishPhonemeContentReview,
} from "@/lib/content-review-metadata";
import { PHONEMES } from "@/lib/phoneme-data";

describe("English pronunciation content review metadata", () => {
  it("records review scope and sources for all 40 English phonemes", () => {
    expect(PHONEMES).toHaveLength(40);
    expect(Object.keys(ENGLISH_PHONEME_CONTENT_REVIEWS)).toHaveLength(40);
    for (const phoneme of PHONEMES) {
      const review = getEnglishPhonemeContentReview(phoneme.slug);
      expect(review).toMatchObject({
        unitSlug: phoneme.slug,
        accentScope: "General American",
        lastReviewedAt: "2026-07-13",
        status: "reviewed",
      });
      expect(review?.sources.length).toBeGreaterThanOrEqual(3);
      expect(
        review?.sources.every((source) => source.url.startsWith("https://")),
      ).toBe(true);
    }
  });
});
