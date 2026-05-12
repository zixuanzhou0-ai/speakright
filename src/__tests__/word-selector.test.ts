import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectNextWord } from "@/lib/word-selector";
import type { KeywordEntry } from "@/types/phoneme";

// Mock practice-tracker to control practiced words
vi.mock("@/lib/practice-tracker", () => ({
  getPracticedWords: vi.fn(() => []),
}));

const makePool = (words: string[]): KeywordEntry[] =>
  words.map((word) => ({ word, ipa: `/${word}/` }));

describe("selectNextWord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws on empty pool", () => {
    expect(() => selectNextWord("test", [])).toThrow("Word pool is empty");
  });

  it("returns the only word for single-element pool", () => {
    const pool = makePool(["cat"]);
    expect(selectNextWord("test", pool)).toEqual(pool[0]);
  });

  it("excludes current word from selection", () => {
    const pool = makePool(["cat", "dog"]);
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(selectNextWord("test", pool, "cat").word);
    }
    expect(results.has("cat")).toBe(false);
    expect(results.has("dog")).toBe(true);
  });

  it("returns a word from the pool for multi-element pool", () => {
    const pool = makePool(["cat", "dog", "fish"]);
    const result = selectNextWord("test", pool);
    expect(pool.map((p) => p.word)).toContain(result.word);
  });

  it("handles case-insensitive currentWord exclusion", () => {
    const pool = makePool(["Cat", "dog"]);
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      results.add(selectNextWord("test", pool, "cat").word);
    }
    expect(results.has("Cat")).toBe(false);
  });

  it("falls back to pool[0] if currentWord is the only word", () => {
    const pool = makePool(["only"]);
    expect(selectNextWord("test", pool, "only").word).toBe("only");
  });
});
