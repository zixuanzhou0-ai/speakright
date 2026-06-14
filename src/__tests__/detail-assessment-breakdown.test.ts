import { describe, expect, it } from "vitest";
import {
  collectDetailAssessmentPhonemes,
  collectDetailAssessmentSyllables,
  segmentIpaForAssessment,
} from "@/lib/detail-assessment-breakdown";
import type { AzureAssessmentResult, AzureWord } from "@/types/azure";

function word(
  text: string,
  phonemes: string[],
  syllables: string[] = [],
): AzureWord {
  return {
    word: text,
    accuracyScore: 80,
    errorType: "None",
    phonemes: phonemes.map((phoneme, index) => ({
      phoneme,
      accuracyScore: 70 + index,
    })),
    syllables: syllables.map((syllable, index) => ({
      syllable,
      accuracyScore: 75 + index,
    })),
  };
}

function result(words: AzureWord[]): AzureAssessmentResult {
  return {
    pronunciationScore: 80,
    accuracyScore: 80,
    fluencyScore: 80,
    completenessScore: 80,
    words,
  };
}

describe("detail assessment breakdown", () => {
  it("segments a target IPA reference without dropping French nasal marks", () => {
    expect(segmentIpaForAssessment("/tʁo gʁɑ̃ tʁo lɑ̃ tʁo fɔʁ/")).toEqual([
      "t",
      "ʁ",
      "o",
      "g",
      "ʁ",
      "ɑ̃",
      "t",
      "ʁ",
      "o",
      "l",
      "ɑ̃",
      "t",
      "ʁ",
      "o",
      "f",
      "ɔ",
      "ʁ",
    ]);
  });

  it("uses every word returned by Azure for phrase and sentence detail pages", () => {
    const collected = collectDetailAssessmentPhonemes(
      result([
        word("Trop", ["t", "ʁ", "o"], ["tʁo"]),
        word("grand", ["g", "ʁ", "ɑ̃"], ["gʁɑ̃"]),
        word("fort", ["f", "ɔ", "ʁ"], ["fɔʁ"]),
      ]),
      "/tʁo gʁɑ̃ fɔʁ/",
    );

    expect(collected.map((item) => item.phoneme)).toEqual([
      "t",
      "ʁ",
      "o",
      "g",
      "ʁ",
      "ɑ̃",
      "f",
      "ɔ",
      "ʁ",
    ]);
  });

  it("collects syllables across the full target instead of only the first word", () => {
    const collected = collectDetailAssessmentSyllables(
      result([
        word("petit", ["p", "ə", "t", "i"], ["pə", "ti"]),
        word("chat", ["ʃ", "a"], ["ʃa"]),
      ]),
    );

    expect(collected.map((item) => item.syllable)).toEqual(["pə", "ti", "ʃa"]);
  });

  it("keeps empty Azure phoneme evidence empty instead of fabricating scored tiles", () => {
    const collected = collectDetailAssessmentPhonemes(
      result([word("liaison", [], [])]),
      "/ljɛzɔ̃/",
    );

    expect(collected).toEqual([]);
  });
});
