"use client";

import { Howl, Howler } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPronunciation } from "@/lib/api-client";
import {
  calculateAudioNormalization,
  getLocalAudioPlaybackVolume,
  selectPeakSafePlaybackGain,
  shouldNormalizeLocalAudioSrc,
} from "@/lib/audio-normalization";
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
  error: string | null;
  stop: () => void;
  clearError: () => void;
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

function getSharedAudioContext(): AudioContext | null {
  const ctx = Howler.ctx as AudioContext | undefined;
  if (
    !ctx ||
    typeof ctx.decodeAudioData !== "function" ||
    typeof ctx.createBufferSource !== "function" ||
    typeof ctx.createGain !== "function"
  ) {
    return null;
  }

  return ctx;
}

function getPronunciationFallbackErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (message && /[\u4e00-\u9fff]/.test(message)) {
    return `在线发音兜底失败：${message}`;
  }
  return "在线发音兜底失败，请检查网络后重试。";
}

export function useWordPronunciation(): UseWordPronunciationReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const howlRef = useRef<Howl | null>(null);
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const webAudioGainRef = useRef<GainNode | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const playRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const setSafeIsPlaying = useCallback((value: boolean) => {
    if (mountedRef.current) setIsPlaying(value);
  }, []);

  const setSafeIsLoading = useCallback((value: boolean) => {
    if (mountedRef.current) setIsLoading(value);
  }, []);

  const setSafeError = useCallback((value: string | null) => {
    if (mountedRef.current) setError(value);
  }, []);

  const isStaleRequest = useCallback((requestId?: number) => {
    return requestId !== undefined && requestId !== playRequestIdRef.current;
  }, []);

  const cleanup = useCallback(() => {
    if (webAudioSourceRef.current) {
      const source = webAudioSourceRef.current;
      webAudioSourceRef.current = null;
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped or not started.
      }
      try {
        source.disconnect();
      } catch {
        // Ignore Web Audio cleanup races.
      }
    }
    if (webAudioGainRef.current) {
      const gainNode = webAudioGainRef.current;
      webAudioGainRef.current = null;
      try {
        gainNode.disconnect();
      } catch {
        // Ignore Web Audio cleanup races.
      }
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

  const playHowl = useCallback(
    (
      src: string,
      {
        format = "mp3",
        onLoadError,
        requestId,
        normalizeVolume = false,
      }: {
        format?: string;
        onLoadError?: () => void;
        requestId?: number;
        normalizeVolume?: boolean;
      } = {},
    ) => {
      if (requestId !== undefined && requestId !== playRequestIdRef.current) {
        return;
      }

      const shouldUseLocalBoost =
        normalizeVolume && shouldNormalizeLocalAudioSrc(src);
      const volume = shouldUseLocalBoost
        ? Math.min(getLocalAudioPlaybackVolume(src), 1)
        : 1;

      const howl = new Howl({
        src: [src],
        format: [format],
        html5: !shouldUseLocalBoost,
        volume,
        onplay: () => {
          if (
            requestId !== undefined &&
            requestId !== playRequestIdRef.current
          ) {
            return;
          }
          setSafeIsLoading(false);
          setSafeIsPlaying(true);
        },
        onend: () => setSafeIsPlaying(false),
        onstop: () => setSafeIsPlaying(false),
        onloaderror: () => {
          if (
            requestId !== undefined &&
            requestId !== playRequestIdRef.current
          ) {
            return;
          }
          if (onLoadError) {
            onLoadError();
            return;
          }
          setSafeIsLoading(false);
          setSafeIsPlaying(false);
          setSafeError("音频加载失败，请稍后重试。");
          console.warn(`[Pronunciation] Audio failed to load: ${src}`);
        },
      });
      howlRef.current = howl;
      howl.play();
    },
    [setSafeError, setSafeIsLoading, setSafeIsPlaying],
  );

  const playLocalWebAudio = useCallback(
    async (
      src: string,
      {
        onLoadError,
        requestId,
      }: {
        onLoadError?: () => void;
        requestId?: number;
      } = {},
    ) => {
      if (requestId !== undefined && requestId !== playRequestIdRef.current) {
        return;
      }

      const audioContext = getSharedAudioContext();
      if (!audioContext || typeof fetch !== "function") {
        playHowl(src, { normalizeVolume: true, onLoadError, requestId });
        return;
      }

      try {
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const response = await fetch(src);
        if (requestId !== undefined && requestId !== playRequestIdRef.current) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Local audio request failed: ${response.status}`);
        }

        const encodedAudio = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(
          encodedAudio.slice(0),
        );
        if (requestId !== undefined && requestId !== playRequestIdRef.current) {
          return;
        }

        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        const normalization = calculateAudioNormalization(audioBuffer);
        const packFallbackGain = getLocalAudioPlaybackVolume(src);

        source.buffer = audioBuffer;
        gainNode.gain.value = selectPeakSafePlaybackGain(
          normalization,
          packFallbackGain,
        );
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        webAudioSourceRef.current = source;
        webAudioGainRef.current = gainNode;
        source.onended = () => {
          if (webAudioSourceRef.current === source) {
            webAudioSourceRef.current = null;
          }
          if (webAudioGainRef.current === gainNode) {
            webAudioGainRef.current = null;
          }
          setSafeIsPlaying(false);
        };

        setSafeIsLoading(false);
        setSafeIsPlaying(true);
        source.start(0);
      } catch (error) {
        if (requestId !== undefined && requestId !== playRequestIdRef.current) {
          return;
        }
        if (onLoadError) {
          onLoadError();
          return;
        }
        setSafeIsLoading(false);
        setSafeIsPlaying(false);
        setSafeError("音频加载失败，请稍后重试。");
        console.warn(
          `[Pronunciation] Local audio failed to play: ${src}`,
          error,
        );
      }
    },
    [playHowl, setSafeError, setSafeIsLoading, setSafeIsPlaying],
  );

  const playYoudaoFallback = useCallback(
    async (word: string, requestId?: number) => {
      cleanup();
      setSafeIsLoading(true);
      try {
        const blob = await fetchPronunciation(word);
        if (isStaleRequest(requestId)) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        playHowl(url, { requestId });
      } catch (error) {
        if (isStaleRequest(requestId)) return;
        setSafeIsLoading(false);
        setSafeIsPlaying(false);
        setSafeError(getPronunciationFallbackErrorMessage(error));
        console.warn(
          `[Pronunciation] Youdao fallback failed for "${word}":`,
          error,
        );
      }
    },
    [
      cleanup,
      isStaleRequest,
      playHowl,
      setSafeError,
      setSafeIsLoading,
      setSafeIsPlaying,
    ],
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
      const requestId = playRequestIdRef.current + 1;
      playRequestIdRef.current = requestId;
      cleanup();
      setSafeIsLoading(true);
      setSafeError(null);

      if (languageId === "en-US") {
        const localSrc = getEnglishWordAudioSrc(normalizedWord, fallbackVoice);
        void playLocalWebAudio(localSrc, {
          requestId,
          onLoadError: () => {
            void playYoudaoFallback(normalizedWord, requestId);
          },
        });
        return;
      }

      if (isElevenLabsPackLanguageId(languageId)) {
        const staticEntry = await getStaticLanguageAudioPackEntry(
          languageId,
          normalizedWord,
          fallbackVoice,
        );
        if (isStaleRequest(requestId)) return;
        if (staticEntry) {
          void playLocalWebAudio(staticEntry.audioSrc, {
            requestId,
          });
          return;
        }

        const cached = await getLanguageAudioPackEntry(
          languageId,
          normalizedWord,
        );
        if (isStaleRequest(requestId)) return;
        if (cached) {
          const url = URL.createObjectURL(cached.audioBlob);
          blobUrlRef.current = url;
          playHowl(url, { requestId });
          return;
        }

        setSafeIsLoading(false);
        setSafeIsPlaying(false);
        setSafeError(`暂无「${normalizedWord}」的本地标准发音。`);
        console.warn(
          `[Pronunciation] Missing local ${languageId} pronunciation for "${normalizedWord}"`,
        );
        return;
      }

      await playYoudaoFallback(normalizedWord, requestId);
    },
    [
      cleanup,
      isStaleRequest,
      playHowl,
      playLocalWebAudio,
      playYoudaoFallback,
      setSafeError,
      setSafeIsLoading,
      setSafeIsPlaying,
    ],
  );

  const stop = useCallback(() => {
    playRequestIdRef.current += 1;
    cleanup();
    setSafeIsPlaying(false);
    setSafeIsLoading(false);
  }, [cleanup, setSafeIsLoading, setSafeIsPlaying]);

  const clearError = useCallback(() => setSafeError(null), [setSafeError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playRequestIdRef.current += 1;
      cleanup();
    };
  }, [cleanup]);

  return { playWord, isLoading, isPlaying, error, stop, clearError };
}
