"use client";

import { Howl } from "howler";
import { useCallback, useRef, useState } from "react";
import { elevenLabsTtsAligned } from "@/lib/api-client";
import { getElevenLabsConfig } from "@/lib/api-keys";
import { getTtsFromCache, setTtsToCache } from "@/lib/tts-cache";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface UseTtsAlignedReturn {
  speak: (text: string, speed?: number) => Promise<void>;
  replay: () => void;
  stop: () => void;
  reset: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  wordTimings: WordTiming[];
  currentTime: number;
}

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

function aggregateToWordTimings(
  _text: string,
  alignment: AlignmentData,
): WordTiming[] {
  const {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  } = alignment;

  const timings: WordTiming[] = [];
  let wordStart = -1;
  let wordChars: string[] = [];

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];

    if (ch === " " || ch === "\n" || ch === "\t") {
      // End current word if any
      if (wordChars.length > 0 && wordStart >= 0) {
        timings.push({
          word: wordChars.join(""),
          start: character_start_times_seconds[wordStart],
          end: character_end_times_seconds[i - 1],
        });
        wordChars = [];
        wordStart = -1;
      }
    } else {
      if (wordStart < 0) wordStart = i;
      wordChars.push(ch);
    }
  }

  // Last word
  if (wordChars.length > 0 && wordStart >= 0) {
    timings.push({
      word: wordChars.join(""),
      start: character_start_times_seconds[wordStart],
      end: character_end_times_seconds[characters.length - 1],
    });
  }

  return timings;
}

export function useTtsAligned(): UseTtsAlignedReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const lastWordTimingsRef = useRef<WordTiming[]>([]);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const startTimeTracking = useCallback(() => {
    const tick = () => {
      if (howlRef.current?.playing()) {
        setCurrentTime(howlRef.current.seek() as number);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const playBlob = useCallback(
    (blob: Blob, timings: WordTiming[]) => {
      cleanup();
      setWordTimings(timings);
      setCurrentTime(0);

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const howl = new Howl({
        src: [url],
        format: ["mp3"],
        onplay: () => {
          setIsPlaying(true);
          startTimeTracking();
        },
        onend: () => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        },
        onstop: () => {
          setIsPlaying(false);
          setCurrentTime(0);
        },
        onloaderror: () => {
          setIsPlaying(false);
          setError("音频加载失败");
        },
      });

      howlRef.current = howl;
      howl.play();
    },
    [cleanup, startTimeTracking],
  );

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setCurrentTime(0);
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setIsLoading(false);
    setIsPlaying(false);
    setError(null);
    setWordTimings([]);
    setCurrentTime(0);
    lastAudioBlobRef.current = null;
    lastWordTimingsRef.current = [];
  }, [cleanup]);

  const speak = useCallback(
    async (text: string, speed = 0.85) => {
      const config = getElevenLabsConfig();
      if (!config) {
        setError("请先在设置页面配置 ElevenLabs API 密钥");
        return;
      }

      cleanup();
      setError(null);
      setIsLoading(true);
      setWordTimings([]);
      setCurrentTime(0);

      try {
        // Check cache first
        const cached = await getTtsFromCache(text, config.voiceId, speed);
        if (cached) {
          const blob = cached.audioBlob;
          const alignment = cached.alignment as AlignmentData | null;
          const timings = alignment
            ? aggregateToWordTimings(text, alignment)
            : [];
          lastAudioBlobRef.current = blob;
          lastWordTimingsRef.current = timings;
          setIsLoading(false);
          playBlob(blob, timings);
          return;
        }

        const data = await elevenLabsTtsAligned(
          config.apiKey,
          config.voiceId,
          text,
          config.modelId || "eleven_flash_v2_5",
          speed,
        );
        const { audio_base64, alignment } = data;

        if (!audio_base64) {
          throw new Error("No audio returned from TTS");
        }

        // Aggregate character timings to word timings
        const timings = alignment
          ? aggregateToWordTimings(text, alignment as AlignmentData)
          : [];

        // Convert base64 to blob
        const audioBytes = Uint8Array.from(atob(audio_base64), (c) =>
          c.charCodeAt(0),
        );
        const blob = new Blob([audioBytes], { type: "audio/mpeg" });

        // Cache the result
        await setTtsToCache(text, config.voiceId, speed, blob, alignment);

        // Dispatch custom event to notify usage monitor (only on actual API calls)
        window.dispatchEvent(
          new CustomEvent("speakright:elevenlabs-usage-changed"),
        );

        // Store for replay
        lastAudioBlobRef.current = blob;
        lastWordTimingsRef.current = timings;

        setIsLoading(false);
        playBlob(blob, timings);
      } catch (e) {
        console.error("[ElevenLabs TTS Aligned]", e);
        setError(e instanceof Error ? e.message : "语音合成失败");
        setIsLoading(false);
      }
    },
    [cleanup, playBlob],
  );

  const replay = useCallback(() => {
    if (!lastAudioBlobRef.current) return;
    playBlob(lastAudioBlobRef.current, lastWordTimingsRef.current);
  }, [playBlob]);

  return {
    speak,
    replay,
    stop,
    reset,
    isLoading,
    isPlaying,
    error,
    wordTimings,
    currentTime,
  };
}
