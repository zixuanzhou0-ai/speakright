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

  it("summarizes hard miscues even when a recording remains otherwise usable", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "西语短文",
      referenceText: "Mi casa esta cerca de la plaza",
      source: "paragraph",
      languageId: "es-ES",
      result: result([
        word("Mi", [{ phoneme: "i", accuracyScore: 96 }]),
        word("casa", [{ phoneme: "a", accuracyScore: 96 }], "Omission"),
        word("esta", [{ phoneme: "a", accuracyScore: 96 }]),
        word("cerca", [{ phoneme: "e", accuracyScore: 96 }]),
        word("de", [{ phoneme: "e", accuracyScore: 96 }]),
        word("la", [{ phoneme: "a", accuracyScore: 96 }]),
        word("plaza", [{ phoneme: "a", accuracyScore: 96 }]),
      ]),
    });

    const summary = summarizeAssessmentAnalyses([analysis]);

    expect(analysis.usable).toBe(true);
    expect(summary.omissionCount).toBe(1);
    expect(summary.insertionCount).toBe(0);
    expect(summary.wordLevelEvidenceCount).toBe(6);
  });

  it("uses Unicode tokenization for non-English diagnosis text", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "法语短句",
      referenceText: "Été très bon.",
      source: "paragraph",
      languageId: "fr-FR",
      result: result([
        word("Été", [
          { phoneme: "e", accuracyScore: 74 },
          { phoneme: "t", accuracyScore: 86 },
          { phoneme: "e", accuracyScore: 76 },
        ]),
        word("très", [{ phoneme: "ɛ", accuracyScore: 70 }]),
        word("bon", [{ phoneme: "ɔ̃", accuracyScore: 68 }]),
      ]),
    });

    expect(analysis.alignment.expectedWordCount).toBe(3);
    expect(analysis.alignment.observedWordCount).toBe(3);
    expect(analysis.phonemeEvidence["fr-e"].sampleCount).toBe(2);
    expect(analysis.phonemeEvidence["fr-e-open"].sampleCount).toBe(1);
    expect(analysis.phonemeEvidence["fr-on"].sampleCount).toBe(1);
    expect(analysis.phonemeEvidence.eh).toBeUndefined();
  });

  it("outputs language-specific slugs for Russian evidence instead of English slugs", () => {
    const analysis = analyzeAssessmentEvidence({
      label: "俄语补测",
      referenceText: "ты сыр",
      source: "coverage-probe",
      languageId: "ru-RU",
      result: result([
        word("ты", [
          { phoneme: "t", accuracyScore: 82 },
          { phoneme: "ɨ", accuracyScore: 62 },
        ]),
        word("сыр", [
          { phoneme: "s", accuracyScore: 80 },
          { phoneme: "ɨ", accuracyScore: 64 },
          { phoneme: "r", accuracyScore: 86 },
        ]),
      ]),
    });

    expect(analysis.phonemeEvidence["ru-y"].sampleCount).toBe(2);
    expect(analysis.phonemeEvidence.ih).toBeUndefined();
    expect(analysis.phonemeEvidence.r).toBeUndefined();
  });
});
