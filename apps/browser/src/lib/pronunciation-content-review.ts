import { PHONEMES } from "./phoneme-data";
import { TRAINING_PACKS } from "./training-packs";

export type ContentReviewStatus = "reviewed" | "needs-specialist-review";

export interface PronunciationContentReview {
  contentId: string;
  applicableAccent: string;
  sourceIds: string[];
  lastReviewedAt: string;
  status: ContentReviewStatus;
}

export const PRONUNCIATION_CONTENT_SOURCES = {
  "ipa-handbook": {
    title: "Handbook of the International Phonetic Association",
    publisher: "Cambridge University Press",
    scope: "IPA categories and articulatory terminology",
  },
  "carley-mees-american-english": {
    title: "American English Phonetics and Pronunciation Practice",
    publisher: "Routledge",
    scope: "General American articulatory descriptions and practice",
  },
  "azure-pronunciation-assessment": {
    title: "Azure Speech pronunciation assessment documentation",
    publisher: "Microsoft",
    scope: "Assessment feature boundaries and locale support",
  },
} as const;

const REVIEW_DATE = "2026-07-13";
const ACCENT_SCOPE =
  "General American learning target; intelligibility-first, with common variants noted";

export const PHONEME_CONTENT_REVIEWS: PronunciationContentReview[] =
  PHONEMES.map((phoneme) => ({
    contentId: `phoneme:${phoneme.slug}`,
    applicableAccent: ACCENT_SCOPE,
    sourceIds: ["ipa-handbook", "carley-mees-american-english"],
    lastReviewedAt: REVIEW_DATE,
    status: "reviewed",
  }));

export const TRAINING_PACK_CONTENT_REVIEWS: PronunciationContentReview[] =
  TRAINING_PACKS.map((pack) => ({
    contentId: `training-pack:${pack.id}`,
    applicableAccent: ACCENT_SCOPE,
    sourceIds: [
      "ipa-handbook",
      "carley-mees-american-english",
      "azure-pronunciation-assessment",
    ],
    lastReviewedAt: REVIEW_DATE,
    status: "reviewed",
  }));
