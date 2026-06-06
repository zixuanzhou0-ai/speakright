import { describe, expect, it } from "vitest";
import {
  analyzeFreePracticeTransfer,
  buildFreePracticeTargetPreview,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import type { AzureAssessmentResult } from "@/types/azure";
import type { MasteryProfile } from "@/types/training";

const NOW = 1_000_000;

function resultForWord(
  word: string,
  phonemes: Array<{ phoneme: string; accuracyScore: number }>,
  score = 86,
): AzureAssessmentResult {
  return {
    pronunciationScore: score,
    accuracyScore: score,
    fluencyScore: score,
    completenessScore: 96,
    words: [
      {
        word,
        accuracyScore: score,
        errorType: "None",
        phonemes,
        syllables: [],
      },
    ],
  };
}

function profile(overrides: Partial<MasteryProfile> = {}): MasteryProfile {
  return {
    version: 2,
    languageId: "en-US",
    updatedAt: NOW,
    packs: {
      "s-th": {
        packId: "s-th",
        status: "practicing",
        masteryState: "learning",
        levelProgress: {},
        bestTargetScore: 58,
        perceptionBestRate: 0.7,
        completedSessions: 1,
        failureStreak: 1,
        lastPracticedAt: NOW - 1_000,
      },
    },
    phonemes: {},
    errorPatterns: {
      "tongue-between-teeth": {
        patternId: "tongue-between-teeth",
        seenCount: 2,
        stuckCount: 2,
        lastSeenAt: NOW - 500,
        status: "active",
      },
    },
    sessions: [],
    ...overrides,
  };
}

describe("free-practice transfer", () => {
  it("previews current review targets before recording", () => {
    const preview = buildFreePracticeTargetPreview({
      profile: profile(),
      text: "I think the thin path is clear.",
      mode: "sentence",
      now: NOW,
    });

    expect(preview.targets[0]).toMatchObject({
      packId: "s-th",
      source: "review",
    });
    expect(preview.targets[0].matchedWords).toContain("thin");
  });

  it("suggests target words when the free-practice text misses the current goal", () => {
    const preview = buildFreePracticeTargetPreview({
      profile: profile(),
      text: "I had coffee today.",
      mode: "sentence",
      now: NOW,
    });

    expect(preview.targets).toEqual([]);
    expect(preview.suggestions[0]).toMatchObject({
      packId: "s-th",
    });
    expect(preview.suggestions[0].words.length).toBeGreaterThan(0);
  });

  it("does not create transfer evidence when the text misses preview targets", () => {
    const summary = analyzeFreePracticeTransfer({
      profile: profile(),
      result: resultForWord("coffee", [
        { phoneme: "k", accuracyScore: 92 },
        { phoneme: "aa", accuracyScore: 90 },
        { phoneme: "f", accuracyScore: 91 },
        { phoneme: "iy", accuracyScore: 93 },
      ]),
      text: "I had coffee today.",
      mode: "sentence",
      now: NOW,
    });

    expect(summary.evidences).toEqual([]);
  });

  it("turns a failed free-practice target into reviewable evidence", () => {
    const summary = analyzeFreePracticeTransfer({
      profile: profile(),
      result: resultForWord("thin", [
        { phoneme: "th", accuracyScore: 52 },
        { phoneme: "ih", accuracyScore: 88 },
        { phoneme: "n", accuracyScore: 90 },
      ]),
      text: "thin",
      mode: "word",
      now: NOW,
    });

    expect(summary.evidences[0]).toMatchObject({
      packId: "s-th",
      passed: false,
      targetScore: 52,
      source: "review",
    });

    const recorded = recordFreePracticeTransfer(profile(), summary);

    expect(recorded.summary.recorded).toBe(true);
    expect(recorded.sessions[0].failedItems?.[0]).toMatchObject({
      text: "thin",
      targetScore: 52,
      passed: false,
    });
    expect(
      recorded.sessions[0].reviewItems?.some(
        (task) => task.source === "failed-item",
      ),
    ).toBe(true);
  });

  it("records passed personal-sentence practice as guided transfer evidence", () => {
    const base = profile({
      packs: {
        "v-w": {
          packId: "v-w",
          status: "practicing",
          masteryState: "integrated",
          levelProgress: {},
          bestTargetScore: 82,
          perceptionBestRate: 0.9,
          completedSessions: 2,
          failureStreak: 0,
          lastPracticedAt: NOW - 1_000,
        },
      },
      errorPatterns: {},
    });
    const summary = analyzeFreePracticeTransfer({
      profile: base,
      result: resultForWord(
        "vivid",
        [
          { phoneme: "v", accuracyScore: 90 },
          { phoneme: "ih", accuracyScore: 86 },
          { phoneme: "v", accuracyScore: 92 },
          { phoneme: "ih", accuracyScore: 85 },
          { phoneme: "d", accuracyScore: 88 },
        ],
        90,
      ),
      text: "I gave a vivid review.",
      mode: "sentence",
      now: NOW,
    });

    expect(summary.evidences[0]).toMatchObject({
      packId: "v-w",
      passed: true,
      source: "active-pack",
    });

    const recorded = recordFreePracticeTransfer(base, summary);
    const mastery = recorded.profile.packs["v-w"];

    expect(recorded.sessions[0].transferEvidence?.[0]).toMatchObject({
      layer: "guided",
      passed: true,
    });
    expect(mastery.transferEvidenceCount).toBe(1);
    expect(mastery.masteryState).toBe("retained");
  });

  it("keeps single-word spontaneous evidence non-promoting", () => {
    const base = profile({
      packs: {
        "v-w": {
          packId: "v-w",
          status: "practicing",
          masteryState: "integrated",
          levelProgress: {},
          bestTargetScore: 82,
          perceptionBestRate: 0.9,
          completedSessions: 2,
          failureStreak: 0,
          lastPracticedAt: NOW - 1_000,
        },
      },
      errorPatterns: {},
    });
    const summary = analyzeFreePracticeTransfer({
      profile: base,
      result: resultForWord(
        "vivid",
        [
          { phoneme: "v", accuracyScore: 90 },
          { phoneme: "ih", accuracyScore: 86 },
          { phoneme: "v", accuracyScore: 92 },
        ],
        90,
      ),
      text: "I gave a vivid review.",
      mode: "sentence",
      now: NOW,
    });

    const recorded = recordFreePracticeTransfer(base, {
      ...summary,
      transferLayer: "spontaneous",
    });

    expect(recorded.sessions[0].transferEvidence?.[0]).toMatchObject({
      layer: "spontaneous",
      passed: false,
    });
    expect(recorded.sessions[0].promotionBlockers?.[0]).toContain(
      "即兴迁移证据过薄",
    );
    expect(recorded.profile.packs["v-w"].masteryState).not.toBe("transferred");
  });

  it("does not record the same pack and same sentence twice on the same day", () => {
    const base = profile({
      packs: {
        "v-w": {
          packId: "v-w",
          status: "practicing",
          masteryState: "integrated",
          levelProgress: {},
          bestTargetScore: 82,
          perceptionBestRate: 0.9,
          completedSessions: 2,
          failureStreak: 0,
          lastPracticedAt: NOW - 1_000,
        },
      },
      errorPatterns: {},
    });
    const summary = analyzeFreePracticeTransfer({
      profile: base,
      result: resultForWord(
        "vivid",
        [
          { phoneme: "v", accuracyScore: 90 },
          { phoneme: "ih", accuracyScore: 86 },
          { phoneme: "v", accuracyScore: 92 },
        ],
        90,
      ),
      text: "I gave a vivid review.",
      mode: "sentence",
      now: NOW,
    });
    const first = recordFreePracticeTransfer(base, summary);
    const second = recordFreePracticeTransfer(first.profile, {
      ...summary,
      generatedAt: NOW + 60_000,
    });

    expect(first.summary.recorded).toBe(true);
    expect(second.summary.recorded).toBe(false);
    expect(second.sessions).toEqual([]);
  });
});
