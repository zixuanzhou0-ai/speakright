import { describe, expect, it } from "vitest";
import { buildDiagnosisReport } from "@/lib/diagnosis-engine";
import type { AssessmentRecording } from "@/types/diagnosis";

function resultForWord(
  word: string,
  phonemes: Array<{ phoneme: string; accuracyScore: number }>,
  overrides: Partial<{
    pronunciationScore: number;
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
    prosodyScore: number;
  }> = {},
) {
  return {
    pronunciationScore: overrides.pronunciationScore ?? 70,
    accuracyScore: overrides.accuracyScore ?? 70,
    fluencyScore: overrides.fluencyScore ?? 82,
    completenessScore: overrides.completenessScore ?? 100,
    prosodyScore: overrides.prosodyScore,
    words: [
      {
        word,
        accuracyScore: overrides.accuracyScore ?? 70,
        errorType: "None" as const,
        phonemes,
        syllables: [{ syllable: "test", accuracyScore: 80 }],
      },
    ],
  };
}

describe("buildDiagnosisReport", () => {
  it("aggregates phoneme scores and maps low /th/ to the s-th pack", () => {
    const wordRecordings: AssessmentRecording[] = [
      {
        prompt: {
          word: "think",
          ipa: "/θɪŋk/",
          targetPhonemes: ["th", "ih", "ng"],
        },
        source: "word",
        result: resultForWord("think", [
          { phoneme: "th", accuracyScore: 42 },
          { phoneme: "ih", accuracyScore: 82 },
          { phoneme: "ng", accuracyScore: 86 },
        ]),
      },
    ];

    const report = buildDiagnosisReport({
      wordRecordings,
      paragraphText: "paragraph",
      paragraphResult: resultForWord(
        "paragraph",
        [
          { phoneme: "th", accuracyScore: 55 },
          { phoneme: "s", accuracyScore: 90 },
        ],
        { prosodyScore: 88, fluencyScore: 86 },
      ),
    });

    expect(report.version).toBe(2);
    expect(report.source).toBe("quick-word-check");
    expect(report.phonemeScores.th.score).toBe(49);
    expect(report.phonemeScores.th.sampleCount).toBe(2);
    expect(report.issues[0].recommendedPackIds).toContain("s-th");
    expect(report.issues[0].errorPatternIds).toContain("tongue-between-teeth");
    expect(report.issues[0].confidence).toBe("medium");
    expect(report.issues[0].nextLesson?.levelId).toBe("perception-abx");
  });

  it("creates a rhythm issue when paragraph prosody is weak", () => {
    const report = buildDiagnosisReport({
      wordRecordings: [],
      paragraphText: "paragraph",
      paragraphResult: resultForWord(
        "paragraph",
        [{ phoneme: "ax", accuracyScore: 80 }],
        { prosodyScore: 52, fluencyScore: 58 },
      ),
    });

    expect(report.issues.some((issue) => issue.id === "stress-rhythm")).toBe(
      true,
    );
    expect(
      report.prescription.days
        .flatMap((day) => day.items)
        .some((item) => item.packId === "stress-rhythm"),
    ).toBe(true);
  });

  it("does not turn an invalid low-quality recording into a pronunciation issue", () => {
    const report = buildDiagnosisReport({
      wordRecordings: [
        {
          prompt: {
            word: "think",
            ipa: "/θɪŋk/",
            targetPhonemes: ["th", "ih", "ng"],
          },
          source: "word",
          result: resultForWord(
            "think",
            [
              { phoneme: "th", accuracyScore: 35 },
              { phoneme: "ih", accuracyScore: 40 },
            ],
            { completenessScore: 18, fluencyScore: 0 },
          ),
        },
      ],
      paragraphText: "paragraph",
      paragraphResult: resultForWord(
        "paragraph",
        [{ phoneme: "th", accuracyScore: 88 }],
        { prosodyScore: 88, fluencyScore: 86 },
      ),
    });

    expect(report.issues.some((issue) => issue.id === "s-th")).toBe(false);
    expect(report.evidenceSummary?.invalidRecordings).toBe(1);
    expect(report.rawEvidence[0]?.recommendedAction).toBe("request-retry");
  });

  it("keeps non-English diagnosis in beta feedback mode without English prescriptions", () => {
    const report = buildDiagnosisReport({
      languageId: "es-ES",
      wordRecordings: [
        {
          prompt: {
            word: "casa",
            ipa: "/ˈkasa/",
            targetPhonemes: ["es-a", "es-s"],
          },
          source: "word",
          result: resultForWord("casa", [
            { phoneme: "th", accuracyScore: 42 },
            { phoneme: "s", accuracyScore: 74 },
          ]),
        },
      ],
      paragraphText: "Cada manana estudio espanol.",
      paragraphResult: resultForWord(
        "paragraph",
        [{ phoneme: "th", accuracyScore: 50 }],
        { prosodyScore: 45, fluencyScore: 58 },
      ),
    });

    expect(report.languageId).toBe("es-ES");
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.issues.every((issue) => issue.recommendedPackIds.length === 0)).toBe(
      true,
    );
    expect(report.issues.map((issue) => issue.id).join(" ")).toContain("es-ES");
    expect(report.issues.map((issue) => issue.title).join(" ")).not.toContain(
      "/θ/ 容易读成 /s/",
    );
    expect(
      report.prescription.days.flatMap((day) => day.items),
    ).toHaveLength(0);
    expect(report.prescription.days[0]?.title).toContain("不生成英语训练处方");
  });
});
