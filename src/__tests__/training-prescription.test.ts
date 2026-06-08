import { describe, expect, it } from "vitest";
import {
  buildDefaultPrescription,
  buildTrainingPrescription,
} from "@/lib/training-prescription";
import type { DiagnosisIssue } from "@/types/diagnosis";
import type { MasteryProfile } from "@/types/training";

function issue(
  id: string,
  severity: DiagnosisIssue["severity"],
  packId: string,
): DiagnosisIssue {
  return {
    id,
    severity,
    type: "contrast",
    title: id,
    targetPhonemes: [],
    evidence: [{ text: id, score: 50, detail: id }],
    impact: `${id} impact`,
    fixCue: `${id} fix`,
    recommendedPackIds: [packId],
  };
}

describe("training prescription", () => {
  it("prioritizes critical issues and deduplicates packs", () => {
    const prescription = buildTrainingPrescription([
      issue("minor", "minor", "v-w"),
      issue("critical", "critical", "s-th"),
      issue("duplicate", "major", "s-th"),
    ]);

    expect(prescription.days[0].items[0].packId).toBe("s-th");
    expect(prescription.days[0].items.map((item) => item.packId)).toEqual([
      "s-th",
      "v-w",
    ]);
    expect(prescription.days[0].items[0].levelId).toBe("perception-abx");
  });

  it("falls back to default high-frequency packs", () => {
    const prescription = buildDefaultPrescription();
    const packIds = prescription.days
      .flatMap((day) => day.items)
      .map((item) => item.packId);

    expect(packIds).toContain("final-consonants");
    expect(packIds).toContain("ee-ih");
    expect(prescription.days[0].items[0].levelId).toBe("perception-abx");
    expect(prescription.source).toBe("default");
  });

  it("routes low-confidence issues to retest instead of primary training", () => {
    const thinIssue = issue("thin-th", "critical", "s-th");
    thinIssue.confidence = "low";
    thinIssue.evidenceStrength = "thin";

    const prescription = buildTrainingPrescription([thinIssue]);
    const firstDayPackIds = prescription.days[0].items.map(
      (item) => item.packId,
    );

    expect(firstDayPackIds).not.toContain("s-th");
  });

  it("defers mastered packs unless review is due", () => {
    const profile: MasteryProfile = {
      version: 2,
      updatedAt: 1,
      packs: {
        "s-th": {
          packId: "s-th",
          status: "mastered",
          levelProgress: {},
          bestTargetScore: 90,
          perceptionBestRate: 1,
          completedSessions: 2,
          failureStreak: 0,
          nextReviewAt: Date.now() + 100000,
        },
        "v-w": {
          packId: "v-w",
          status: "mastered",
          levelProgress: {},
          bestTargetScore: 88,
          perceptionBestRate: 1,
          completedSessions: 2,
          failureStreak: 0,
          nextReviewAt: Date.now() - 1000,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [],
    };

    const prescription = buildTrainingPrescription(
      [issue("critical", "critical", "s-th")],
      "diagnosis",
      profile,
    );
    const packIds = prescription.days
      .flatMap((day) => day.items)
      .map((item) => item.packId);

    expect(packIds).not.toContain("s-th");
    expect(packIds).toContain("v-w");
    expect(
      prescription.days
        .flatMap((day) => day.items)
        .find((item) => item.packId === "v-w")?.levelId,
    ).toBe("mixed-review");
  });

  it("uses diagnosis nextLesson when available", () => {
    const diagnosisIssue = issue("rhythm", "critical", "stress-rhythm");
    diagnosisIssue.nextLesson = {
      packId: "stress-rhythm",
      levelId: "shadowing-transfer",
      reason: "句子节奏优先跟读。",
    };

    const prescription = buildTrainingPrescription([diagnosisIssue]);

    expect(prescription.days[0].items[0]).toMatchObject({
      packId: "stress-rhythm",
      levelId: "shadowing-transfer",
    });
  });

  it("routes diagnosis items through the current mastery stage", () => {
    const diagnosisIssue = issue("thin", "critical", "s-th");
    diagnosisIssue.evidenceStrength = "strong";
    const profile: MasteryProfile = {
      version: 2,
      updatedAt: 1,
      packs: {
        "s-th": {
          packId: "s-th",
          status: "practicing",
          masteryState: "learning",
          stageScore: 30,
          stageCeiling: 35,
          highestLayer: "articulation",
          nextRequiredLayer: "word",
          stateRationale: "动作已建立，下一步要放进真实单词。",
          levelProgress: {},
          bestTargetScore: 76,
          perceptionBestRate: 0.86,
          completedSessions: 1,
          failureStreak: 0,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [],
    };

    const prescription = buildTrainingPrescription(
      [diagnosisIssue],
      "diagnosis",
      profile,
    );

    expect(prescription.days[0].items[0]).toMatchObject({
      packId: "s-th",
      levelId: "word-ladder",
      currentMasteryState: "learning",
      stageScore: 30,
      stageCeiling: 35,
      highestLayer: "articulation",
      nextRequiredLayer: "word",
      evidenceStrength: "strong",
    });
    expect(prescription.days[0].items[0].learningObjective).toContain(
      "真实单词",
    );
  });

  it("routes due reviews to the next required mastery layer", () => {
    const profile: MasteryProfile = {
      version: 2,
      updatedAt: 1,
      packs: {
        "v-w": {
          packId: "v-w",
          status: "mastered",
          masteryState: "retained",
          stageScore: 78,
          stageCeiling: 85,
          highestLayer: "connected",
          nextRequiredLayer: "guided",
          levelProgress: {},
          bestTargetScore: 91,
          perceptionBestRate: 1,
          completedSessions: 3,
          failureStreak: 0,
          nextReviewAt: Date.now() - 1000,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [],
    };

    const prescription = buildTrainingPrescription([], "review", profile);

    expect(prescription.days[0].items[0]).toMatchObject({
      packId: "v-w",
      levelId: "shadowing-transfer",
      currentMasteryState: "retained",
      nextRequiredLayer: "guided",
    });
    expect(prescription.days[0].items[0].learningObjective).toContain(
      "半开放回答",
    );
  });
});
