import {
  buildGuidedRepeatSessionPlan,
  buildGuidedRepeatSteps,
  type GuidedRepeatQueueItem,
  getGuidedRepeatGapMs,
  resolveGuidedRepeatVoicePolicy,
  rotateGuidedRepeatQueue,
  validateGuidedRepeatSessionPlan,
} from "@speakright/core/training/guided-repeat";
import { describe, expect, it } from "vitest";

const POOL: GuidedRepeatQueueItem[] = ["one", "two", "three", "four"].map(
  (word) => ({
    materialId: `en-US:ee:${word}`,
    word,
    ipa: `/${word}/`,
    targetUnits: ["ee"],
    masculineAudioSrc: `/audio/words/blue/${word}.mp3`,
    feminineAudioSrc: `/audio/words/pink/${word}.mp3`,
  }),
);

describe("guided repeat core", () => {
  it("rotates a frozen queue from the current word without duplicates", () => {
    expect(
      rotateGuidedRepeatQueue(POOL, "en-US:ee:three").map((item) => item.word),
    ).toEqual(["three", "four", "one", "two"]);
  });

  it("repeats the same isolated English phoneme anchor for every word", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      anchorAudio: { single: "/audio/ipa/phoneme/green.mp3" },
      pool: POOL.slice(0, 2),
      currentMaterialId: POOL[0].materialId,
    });
    const audio = buildGuidedRepeatSteps(plan).filter(
      (step) => step.kind === "audio",
    );
    expect(audio.map((step) => step.role)).toEqual([
      "anchor-single",
      "anchor-single",
      "word-masculine",
      "word-feminine",
      "word-masculine",
      "word-feminine",
      "anchor-single",
      "anchor-single",
      "word-masculine",
      "word-feminine",
      "word-masculine",
      "word-feminine",
    ]);
    expect(
      audio
        .filter((step) => step.role === "anchor-single")
        .map((step) => step.src),
    ).toEqual([
      `/audio/ipa/phoneme/green.mp3`,
      `/audio/ipa/phoneme/green.mp3`,
      `/audio/ipa/phoneme/green.mp3`,
      `/audio/ipa/phoneme/green.mp3`,
    ]);
  });

  it("repeats one non-English anchor and keeps Russian voice semantics", () => {
    const policy = resolveGuidedRepeatVoicePolicy("ru-RU");
    expect(policy.masculine.assetSlot).toBe("pink");
    expect(policy.feminine.assetSlot).toBe("blue");
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "ru-RU",
      soundUnitSlug: "ru-a",
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
      "word-masculine",
      "word-feminine",
    ]);
  });

  it("uses clamped rhythm timing without changing playback speed", () => {
    expect(getGuidedRepeatGapMs(500, "flow", "imitation")).toBe(900);
    expect(getGuidedRepeatGapMs(1000, "standard", "imitation")).toBe(1400);
    expect(getGuidedRepeatGapMs(10_000, "relaxed", "imitation")).toBe(4200);
    expect(getGuidedRepeatGapMs(0, "standard", "cue")).toBe(450);
    expect(getGuidedRepeatGapMs(0, "standard", "transition")).toBe(650);
  });

  it("rejects online or incomplete core assets", () => {
    const plan = buildGuidedRepeatSessionPlan({
      languageId: "en-US",
      soundUnitSlug: "ee",
      anchorAudio: { single: "https://example.com/phoneme.mp3" },
      pool: POOL,
      currentMaterialId: POOL[0].materialId,
    });
    expect(validateGuidedRepeatSessionPlan(plan)).toMatchObject({
      valid: false,
    });
  });
});
