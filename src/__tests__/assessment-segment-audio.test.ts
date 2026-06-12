import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllAssessmentSegmentAudioEntries } from "@/lib/assessment-segment-audio";
import { getPhonemeAudioInfo, getPhonemeAudioUrl } from "@/lib/azure-phoneme-map";
import type { LanguageId } from "@/types/language";

function expectPlayable(segment: string, languageId: LanguageId) {
  const audioInfo = getPhonemeAudioInfo(segment, languageId);
  expect(audioInfo, `${languageId}:${segment}`).not.toBeNull();
  expect(getPhonemeAudioUrl(segment, languageId)).toBe(audioInfo?.url);
}

describe("assessment segment audio inventory", () => {
  it("makes common Spanish assessment segments clickable, including casa /k a s a/", () => {
    for (const segment of ["k", "a", "s", "p", "t", "m", "n", "f"]) {
      expectPlayable(segment, "es-ES");
    }
  });

  it("makes common French assessment consonants clickable even when they are not course units", () => {
    for (const segment of [
      "k",
      "p",
      "t",
      "d",
      "b",
      "g",
      "f",
      "v",
      "m",
      "n",
      "s",
      "z",
      "l",
    ]) {
      expectPlayable(segment, "fr-FR");
    }
  });

  it("makes common Russian assessment consonants clickable without using broad rule proxies", () => {
    for (const segment of [
      "p",
      "b",
      "t",
      "d",
      "k",
      "g",
      "f",
      "m",
      "n",
      "l",
      "s",
      "z",
    ]) {
      const audioInfo = getPhonemeAudioInfo(segment, "ru-RU");
      expect(audioInfo, `ru-RU:${segment}`).not.toBeNull();
      expect(audioInfo?.kind).toBe("word-example");
    }
  });

  it("points every word-example inventory entry at a real bundled file", () => {
    const missingOrEmpty = getAllAssessmentSegmentAudioEntries()
      .map((entry) => entry.audioUrl.replace(/^\//, ""))
      .filter((publicPath) => {
        const diskPath = join(process.cwd(), "public", publicPath);
        return !existsSync(diskPath) || statSync(diskPath).size < 1024;
      });

    expect(missingOrEmpty).toEqual([]);
  });
});
