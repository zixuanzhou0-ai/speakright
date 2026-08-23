import { describe, expect, it } from "vitest";
import { buildAzureAttemptEvidence } from "@/lib/azure-attempt-evidence";

describe("single Azure observation evidence", () => {
  it("never promotes one aligned high score beyond introduced", () => {
    const evidence = buildAzureAttemptEvidence({
      id: "attempt-1",
      sessionId: "session-1",
      languageId: "en-US",
      taskType: "controlled-word",
      targetUnits: ["ih"],
      materialIds: ["ship"],
      result: {
        pronunciationScore: 99,
        accuracyScore: 99,
        fluencyScore: 99,
        completenessScore: 99,
        words: [],
      },
      targetScore: 99,
      recordingQuality: { valid: true, score: 95 },
      alignmentValid: true,
    });

    expect(evidence.evidenceStage).toBe("introduced");
    expect(evidence.confidence).toBe("low");
    expect(evidence.observations).toContainEqual(
      expect.objectContaining({ metric: "target-unit", score: 99 }),
    );
  });
});
