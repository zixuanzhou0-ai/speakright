import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";

const PROJECT_ROOT = process.cwd();
const PACK_LANGUAGES = ["es-ES", "fr-FR", "ru-RU"] as const;

interface StaticPackManifest {
  languageId: (typeof PACK_LANGUAGES)[number];
  itemCount: number;
  items: Array<{
    key: string;
    text: string;
    audioSrc: string;
  }>;
}

function loadManifest(languageId: (typeof PACK_LANGUAGES)[number]) {
  const manifestPath = join(
    PROJECT_ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
  return JSON.parse(readFileSync(manifestPath, "utf8")) as StaticPackManifest;
}

describe("static multilingual language audio packs", () => {
  it("bundles a manifest and local audio files for each experimental language", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);

      expect(manifest.languageId).toBe(languageId);
      expect(manifest.itemCount).toBe(manifest.items.length);
      expect(manifest.itemCount).toBeGreaterThan(300);

      const keys = new Set<string>();
      for (const item of manifest.items) {
        expect(item.key).toBeTruthy();
        expect(item.text).toBeTruthy();
        expect(item.audioSrc).toMatch(
          new RegExp(`^/audio/language-packs/${languageId}/.+\\.mp3$`),
        );
        expect(keys.has(item.key)).toBe(false);
        keys.add(item.key);

        const filePath = join(PROJECT_ROOT, "public", item.audioSrc.replace(/^\//, ""));
        expect(existsSync(filePath)).toBe(true);
      }
    }
  });

  it("normalizes multilingual apostrophes, accents, punctuation, and spacing for lookup", () => {
    expect(normalizeAudioPackText(" j’aime ")).toBe("j'aime");
    expect(normalizeAudioPackText("J’ AIME")).toBe("j'aime");
    expect(normalizeAudioPackText("cafe\u0301")).toBe("café");
    expect(normalizeAudioPackText("да́")).toBe("да");
    expect(normalizeAudioPackText("Les   amis")).toBe("les amis");
  });

  it("covers every non-English diagnostic word with static local audio", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);
      const keys = new Set(
        manifest.items.flatMap((item) => [
          normalizeAudioPackText(item.key),
          normalizeAudioPackText(item.text),
        ]),
      );

      const missing = LANGUAGE_LEARNING_DECKS[
        languageId
      ].diagnosticWords.filter(
        (word) => !keys.has(normalizeAudioPackText(word.text)),
      );

      expect(missing.map((word) => word.text)).toEqual([]);
    }
  });

  it("covers multilingual contrast drill words with static local audio", () => {
    for (const languageId of PACK_LANGUAGES) {
      const manifest = loadManifest(languageId);
      const keys = new Set(
        manifest.items.flatMap((item) => [
          normalizeAudioPackText(item.key),
          normalizeAudioPackText(item.text),
        ]),
      );
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      const requiredTexts = [
        ...deck.contrastDeck.flatMap((item) => [item.left, item.right]),
      ];
      const missing = Array.from(new Set(requiredTexts)).filter(
        (text) => !keys.has(normalizeAudioPackText(text)),
      );

      expect(missing).toEqual([]);
    }
  });

  it("keeps multilingual sentence and passage texts available for TTS preview", () => {
    for (const languageId of PACK_LANGUAGES) {
      const deck = LANGUAGE_LEARNING_DECKS[languageId];
      expect(deck.diagnosticPassage.text.trim().length).toBeGreaterThan(0);
      expect(deck.sentenceDeck.map((item) => item.text.trim())).not.toContain("");
    }
  });
});
