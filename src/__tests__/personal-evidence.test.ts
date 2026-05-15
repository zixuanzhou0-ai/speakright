import { describe, expect, it } from "vitest";
import { buildPersonalEvidencePlan } from "@/lib/personal-evidence";

describe("personal evidence generator", () => {
  it("extracts target words from user-owned text", () => {
    const plan = buildPersonalEvidencePlan(
      "I worked late and missed the last bus.",
      ["final-consonants"],
    );

    expect(plan.occurrences.length).toBeGreaterThan(0);
    expect(plan.generatedSentences[0]).toContain("worked");
  });

  it("falls back to curated sentences when text has no target words", () => {
    const plan = buildPersonalEvidencePlan("hello", ["s-th"]);

    expect(plan.occurrences).toHaveLength(0);
    expect(plan.generatedSentences.length).toBeGreaterThan(0);
  });
});
