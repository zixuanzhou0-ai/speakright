import { normalizeAssessmentPhoneme } from "@/lib/azure-phoneme-map";
import type {
  AzureAssessmentResult,
  AzurePhoneme,
  AzureSyllable,
} from "@/types/azure";

const IPA_COMBINING_MARKS = new Set([
  "ː",
  "ʲ",
  "ʷ",
  "̃",
  "̯",
  "̞",
  "̩",
  "̥",
  "̬",
  "̪",
  "̟",
  "̠",
  "̝",
  "̜",
  "̹",
  "̺",
  "̻",
]);

export function segmentIpaForAssessment(ipa?: string): string[] {
  const cleaned = (ipa ?? "")
    .normalize("NFC")
    .replace(/[/[\]ˈˌ.\s]/g, "")
    .replace(/[͜͡]/g, "");

  const chars = Array.from(cleaned);
  const tokens: string[] = [];

  for (let index = 0; index < chars.length; index++) {
    let token = chars[index];
    const next = chars[index + 1];

    if (token === "t" && ["ʃ", "ɕ", "s"].includes(next)) {
      token += next;
      index++;
    } else if (token === "d" && ["ʒ", "z"].includes(next)) {
      token += next;
      index++;
    }

    while (IPA_COMBINING_MARKS.has(chars[index + 1])) {
      token += chars[index + 1];
      index++;
    }

    if (normalizeAssessmentPhoneme(token)) tokens.push(token);
  }

  return tokens;
}

export function hydrateAssessmentPhonemes(
  phonemes: AzurePhoneme[],
  fallbackIpa?: string,
): AzurePhoneme[] {
  const fallbackTokens = segmentIpaForAssessment(fallbackIpa);

  return phonemes
    .map((phoneme, index) => {
      const rawPhoneme =
        typeof phoneme.phoneme === "string" ? phoneme.phoneme : "";
      if (normalizeAssessmentPhoneme(rawPhoneme)) {
        return { ...phoneme, phoneme: rawPhoneme };
      }

      return {
        ...phoneme,
        phoneme: fallbackTokens[index] ?? rawPhoneme,
      };
    })
    .filter((phoneme) => normalizeAssessmentPhoneme(phoneme.phoneme));
}

export function collectDetailAssessmentPhonemes(
  result: AzureAssessmentResult,
  fallbackIpa?: string,
): AzurePhoneme[] {
  return hydrateAssessmentPhonemes(
    result.words.flatMap((word) => word.phonemes),
    fallbackIpa,
  );
}

export function collectDetailAssessmentSyllables(
  result: AzureAssessmentResult,
): AzureSyllable[] {
  return result.words.flatMap((word) => word.syllables);
}
