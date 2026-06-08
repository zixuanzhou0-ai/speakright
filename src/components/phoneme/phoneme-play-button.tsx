"use client";

import { useState } from "react";
import { AudioPlayerButton } from "@/components/audio/audio-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { openDesktopExternalUrl } from "@/lib/desktop-external-url";
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
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!chartWord && !phonemeAudio) return null;

  const openExternalReference = () => {
    if (!phonemeAudio?.url) return;
    void openDesktopExternalUrl(phonemeAudio.url);
  };

  const playBrowserSpeech = () => {
    if (
      !phonemeAudio?.text ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      openExternalReference();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(phonemeAudio.text);
    utterance.lang = phonemeAudio.languageId ?? "en-US";
    utterance.rate = 0.82;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      openExternalReference();
    };

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleClick = () => {
    onBeforePlay?.();

    if (chartWord) {
      play(`/audio/ipa/phoneme/${chartWord}.mp3`);
      return;
    }

    if (phonemeAudio?.localSrc) {
      play(phonemeAudio.localSrc);
      return;
    }

    if (phonemeAudio?.kind === "tts-example") {
      playBrowserSpeech();
      return;
    }

    openExternalReference();
  };

  return (
    <AudioPlayerButton
      onClick={handleClick}
      isPlaying={isPlaying || isSpeaking}
      isLoading={isLoading}
      size="lg"
    />
  );
}
