"use client";

import { AudioPlayerButton } from "@/components/audio/audio-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
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
  const { play, isPlaying, isLoading } = useAudioPlayer();
  const canPlayLocalHeaderAudio = isPlayableHeaderAudioSrc(
    phonemeAudio?.localSrc,
  );

  if (!chartWord && !canPlayLocalHeaderAudio) return null;

  const handleClick = () => {
    onBeforePlay?.();
    const playbackOptions = getSoundUnitHeaderPlaybackOptions({
      chartWord,
      phonemeAudio,
    });

    if (chartWord) {
      play(`/audio/ipa/phoneme/${chartWord}.mp3`, playbackOptions);
      return;
    }

    if (canPlayLocalHeaderAudio && phonemeAudio?.localSrc && playbackOptions) {
      play(phonemeAudio.localSrc, playbackOptions);
    }
  };

  return (
    <AudioPlayerButton
      onClick={handleClick}
      isPlaying={isPlaying}
      isLoading={isLoading}
      size="lg"
    />
  );
}
