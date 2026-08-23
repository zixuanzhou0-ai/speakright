import { beforeEach, describe, expect, it } from "vitest";
import {
  appendLearningEvidence,
  LEARNING_EVIDENCE_STORAGE_KEY,
  loadLearningEvidence,
  migrateLegacyMasteryEvidence,
  summarizeLearningEvidence,
} from "@/lib/learning-evidence";
import type { LearningEvidenceV3 } from "@/types/learning-evidence";

describe("learning evidence v3", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy mastery as low-confidence unvalidated evidence", () => {
    localStorage.setItem(
      "speakright_mastery_profile_v2",
      JSON.stringify({
        version: 2,
        updatedAt: 123,
        packs: {
          "s-th": {
            masteryState: "transferred",
            bestTargetScore: 78,
            completedSessions: 3,
          },
        },
      }),
    );

    expect(migrateLegacyMasteryEvidence()).toBe(true);
    const store = loadLearningEvidence();
    expect(store.version).toBe(3);
    expect(store.evidence).toHaveLength(1);
    expect(store.evidence[0]).toMatchObject({
      targetUnits: ["s-th"],
      evidenceStage: "introduced",
      confidence: "low",
      calibrationVersion: "legacy-unvalidated",
      sampleCount: 3,
    });
  });

  it("deduplicates evidence ids without discarding the newest item", () => {
    const base: LearningEvidenceV3 = {
      id: "attempt-1",
      version: 3,
      languageId: "en-US",
      taskType: "controlled-word",
      targetUnits: ["th"],
      observations: [],
      recordingQuality: { status: "good", reasons: [] },
      alignmentQuality: { status: "good", reasons: [] },
      sampleCount: 1,
      contextCount: 1,
      source: "training",
      confidence: "low",
      evidenceStage: "controlled",
      calibrationVersion: "pre-pilot-v1",
      createdAt: 1,
    };

    expect(appendLearningEvidence(base)).toBe(true);
    expect(
      appendLearningEvidence({ ...base, confidence: "medium", createdAt: 2 }),
    ).toBe(true);

    const stored = JSON.parse(
      localStorage.getItem(LEARNING_EVIDENCE_STORAGE_KEY) ?? "{}",
    );
    expect(stored.evidence).toHaveLength(1);
    expect(stored.evidence[0].confidence).toBe("medium");
    expect(stored.evidence[0].createdAt).toBe(2);
  });
  it("summarizes cumulative stages and excludes invalid recordings", () => {
    const evidence = (
      id: string,
      target: string,
      stage: LearningEvidenceV3["evidenceStage"],
      recordingStatus: LearningEvidenceV3["recordingQuality"]["status"] = "good",
    ): LearningEvidenceV3 => ({
      id,
      version: 3,
      languageId: "en-US",
      taskType: "controlled-word",
      targetUnits: [target],
      observations: [],
      recordingQuality: { status: recordingStatus, reasons: [] },
      alignmentQuality: { status: "good", reasons: [] },
      sampleCount: 1,
      contextCount: 1,
      source: "training",
      confidence: "low",
      evidenceStage: stage,
      calibrationVersion: "test",
      createdAt: 1,
    });

    const summary = summarizeLearningEvidence(
      [
        evidence("one", "th", "varied"),
        evidence("two", "l", "controlled"),
        evidence("invalid", "r", "retention_observed", "invalid"),
      ],
      "en-US",
    );

    expect(summary.totalTargets).toBe(2);
    expect(summary.stageCounts.controlled).toBe(2);
    expect(summary.stageCounts.varied).toBe(1);
    expect(summary.stageCounts.transfer_observed).toBe(0);
  });
});
