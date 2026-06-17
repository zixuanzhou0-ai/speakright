import { describe, expect, it } from "vitest";
import { getAllAssessmentSegmentAudioRegistryEntries } from "@/lib/assessment-segment-audio";
import { getLanguageAssessmentAudioPolicyRows } from "@/lib/language-assessment-audio-policy";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import {
  getSoundUnitSourceAlignment,
  shouldShowSoundUnitHeaderAudio,
} from "@/lib/language-source-alignment";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";

function unit(languageId: LanguageId, slug: string) {
  const soundUnit = getLanguagePhonemeBySlug(languageId, slug);
  expect(soundUnit, `${languageId}:${slug}`).toBeDefined();
  if (!soundUnit) throw new Error(`Missing sound unit ${languageId}:${slug}`);
  return soundUnit;
}

function adHocEnglishUnit(overrides: Partial<PhonemeData>): PhonemeData {
  return {
    ipa: "/x/",
    symbol: "x",
    slug: "test-audio-policy",
    name: "test audio policy",
    category: "consonant",
    example: "test",
    keywords: [{ word: "test", ipa: "/test/" }],
    difficulty: "easy",
    ...overrides,
  };
}

describe("language source alignment", () => {
  it("keeps English local chart/header audio available", () => {
    expect(shouldShowSoundUnitHeaderAudio("en-US", unit("en-US", "ee"))).toBe(
      true,
    );
  });

  it("hides English header speakers when fallback localSrc is not a short header clip", () => {
    expect(
      shouldShowSoundUnitHeaderAudio(
        "en-US",
        adHocEnglishUnit({
          phonemeAudio: {
            kind: "local",
            label: "Video-backed fallback",
            source: "test",
            localSrc: "/videos/phonemes/ee.mp4",
            languageId: "en-US",
          },
        }),
      ),
    ).toBe(false);

    expect(
      shouldShowSoundUnitHeaderAudio(
        "en-US",
        adHocEnglishUnit({
          phonemeAudio: {
            kind: "local",
            label: "Whole-word fallback",
            source: "test",
            localSrc: "/audio/words/blue/test.mp3",
            languageId: "en-US",
          },
        }),
      ),
    ).toBe(false);

    expect(
      shouldShowSoundUnitHeaderAudio(
        "en-US",
        adHocEnglishUnit({ chartWord: "cat" }),
      ),
    ).toBe(true);

    expect(
      shouldShowSoundUnitHeaderAudio(
        "en-US",
        adHocEnglishUnit({ chartWord: "fr-schwa" }),
      ),
    ).toBe(false);
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

  it("keeps every exact assessment clip visible as the same sound-unit header audio", () => {
    for (const entry of getAllAssessmentSegmentAudioRegistryEntries()) {
      const soundUnit = unit(entry.languageId, entry.soundUnitSlug);
      const policyRow = getLanguageAssessmentAudioPolicyRows(entry.languageId).find(
        (row) => row.slug === entry.soundUnitSlug,
      );

      expect(
        shouldShowSoundUnitHeaderAudio(entry.languageId, soundUnit),
        `${entry.languageId}:${entry.soundUnitSlug}`,
      ).toBe(true);
      expect(soundUnit.phonemeAudio?.localSrc, entry.soundUnitSlug).toBe(
        entry.audioUrl,
      );
      expect(policyRow?.shouldBeClickable, entry.soundUnitSlug).toBe(true);
      expect(policyRow?.registryAudioUrl, entry.soundUnitSlug).toBe(
        soundUnit.phonemeAudio?.localSrc,
      );
      expect(policyRow?.registryMatchesHeaderAudio, entry.soundUnitSlug).toBe(
        true,
      );
    }
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
        "fr-FR",
        unit("fr-FR", "fr-phrase-final-prominence"),
      ),
    ).toBe(false);
    expect(
      shouldShowSoundUnitHeaderAudio(
        "ru-RU",
        unit("ru-RU", "ru-final-devoicing"),
      ),
    ).toBe(false);
  });

  it("keeps Russian final-devoicing source guidance connected-speech aware", () => {
    const alignment = getSoundUnitSourceAlignment("ru-RU", "ru-final-devoicing");

    expect(alignment?.ruleSummary).toContain("停顿或清辅音前");
    expect(alignment?.ruleSummary).toContain("浊辅音、响音或元音前");
    expect(alignment?.ruleSummary).not.toContain("这不是拼写错误，而是词尾规则");
  });

  it("keeps French phrase-final prominence out of English lexical stress logic", () => {
    const alignment = getSoundUnitSourceAlignment(
      "fr-FR",
      "fr-phrase-final-prominence",
    );

    expect(alignment?.ruleSummary).toContain("节奏组");
    expect(alignment?.ruleSummary).toContain("不要像英语");
    expect(alignment?.primaryVideoCoverage).not.toBe("exact");
  });
});
