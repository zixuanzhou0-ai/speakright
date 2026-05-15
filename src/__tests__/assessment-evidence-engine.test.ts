import { describe, expect, it } from "vitest";
import {
  analyzeAssessmentEvidence,
  summarizeAssessmentAnalyses,
} from "@/lib/assessment-evidence-engine";
import type { AzureAssessmentResult, AzureWord } from "@/types/azure";

function word(
  text: string,
  phonemes: Array<{ phoneme: string; accuracyScore: number }>,
  errorType: AzureWord["errorType"] = "None",
): AzureWord {
  return {
    word: text,
    accuracyScore: Math.round(
      phonemes.reduce((sum, item) => sum + item.accuracyScore, 0) /
        Math.max(phonemes.length, 1),
    ),
    errorType,
    phonemes,
    syllables: [{ syllable: text, accuracyScore: 82 }],
  };
}

function result(
  words: AzureWord[],
  overrides: Partial<AzureAssessmentResult> = {},
): AzureAssessmentResult {
  return {
    pronunciationScore: overrides.pronunciationScore ?? 78,
    accuracyScore: overrides.accuracyScore ?? 78,
    fluencyScore: overrides.fluencyScore ?? 84,
    completenessScore: overrides.completenessScore ?? 100,
    prosodyScore: overrides.prosodyScore ?? 84,
    words,
  };
}

describe("assessment evidence engine", () => {
  it("invalidates recordings that are too incomplete to diagnose", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "短文朗读",
      referenceText: "Think through thin teeth",
      source: "paragraph",
      result: result([], { completenessScore: 18, fluencyScore: 0 }),
    });

    expect(analysis.usable).toBe(false);
    expect(analysis.recordingStrength).toBe("invalid");
    expect(analysis.recommendedAction).toBe("request-retry");
    expect(analysis.tokens).toHaveLength(0);
  });

  it("marks a single weak token as thin evidence that needs more samples", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "think",
      referenceText: "think",
      source: "word",
      result: result([
        word("think", [
          { phoneme: "th", accuracyScore: 52 },
          { phoneme: "ih", accuracyScore: 84 },
          { phoneme: "ng", accuracyScore: 86 },
          { phoneme: "k", accuracyScore: 88 },
        ]),
      ]),
    });

    expect(analysis.usable).toBe(true);
    expect(analysis.phonemeEvidence.th.strength).toBe("thin");
    expect(analysis.phonemeEvidence.th.recommendedAction).toBe(
      "request-more-samples",
    );
  });

  it("promotes repeated low evidence across contexts to strong evidence", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "齿间音补测",
      referenceText: "Think through thin teeth.",
      source: "coverage-probe",
      result: result([
        word("Think", [
          { phoneme: "th", accuracyScore: 48 },
          { phoneme: "ih", accuracyScore: 82 },
        ]),
        word("through", [
          { phoneme: "th", accuracyScore: 51 },
          { phoneme: "r", accuracyScore: 88 },
        ]),
        word("thin", [
          { phoneme: "th", accuracyScore: 55 },
          { phoneme: "ih", accuracyScore: 82 },
        ]),
        word("teeth", [
          { phoneme: "t", accuracyScore: 88 },
          { phoneme: "th", accuracyScore: 50 },
        ]),
      ]),
    });

    expect(analysis.phonemeEvidence.th.sampleCount).toBe(4);
    expect(analysis.phonemeEvidence.th.strength).toBe("strong");
    expect(analysis.phonemeEvidence.th.confidence).toBe("high");
  });

  it("summarizes invalid and thin features at report level", () => {
    const invalid = analyzeAssessmentEvidence({
      label: "坏录音",
      referenceText: "A clear sentence should be readable.",
      source: "paragraph",
      result: result([], { completenessScore: 10 }),
    });
    const thin = analyzeAssessmentEvidence({
      label: "think",
      referenceText: "think",
      source: "word",
      result: result([
        word("think", [
          { phoneme: "th", accuracyScore: 50 },
          { phoneme: "ih", accuracyScore: 82 },
        ]),
      ]),
    });

    const summary = summarizeAssessmentAnalyses([invalid, thin]);

    expect(summary.invalidRecordings).toBe(1);
    expect(summary.lowConfidenceFeatures).toContain("th");
    expect(summary.recommendedAction).toBe("request-more-samples");
  });
});
