import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_LANGUAGE_PACKS,
  getElevenLabsPackItems,
  getElevenLabsPackSummary,
  type ElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";

const PACK_LANGUAGES: ElevenLabsPackLanguageId[] = ["es-ES", "fr-FR", "ru-RU"];

describe("ElevenLabs language audio packs", () => {
  it("defines installable presets for Spanish, French, and Russian", () => {
    for (const languageId of PACK_LANGUAGES) {
      const pack = ELEVENLABS_LANGUAGE_PACKS[languageId];

      expect(pack.modelId).toBe("eleven_multilingual_v2");
      expect(pack.previewModelId).toBe("eleven_flash_v2_5");
      expect(pack.voiceSearchTerms.length).toBeGreaterThanOrEqual(3);
      expect(pack.voiceSettings.use_speaker_boost).toBe(true);
    }
  });

  it("offers at least 20 generated-audio candidates per sound unit in core mode", () => {
    for (const languageId of PACK_LANGUAGES) {
      const coreSummary = getElevenLabsPackSummary(languageId, "core");
      const fullSummary = getElevenLabsPackSummary(languageId, "full");

      expect(coreSummary.itemCount).toBeGreaterThanOrEqual(200);
      expect(coreSummary.estimatedCredits).toBeGreaterThan(0);
      expect(fullSummary.itemCount).toBeGreaterThanOrEqual(coreSummary.itemCount);
    }
  });

  it("deduplicates repeated words before installation", () => {
    for (const languageId of PACK_LANGUAGES) {
      const words = getElevenLabsPackItems(languageId, "full").map((item) =>
        item.word.toLocaleLowerCase(),
      );

      expect(new Set(words).size).toBe(words.length);
    }
  });
});
