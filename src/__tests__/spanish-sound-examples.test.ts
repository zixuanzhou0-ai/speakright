import { describe, expect, it } from "vitest";
import {
  getAdjacentSpanishWord,
  getSpanishExampleWindow,
  getSpanishTargetSymbols,
  highlightSpanishTargetInIpa,
} from "@/lib/spanish-sound-examples";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

function keyword(word: string, ipa: string): KeywordEntry {
  return { word, ipa };
}

function phoneme(slug: string, ipa: string): PhonemeData {
  return {
    languageId: "es-ES",
    slug,
    ipa,
    symbol: ipa,
    name: slug,
    category: "consonant",
    example: "paso",
    keywords: [],
    difficulty: "easy",
  };
}

describe("spanish sound examples", () => {
  it("keeps current word first and fills the remaining example window", () => {
    const pool = [
      keyword("paso", "/ˈpaso/"),
      keyword("pico", "/ˈpiko/"),
      keyword("sopa", "/ˈsopa/"),
      keyword("capa", "/ˈkapa/"),
      keyword("mapa", "/ˈmapa/"),
    ];

    expect(
      getSpanishExampleWindow(pool, pool[2], 4).map((item) => item.word),
    ).toEqual(["sopa", "capa", "mapa", "paso"]);
  });

  it("deduplicates repeated words in the example window", () => {
    const pool = [
      keyword("paso", "/ˈpaso/"),
      keyword("Paso", "/ˈpaso/"),
      keyword("pico", "/ˈpiko/"),
    ];

    expect(
      getSpanishExampleWindow(pool, pool[0], 4).map((item) => item.word),
    ).toEqual(["paso", "pico"]);
  });

  it("extracts Spanish allophone target symbols", () => {
    expect(getSpanishTargetSymbols(phoneme("es-bv", "/b ~ β/"))).toEqual([
      "b",
      "β",
    ]);
    expect(getSpanishTargetSymbols(phoneme("es-tap-r", "/ɾ/"))).toEqual(["ɾ"]);
  });

  it("highlights the target symbol inside a Spanish IPA string", () => {
    const parts = highlightSpanishTargetInIpa(
      "/ˈpaso/",
      phoneme("es-p", "/p/"),
    );

    expect(parts).toEqual([
      { text: "/ˈ", highlight: false },
      { text: "p", highlight: true },
      { text: "aso/", highlight: false },
    ]);
  });

  it("does not crash when the target is absent", () => {
    const parts = highlightSpanishTargetInIpa(
      "/ˈkasa/",
      phoneme("es-ny", "/ɲ/"),
    );

    expect(parts).toEqual([{ text: "/ˈkasa/", highlight: false }]);
  });

  it("selects adjacent Spanish words cyclically", () => {
    const pool = [
      keyword("paso", "/ˈpaso/"),
      keyword("pico", "/ˈpiko/"),
      keyword("sopa", "/ˈsopa/"),
    ];

    expect(getAdjacentSpanishWord(pool, pool[0], 1)?.word).toBe("pico");
    expect(getAdjacentSpanishWord(pool, pool[0], -1)?.word).toBe("sopa");
  });
});
