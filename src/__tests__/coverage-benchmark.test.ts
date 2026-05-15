import { beforeEach, describe, expect, it } from "vitest";
import {
  compareCoverageBenchmarks,
  createCoverageBenchmarkSnapshot,
  loadCoverageBenchmarks,
  saveCoverageBenchmark,
} from "@/lib/coverage-benchmark";
import type { DiagnosisReport } from "@/types/diagnosis";

function report(overrides: Partial<DiagnosisReport> = {}): DiagnosisReport {
  return {
    version: 2,
    source: "coverage-passage",
    timestamp: 1_000,
    overallScore: 78,
    dimensions: {
      vowels: 76,
      consonants: 74,
      stress: 82,
      rhythm: 80,
      fluency: 84,
      connectedSpeech: 82,
    },
    phonemeScores: {
      th: { score: 52, sampleCount: 2 },
      v: { score: 72, sampleCount: 1 },
      ih: { score: 86, sampleCount: 3 },
    },
    issues: [
      {
        id: "s-th",
        severity: "major",
        type: "contrast",
        title: "/θ/ 容易缩回",
        targetPhonemes: ["th"],
        evidence: [],
        impact: "think/sink 容易混",
        fixCue: "舌尖到齿间",
        recommendedPackIds: ["s-th"],
        evidenceStrength: "fair",
      },
    ],
    prescription: { generatedAt: 1_000, source: "diagnosis", days: [] },
    rawEvidence: [],
    evidenceSummary: {
      overallStrength: "fair",
      recommendedAction: "use-with-caution",
      usableRecordings: 7,
      invalidRecordings: 0,
      thinFeatureCount: 1,
      lowConfidenceFeatures: ["v"],
      notes: [],
    },
    ...overrides,
  };
}

describe("coverage benchmark", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a compact benchmark snapshot from a coverage report", () => {
    const snapshot = createCoverageBenchmarkSnapshot(report());

    expect(snapshot).toMatchObject({
      id: "coverage-1000",
      overallScore: 78,
      usableRecordings: 7,
      invalidRecordings: 0,
    });
    expect(snapshot.weakPhonemes.map((item) => item.phoneme)).toEqual([
      "th",
      "v",
    ]);
    expect(snapshot.issues[0]).toMatchObject({
      id: "s-th",
      recommendedPackIds: ["s-th"],
    });
  });

  it("compares repeated, resolved, and new issues between stage retests", () => {
    const previous = createCoverageBenchmarkSnapshot(report());
    const current = createCoverageBenchmarkSnapshot(
      report({
        timestamp: 2_000,
        overallScore: 86,
        phonemeScores: {
          th: { score: 80, sampleCount: 3 },
          ae: { score: 58, sampleCount: 2 },
        },
        issues: [
          {
            id: "eh-ae",
            severity: "major",
            type: "contrast",
            title: "/æ/ 开口不足",
            targetPhonemes: ["ae"],
            evidence: [],
            impact: "bad/bed 易混",
            fixCue: "下巴打开",
            recommendedPackIds: ["eh-ae"],
          },
        ],
      }),
    );

    const comparison = compareCoverageBenchmarks(current, previous);

    expect(comparison.overallDelta).toBe(8);
    expect(comparison.resolvedIssueIds).toEqual(["s-th"]);
    expect(comparison.newIssueIds).toEqual(["eh-ae"]);
    expect(comparison.improvedPhonemes[0]).toMatchObject({
      phoneme: "th",
      score: 28,
    });
  });

  it("saves at most eight benchmark snapshots without duplicating the same report", () => {
    for (let index = 0; index < 10; index += 1) {
      saveCoverageBenchmark(
        report({ timestamp: 1_000 + index, overallScore: 70 + index }),
      );
    }
    saveCoverageBenchmark(report({ timestamp: 1_009, overallScore: 99 }));

    const saved = loadCoverageBenchmarks();

    expect(saved).toHaveLength(8);
    expect(saved[0]).toMatchObject({
      id: "coverage-1009",
      overallScore: 99,
    });
    expect(saved.filter((item) => item.id === "coverage-1009")).toHaveLength(1);
  });
});
