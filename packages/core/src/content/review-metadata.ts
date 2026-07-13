export interface PronunciationContentSource {
  id: string;
  title: string;
  url: string;
  role: "articulation" | "notation" | "transcription";
}

export interface PronunciationContentReview {
  unitSlug: string;
  accentScope: "General American";
  lastReviewedAt: string;
  status: "reviewed" | "needs-specialist-review";
  sources: PronunciationContentSource[];
}

export const PRONUNCIATION_CONTENT_SOURCES: PronunciationContentSource[] = [
  {
    id: "uiowa-sounds-of-speech",
    title: "University of Iowa Sounds of Speech",
    url: "https://soundsofspeech.uiowa.edu/",
    role: "articulation",
  },
  {
    id: "cambridge-pronunciation-symbols",
    title: "Cambridge Dictionary pronunciation symbols",
    url: "https://dictionary.cambridge.org/help/phonetics.html",
    role: "transcription",
  },
  {
    id: "international-phonetic-association-chart",
    title: "International Phonetic Association chart",
    url: "https://www.internationalphoneticassociation.org/content/ipa-chart",
    role: "notation",
  },
];

export function createPronunciationContentReview(
  unitSlug: string,
): PronunciationContentReview {
  return {
    unitSlug,
    accentScope: "General American",
    lastReviewedAt: "2026-07-13",
    status: "reviewed",
    sources: PRONUNCIATION_CONTENT_SOURCES,
  };
}
