import {
  createPronunciationContentReview,
  type PronunciationContentReview,
} from "@speakright/core/content/review-metadata";
import { PHONEMES } from "@/lib/phoneme-data";

export const ENGLISH_PHONEME_CONTENT_REVIEWS: Record<
  string,
  PronunciationContentReview
> = Object.fromEntries(
  PHONEMES.map((phoneme) => [
    phoneme.slug,
    createPronunciationContentReview(phoneme.slug),
  ]),
);

export function getEnglishPhonemeContentReview(
  slug: string,
): PronunciationContentReview | undefined {
  return ENGLISH_PHONEME_CONTENT_REVIEWS[slug];
}
