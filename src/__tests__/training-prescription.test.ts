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

    expect(packIds).toContain("s-th");
    expect(packIds).toContain("ee-ih");
    expect(prescription.days[0].items[0].levelId).toBe("perception-abx");
    expect(prescription.source).toBe("default");
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
      prescription.days.flatMap((day) => day.items).find((item) => item.packId === "v-w")
        ?.levelId,
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
});
