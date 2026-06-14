import { describe, expect, it } from "vitest";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import { shouldShowSoundUnitHeaderAudio } from "@/lib/language-source-alignment";
import type { LanguageId } from "@/types/language";

function unit(languageId: LanguageId, slug: string) {
  const soundUnit = getLanguagePhonemeBySlug(languageId, slug);
  expect(soundUnit, `${languageId}:${slug}`).toBeDefined();
  if (!soundUnit) throw new Error(`Missing sound unit ${languageId}:${slug}`);
  return soundUnit;
}

describe("language source alignment", () => {
  it("keeps English local chart/header audio available", () => {
    expect(shouldShowSoundUnitHeaderAudio("en-US", unit("en-US", "ee"))).toBe(
      true,
    );
  });

  it("keeps exact non-English phoneme header audio available", () => {
    expect(shouldShowSoundUnitHeaderAudio("es-ES", unit("es-ES", "es-a"))).toBe(
      true,
    );
    expect(shouldShowSoundUnitHeaderAudio("fr-FR", unit("fr-FR", "fr-i"))).toBe(
      true,
    );
    expect(shouldShowSoundUnitHeaderAudio("ru-RU", unit("ru-RU", "ru-a"))).toBe(
      true,
    );
  });

  it("hides non-English rule/prosody header speakers without exact local target audio", () => {
    expect(
      shouldShowSoundUnitHeaderAudio(
        "es-ES",
        unit("es-ES", "es-lexical-stress"),
      ),
    ).toBe(false);
    expect(
      shouldShowSoundUnitHeaderAudio("fr-FR", unit("fr-FR", "fr-liaison")),
    ).toBe(false);
    expect(
      shouldShowSoundUnitHeaderAudio(
        "ru-RU",
        unit("ru-RU", "ru-final-devoicing"),
      ),
    ).toBe(false);
  });
});
