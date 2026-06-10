import { getPhonemeAccuracy } from "@/lib/azure-phoneme-map";
import type { AzureAssessmentResult } from "@/types/azure";

export function getTargetPhonemeScore(
  result: AzureAssessmentResult,
  targetPhonemes: string[],
): number | null {
  const scores = targetPhonemes
    .map((phoneme) => getPhonemeAccuracy(result, phoneme))
    .filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function getPassScore(
  result: AzureAssessmentResult,
  targetPhonemes: string[],
  options: { allowFallback?: boolean } = { allowFallback: true },
): {
  targetScore: number;
  overallScore: number;
  usedFallback: boolean;
} {
  const targetScore = getTargetPhonemeScore(result, targetPhonemes);
  const usedFallback = targetScore === null;
  return {
    targetScore:
      targetScore ?? (options.allowFallback ? result.pronunciationScore : 0),
    overallScore: result.pronunciationScore,
    usedFallback,
  };
}
