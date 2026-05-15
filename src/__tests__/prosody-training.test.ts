import { describe, expect, it } from "vitest";
import {
  analyzeProsodyAttempt,
  getProsodyExercise,
  PROSODY_EXERCISES,
  recommendProsodyExercises,
} from "@/lib/prosody-training";
import type { AzureAssessmentResult } from "@/types/azure";

function result(
  overrides: Partial<AzureAssessmentResult> = {},
): AzureAssessmentResult {
  return {
    pronunciationScore: 82,
    accuracyScore: 82,
    fluencyScore: 82,
    completenessScore: 90,
    prosodyScore: 82,
    words: [
      "I",
      "need",
      "a",
      "quick",
      "update",
      "before",
      "the",
      "meeting",
    ].map((word) => ({
      word,
      accuracyScore: word === "a" || word === "the" ? 96 : 84,
      errorType: "None" as const,
      phonemes: [],
      syllables: [],
    })),
    ...overrides,
  };
}

describe("prosody training", () => {
  it("passes when prosody, fluency and accuracy are all above the gate", () => {
    const exercise = getProsodyExercise("content-word-stress-1");
    if (!exercise) throw new Error("missing exercise");

    const analysis = analyzeProsodyAttempt(exercise, result());

    expect(analysis.passed).toBe(true);
    expect(analysis.likelyIssue).toBe("good-control");
  });

  it("does not treat incomplete text as a prosody weakness", () => {
    const exercise = getProsodyExercise("content-word-stress-1");
    if (!exercise) throw new Error("missing exercise");

    const analysis = analyzeProsodyAttempt(
      exercise,
      result({
        completenessScore: 60,
        words: [
          {
            word: "need",
            accuracyScore: 82,
            errorType: "None",
            phonemes: [],
            syllables: [],
          },
        ],
      }),
    );

    expect(analysis.passed).toBe(false);
    expect(analysis.likelyIssue).toBe("unclear-text");
    expect(analysis.nextCue).toContain("读完整");
  });

  it("flags over-heavy function words when prosody is low", () => {
    const exercise = getProsodyExercise("content-word-stress-1");
    if (!exercise) throw new Error("missing exercise");

    const analysis = analyzeProsodyAttempt(
      exercise,
      result({ prosodyScore: 64, fluencyScore: 82 }),
    );

    expect(analysis.passed).toBe(false);
    expect(analysis.likelyIssue).toBe("over-heavy-function-words");
    expect(analysis.overHeavyFunctionWords).toContain("a");
  });

  it("contains a focused set of prosody exercise types", () => {
    expect(PROSODY_EXERCISES.map((exercise) => exercise.kind)).toEqual(
      expect.arrayContaining([
        "sentence-stress",
        "weak-forms",
        "thought-groups",
        "linking",
        "shadowing",
      ]),
    );
  });

  it("prioritizes previously failed prosody kinds", () => {
    const recommended = recommendProsodyExercises([
      {
        exerciseId: "linking-1",
        passed: false,
        prosodyScore: 60,
        fluencyScore: 70,
        accuracyScore: 80,
        completenessScore: 90,
        missingFocusWords: [],
        overHeavyFunctionWords: [],
        likelyIssue: "choppy-rhythm",
        nextCue: "link",
      },
    ]);

    expect(recommended[0].kind).toBe("linking");
  });
});
