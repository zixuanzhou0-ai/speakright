import { PHONEMES } from "@/lib/phoneme-data";
import type { LanguageId } from "@/types/language";
import type { PhonemeAudioSource } from "@/types/phoneme";

export interface AudioPlaybackOptions {
  startMs?: number;
  maxDurationMs?: number;
  fadeOutMs?: number;
  volume?: number;
}

const ENGLISH_HEADER_PHONEME_PLAYBACK: Required<
  Pick<AudioPlaybackOptions, "startMs" | "maxDurationMs" | "fadeOutMs">
> = {
  startMs: 25,
  maxDurationMs: 560,
  fadeOutMs: 55,
};

const LOCAL_HEADER_PHONEME_PLAYBACK: Required<
  Pick<AudioPlaybackOptions, "startMs" | "maxDurationMs" | "fadeOutMs">
> = {
  startMs: 15,
  maxDurationMs: 500,
  fadeOutMs: 60,
};

const CHART_WORD_PLAYBACK: Required<Pick<AudioPlaybackOptions, "volume">> = {
  volume: 1.6,
};

export type AssessmentTileAudioKind = "chart" | "sound-unit";

const ENGLISH_CHART_AUDIO_STEMS = new Set(
  PHONEMES.map((phoneme) => phoneme.chartWord).filter(Boolean),
);

export function getEnglishHeaderPhonemeAudioSrc(
  chartWord?: string,
): string | null {
  const stem = chartWord?.trim();
  if (!stem || !/^[a-z0-9-]+$/.test(stem)) return null;
  if (!ENGLISH_CHART_AUDIO_STEMS.has(stem)) return null;

  const src = `/audio/ipa/phoneme/${stem}.mp3`;
  return isPlayableHeaderAudioSrc(src) ? src : null;
}

export function isVideoBackedAudioSrc(src?: string): boolean {
  return Boolean(src && /\.(mp4|m4v|webm)(?:$|\?)/i.test(src));
}

export function isPlayableHeaderAudioSrc(src?: string): boolean {
  if (!src || isVideoBackedAudioSrc(src)) return false;

  return (
    /^\/audio\/ipa\/phoneme\/[^/]+\.mp3$/i.test(src) ||
    /^\/audio\/language-assets\/(?:es-ES|fr-FR|ru-RU)\/header-clips\/[^/]+\.m4a$/.test(
      src,
    )
  );
}

export function getSoundUnitHeaderPlaybackOptions({
  chartWord,
  phonemeAudio,
}: {
  chartWord?: string;
  phonemeAudio?: PhonemeAudioSource;
}): AudioPlaybackOptions | undefined {
  if (getEnglishHeaderPhonemeAudioSrc(chartWord)) {
    return ENGLISH_HEADER_PHONEME_PLAYBACK;
  }

  const localSrc = phonemeAudio?.localSrc;
  if (!localSrc) return undefined;

  if (!isPlayableHeaderAudioSrc(localSrc)) return undefined;

  return LOCAL_HEADER_PHONEME_PLAYBACK;
}

export function getAssessmentTilePlaybackOptions({
  kind,
  languageId,
}: {
  kind: AssessmentTileAudioKind;
  languageId: LanguageId;
}): AudioPlaybackOptions {
  if (languageId === "en-US" || kind === "chart") {
    return ENGLISH_HEADER_PHONEME_PLAYBACK;
  }

  return LOCAL_HEADER_PHONEME_PLAYBACK;
}

export function getChartWordPlaybackOptions(): AudioPlaybackOptions {
  return CHART_WORD_PLAYBACK;
}
