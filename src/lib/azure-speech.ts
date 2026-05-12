import type { AzureAssessmentResult, AzureWord } from "@/types/azure";

/**
 * Parse the Azure pronunciation assessment result.
 * Supports both SDK format (scores nested under PronunciationAssessment)
 * and REST API format (scores flat at top level).
 */
export function parseAzureResult(
  raw: Record<string, unknown>,
): AzureAssessmentResult {
  const nb = raw.NBest as Array<Record<string, unknown>> | undefined;
  const best = nb?.[0] as Record<string, unknown> | undefined;

  if (!best) {
    return {
      pronunciationScore: 0,
      accuracyScore: 0,
      fluencyScore: 0,
      completenessScore: 0,
      words: [],
    };
  }

  // SDK format: scores under PronunciationAssessment sub-object
  // REST API format: scores flat at top level
  const pa = best.PronunciationAssessment as Record<string, number> | undefined;

  const pronunciationScore = pa?.PronScore ?? (best.PronScore as number) ?? 0;
  const accuracyScore =
    pa?.AccuracyScore ?? (best.AccuracyScore as number) ?? 0;
  const fluencyScore = pa?.FluencyScore ?? (best.FluencyScore as number) ?? 0;
  const completenessScore =
    pa?.CompletenessScore ?? (best.CompletenessScore as number) ?? 0;
  const prosodyScore =
    pa?.ProsodyScore ?? (best.ProsodyScore as number) ?? undefined;

  const rawWords = (best.Words ?? []) as Array<Record<string, unknown>>;
  const words: AzureWord[] = rawWords.map((w) => {
    const wpa = w.PronunciationAssessment as
      | Record<string, unknown>
      | undefined;

    const rawPhonemes = (w.Phonemes ?? []) as Array<Record<string, unknown>>;
    const rawSyllables = (w.Syllables ?? []) as Array<Record<string, unknown>>;

    return {
      word: w.Word as string,
      accuracyScore:
        (wpa?.AccuracyScore as number) ?? (w.AccuracyScore as number) ?? 0,
      errorType:
        (wpa?.ErrorType as AzureWord["errorType"]) ??
        (w.ErrorType as AzureWord["errorType"]) ??
        "None",
      phonemes: rawPhonemes.map((ph) => {
        const phpa = ph.PronunciationAssessment as
          | Record<string, number>
          | undefined;
        return {
          phoneme: ph.Phoneme as string,
          accuracyScore:
            phpa?.AccuracyScore ?? (ph.AccuracyScore as number) ?? 0,
        };
      }),
      syllables: rawSyllables.map((s) => {
        const spa = s.PronunciationAssessment as
          | Record<string, number>
          | undefined;
        return {
          syllable: (s.Syllable as string) ?? "",
          grapheme: s.Grapheme as string | undefined,
          accuracyScore: spa?.AccuracyScore ?? (s.AccuracyScore as number) ?? 0,
        };
      }),
    };
  });

  return {
    pronunciationScore,
    accuracyScore,
    fluencyScore,
    completenessScore,
    prosodyScore,
    words,
  };
}
