import type { ElevenLabsPackLanguageId } from "@/lib/elevenlabs-language-packs";
import { normalizeAudioPackText } from "@/lib/language-audio-pack-cache";

interface StaticLanguageAudioPackItem {
  key: string;
  text: string;
  ipa?: string;
  soundUnitSlugs: string[];
  audioSrc: string;
}

interface StaticLanguageAudioPackManifest {
  version: number;
  languageId: ElevenLabsPackLanguageId;
  modelId: string;
  voiceId: string;
  voiceName: string;
  itemCount: number;
  items: StaticLanguageAudioPackItem[];
}

export interface StaticLanguageAudioPackSummary {
  languageId: ElevenLabsPackLanguageId;
  itemCount: number;
  modelId: string;
  voiceName: string;
}

export interface StaticLanguageAudioPackEntry extends StaticLanguageAudioPackItem {
  languageId: ElevenLabsPackLanguageId;
  modelId: string;
  voiceId: string;
  voiceName: string;
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
): Promise<StaticLanguageAudioPackEntry | null> {
  const manifest = await getManifest(languageId);
  if (!manifest) return null;

  const key = normalizeAudioPackText(text);
  const item = manifest.items.find((entry) => entry.key === key);
  if (!item) return null;

  return {
    ...item,
    languageId,
    modelId: manifest.modelId,
    voiceId: manifest.voiceId,
    voiceName: manifest.voiceName,
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
  };
}

export function clearStaticLanguageAudioPackCache(): void {
  manifestCache.clear();
}
