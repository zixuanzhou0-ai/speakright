import { beforeEach, describe, expect, it } from "vitest";
import {
  DEEP_TRAINING_SESSION_PREFIX,
  loadDeepTrainingSession,
  saveDeepTrainingSession,
} from "@/lib/deep-training-session";
import { readCorruptLocalData } from "@/lib/local-data-migrations";

const snapshot = {
  version: 1 as const,
  packId: "ee-ih",
  startedAt: 100,
  updatedAt: 100,
  phase: {
    type: "course" as const,
    position: { levelIndex: 1, itemIndex: 2 },
  },
  perceptionTrials: [],
  perceptionCorrect: 7,
  perceptionTotal: 8,
  perceptionExtraRemaining: 0,
  levelStats: {},
};

describe("deep training session storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a resumable course without audio or credentials", () => {
    expect(saveDeepTrainingSession(snapshot)).toBe(true);
    expect(loadDeepTrainingSession("ee-ih")).toEqual(
      expect.objectContaining({
        packId: "ee-ih",
        phase: snapshot.phase,
        perceptionCorrect: 7,
      }),
    );
    const raw = localStorage.getItem(`${DEEP_TRAINING_SESSION_PREFIX}ee-ih`);
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("audioBlob");
  });

  it("quarantines a corrupt resumable course", () => {
    const key = `${DEEP_TRAINING_SESSION_PREFIX}ee-ih`;
    localStorage.setItem(key, "{broken");

    expect(loadDeepTrainingSession("ee-ih")).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(readCorruptLocalData()).toEqual([
      expect.objectContaining({ key, raw: "{broken" }),
    ]);
  });
});
