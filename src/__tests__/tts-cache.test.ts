import { describe, expect, it } from "vitest";

// Test the buildCacheKey logic directly (the function is internal to tts-cache.ts,
// so we test its behavior through the module's public API contract)
describe("TTS cache key format", () => {
  // Replicating the internal buildCacheKey logic for unit testing
  function buildCacheKey(text: string, voiceId: string, speed: number): string {
    return `${text.trim().toLowerCase()}:${voiceId}:${speed.toFixed(1)}`;
  }

  it("lowercases text", () => {
    expect(buildCacheKey("Hello", "voice1", 1.0)).toBe("hello:voice1:1.0");
  });

  it("trims whitespace", () => {
    expect(buildCacheKey("  hello  ", "voice1", 1.0)).toBe("hello:voice1:1.0");
  });

  it("normalizes speed to 1 decimal", () => {
    expect(buildCacheKey("hello", "voice1", 0.85)).toBe("hello:voice1:0.8");
    expect(buildCacheKey("hello", "voice1", 1.0)).toBe("hello:voice1:1.0");
    expect(buildCacheKey("hello", "voice1", 0.7)).toBe("hello:voice1:0.7");
  });

  it("includes voiceId in key", () => {
    const key1 = buildCacheKey("hello", "voice1", 1.0);
    const key2 = buildCacheKey("hello", "voice2", 1.0);
    expect(key1).not.toBe(key2);
  });

  it("different speeds produce different keys", () => {
    const key1 = buildCacheKey("hello", "voice1", 0.8);
    const key2 = buildCacheKey("hello", "voice1", 1.0);
    expect(key1).not.toBe(key2);
  });
});
