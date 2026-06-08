import { describe, expect, it } from "vitest";
import { analyzeAttempt } from "@/lib/attempt-analysis";
import {
  buildFocusedReviewItems,
  createCourseRunnerState,
  createCourseStartPosition,
  evaluateLevelGate,
  getCourseItemReference,
  recordRunnerAttempt,
} from "@/lib/course-runner";
import {
  hasLevelPassed,
  shouldAppendPerceptionReview,
  shouldEnterRemediation,
  shouldMarkStuck,
} from "@/lib/training-course-session";
import { detectErrorPatterns } from "@/lib/training-error-patterns";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { AzureAssessmentResult } from "@/types/azure";
import type {
  TrainingCourseItem,
  TrainingLevel,
  TrainingLevelKind,
  TrainingPack,
} from "@/types/training";

describe("training course v2.5", () => {
  it("expands every core pack into a complete coaching course", () => {
    expect(TRAINING_PACKS).toHaveLength(10);
    for (const pack of TRAINING_PACKS) {
      expect(pack.course?.levels.map((level) => level.kind)).toEqual([
        "perception",
        "articulation",
        "syllable",
        "word",
        "minimal-pair",
        "sentence",
        "shadowing",
        "mixed-review",
      ]);
      expect(
        pack.course?.levels.find((level) => level.kind === "perception")?.items,
      ).toHaveLength(8);
      expect(
        pack.course?.levels.find((level) => level.kind === "word")?.items,
      ).toHaveLength(12);
      expect(
        pack.course?.levels.find((level) => level.kind === "minimal-pair")
          ?.items,
      ).toHaveLength(8);
      expect(
        pack.course?.levels.find((level) => level.kind === "sentence")?.items,
      ).toHaveLength(8);
      expect(
        pack.course?.levels.find((level) => level.kind === "shadowing")?.items,
      ).toHaveLength(3);
      expect(
        pack.course?.levels.find((level) => level.kind === "mixed-review")
          ?.items,
      ).toHaveLength(6);
    }
  });

  it("detects coaching error patterns for common Chinese learner issues", () => {
    expect(
      detectErrorPatterns({
        packId: "s-th",
        targetPhonemes: ["th"],
        targetScore: 52,
        overallScore: 80,
      }).map((pattern) => pattern.id),
    ).toContain("tongue-between-teeth");

    expect(
      detectErrorPatterns({
        packId: "v-w",
        targetPhonemes: ["v"],
        targetScore: 60,
        overallScore: 76,
      }).map((pattern) => pattern.id),
    ).toContain("lip-teeth-round-lips");

    expect(
      detectErrorPatterns({
        packId: "final-consonants",
        targetPhonemes: ["k"],
        targetScore: 58,
        overallScore: 72,
        isFinalPosition: true,
      }).map((pattern) => pattern.id),
    ).toContain("final-consonant-release");
  });

  it("controls perception review and remediation gates", () => {
    expect(shouldAppendPerceptionReview(5, 8)).toBe(true);
    expect(shouldAppendPerceptionReview(7, 8)).toBe(false);
    expect(shouldEnterRemediation(2)).toBe(true);
    expect(shouldMarkStuck(2)).toBe(false);
    expect(shouldMarkStuck(3)).toBe(true);
  });
});

function result(
  overrides: Partial<AzureAssessmentResult> = {},
): AzureAssessmentResult {
  return {
    pronunciationScore: 86,
    accuracyScore: 86,
    fluencyScore: 82,
    completenessScore: 90,
    words: [
      {
        word: "think",
        accuracyScore: 86,
        errorType: "None",
        phonemes: [
          { phoneme: "th", accuracyScore: 52 },
          { phoneme: "ih", accuracyScore: 90 },
          { phoneme: "ng", accuracyScore: 88 },
          { phoneme: "k", accuracyScore: 86 },
        ],
        syllables: [],
      },
    ],
    ...overrides,
  };
}

