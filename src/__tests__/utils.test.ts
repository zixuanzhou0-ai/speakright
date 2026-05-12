import { describe, expect, it } from "vitest";
import { isSentence } from "@/lib/utils";

describe("isSentence", () => {
  it("returns false for single word", () => {
    expect(isSentence("hello")).toBe(false);
  });

  it("returns true for multiple words", () => {
    expect(isSentence("hello world")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isSentence("")).toBe(false);
  });

  it("returns false for whitespace only", () => {
    expect(isSentence("   ")).toBe(false);
  });

  it("trims whitespace before checking", () => {
    expect(isSentence("  hello  ")).toBe(false);
    expect(isSentence("  hello world  ")).toBe(true);
  });

  it("handles multiple spaces between words", () => {
    expect(isSentence("hello   world")).toBe(true);
  });
});
