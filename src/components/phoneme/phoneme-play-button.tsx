"use client";

import { AudioPlayerButton } from "@/components/audio/audio-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
  getEnglishHeaderPhonemeAudioSrc,
  getSoundUnitHeaderPlaybackOptions,
  isPlayableHeaderAudioSrc,
} from "@/lib/audio-playback-policy";
import type { PhonemeAudioSource } from "@/types/phoneme";

interface PhonemePlayButtonProps {
  chartWord?: string;
  phonemeAudio?: PhonemeAudioSource;
  onBeforePlay?: () => void;
}

export function PhonemePlayButton({
  chartWord,
  phonemeAudio,
  onBeforePlay,
}: PhonemePlayButtonProps) {
  const { play, isPlaying, isLoading, error, clearError } = useAudioPlayer();
  const chartAudioSrc = getEnglishHeaderPhonemeAudioSrc(chartWord);
  const canPlayLocalHeaderAudio = isPlayableHeaderAudioSrc(
    phonemeAudio?.localSrc,
  );

  if (!chartAudioSrc && !canPlayLocalHeaderAudio) return null;

  const playbackOptions = getSoundUnitHeaderPlaybackOptions({
    chartWord,
    phonemeAudio,
  });
  if (!playbackOptions) return null;

  const audioSrc = chartAudioSrc ?? phonemeAudio?.localSrc ?? "";
  const audioKind = chartAudioSrc ? "chart" : "sound-unit";
  const dataAttributes = {
    "data-audio-playable": "true",
    "data-audio-kind": audioKind,
    "data-audio-src": audioSrc,
    "data-audio-start-ms": playbackOptions.startMs?.toString() ?? "",
    "data-audio-max-duration-ms":
      playbackOptions.maxDurationMs?.toString() ?? "",
    "data-audio-fade-out-ms": playbackOptions.fadeOutMs?.toString() ?? "",
  };

  const handleClick = () => {
    clearError();
    onBeforePlay?.();
    play(audioSrc, playbackOptions);
  };

  return (
    <span className="inline-flex min-w-0 flex-col items-center gap-1">
      <AudioPlayerButton
        onClick={handleClick}
        isPlaying={isPlaying}
        isLoading={isLoading}
        size="lg"
        dataAttributes={dataAttributes}
      />
      {error && (
        <span
          className="max-w-44 break-words text-center text-[11px] leading-snug text-destructive [overflow-wrap:anywhere]"
          data-smoke="phoneme-header-audio-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </span>
  );
}
