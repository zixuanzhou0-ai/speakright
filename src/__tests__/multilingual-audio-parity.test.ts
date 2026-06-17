import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  MULTILINGUAL_AUDIO_PARITY_LANGUAGES,
  MULTILINGUAL_AUDIO_PARITY_RULE_ANCHOR_TARGET,
  MULTILINGUAL_AUDIO_PARITY_RULE_PHRASE_TARGET,
  MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
  buildMultilingualAudioParityReport,
  getAudioParityKey,
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
    audioByVoice?: Partial<Record<"blue" | "pink", string>>;
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

  const keys = new Set<string>();
  for (const item of manifest.items) {
    const audioByVoice = item.audioByVoice ?? { blue: item.audioSrc };
    for (const [voiceSlot, audioSrc] of Object.entries(audioByVoice)) {
      if (!audioSrc) continue;
      keys.add(getAudioParityKey(voiceSlot as "blue" | "pink", item.key));
      keys.add(getAudioParityKey(voiceSlot as "blue" | "pink", item.text));
    }
  }
  return keys;
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
    expect(report.totals.soundUnits).toBe(99);
    expect(report.totals.requiredItems).toBe(
      99 * MULTILINGUAL_AUDIO_PARITY_TARGET_PER_UNIT,
    );
    expect(report.totals.existingAudioItems).toBe(2888);
    expect(report.totals.missingAudioItems).toBe(688);
    expect(report.totals.estimatedNewCharacters).toBe(5832);

    const spanishReport = report.languages.find(
      (language) => language.languageId === "es-ES",
    );
    expect(
      spanishReport?.units
        .filter((unit) => unit.missingAudioTexts.length > 0)
        .map((unit) => unit.slug),
    ).toEqual(["es-p", "es-t", "es-k", "es-f", "es-m", "es-n"]);

    const frenchReport = report.languages.find(
      (language) => language.languageId === "fr-FR",
    );
    expect(
      frenchReport?.units
        .filter((unit) => unit.missingAudioTexts.length > 0)
        .map((unit) => unit.slug),
    ).toEqual([
      "fr-p",
      "fr-b",
      "fr-t",
      "fr-d",
      "fr-k",
      "fr-g",
      "fr-f",
      "fr-v",
      "fr-s",
      "fr-z",
      "fr-m",
      "fr-n",
      "fr-l",
    ]);

    const russianReport = report.languages.find(
      (language) => language.languageId === "ru-RU",
    );
    expect(
      russianReport?.units
        .filter((unit) => unit.missingAudioTexts.length > 0)
        .map((unit) => unit.slug),
    ).toEqual(["ru-p-pj", "ru-b-bj", "ru-m-mj", "ru-f-fj", "ru-v-vj"]);
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
        expect(item.audioByVoice?.blue).toBe(item.audioSrc);
        for (const voiceSlot of ["blue", "pink"] as const) {
          const audioSrc = item.audioByVoice?.[voiceSlot];
          expect(audioSrc).toBeTruthy();
          const filePath = join(
            PROJECT_ROOT,
            "public",
            String(audioSrc).replace(/^\//, ""),
          );
          expect(existsSync(filePath)).toBe(true);
        }
      }
    }
  });
});
