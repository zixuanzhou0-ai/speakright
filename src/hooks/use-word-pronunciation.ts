"use client";

import { Howl, Howler } from "howler";
import { useCallback, useRef, useState } from "react";
import { fetchPronunciation } from "@/lib/api-client";
import { isElevenLabsPackLanguageId } from "@/lib/elevenlabs-language-packs";
import { getLanguageAudioPackEntry } from "@/lib/language-audio-pack-cache";
import { getStaticLanguageAudioPackEntry } from "@/lib/static-language-audio-pack";
import type { LanguageId } from "@/types/language";

export interface UseWordPronunciationReturn {
  playWord: (
    word: string,
    fallbackVoice?: "blue" | "pink",
    languageId?: LanguageId,
  ) => void;
  isLoading: boolean;
  isPlaying: boolean;
  stop: () => void;
}

export function getEnglishWordAudioSrc(
  word: string,
  voice: "blue" | "pink" = "blue",
): string {
  return `/audio/words/${voice}/${encodeURIComponent(word.toLowerCase())}.mp3`;
}

function resumeHowlerAudioContext(): void {
  const ctx = Howler.ctx;
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => {
      // The next explicit user gesture will get another chance to unlock audio.
    });
  }
}

export function useWordPronunciation(): UseWordPronunciationReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const howlRef = useRef<Howl | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const playHowl = useCallback(
    (
      src: string,
      {
        format = "mp3",
        onLoadError,
      }: {
        format?: string;
        onLoadError?: () => void;
      } = {},
    ) => {
      const howl = new Howl({
        src: [src],
        format: [format],
        html5: true,
        onplay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: () => {
          if (onLoadError) {
            onLoadError();
            return;
          }
          setIsLoading(false);
          setIsPlaying(false);
          console.warn(`[Pronunciation] Audio failed to load: ${src}`);
        },
      });
      howlRef.current = howl;
      howl.play();
    },
    [],
  );

  const playYoudaoFallback = useCallback(
    async (word: string) => {
      cleanup();
      setIsLoading(true);
      try {
        const blob = await fetchPronunciation(word);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        playHowl(url);
      } catch (error) {
        setIsLoading(false);
        setIsPlaying(false);
        console.warn(`[Pronunciation] Youdao fallback failed for "${word}":`, error);
      }
    },
    [cleanup, playHowl],
  );

  const playWord = useCallback(
    async (
      word: string,
      fallbackVoice: "blue" | "pink" = "blue",
      languageId: LanguageId = "en-US",
    ) => {
      const normalizedWord = word.trim();
      if (!normalizedWord) return;

      resumeHowlerAudioContext();
      cleanup();
      setIsLoading(true);

      if (languageId === "en-US") {
        playHowl(getEnglishWordAudioSrc(normalizedWord, fallbackVoice), {
          onLoadError: () => {
            void playYoudaoFallback(normalizedWord);
          },
        });
        return;
      }

      if (isElevenLabsPackLanguageId(languageId)) {
        const staticEntry = await getStaticLanguageAudioPackEntry(
          languageId,
          normalizedWord,
        );
        if (staticEntry) {
          playHowl(staticEntry.audioSrc);
          return;
        }

        const cached = await getLanguageAudioPackEntry(languageId, normalizedWord);
        if (cached) {
          const url = URL.createObjectURL(cached.audioBlob);
          blobUrlRef.current = url;
          playHowl(url);
          return;
        }
      }

      await playYoudaoFallback(normalizedWord);
    },
    [cleanup, playHowl, playYoudaoFallback],
  );

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsLoading(false);
  }, [cleanup]);

  return { playWord, isLoading, isPlaying, stop };
}
