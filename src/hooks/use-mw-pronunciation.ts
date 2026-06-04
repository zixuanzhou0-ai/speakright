"use client";

import { Howl } from "howler";
import { useCallback, useRef, useState } from "react";
import { fetchPronunciation } from "@/lib/api-client";
import {
  getMerriamWebsterConfig,
  getPronunciationConfig,
} from "@/lib/api-keys";

export interface UseMwPronunciationReturn {
  playWord: (word: string, fallbackVoice?: "blue" | "pink") => void;
  isLoading: boolean;
  isPlaying: boolean;
  stop: () => void;
}

export function useMwPronunciation(): UseMwPronunciationReturn {
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

  const tryLocalFallback = useCallback(
    (word: string, voice: "blue" | "pink") => {
      cleanup();
      setIsLoading(true);
      const localUrl = `/audio/words/${voice}/${word}.mp3`;
      const howl = new Howl({
        src: [localUrl],
        format: ["mp3"],
        onplay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: () => {
          setIsLoading(false);
          setIsPlaying(false);
          console.warn(
            `[Pronunciation] No audio available for "${word}" — API failed and local fallback missing. Check network / API config.`,
          );
        },
      });
      howlRef.current = howl;
      howl.play();
    },
    [cleanup],
  );

  const playWord = useCallback(
    async (word: string, fallbackVoice: "blue" | "pink" = "blue") => {
      const { source } = getPronunciationConfig();
      const mwConfig = getMerriamWebsterConfig();

      cleanup();
      setIsLoading(true);

      // Primary: API-based pronunciation (youdao default, or merriam-webster)
      try {
        const blob = await fetchPronunciation(word, source, mwConfig?.apiKey);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const howl = new Howl({
          src: [url],
          format: ["mp3"],
          onplay: () => {
            setIsLoading(false);
            setIsPlaying(true);
          },
          onend: () => setIsPlaying(false),
          onstop: () => setIsPlaying(false),
          onloaderror: () => {
            // Blob decode failed — try local fallback
            tryLocalFallback(word, fallbackVoice);
          },
          onplayerror: () => {
            setIsLoading(false);
            setIsPlaying(false);
            console.warn(
              `[Pronunciation] Audio was downloaded for "${word}" but playback was blocked.`,
            );
          },
        });
        howlRef.current = howl;
        howl.play();
        return;
      } catch (e) {
        console.warn(`[Pronunciation] API failed for "${word}":`, e);
      }

      // API failed — attempt local pre-generated mp3 (only ~24% coverage of
      // minimal-pairs vocabulary). Missing files surface via onloaderror
      // instead of silent failure.
      tryLocalFallback(word, fallbackVoice);
    },
    [cleanup, tryLocalFallback],
  );

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsLoading(false);
  }, [cleanup]);

  return { playWord, isLoading, isPlaying, stop };
}
