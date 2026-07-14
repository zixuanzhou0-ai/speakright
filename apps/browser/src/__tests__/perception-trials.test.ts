import { isCrossSpeakerPerceptionTrial } from "@speakright/core/training/perception";
import { describe, expect, it } from "vitest";
import {
  createFocusedPackPerceptionTrials,
  createPackPerceptionTrials,
  perceptionTrialToCourseItem,
} from "@/lib/training-perception";

describe("cross-speaker ABX perception trials", () => {
  it("is deterministic for a fixed seed", () => {
    expect(createPackPerceptionTrials("ee-ih", "fixed-seed", 8)).toEqual(
      createPackPerceptionTrials("ee-ih", "fixed-seed", 8),
    );
  });

  it("removes speaker identity and identical-recording shortcuts", () => {
    const trials = createPackPerceptionTrials("ee-ih", "validity", 8);

    expect(trials).toHaveLength(8);
    expect(
      new Set(trials.map((trial) => trial.pairId)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(trials.filter((trial) => trial.probeMatches === "A")).toHaveLength(
      4,
    );
    expect(trials.filter((trial) => trial.probeMatches === "B")).toHaveLength(
      4,
    );

    for (const trial of trials) {
      expect(isCrossSpeakerPerceptionTrial(trial)).toBe(true);
      expect(trial.referenceA.speakerId).toBe(trial.referenceB.speakerId);
      expect(trial.probe.speakerId).not.toBe(trial.referenceA.speakerId);
      expect(trial.probe.uri).not.toBe(trial.referenceA.uri);
      expect(trial.probe.uri).not.toBe(trial.referenceB.uri);
      expect(trial.probe.word).not.toBe(trial.referenceA.word);
      expect(trial.probe.word).not.toBe(trial.referenceB.word);
    }
  });

  it("keeps hidden ABX assets out of the visible course item", () => {
    const [trial] = createPackPerceptionTrials("s-th", "item", 1);
    const item = perceptionTrialToCourseItem(trial, 0);

    expect(item.id).toContain("perception-trial");
    expect(item.isRecordable).toBe(false);
    expect(item.focusPoint).toContain("X");
  });
  it("focuses extra trials on contrasts missed in the first pass", () => {
    const trials = createFocusedPackPerceptionTrials(
      "ee-ih",
      "focused-review",
      ["ee-ih-7"],
      4,
    );

    expect(trials.some((trial) => trial.pairId === "ee-ih-7")).toBe(true);
  });
});
