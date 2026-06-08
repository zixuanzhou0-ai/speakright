import { getLanguagePhonemes } from "@/lib/language-phonemes";
import type { ElevenLabsVoiceSettings } from "@/lib/api-client";
import type { LanguageId } from "@/types/language";
import type { KeywordEntry } from "@/types/phoneme";

export type ElevenLabsPackLanguageId = Extract<
  LanguageId,
  "es-ES" | "fr-FR" | "ru-RU"
>;

export type ElevenLabsAudioPackMode = "core" | "full";

export interface ElevenLabsLanguagePackPreset {
  languageId: ElevenLabsPackLanguageId;
  title: string;
  nativeName: string;
  languageCode: "es" | "fr" | "ru";
  modelId: string;
  previewModelId: string;
  speed: number;
  voiceSettings: ElevenLabsVoiceSettings;
  voiceSearchTerms: string[];
  voiceDescription: string;
}

export interface ElevenLabsPackItem extends KeywordEntry {
  soundUnitSlug: string;
}

const CORE_OPTIONS_PER_SOUND_UNIT = 20;

export const ELEVENLABS_LANGUAGE_PACKS: Record<
  ElevenLabsPackLanguageId,
  ElevenLabsLanguagePackPreset
> = {
  "es-ES": {
    languageId: "es-ES",
    title: "西班牙语发音包",
    nativeName: "Español",
    languageCode: "es",
    modelId: "eleven_multilingual_v2",
    previewModelId: "eleven_flash_v2_5",
    speed: 0.86,
    voiceSettings: {
      stability: 0.78,
      similarity_boost: 0.86,
      style: 0.12,
      use_speaker_boost: true,
    },
    voiceSearchTerms: ["Spanish", "Español", "Castilian", "Spain"],
    voiceDescription: "优先搜索 ElevenLabs 里带 Spanish/Español/Spain 标签的清晰教学型声音。",
  },
  "fr-FR": {
    languageId: "fr-FR",
    title: "法语发音包",
    nativeName: "Français",
    languageCode: "fr",
    modelId: "eleven_multilingual_v2",
    previewModelId: "eleven_flash_v2_5",
    speed: 0.84,
    voiceSettings: {
      stability: 0.8,
      similarity_boost: 0.87,
      style: 0.1,
      use_speaker_boost: true,
    },
    voiceSearchTerms: ["French", "Français", "France", "Paris"],
    voiceDescription: "优先搜索 ElevenLabs 里带 French/Français/France 标签的清晰教学型声音。",
  },
  "ru-RU": {
    languageId: "ru-RU",
    title: "俄语发音包",
    nativeName: "Русский",
    languageCode: "ru",
    modelId: "eleven_multilingual_v2",
    previewModelId: "eleven_flash_v2_5",
    speed: 0.82,
    voiceSettings: {
      stability: 0.82,
      similarity_boost: 0.88,
      style: 0.08,
      use_speaker_boost: true,
    },
    voiceSearchTerms: ["Russian", "Русский", "Russia"],
    voiceDescription: "优先搜索 ElevenLabs 里带 Russian/Русский/Russia 标签的清晰教学型声音。",
  },
};

function normalizedTextKey(text: string): string {
  return text.trim().toLocaleLowerCase();
}

export function getElevenLabsLanguagePack(
  languageId: ElevenLabsPackLanguageId,
): ElevenLabsLanguagePackPreset {
  return ELEVENLABS_LANGUAGE_PACKS[languageId];
}

export function getElevenLabsPackItems(
  languageId: ElevenLabsPackLanguageId,
  mode: ElevenLabsAudioPackMode,
): ElevenLabsPackItem[] {
  const seen = new Set<string>();
  const items: ElevenLabsPackItem[] = [];

  for (const soundUnit of getLanguagePhonemes(languageId)) {
    const keywords =
      mode === "core"
        ? soundUnit.keywords.slice(0, CORE_OPTIONS_PER_SOUND_UNIT)
        : soundUnit.keywords;

    for (const keyword of keywords) {
      const key = normalizedTextKey(keyword.word);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({ ...keyword, soundUnitSlug: soundUnit.slug });
    }
  }

  return items;
}

export function estimateElevenLabsCredits(items: Pick<KeywordEntry, "word">[]): number {
  return items.reduce((sum, item) => sum + item.word.trim().length, 0);
}

export function getElevenLabsPackSummary(
  languageId: ElevenLabsPackLanguageId,
  mode: ElevenLabsAudioPackMode,
) {
  const items = getElevenLabsPackItems(languageId, mode);
  return {
    itemCount: items.length,
    estimatedCredits: estimateElevenLabsCredits(items),
  };
}

export function isElevenLabsPackLanguageId(
  languageId: LanguageId,
): languageId is ElevenLabsPackLanguageId {
  return languageId === "es-ES" || languageId === "fr-FR" || languageId === "ru-RU";
}
