import { describe, expect, it } from "vitest";
import { buildCacheKey } from "@/lib/tts-cache";

describe("TTS cache key format", () => {
  it("normalizes text and speed", () => {
    expect(
      buildCacheKey("  Hello  ", "elevenlabs:voice1:eleven_flash_v2_5", 0.85),
    ).toBe("v2:en-US:hello:elevenlabs:voice1:eleven_flash_v2_5:0.85");
  });

  it("includes voiceId in key", () => {
    const key1 = buildCacheKey("hello", "voice1", 1.0);
    const key2 = buildCacheKey("hello", "voice2", 1.0);

    expect(key1).not.toBe(key2);
  });

  it("separates identical text by language", () => {
    const english = buildCacheKey("Bonjour", "voice1", 0.84, "en-US");
    const french = buildCacheKey("Bonjour", "voice1", 0.84, "fr-FR");

    expect(english).toBe("v2:en-US:bonjour:voice1:0.84");
    expect(french).toBe("v2:fr-FR:bonjour:voice1:0.84");
    expect(english).not.toBe(french);
  });

  it("separates identical audio requests by provider, voice, and model", () => {
    const elevenLabs = buildCacheKey(
      "hello",
      "elevenlabs:voice1:eleven_flash_v2_5",
      1,
    );
    const hermes = buildCacheKey("hello", "hermes-grok:local-config", 1);
    const otherModel = buildCacheKey(
      "hello",
      "elevenlabs:voice1:eleven_multilingual_v2",
      1,
    );

    expect(new Set([elevenLabs, hermes, otherModel]).size).toBe(3);
  });
});
