import { describe, expect, it } from "vitest";
import {
  buildTransferPromptPlan,
  TRANSFER_SCENARIOS,
} from "@/lib/transfer-scenarios";
import type { MasteryProfile } from "@/types/training";

describe("transfer scenarios", () => {
  it("provides realistic scenario prompts with target packs", () => {
    expect(TRANSFER_SCENARIOS.map((scenario) => scenario.kind)).toEqual(
      expect.arrayContaining([
        "meeting",
        "interview",
        "presentation",
        "daily",
        "technical",
      ]),
    );
    expect(
      TRANSFER_SCENARIOS.every((scenario) => scenario.targetPackIds.length > 0),
    ).toBe(true);
  });

  it("prioritizes active user weakness packs inside a scenario plan", () => {
    const profile: MasteryProfile = {
      version: 2,
      languageId: "en-US",
      updatedAt: 1000,
      packs: {
        "s-th": {
          packId: "s-th",
          status: "practicing",
          levelProgress: {},
          bestTargetScore: 55,
          perceptionBestRate: 0.6,
          completedSessions: 1,
          failureStreak: 4,
        },
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [],
    };

    const plan = buildTransferPromptPlan("standup-update", profile);

    expect(plan.targetPackIds[0]).toBe("s-th");
    expect(plan.targetWords.length).toBeGreaterThan(0);
    expect(plan.coachingFocus).toContain("只盯");
  });
});
