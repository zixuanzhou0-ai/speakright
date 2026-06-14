import { describe, expect, it } from "vitest";
import {
  buildDiagnosisReport,
  getDiagnosisSummary,
} from "@/lib/diagnosis-engine";
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

function resultForWords(
  words: Array<{
    word: string;
    phonemes: Array<{ phoneme: string; accuracyScore: number }>;
    accuracyScore?: number;
    errorType?: "None" | "Omission" | "Insertion" | "Mispronunciation";
  }>,
  overrides: Partial<{
    pronunciationScore: number;
    accuracyScore: number;
    fluencyScore: number;
    completenessScore: number;
    prosodyScore: number;
  }> = {},
) {
  return {
    pronunciationScore: overrides.pronunciationScore ?? 95,
    accuracyScore: overrides.accuracyScore ?? 95,
    fluencyScore: overrides.fluencyScore ?? 95,
    completenessScore: overrides.completenessScore ?? 100,
    prosodyScore: overrides.prosodyScore,
    words: words.map((word) => ({
      word: word.word,
      accuracyScore: word.accuracyScore ?? overrides.accuracyScore ?? 95,
      errorType: word.errorType ?? ("None" as const),
      phonemes: word.phonemes,
      syllables: [{ syllable: word.word, accuracyScore: 95 }],
    })),
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

  it("withholds non-English overall scores when evidence is too thin", () => {
    const report = buildDiagnosisReport({
      languageId: "fr-FR",
      wordRecordings: [],
      paragraphText:
        "Un étudiant prend un bon café. Les amis parlent dans une petite rue.",
      paragraphResult: resultForWord(
        "bonjour",
        [
          { phoneme: "unknown-1", accuracyScore: 100 },
          { phoneme: "unknown-2", accuracyScore: 100 },
        ],
        {
          pronunciationScore: 100,
          accuracyScore: 100,
          fluencyScore: 100,
          completenessScore: 100,
          prosodyScore: 100,
        },
      ),
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.issues.map((issue) => issue.id)).not.toContain(
      "stress-rhythm",
    );
    expect(getDiagnosisSummary(report)).toContain("证据不足");
  });

  it("withholds non-English scores for silence or no usable word-level evidence", () => {
    const report = buildDiagnosisReport({
      languageId: "ru-RU",
      wordRecordings: [],
      paragraphText: "Мама мыла раму. Мы говорим по-русски медленно.",
      paragraphResult: {
        pronunciationScore: 100,
        accuracyScore: 100,
        fluencyScore: 100,
        completenessScore: 0,
        words: [],
      },
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.scoreStatusReason).toContain("录音无效");
  });

  it("withholds non-English scores when only one or two words were read", () => {
    const report = buildDiagnosisReport({
      languageId: "fr-FR",
      wordRecordings: [],
      paragraphText:
        "Un étudiant prend un bon café. Les amis parlent dans une petite rue.",
      paragraphResult: resultForWords(
        [
          {
            word: "étudiant",
            phonemes: [{ phoneme: "a", accuracyScore: 100 }],
          },
          {
            word: "café",
            phonemes: [{ phoneme: "e", accuracyScore: 100 }],
          },
        ],
        {
          pronunciationScore: 100,
          accuracyScore: 100,
          fluencyScore: 100,
          completenessScore: 100,
          prosodyScore: 100,
        },
      ),
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.evidenceSummary?.wordLevelEvidenceCount).toBe(2);
  });

  it("withholds non-English scores when the recognized text does not match the target language material", () => {
    const report = buildDiagnosisReport({
      languageId: "es-ES",
      wordRecordings: [],
      paragraphText:
        "Mi casa está cerca de la plaza. El perro corre por la calle.",
      paragraphResult: resultForWords(
        [
          "hello",
          "world",
          "this",
          "is",
          "not",
          "spanish",
          "speech",
          "today",
        ].map((word) => ({
          word,
          phonemes: [{ phoneme: "a", accuracyScore: 100 }],
        })),
        {
          pronunciationScore: 100,
          accuracyScore: 100,
          fluencyScore: 100,
          completenessScore: 100,
          prosodyScore: 100,
        },
      ),
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.evidenceSummary?.referenceMatchRatio).toBe(0);
    expect(report.scoreStatusReason).toContain("目标语言材料不匹配");
  });

  it("withholds non-English scores when otherwise high evidence contains omission or insertion miscues", () => {
    const report = buildDiagnosisReport({
      languageId: "es-ES",
      wordRecordings: [],
      paragraphText:
        "Mi casa está cerca de la plaza. El perro corre por la calle.",
      paragraphResult: resultForWords(
        [
          {
            word: "Mi",
            phonemes: [{ phoneme: "i", accuracyScore: 100 }],
          },
          {
            word: "casa",
            phonemes: [{ phoneme: "a", accuracyScore: 100 }],
            errorType: "Omission",
          },
          {
            word: "está",
            phonemes: [{ phoneme: "a", accuracyScore: 100 }],
          },
          {
            word: "cerca",
            phonemes: [{ phoneme: "e", accuracyScore: 100 }],
          },
          {
            word: "de",
            phonemes: [{ phoneme: "e", accuracyScore: 100 }],
          },
          {
            word: "la",
            phonemes: [{ phoneme: "a", accuracyScore: 100 }],
          },
          {
            word: "plaza",
            phonemes: [{ phoneme: "a", accuracyScore: 100 }],
          },
          {
            word: "el",
            phonemes: [{ phoneme: "e", accuracyScore: 100 }],
          },
          {
            word: "perro",
            phonemes: [{ phoneme: "r", accuracyScore: 100 }],
          },
          {
            word: "corre",
            phonemes: [{ phoneme: "r", accuracyScore: 100 }],
          },
          {
            word: "calle",
            phonemes: [{ phoneme: "ʎ", accuracyScore: 100 }],
          },
        ],
        {
          pronunciationScore: 100,
          accuracyScore: 100,
          fluencyScore: 100,
          completenessScore: 100,
          prosodyScore: 100,
        },
      ),
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.evidenceSummary?.omissionCount).toBe(1);
    expect(report.scoreStatusReason).toContain("漏读或多读");
  });

  it("withholds non-English scores when Azure returns words but no usable phoneme alignment", () => {
    const report = buildDiagnosisReport({
      languageId: "fr-FR",
      wordRecordings: [],
      paragraphText:
        "Un étudiant prend un bon café. Les amis parlent dans une petite rue.",
      paragraphResult: resultForWords(
        [
          "un",
          "étudiant",
          "prend",
          "un",
          "bon",
          "café",
          "les",
          "amis",
        ].map((word) => ({
          word,
          phonemes: [{ phoneme: "unknown", accuracyScore: 100 }],
        })),
        {
          pronunciationScore: 100,
          accuracyScore: 100,
          fluencyScore: 100,
          completenessScore: 100,
          prosodyScore: 100,
        },
      ),
    });

    expect(report.scoreStatus).toBe("insufficient-evidence");
    expect(report.overallScore).toBe(0);
    expect(report.scoreStatusReason).toContain("可用发音单位太少");
  });

  it("keeps non-English reports out of English training-pack issue rules", () => {
    const report = buildDiagnosisReport({
      languageId: "es-ES",
      wordRecordings: [
        {
          prompt: {
            word: "casa",
            ipa: "/ˈkasa/",
            targetPhonemes: ["es-a"],
          },
          source: "word",
          result: resultForWord("casa", [
            { phoneme: "a", accuracyScore: 45 },
            { phoneme: "s", accuracyScore: 92 },
          ]),
        },
      ],
      paragraphText: "Mi perro corre por la plaza.",
      paragraphResult: resultForWord(
        "plaza",
        [
          { phoneme: "a", accuracyScore: 48 },
          { phoneme: "s", accuracyScore: 90 },
        ],
        { prosodyScore: 85, fluencyScore: 86 },
      ),
    });

    expect(report.issues.map((issue) => issue.id)).not.toContain("ee-ih");
    expect(report.issues.map((issue) => issue.id)).not.toContain("s-th");
    expect(report.issues.every((issue) => issue.id.startsWith("es-ES:"))).toBe(
      true,
    );
  });
});
