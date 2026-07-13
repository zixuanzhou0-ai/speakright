import { describe, expect, it } from "vitest";
import { buildFreePracticeAttemptEvidence } from "@/lib/free-practice-evidence";

describe("free-practice V3 evidence", () => {
  it("stores a traceable observation without promoting one recording", () => {
    const [evidence] = buildFreePracticeAttemptEvidence({
      sessionId: "session-1",
      languageId: "en-US",
      summary: {
        generatedAt: 100,
        text: "I think this is clear",
        mode: "sentence",
        transferLayer: "spontaneous",
        recorded: false,
        assessmentReliability: {
          audioQualityScore: 92,
          audioQualityIssues: [],
          alignment: "good",
          evidenceStrength: "fair",
          canPromoteMastery: true,
        },
        evidences: [
          {
            packId: "ee-ih",
            packTitle: "测试",
            levelId: "sentence",
            targetPhonemes: ["ee", "ih"],
            matchedWords: ["think", "this"],
            targetScore: 81,
            overallScore: 84,
            threshold: 80,
            passed: true,
            source: "active-pack",
            reason: "测试",
            nextCue: "继续",
            patternIds: [],
          },
        ],
      },
    });

    expect(evidence).toMatchObject({
      source: "free-practice",
      taskType: "spontaneous-transfer",
      evidenceStage: "introduced",
      confidence: "low",
      sampleCount: 1,
      contextCount: 1,
    });
  });
});
