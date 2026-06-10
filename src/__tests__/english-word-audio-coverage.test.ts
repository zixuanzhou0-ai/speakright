import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHONEMES } from "@/lib/phoneme-data";
import { getWordPool } from "@/lib/word-pool";

interface WordAudioManifest {
  words: string[];
  voices: Array<{ dir: "blue" | "pink"; name: string; id: string }>;
  files: Record<
    "blue" | "pink",
    Record<string, { path: string; exists: boolean; bytes: number }>
  >;
}

const projectRoot = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(projectRoot, "public/audio/words/manifest.json"), "utf8"),
) as WordAudioManifest;

describe("English word pool and bundled audio coverage", () => {
  it("keeps every English phoneme at exactly 24 practice words", () => {
    for (const phoneme of PHONEMES) {
      const pool = getWordPool(phoneme.slug, phoneme.keywords);
      const words = pool.map((entry) => entry.word.toLowerCase());
      const uniqueWords = new Set(words);

      expect(pool, phoneme.slug).toHaveLength(24);
      expect(uniqueWords.size, phoneme.slug).toBe(words.length);
      expect(
        pool.every((entry) => entry.ipa.trim().startsWith("/")),
        phoneme.slug,
      ).toBe(true);
    }
  });

  it("bundles blue and pink audio for every English practice word", () => {
    const expectedWords = new Set<string>();
    for (const phoneme of PHONEMES) {
      for (const entry of getWordPool(phoneme.slug, phoneme.keywords)) {
        expectedWords.add(entry.word.toLowerCase());
      }
    }

    expect(new Set(manifest.words)).toEqual(expectedWords);
    expect(manifest.voices.map((voice) => voice.dir).sort()).toEqual([
      "blue",
      "pink",
    ]);

    for (const voice of manifest.voices) {
      for (const word of expectedWords) {
        const file = manifest.files[voice.dir][word];
        expect(file, `${voice.dir}/${word}`).toBeDefined();
        expect(file.exists, `${voice.dir}/${word}`).toBe(true);
        expect(file.bytes, `${voice.dir}/${word}`).toBeGreaterThan(1000);
        expect(
          existsSync(join(projectRoot, "public", file.path.replace(/^\//, ""))),
          `${voice.dir}/${word}`,
        ).toBe(true);
      }
    }
  });
});
