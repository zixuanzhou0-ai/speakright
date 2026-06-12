import type { ElevenLabsPackLanguageId } from "@/lib/elevenlabs-language-packs";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";

interface StaticLanguageAudioPackItem {
  key: string;
  text: string;
  ipa?: string;
  soundUnitSlugs: string[];
  audioSrc: string;
  audioByVoice?: Partial<Record<StaticLanguageAudioVoiceSlot, string>>;
  fileName?: string;
  fileNameByVoice?: Partial<Record<StaticLanguageAudioVoiceSlot, string>>;
  bytes?: number;
  bytesByVoice?: Partial<Record<StaticLanguageAudioVoiceSlot, number>>;
}

interface StaticLanguageAudioPackManifest {
  version: number;
  languageId: ElevenLabsPackLanguageId;
  modelId: string;
  voiceId: string;
  voiceName: string;
  voices?: Partial<Record<StaticLanguageAudioVoiceSlot, StaticLanguageAudioPackVoice>>;
  voiceSlots?: StaticLanguageAudioVoiceSlot[];
  itemCount: number;
  items: StaticLanguageAudioPackItem[];
}

export type StaticLanguageAudioVoiceSlot = "blue" | "pink";

interface StaticLanguageAudioPackVoice {
  slot: StaticLanguageAudioVoiceSlot;
  voiceId: string;
  voiceName: string;
  modelId: string;
}

export interface StaticLanguageAudioPackSummary {
  languageId: ElevenLabsPackLanguageId;
  itemCount: number;
  modelId: string;
  voiceName: string;
  voiceSlots: StaticLanguageAudioVoiceSlot[];
}

export interface StaticLanguageAudioPackEntry extends StaticLanguageAudioPackItem {
  languageId: ElevenLabsPackLanguageId;
  modelId: string;
  voiceId: string;
  voiceName: string;
  voiceSlot: StaticLanguageAudioVoiceSlot;
}

const manifestCache = new Map<
  ElevenLabsPackLanguageId,
  Promise<StaticLanguageAudioPackManifest | null>
>();

async function loadManifest(
  languageId: ElevenLabsPackLanguageId,
): Promise<StaticLanguageAudioPackManifest | null> {
  try {
    const response = await fetch(`/audio/language-packs/${languageId}/manifest.json`);
    if (!response.ok) return null;
    return (await response.json()) as StaticLanguageAudioPackManifest;
  } catch {
    return null;
  }
}

async function getManifest(
  languageId: ElevenLabsPackLanguageId,
): Promise<StaticLanguageAudioPackManifest | null> {
  if (!manifestCache.has(languageId)) {
    manifestCache.set(languageId, loadManifest(languageId));
  }
  return manifestCache.get(languageId) ?? null;
}

export async function getStaticLanguageAudioPackEntry(
  languageId: ElevenLabsPackLanguageId,
  text: string,
  voiceSlot: StaticLanguageAudioVoiceSlot = "blue",
): Promise<StaticLanguageAudioPackEntry | null> {
  const manifest = await getManifest(languageId);
  if (!manifest) return null;

  const key = normalizeAudioPackText(text);
  const item = manifest.items.find(
    (entry) =>
      normalizeAudioPackText(entry.key) === key ||
      normalizeAudioPackText(entry.text) === key,
  );
  if (!item) return null;

  const audioSrc =
    item.audioByVoice?.[voiceSlot] ?? (voiceSlot === "blue" ? item.audioSrc : null);
  if (!audioSrc) return null;

  const selectedVoice = manifest.voices?.[voiceSlot];

  return {
    ...item,
    audioSrc,
    languageId,
    modelId: selectedVoice?.modelId ?? manifest.modelId,
    voiceId: selectedVoice?.voiceId ?? manifest.voiceId,
    voiceName: selectedVoice?.voiceName ?? manifest.voiceName,
    voiceSlot,
  };
}

export async function getStaticLanguageAudioPackSummary(
  languageId: ElevenLabsPackLanguageId,
): Promise<StaticLanguageAudioPackSummary | null> {
  const manifest = await getManifest(languageId);
  if (!manifest) return null;
  return {
    languageId: manifest.languageId,
    itemCount: manifest.itemCount,
    modelId: manifest.modelId,
    voiceName: manifest.voiceName,
    voiceSlots: manifest.voiceSlots ?? ["blue"],
  };
}

export function clearStaticLanguageAudioPackCache(): void {
  manifestCache.clear();
}
