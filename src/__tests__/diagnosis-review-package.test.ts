import { describe, expect, it } from "vitest";
import { buildDiagnosisReviewPackage } from "@/lib/diagnosis-review-package";
import type { DiagnosisReport } from "@/types/diagnosis";

function report(): DiagnosisReport {
  return {
    version: 2,
    languageId: "en-US",
    timestamp: 1000,
    overallScore: 72,
    dimensions: {
      vowels: 70,
      consonants: 72,
      stress: 75,
      rhythm: 74,
      fluency: 76,
      connectedSpeech: 70,
    },
    phonemeScores: {},
    prescription: { generatedAt: 1000, source: "diagnosis", days: [] },
    rawEvidence: [],
    issues: [
      {
        id: "thin-th",
        severity: "major",
        type: "contrast",
        title: "/th/ 证据偏薄",
        targetPhonemes: ["th"],
        evidence: [],
        impact: "影响 think/sink",
        fixCue: "舌尖到齿边",
        recommendedPackIds: ["s-th"],
        confidence: "low",
        evidenceStrength: "thin",
      },
      {
        id: "strong-v",
        severity: "major",
        type: "contrast",
        title: "/v/ 稳定偏低",
        targetPhonemes: ["v"],
        evidence: [],
        impact: "影响 very/wary",
        fixCue: "上齿碰下唇",
        recommendedPackIds: ["v-w"],
        confidence: "high",
        evidenceStrength: "strong",
      },
    ],
  };
}

describe("diagnosis review package", () => {
  it("separates low-confidence diagnosis from strong training evidence", () => {
    const review = buildDiagnosisReviewPackage(report());

    expect(review.reviewItems).toHaveLength(1);
    expect(review.reviewItems[0]).toMatchObject({
      issueId: "thin-th",
      suggestedAction: "retest",
    });
    expect(review.reviewItems[0].retestWords.length).toBeGreaterThan(0);
    expect(
      review.reviewItems[0].retestWords.every((word) =>
        word.targetPhonemes.includes("th"),
      ),
    ).toBe(true);
    expect(review.summary).toContain("补测");
  });
});
