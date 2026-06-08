import {
  elevenLabsTts,
  fetchElevenLabsUsage,
  searchElevenLabsVoices,
  type ElevenLabsVoiceSummary,
} from "@/lib/api-client";
import {
  hasLanguageAudioPackEntry,
  setLanguageAudioPackEntry,
  setLanguageAudioPackStatus,
} from "@/lib/language-audio-pack-cache";
import {
  estimateElevenLabsCredits,
  getElevenLabsLanguagePack,
  getElevenLabsPackItems,
  type ElevenLabsAudioPackMode,
  type ElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";

export interface ElevenLabsFallbackVoice {
  voiceId: string;
  voiceName?: string;
}

export interface ElevenLabsResolvedVoice {
  voiceId: string;
  voiceName: string;
  source: "language-search" | "default-config";
}

export interface ElevenLabsPackInstallProgress {
  phase: "checking" | "voice" | "generating" | "saving" | "done";
  current: number;
  total: number;
  text?: string;
  skipped: number;
  generated: number;
}

export interface ElevenLabsPackInstallResult {
  languageId: ElevenLabsPackLanguageId;
  mode: ElevenLabsAudioPackMode;
  total: number;
  skipped: number;
  generated: number;
  estimatedCredits: number;
  voice: ElevenLabsResolvedVoice;
}

interface InstallOptions {
  apiKey: string;
  languageId: ElevenLabsPackLanguageId;
  mode: ElevenLabsAudioPackMode;
  fallbackVoice?: ElevenLabsFallbackVoice;
  onProgress?: (progress: ElevenLabsPackInstallProgress) => void;
}

const CREDIT_SAFETY_BUFFER = 1000;

function voiceText(voice: ElevenLabsVoiceSummary): string {
  return [
    voice.name,
    voice.category,
    voice.description,
    ...Object.values(voice.labels ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function scoreVoice(
  voice: ElevenLabsVoiceSummary,
  searchTerms: string[],
): number {
  const text = voiceText(voice);
  const searchScore = searchTerms.reduce((score, term) => {
    return text.includes(term.toLocaleLowerCase()) ? score + 8 : score;
  }, 0);
  const categoryScore =
    voice.category === "professional" ? 5 : voice.category === "premade" ? 4 : 1;
  const previewScore = voice.preview_url ? 1 : 0;

  return searchScore + categoryScore + previewScore;
}

export async function resolveElevenLabsPackVoice(
  apiKey: string,
  languageId: ElevenLabsPackLanguageId,
  fallbackVoice?: ElevenLabsFallbackVoice,
): Promise<ElevenLabsResolvedVoice> {
  const pack = getElevenLabsLanguagePack(languageId);
  const byId = new Map<string, ElevenLabsVoiceSummary>();

  for (const term of pack.voiceSearchTerms) {
    try {
      const result = await searchElevenLabsVoices(apiKey, term);
      for (const voice of result.voices) {
        byId.set(voice.voice_id, voice);
      }
    } catch {
      // Voice search is a convenience layer. Falling back to the configured
      // default voice is better than blocking installation.
    }
  }

  const best = [...byId.values()]
    .map((voice) => ({
      voice,
      score: scoreVoice(voice, pack.voiceSearchTerms),
    }))
    .filter((item) => item.score >= 8)
    .sort((a, b) => b.score - a.score)[0]?.voice;

  if (best) {
    return {
      voiceId: best.voice_id,
      voiceName: best.name,
      source: "language-search",
    };
  }

  if (fallbackVoice?.voiceId) {
    return {
      voiceId: fallbackVoice.voiceId,
      voiceName: fallbackVoice.voiceName ?? "Default ElevenLabs voice",
      source: "default-config",
    };
  }

  throw new Error("请先在 ElevenLabs 设置里保存一个默认声音。");
}

async function collectMissingItems(
  languageId: ElevenLabsPackLanguageId,
  mode: ElevenLabsAudioPackMode,
) {
  const items = getElevenLabsPackItems(languageId, mode);
  const missing = [];
  let skipped = 0;

  for (const item of items) {
    if (await hasLanguageAudioPackEntry(languageId, item.word)) {
      skipped += 1;
    } else {
      missing.push(item);
    }
  }

  return { items, missing, skipped };
}

export async function installElevenLabsLanguagePack({
  apiKey,
  languageId,
  mode,
  fallbackVoice,
  onProgress,
}: InstallOptions): Promise<ElevenLabsPackInstallResult> {
  const pack = getElevenLabsLanguagePack(languageId);
  onProgress?.({
    phase: "checking",
    current: 0,
    total: 0,
    skipped: 0,
    generated: 0,
  });

  const { items, missing, skipped } = await collectMissingItems(languageId, mode);
  const estimatedCredits = estimateElevenLabsCredits(missing);

  const usage = await fetchElevenLabsUsage(apiKey);
  const remainingCredits = usage.characterLimit - usage.characterCount;
  if (estimatedCredits + CREDIT_SAFETY_BUFFER > remainingCredits) {
    throw new Error(
      `ElevenLabs 余额保护：预计需要 ${estimatedCredits} credits，当前剩余 ${remainingCredits} credits。`,
    );
  }

  onProgress?.({
    phase: "voice",
    current: 0,
    total: missing.length,
    skipped,
    generated: 0,
  });
  const voice = await resolveElevenLabsPackVoice(apiKey, languageId, fallbackVoice);

  let generated = 0;
  for (const [index, item] of missing.entries()) {
    onProgress?.({
      phase: "generating",
      current: index + 1,
      total: missing.length,
      text: item.word,
      skipped,
      generated,
    });

    const audioBlob = await elevenLabsTts(apiKey, voice.voiceId, item.word, pack.modelId, {
      speed: pack.speed,
      languageCode: pack.languageCode,
      voiceSettings: pack.voiceSettings,
    });

    onProgress?.({
      phase: "saving",
      current: index + 1,
      total: missing.length,
      text: item.word,
      skipped,
      generated,
    });

    await setLanguageAudioPackEntry({
      languageId,
      text: item.word,
      ipa: item.ipa,
      audioBlob,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      modelId: pack.modelId,
      languageCode: pack.languageCode,
    });
    generated += 1;
  }

  await setLanguageAudioPackStatus({
    languageId,
    mode,
    installedCount: items.length,
    totalCount: items.length,
    estimatedCredits,
    voiceId: voice.voiceId,
    voiceName: voice.voiceName,
    modelId: pack.modelId,
    languageCode: pack.languageCode,
  });

  onProgress?.({
    phase: "done",
    current: items.length,
    total: items.length,
    skipped,
    generated,
  });

  return {
    languageId,
    mode,
    total: items.length,
    skipped,
    generated,
    estimatedCredits,
    voice,
  };
}
