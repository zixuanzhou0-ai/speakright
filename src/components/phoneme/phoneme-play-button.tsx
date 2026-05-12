"use client";

import { AudioPlayerButton } from "@/components/audio/audio-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";

interface PhonemePlayButtonProps {
  chartWord?: string;
}

export function PhonemePlayButton({ chartWord }: PhonemePlayButtonProps) {
  const { play, isPlaying, isLoading } = useAudioPlayer();

  if (!chartWord) return null;

  return (
    <AudioPlayerButton
      onClick={() => play(`/audio/ipa/phoneme/${chartWord}.mp3`)}
      isPlaying={isPlaying}
      isLoading={isLoading}
      size="lg"
    />
  );
}
