"use client";

import { Howl } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isLoading: boolean;
  play: (src: string) => void;
  playBlob: (blob: Blob) => void;
  stop: () => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
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

  const play = useCallback(
    (src: string) => {
      cleanup();
      setIsLoading(true);

      const howl = new Howl({
        src: [src],
        format: ["mp3", "wav", "ogg", "mp4", "m4a"],
        html5: src.startsWith("http") || src.endsWith(".mp4"),
        onplay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: () => {
          setIsLoading(false);
          setIsPlaying(false);
        },
      });

      howlRef.current = howl;
      howl.play();
    },
    [cleanup],
  );

  const playBlob = useCallback(
    (blob: Blob) => {
      cleanup();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setIsLoading(true);
      const howl = new Howl({
        src: [url],
        format: ["wav", "ogg", "mp4", "m4a"],
        onplay: () => {
          setIsLoading(false);
          setIsPlaying(true);
        },
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: () => {
          setIsLoading(false);
          setIsPlaying(false);
        },
      });
      howlRef.current = howl;
      howl.play();
    },
    [cleanup],
  );

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsLoading(false);
  }, [cleanup]);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { isPlaying, isLoading, play, playBlob, stop };
}
