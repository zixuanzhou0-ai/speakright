import { describe, expect, it } from "vitest";
import {
  COVERAGE_PASSAGE,
  COVERAGE_TARGET_PACKS,
  selectCoverageAdaptiveProbes,
} from "@/lib/coverage-passage";
import { buildCoveragePassageDiagnosisReport } from "@/lib/diagnosis-engine";
import type { AzureAssessmentResult } from "@/types/azure";
import type { DiagnosisReport } from "@/types/diagnosis";

function resultForWords(
  words: Array<{
    word: string;
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
  }>,
  overrides: Partial<AzureAssessmentResult> = {},
): AzureAssessmentResult {
  return {
    pronunciationScore: overrides.pronunciationScore ?? 78,
    accuracyScore: overrides.accuracyScore ?? 78,
    fluencyScore: overrides.fluencyScore ?? 84,
    completenessScore: overrides.completenessScore ?? 100,
    prosodyScore: overrides.prosodyScore ?? 84,
    words: words.map((word) => ({
      word: word.word,
      accuracyScore: 78,
      errorType: "None",
      phonemes: word.phonemes,
      syllables: [{ syllable: word.word, accuracyScore: 82 }],
    })),
  };
}

describe("coverage passage", () => {
  it("covers the ten core training packs with natural recordable text", () => {
    expect(COVERAGE_PASSAGE.segments.length).toBeGreaterThanOrEqual(7);

    const coveredFeatures = new Set(
      COVERAGE_PASSAGE.segments.flatMap((segment) => segment.targetFeatures),
    );
    for (const packId of COVERAGE_TARGET_PACKS) {
      expect(coveredFeatures.has(packId)).toBe(true);
    }

    for (const item of [
      ...COVERAGE_PASSAGE.segments,
      ...COVERAGE_PASSAGE.probes,
    ]) {
      expect(item.text.trim().length).toBeGreaterThan(20);
      expect(item.text).not.toMatch(/\/[a-zːɪʊæəɝθðŋ]+\/|target|slow word/i);
      expect(item.evidenceWords.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("builds a v2 coverage report and maps weak th evidence to s-th", () => {
    const report = buildCoveragePassageDiagnosisReport({
      recordings: [
        {
          text: "thin sheep",
          label: COVERAGE_PASSAGE.segments[0].title,
          source: "coverage-segment",
          result: resultForWords([
            {
              word: "thin",
              phonemes: [
                { phoneme: "th", accuracyScore: 46 },
                { phoneme: "ih", accuracyScore: 83 },
                { phoneme: "n", accuracyScore: 88 },
              ],
            },
            {
              word: "sheep",
              phonemes: [{ phoneme: "iy", accuracyScore: 88 }],
            },
          ]),
        },
        {
          text: "rhythm",
          label: COVERAGE_PASSAGE.segments[6].title,
          source: "coverage-segment",
          result: resultForWords(
            [
              {
                word: "rhythm",
                phonemes: [
                  { phoneme: "r", accuracyScore: 82 },
                  { phoneme: "ih", accuracyScore: 80 },
                ],
              },
            ],
            { prosodyScore: 86, fluencyScore: 88 },
          ),
        },
      ],
    });

    expect(report.version).toBe(2);
    expect(report.source).toBe("coverage-passage");
    expect(report.phonemeScores.th.score).toBe(46);
    expect(report.issues.some((issue) => issue.id === "s-th")).toBe(true);
    expect(report.rawEvidence[0].source).toBe("coverage-segment");
  });

  it("selects adaptive probes from weak issues without repeating used probes", () => {
    const report: DiagnosisReport = {
      version: 2,
      source: "coverage-passage",
      timestamp: Date.now(),
      overallScore: 70,
      dimensions: {
        vowels: 80,
        consonants: 68,
        stress: 82,
        rhythm: 84,
        fluency: 85,
        connectedSpeech: 84,
      },
      phonemeScores: {
        th: { score: 52, sampleCount: 1 },
      },
      issues: [
        {
          id: "s-th",
          severity: "major",
          type: "contrast",
          title: "/θ/ 容易读成 /s/",
          targetPhonemes: ["th"],
          evidence: [{ text: "thin", score: 52, detail: "low th" }],
          impact: "think 会不清楚",
          fixCue: "舌尖到齿间",
          recommendedPackIds: ["s-th"],
          confidence: "low",
          evidenceStrength: "thin",
        },
      ],
      prescription: { generatedAt: Date.now(), source: "diagnosis", days: [] },
      rawEvidence: [],
    };

    const probes = selectCoverageAdaptiveProbes(report);
    expect(probes[0]?.id).toBe("probe-s-th");
    expect(
      selectCoverageAdaptiveProbes(report, ["probe-s-th"]).map(
        (probe) => probe.id,
      ),
    ).not.toContain("probe-s-th");
  });

  it("creates rhythm evidence from the weakest passage segment", () => {
    const report = buildCoveragePassageDiagnosisReport({
      recordings: [
        {
          text: "again",
          label: COVERAGE_PASSAGE.segments[6].title,
          source: "coverage-segment",
          result: resultForWords(
            [
              {
                word: "again",
                phonemes: [
                  { phoneme: "ax", accuracyScore: 86 },
                  { phoneme: "n", accuracyScore: 84 },
                ],
              },
            ],
            { prosodyScore: 54, fluencyScore: 58 },
          ),
        },
      ],
    });

    const rhythmIssue = report.issues.find(
      (issue) => issue.id === "stress-rhythm",
    );

    expect(rhythmIssue?.recommendedPackIds).toContain("stress-rhythm");
    expect(rhythmIssue?.evidence[0]?.text).toBe("连起来说");
    expect(selectCoverageAdaptiveProbes(report)[0]?.id).toBe(
      "probe-stress-rhythm",
    );
  });

  it("includes coverage recording quality notes in evidence summary", () => {
    const report = buildCoveragePassageDiagnosisReport({
      recordings: [
        {
          text: "thin sheep",
          label: COVERAGE_PASSAGE.segments[0].title,
          source: "coverage-segment",
          recordingQuality: {
            score: 72,
            canSubmit: true,
            issues: [
              {
                code: "low-level",
                severity: "warning",
                title: "音量偏低",
                detail: "可以评分，但不建议用于提升掌握度。",
              },
            ],
          },
          result: resultForWords([
            {
              word: "thin",
              phonemes: [
                { phoneme: "th", accuracyScore: 78 },
                { phoneme: "ih", accuracyScore: 83 },
                { phoneme: "n", accuracyScore: 88 },
              ],
            },
          ]),
        },
      ],
    });

    expect(report.evidenceSummary?.notes.join("\n")).toContain(
      "录音质量：音量偏低",
    );
  });

  it("routes repeated weak final consonants to the final consonant probe", () => {
    const report = buildCoveragePassageDiagnosisReport({
      recordings: [
        {
          text: "asked lift",
          label: COVERAGE_PASSAGE.segments[5].title,
          source: "coverage-segment",
          result: resultForWords([
            {
              word: "asked",
              phonemes: [
                { phoneme: "ae", accuracyScore: 88 },
                { phoneme: "s", accuracyScore: 55 },
                { phoneme: "k", accuracyScore: 58 },
                { phoneme: "t", accuracyScore: 49 },
              ],
            },
            {
              word: "lift",
              phonemes: [
                { phoneme: "l", accuracyScore: 86 },
                { phoneme: "ih", accuracyScore: 84 },
                { phoneme: "f", accuracyScore: 77 },
                { phoneme: "t", accuracyScore: 52 },
              ],
            },
          ]),
        },
      ],
    });

    expect(report.issues.some((issue) => issue.id === "final-consonants")).toBe(
      true,
    );
    expect(selectCoverageAdaptiveProbes(report)[0]?.id).toBe(
      "probe-final-consonants",
    );
  });
});
