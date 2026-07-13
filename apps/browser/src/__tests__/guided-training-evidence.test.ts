import { describe, expect, it } from "vitest";
import { buildGuidedTrainingEvidence } from "@/lib/guided-training-evidence";
import { TRAINING_PACKS } from "@/lib/training-packs";

describe("guided training evidence", () => {
  it("promotes valid ABX only to discriminated with non-applicable audio quality", () => {
    const pack = TRAINING_PACKS[0];
    const level = pack.course?.levels.find(
      (item) => item.kind === "perception",
    );
    expect(level).toBeTruthy();
    if (!level) return;

    const [evidence] = buildGuidedTrainingEvidence({
      sessionId: "session-1",
      languageId: "en-US",
      pack,
      createdAt: 100,
      levels: [
        {
          level,
          snapshot: {
            levelId: level.id,
            kind: level.kind,
            scores: [],
            attempts: 8,
            passedCount: 7,
            stuckCount: 0,
            contextIds: ["p1", "p2", "p3", "p4", "p1", "p2", "p3", "p4"],
            crossSpeakerValid: true,
          },
        },
      ],
    });

    expect(evidence.evidenceStage).toBe("discriminated");
    expect(evidence.recordingQuality.status).toBe("not-applicable");
    expect(evidence.alignmentQuality.status).toBe("not-applicable");
    expect(evidence.sampleCount).toBe(8);
    expect(evidence.contextCount).toBe(4);
    expect(evidence.trace).toMatchObject({
      sessionId: "session-1",
      levelId: level.id,
      aggregate: true,
    });
  });

  it("keeps insufficient ABX as introduced", () => {
    const pack = TRAINING_PACKS[0];
    const level = pack.course?.levels.find(
      (item) => item.kind === "perception",
    );
    expect(level).toBeTruthy();
    if (!level) return;

    const [evidence] = buildGuidedTrainingEvidence({
      sessionId: "session-2",
      languageId: "en-US",
      pack,
      createdAt: 200,
      levels: [
        {
          level,
          snapshot: {
            levelId: level.id,
            kind: level.kind,
            scores: [],
            attempts: 1,
            passedCount: 1,
            stuckCount: 0,
            contextIds: ["p1"],
            crossSpeakerValid: true,
          },
        },
      ],
    });

    expect(evidence.evidenceStage).toBe("introduced");
    expect(evidence.confidence).toBe("low");
  });
});
