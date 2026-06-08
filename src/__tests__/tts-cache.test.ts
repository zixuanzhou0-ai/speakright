import { describe, expect, it } from "vitest";
import { buildCacheKey } from "@/lib/tts-cache";

describe("TTS cache key format", () => {
  it("normalizes text and speed", () => {
    expect(buildCacheKey("  Hello  ", "voice1", 0.85)).toBe(
      "en-US:hello:voice1:0.8",
    );
  });

  it("includes voiceId in key", () => {
    const key1 = buildCacheKey("hello", "voice1", 1.0);
    const key2 = buildCacheKey("hello", "voice2", 1.0);

    expect(key1).not.toBe(key2);
  });

  it("separates identical text by language", () => {
    const english = buildCacheKey("Bonjour", "voice1", 0.84, "en-US");
    const french = buildCacheKey("Bonjour", "voice1", 0.84, "fr-FR");

    expect(english).toBe("en-US:bonjour:voice1:0.8");
    expect(french).toBe("fr-FR:bonjour:voice1:0.8");
    expect(english).not.toBe(french);
  });
});
