import { describe, expect, it } from "vitest";
import { buildLocalGuidedRepeatPlan } from "@/lib/guided-repeat-plan";
import { getPhonemeBySlug } from "@/lib/phoneme-data";
import type { KeywordEntry } from "@/types/phoneme";

const WORD_POOL: KeywordEntry[] = [
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
].map((word) => ({ word, ipa: `/${word}/` }));

const PHONEME = getPhonemeBySlug("ee");
const CURRENT_WORD = WORD_POOL.find((item) => item.word === "eight");

if (!PHONEME || !CURRENT_WORD) {
  throw new Error("Guided-repeat test fixtures are incomplete.");
}

describe("buildLocalGuidedRepeatPlan", () => {
  it("keeps the complete word pool in every mode and rotates from the current word", async () => {
    for (const mode of ["quick", "standard", "intensive"] as const) {
      const plan = await buildLocalGuidedRepeatPlan({
        languageId: "en-US",
        phoneme: PHONEME,
        wordPool: WORD_POOL,
        currentWord: CURRENT_WORD,
        rhythm: "standard",
        mode,
      });

      expect(plan.mode).toBe(mode);
      expect(plan.totalWords).toBe(WORD_POOL.length);
      expect(plan.queue.map((item) => item.word)).toEqual([
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
      ]);
      expect(new Set(plan.queue.map((item) => item.materialId)).size).toBe(
        WORD_POOL.length,
      );
    }
  });
});
