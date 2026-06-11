import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  MULTILINGUAL_AUDIO_PARITY_LANGUAGES,
  MULTILINGUAL_AUDIO_PARITY_RULE_ANCHOR_TARGET,
  MULTILINGUAL_AUDIO_PARITY_RULE_PHRASE_TARGET,
  MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
  buildMultilingualAudioParityReport,
  getMultilingualPracticeItems,
  isRuleLikeParityUnit,
  summarizeMultilingualAudioParity,
  type MultilingualAudioParityLanguageId,
} from "@/lib/multilingual-audio-parity";

const PROJECT_ROOT = process.cwd();

interface StaticLanguageAudioPackManifest {
  items: Array<{
    key: string;
    text: string;
    audioSrc: string;
  }>;
}

function loadAudioKeys(languageId: MultilingualAudioParityLanguageId) {
  const manifestPath = join(
    PROJECT_ROOT,
    "public",
    "audio",
    "language-packs",
    languageId,
    "manifest.json",
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as StaticLanguageAudioPackManifest;

  return new Set(
    manifest.items.flatMap((item) => [
      normalizeAudioPackText(item.key),
      normalizeAudioPackText(item.text),
    ]),
  );
}

describe("multilingual audio parity contract", () => {
  it("builds typed practice items for every non-English sound unit", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      const items = getMultilingualPracticeItems(languageId);

      expect(items.length).toBeGreaterThan(0);

      for (const item of items) {
        expect(item.languageId).toBe(languageId);
        expect(item.text.trim()).not.toBe("");
        expect(item.ipa.trim()).not.toBe("");
        expect(item.soundUnitSlugs.length).toBeGreaterThan(0);
        expect(["word", "phrase", "sentence", "contrast"]).toContain(item.kind);

        for (const slug of item.soundUnitSlugs) {
          expect(getLanguagePhonemeBySlug(languageId, slug)).toBeDefined();
        }
      }
    }
  });

  it("keeps every non-English sound unit at or above the 24-item density target", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      const summary = summarizeMultilingualAudioParity(languageId);
      const underfilled = summary.units.filter(
        (unit) => unit.totalItems < MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
      );

      expect(
        underfilled.map((unit) => ({
          slug: unit.slug,
          totalItems: unit.totalItems,
        })),
      ).toEqual([]);
    }
  });

  it("keeps rule and prosody units phrase-heavy instead of word-only", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      const summary = summarizeMultilingualAudioParity(languageId);
      const weakRuleUnits = summary.units
        .filter((unit) => isRuleLikeParityUnit(unit))
        .filter(
          (unit) =>
            unit.phraseLikeItems < MULTILINGUAL_AUDIO_PARITY_RULE_PHRASE_TARGET ||
            (unit.wordLikeItems < MULTILINGUAL_AUDIO_PARITY_RULE_ANCHOR_TARGET &&
              unit.phraseLikeItems < MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT),
        );

      expect(
        weakRuleUnits.map((unit) => ({
          slug: unit.slug,
          wordLikeItems: unit.wordLikeItems,
          phraseLikeItems: unit.phraseLikeItems,
        })),
      ).toEqual([]);
    }
  });

  it("reports local audio gaps without requiring an ElevenLabs key", () => {
    const audioKeysByLanguage = Object.fromEntries(
      MULTILINGUAL_AUDIO_PARITY_LANGUAGES.map((languageId) => [
        languageId,
        loadAudioKeys(languageId),
      ]),
    );
    const report = buildMultilingualAudioParityReport(audioKeysByLanguage);

    expect(report.targetItemsPerUnit).toBe(
      MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    );
    expect(report.totals.soundUnits).toBe(75);
    expect(report.totals.requiredItems).toBe(
      75 * MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    );
    expect(report.totals.existingAudioItems).toBeGreaterThan(1200);
    expect(report.totals.missingAudioItems).toBeGreaterThanOrEqual(0);
    expect(report.totals.estimatedNewCharacters).toBeGreaterThanOrEqual(0);
  });

  it("keeps existing language pack manifest entries pointing to real files", () => {
    for (const languageId of MULTILINGUAL_AUDIO_PARITY_LANGUAGES) {
      const manifestPath = join(
        PROJECT_ROOT,
        "public",
        "audio",
        "language-packs",
        languageId,
        "manifest.json",
      );
      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      ) as StaticLanguageAudioPackManifest;

      for (const item of manifest.items) {
        const filePath = join(
          PROJECT_ROOT,
          "public",
          item.audioSrc.replace(/^\//, ""),
        );
        expect(existsSync(filePath)).toBe(true);
      }
    }
  });
});