function expectFound<T>(value: T | null | undefined, label: string): T {
  expect(value, label).toBeTruthy();
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

function trainingPack(id: string): TrainingPack {
  return expectFound(
    TRAINING_PACKS.find((item) => item.id === id),
    `training pack ${id}`,
  );
}

function courseLevel(
  pack: TrainingPack,
  kind: TrainingLevelKind,
): TrainingLevel {
  return expectFound(
    pack.course?.levels.find((item) => item.kind === kind),
    `${pack.id}/${kind}`,
  );
}

function targetItem(level: TrainingLevel, phoneme: string): TrainingCourseItem {
  return expectFound(
    level.items.find((entry) => entry.targetPhonemes.includes(phoneme)),
    `${level.id}/${phoneme}`,
  );
}

describe("training course v2.6 quality gates", () => {
  it("keeps every recordable course item scoreable with natural English reference text", () => {
    const forbidden =
      /(^\/.*\/$|target|slow word|\b[a-z]+-[a-z]+\b|[θðæɪʊŋː])/i;
    for (const pack of TRAINING_PACKS) {
      for (const level of pack.course?.levels ?? []) {
        for (const item of level.items) {
          if (item.isRecordable === false) continue;
          const reference = getCourseItemReference(item);
          expect(
            reference.trim().length,
            `${pack.id}/${level.id}/${item.id}`,
          ).toBeGreaterThan(0);
          expect(reference, `${pack.id}/${level.id}/${item.id}`).not.toMatch(
            forbidden,
          );
        }
      }
    }
  });

  it("analyzes target-low overall-high attempts as failed attempts with a concrete cue", () => {
    const pack = trainingPack("s-th");
    const level = courseLevel(pack, "word");
    const item = targetItem(level, "th");

    const analysis = analyzeAttempt({
      pack,
      levelKind: level.kind,
      item,
      result: result(),
    });

    expect(analysis.passed).toBe(false);
    expect(analysis.targetScore).toBe(52);
    expect(analysis.detectedPatternIds).toContain("tongue-between-teeth");
    expect(analysis.detectedPatternIds).toContain("target-low-overall-high");
    expect(analysis.nextCue).toContain("舌");
  });

  it("uses stricter pass thresholds for target phoneme attempts", () => {
    const pack = trainingPack("s-th");
    const level = courseLevel(pack, "word");
    const item = targetItem(level, "th");

    const nearMiss = analyzeAttempt({
      pack,
      levelKind: level.kind,
      item,
      result: result({
        words: [
          {
            word: "think",
            accuracyScore: 90,
            errorType: "None",
            phonemes: [{ phoneme: "th", accuracyScore: 81 }],
            syllables: [],
          },
        ],
      }),
    });
    const pass = analyzeAttempt({
      pack,
      levelKind: level.kind,
      item,
      result: result({
        words: [
          {
            word: "think",
            accuracyScore: 90,
            errorType: "None",
            phonemes: [{ phoneme: "th", accuracyScore: 82 }],
            syllables: [],
          },
        ],
      }),
    });

    expect(nearMiss.passed).toBe(false);
    expect(pass.passed).toBe(true);
  });

  it("does not pass when Azure misses the target phoneme and falls back to overall score", () => {
    const pack = trainingPack("s-th");
    const level = courseLevel(pack, "word");
    const item = targetItem(level, "th");

    const analysis = analyzeAttempt({
      pack,
      levelKind: level.kind,
      item,
      result: result({
        pronunciationScore: 96,
        words: [
          {
            word: "think",
            accuracyScore: 96,
            errorType: "None",
            phonemes: [{ phoneme: "ih", accuracyScore: 96 }],
            syllables: [],
          },
        ],
      }),
    });

    expect(analysis.targetScore).toBe(96);
    expect(analysis.usedFallback).toBe(true);
    expect(analysis.passed).toBe(false);
    expect(analysis.nextCue).toContain("没有对齐到目标音素");
  });

  it("builds focused review when a level gate is not passed", () => {
    const pack = trainingPack("v-w");
    const level = courseLevel(pack, "word");
    const gate = evaluateLevelGate(
      level,
      {
        levelId: level.id,
        kind: level.kind,
        scores: [70, 72],
        attempts: 2,
        passedCount: 0,
        stuckCount: 0,
      },
      level.items[0],
    );

    expect(gate.passed).toBe(false);
    expect(gate.focusedReviewItems).toHaveLength(3);
    expect(gate.focusedReviewItems[0].focusPoint).toContain("专项复练");
  });

  it("requires both average score and enough passed items in mixed review", () => {
    const pack = trainingPack("s-th");
    const level = courseLevel(pack, "mixed-review");

    expect(
      hasLevelPassed(level, {
        levelId: level.id,
        kind: level.kind,
        scores: [90, 88, 86, 84, 60, 58],
        attempts: 6,
        passedCount: 4,
        stuckCount: 0,
      }),
    ).toBe(false);

    expect(
      hasLevelPassed(level, {
        levelId: level.id,
        kind: level.kind,
        scores: [90, 88, 86, 84, 83, 61],
        attempts: 6,
        passedCount: 5,
        stuckCount: 0,
      }),
    ).toBe(true);
  });

  it("pure runner enters remediation after two failures and records stuck after three", () => {
    const pack = trainingPack("s-th");
    const level = courseLevel(pack, "word");
    const item = level.items[0];
    const first = analyzeAttempt({
      pack,
      levelKind: level.kind,
      item,
      result: result(),
    });
    const second = { ...first, detectedPatternIds: ["tongue-between-teeth"] };

    let state = createCourseRunnerState(pack.id);
    state = recordRunnerAttempt(state, level, item, first);
    expect(state.phase).toBe("intro");
    state = recordRunnerAttempt(state, level, item, second);
    expect(state.phase).toBe("remediation");
    state = recordRunnerAttempt(state, level, item, second);
    expect(state.stuckPatternIds).toContain("tongue-between-teeth");
  });

  it("creates perception focused review items from the same target contrast", () => {
    const pack = trainingPack("ee-ih");
    const level = courseLevel(pack, "perception");
    const review = buildFocusedReviewItems(level, level.items[0], 4);

    expect(review).toHaveLength(4);
    expect(
      review.every((item) => item.id.startsWith("focus-perception-abx")),
    ).toBe(true);
  });

  it("starts a pack from the prescribed level id", () => {
    const pack = trainingPack("stress-rhythm");
    const course = expectFound(pack.course, "stress-rhythm course");
    const position = createCourseStartPosition(course, "shadowing-transfer");

    expect(course.levels[position.levelIndex].id).toBe("shadowing-transfer");
    expect(position.itemIndex).toBe(0);
    expect(createCourseStartPosition(course, "missing-level").levelIndex).toBe(
      0,
    );
    expect(createCourseStartPosition(course, "#shadowing-transfer").levelIndex).toBe(
      position.levelIndex,
    );
  });

  it("keeps remediation steps scoreable with natural English text", () => {
    const forbidden =
      /(^\/.*\/$|target|slow word|\b[a-z]+-[a-z]+\b|[θðæɪʊŋː])/i;
    for (const pack of TRAINING_PACKS) {
      for (const path of pack.course?.remediation ?? []) {
        for (const step of path.steps) {
          const reference = step.referenceText ?? step.text;
          expect(
            reference.trim().length,
            `${pack.id}/${path.id}`,
          ).toBeGreaterThan(0);
          expect(reference, `${pack.id}/${path.id}`).not.toMatch(forbidden);
        }
      }
    }
  });
});
