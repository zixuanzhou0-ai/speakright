import {
  buildGuidedRepeatSessionPlan,
  buildGuidedRepeatSteps,
  type GuidedRepeatQueueItem,
  getGuidedRepeatGapMs,
  getGuidedRepeatModePolicy,
  resolveGuidedRepeatVoicePolicy,
  rotateGuidedRepeatQueue,
  validateGuidedRepeatSessionPlan,
} from "@speakright/core/training/guided-repeat";
import { describe, expect, it } from "vitest";

const POOL: GuidedRepeatQueueItem[] = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
].map((word) => ({
  materialId: `en-US:ee:${word}`,
  word,
  ipa: `/${word}/`,
  targetUnits: ["ee"],
  masculineAudioSrc: `/audio/words/blue/${word}.mp3`,
  feminineAudioSrc: `/audio/words/pink/${word}.mp3`,
}));

describe("guided repeat core", () => {
  it("rotates a frozen queue from the current word without duplicates", () => {
    expect(
      rotateGuidedRepeatQueue(POOL, "en-US:ee:three")
        .slice(0, 4)
        .map((item) => item.word),
    ).toEqual(["three", "four", "five", "six"]);
  });

  it("builds a full-pool quick review with one opening anchor and alternating voices", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      mode: "quick",
      anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
      pool: POOL,
      currentMaterialId: POOL[2].materialId,
    });
    const steps = buildGuidedRepeatSteps(plan);
    const audio = steps.filter((step) => step.kind === "audio");
    const wordAudio = audio.filter((step) => step.role !== "anchor-single");

    expect(plan.queue.map((item) => item.word)).toEqual([
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "one",
      "two",
    ]);
    expect(plan.totalWords).toBe(12);
    expect(audio[0]?.role).toBe("anchor-single");
    expect(wordAudio.map((step) => step.role)).toEqual(
      Array.from({ length: 12 }, (_, index) =>
        index % 2 === 0 ? "word-masculine" : "word-feminine",
      ),
    );
    expect(
      wordAudio.every((step) => step.turn === 1 && step.turnTotal === 1),
    ).toBe(true);
    expect(steps.filter((step) => step.kind === "transition")).toHaveLength(11);
  });

  it("builds full-pool standard training with an anchor reminder after every five words", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      mode: "standard",
      anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
      pool: POOL,
      currentMaterialId: POOL[0].materialId,
    });
    const audio = buildGuidedRepeatSteps(plan).filter(
      (step) => step.kind === "audio",
    );
    const anchors = audio.filter((step) => step.role === "anchor-single");
    const words = audio.filter((step) => step.role !== "anchor-single");

    expect(plan.totalWords).toBe(12);
    expect(anchors.map((step) => step.wordIndex)).toEqual([0, 0, 5, 10]);
    expect(anchors.map((step) => [step.turn, step.turnTotal])).toEqual([
      [1, 2],
      [2, 2],
      [1, 1],
      [1, 1],
    ]);
    expect(words).toHaveLength(24);
    expect(
      Array.from({ length: 12 }, (_, wordIndex) =>
        words
          .filter((step) => step.wordIndex === wordIndex)
          .map((step) => step.role),
      ),
    ).toEqual(
      Array.from({ length: 12 }, () => ["word-masculine", "word-feminine"]),
    );
  });

  it("builds intensive training with an anchor and four rounds for every word", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      mode: "intensive",
      anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
      pool: POOL.slice(0, 2),
      currentMaterialId: POOL[0].materialId,
    });
    const audio = buildGuidedRepeatSteps(plan).filter(
      (step) => step.kind === "audio",
    );

    expect(audio.map((step) => step.role)).toEqual([
      "anchor-single",
      "word-masculine",
      "word-feminine",
      "word-masculine",
      "word-feminine",
      "anchor-single",
      "word-masculine",
      "word-feminine",
      "word-masculine",
      "word-feminine",
    ]);
    expect(
      audio
        .filter((step) => step.wordIndex === 0 && step.role !== "anchor-single")
        .map((step) => [step.turn, step.turnTotal]),
    ).toEqual([
      [1, 2],
      [1, 2],
      [2, 2],
      [2, 2],
    ]);
  });

  it("keeps Russian masculine and feminine semantics in standard mode", () => {
    const policy = resolveGuidedRepeatVoicePolicy("ru-RU");
    expect(policy.masculine.assetSlot).toBe("pink");
    expect(policy.feminine.assetSlot).toBe("blue");
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "ru-RU",
      soundUnitSlug: "ru-a",
      mode: "standard",
      anchorAudio: { single: "/audio/language-assets/ru-RU/a.m4a" },
      pool: [
        {
          ...POOL[0],
          masculineAudioSrc: "/audio/language-packs/ru-RU/a-pink.mp3",
          feminineAudioSrc: "/audio/language-packs/ru-RU/a-blue.mp3",
        },
      ],
      currentMaterialId: POOL[0].materialId,
    });
    expect(
      buildGuidedRepeatSteps(plan)
        .filter((step) => step.kind === "audio")
        .map((step) => step.role),
    ).toEqual([
      "anchor-single",
      "anchor-single",
      "word-masculine",
      "word-feminine",
    ]);
  });

  it("keeps every available word regardless of the selected mode", () => {
    for (const mode of ["quick", "standard", "intensive"] as const) {
      const plan = buildGuidedRepeatSessionPlan({
        languageId: "en-US",
        soundUnitSlug: "ee",
        mode,
        anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
        pool: POOL,
        currentMaterialId: POOL[0].materialId,
      });
      expect(plan.totalWords).toBe(POOL.length);
      expect(plan.queue).toHaveLength(POOL.length);
    }
    expect(getGuidedRepeatModePolicy("quick")).toEqual({ wordRounds: 1 });
    expect(getGuidedRepeatModePolicy("standard")).toEqual({ wordRounds: 2 });
    expect(getGuidedRepeatModePolicy("intensive")).toEqual({ wordRounds: 4 });
  });

  it("uses clamped rhythm timing without changing playback speed", () => {
    expect(getGuidedRepeatGapMs(500, "flow", "imitation")).toBe(900);
    expect(getGuidedRepeatGapMs(1000, "standard", "imitation")).toBe(1400);
    expect(getGuidedRepeatGapMs(10_000, "relaxed", "imitation")).toBe(4200);
    expect(getGuidedRepeatGapMs(0, "flow", "anchor-imitation")).toBe(900);
    expect(getGuidedRepeatGapMs(0, "standard", "anchor-imitation")).toBe(1200);
    expect(getGuidedRepeatGapMs(0, "relaxed", "anchor-imitation")).toBe(1600);
    expect(getGuidedRepeatGapMs(0, "standard", "transition")).toBe(650);
  });

  it("rejects online or incomplete core assets", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      mode: "standard",
      anchorAudio: { single: "https://example.com/phoneme.mp3" },
      pool: POOL,
      currentMaterialId: POOL[0].materialId,
    });
    expect(validateGuidedRepeatSessionPlan(plan)).toMatchObject({
      valid: false,
    });
  });
});
