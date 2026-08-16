"use client";

import { Howl, Howler } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  elevenLabsTtsAligned,
  hermesXaiTts,
  vertexGeminiTts,
} from "@/lib/api-client";
import {
  getElevenLabsConfig,
  getStandardTtsConfig,
  getVertexGeminiTtsConfig,
  subscribeToStorage,
} from "@/lib/api-keys";
import { getLocalAudioPlaybackVolume } from "@/lib/audio-normalization";
import {
  getElevenLabsLanguagePack,
  isElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";
import { getLanguageAudioPackEntry } from "@/lib/language-audio-pack-cache";
import { getStaticLanguageAudioPackEntry } from "@/lib/static-language-audio-pack";
import { getTtsFromCache, setTtsToCache } from "@/lib/tts-cache";
import {
  normalizeStandardTtsError,
  STANDARD_TTS_UNAVAILABLE_MESSAGE,
} from "@/lib/tts-errors";
import type { LanguageId } from "@/types/language";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface UseTtsAlignedReturn {
  speak: (
    text: string,
    speedOrOptions?: number | TtsAlignedSpeakOptions,
  ) => Promise<void>;
  replay: () => void;
  stop: () => void;
  reset: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  hasAudio: boolean;
  error: string | null;
  wordTimings: WordTiming[];
  currentTime: number;
}

interface TtsAlignedSpeakOptions {
  speed?: number;
  languageId?: LanguageId;
}

interface TtsPlaybackOptions {
  volume?: number;
  html5?: boolean;
  sourceUrl?: string;
}

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

function resumeHowlerAudioContext(): void {
  const ctx = Howler.ctx;
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => {
      // The next explicit user gesture will get another chance to unlock audio.
    });
  }
}

function getHowlerFormat(blob: Blob): string[] {
  return blob.type.toLowerCase().includes("wav") ? ["wav"] : ["mp3"];
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

function resolveSpeakOptions(speedOrOptions?: number | TtsAlignedSpeakOptions) {
  const languageId =
    typeof speedOrOptions === "object"
      ? (speedOrOptions.languageId ?? "en-US")
      : "en-US";
  const languagePack = isElevenLabsPackLanguageId(languageId)
    ? getElevenLabsLanguagePack(languageId)
    : null;
  const speed =
    typeof speedOrOptions === "number"
      ? speedOrOptions
      : (speedOrOptions?.speed ?? languagePack?.speed ?? 0.85);

  return { languageId, languagePack, speed };
}

async function loadLocalLanguagePackBlob(
  languageId: LanguageId,
  text: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; audioSrc?: string } | null> {
  if (!isElevenLabsPackLanguageId(languageId)) return null;

  try {
    const staticEntry = await getStaticLanguageAudioPackEntry(languageId, text);
    if (staticEntry) {
      const response = await fetch(staticEntry.audioSrc, { signal });
      if (response.ok) {
        return {
          blob: await response.blob(),
          audioSrc: staticEntry.audioSrc,
        };
      }
    }

    const installedEntry = await getLanguageAudioPackEntry(languageId, text);
    return installedEntry ? { blob: installedEntry.audioBlob } : null;
  } catch {
    return null;
  }
}

export function useTtsAligned(): UseTtsAlignedReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const lastAudioBlobRef = useRef<Blob | null>(null);
  const lastWordTimingsRef = useRef<WordTiming[]>([]);
  const lastPlaybackOptionsRef = useRef<TtsPlaybackOptions>({});
  const requestIdRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const playbackGenerationRef = useRef(0);

  const clearReplayAudio = useCallback(() => {
    lastAudioBlobRef.current = null;
    lastWordTimingsRef.current = [];
    lastPlaybackOptionsRef.current = {};
  }, []);

  const cleanupPlayback = useCallback(() => {
    playbackGenerationRef.current += 1;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (howlRef.current) {
      const howl = howlRef.current;
      howlRef.current = null;
      howl.unload();
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const cancelActiveRequest = useCallback(() => {
    requestIdRef.current += 1;
    const controller = activeRequestControllerRef.current;
    activeRequestControllerRef.current = null;
    controller?.abort();
  }, []);

  const beginRequest = useCallback(() => {
    cancelActiveRequest();
    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    return { controller, requestId: requestIdRef.current };
  }, [cancelActiveRequest]);

  const startTimeTracking = useCallback((howl: Howl, generation: number) => {
    const tick = () => {
      if (
        playbackGenerationRef.current !== generation ||
        howlRef.current !== howl
      ) {
        return;
      }

      if (!howl.playing()) {
        rafRef.current = null;
        return;
      }

      const seek = howl.seek();
      setCurrentTime(typeof seek === "number" ? seek : 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const playBlob = useCallback(
    (blob: Blob, timings: WordTiming[], options: TtsPlaybackOptions = {}) => {
      cleanupPlayback();
      const generation = playbackGenerationRef.current;

      setIsLoading(true);
      setIsPlaying(false);
      setHasAudio(false);
      setError(null);
      setWordTimings(timings);
      setCurrentTime(0);

      const url = options.sourceUrl ?? URL.createObjectURL(blob);
      blobUrlRef.current = options.sourceUrl ? null : url;

      let howl: Howl;
      const isCurrentPlayback = () =>
        playbackGenerationRef.current === generation &&
        howlRef.current === howl;
      const markAudioReady = () => {
        if (!isCurrentPlayback()) return;
        lastAudioBlobRef.current = blob;
        lastWordTimingsRef.current = timings;
        lastPlaybackOptionsRef.current = options;
        setHasAudio(true);
      };
      const stopTimeTracking = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };

      try {
        howl = new Howl({
          src: [url],
          format: getHowlerFormat(blob),
          html5: options.html5 ?? true,
          volume: options.volume ?? 1,
          onload: markAudioReady,
          onplay: () => {
            if (!isCurrentPlayback()) return;
            markAudioReady();
            setIsLoading(false);
            setError(null);
            setIsPlaying(true);
            startTimeTracking(howl, generation);
          },
          onend: () => {
            if (!isCurrentPlayback()) return;
            setIsLoading(false);
            setIsPlaying(false);
            setCurrentTime(0);
            stopTimeTracking();
          },
          onstop: () => {
            if (!isCurrentPlayback()) return;
            setIsLoading(false);
            setIsPlaying(false);
            setCurrentTime(0);
            stopTimeTracking();
          },
          onloaderror: () => {
            if (!isCurrentPlayback()) return;
            cleanupPlayback();
            clearReplayAudio();
            setIsLoading(false);
            setIsPlaying(false);
            setHasAudio(false);
            setWordTimings([]);
            setCurrentTime(0);
            setError(
              "标准示范音频加载失败，请重试；如果持续失败，请检查本地音频资源或当前所选 TTS 配置。",
            );
          },
          onplayerror: () => {
            if (!isCurrentPlayback()) return;
            setIsLoading(false);
            setIsPlaying(false);
            setCurrentTime(0);
            stopTimeTracking();
            setError(
              "标准示范音频播放失败，请重试；如果浏览器阻止了声音，请先点击页面后再播放。",
            );
          },
        });

        howlRef.current = howl;
        howl.play();
      } catch {
        if (playbackGenerationRef.current !== generation) return;
        cleanupPlayback();
        clearReplayAudio();
        setIsLoading(false);
        setIsPlaying(false);
        setHasAudio(false);
        setWordTimings([]);
        setCurrentTime(0);
        setError("标准示范音频无法开始播放，请重试。");
      }
    },
    [cleanupPlayback, clearReplayAudio, startTimeTracking],
  );

  const stop = useCallback(() => {
    cancelActiveRequest();
    cleanupPlayback();
    setIsLoading(false);
    setIsPlaying(false);
    setHasAudio(lastAudioBlobRef.current !== null);
    setCurrentTime(0);
  }, [cancelActiveRequest, cleanupPlayback]);

  const reset = useCallback(() => {
    cancelActiveRequest();
    cleanupPlayback();
    clearReplayAudio();
    setIsLoading(false);
    setIsPlaying(false);
    setHasAudio(false);
    setError(null);
    setWordTimings([]);
    setCurrentTime(0);
  }, [cancelActiveRequest, cleanupPlayback, clearReplayAudio]);

  useEffect(() => subscribeToStorage(reset), [reset]);

  useEffect(
    () => () => {
      cancelActiveRequest();
      cleanupPlayback();
      clearReplayAudio();
    },
    [cancelActiveRequest, cleanupPlayback, clearReplayAudio],
  );

  const speak = useCallback(
    async (text: string, speedOrOptions?: number | TtsAlignedSpeakOptions) => {
      const { controller, requestId } = beginRequest();
      const { signal } = controller;
      resumeHowlerAudioContext();
      cleanupPlayback();
      clearReplayAudio();
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);
      setHasAudio(false);
      setWordTimings([]);
      setCurrentTime(0);

      try {
        const { languageId, languagePack, speed } =
          resolveSpeakOptions(speedOrOptions);
        const provider = getStandardTtsConfig().provider;
        const elevenLabsConfig =
          provider === "elevenlabs" ? getElevenLabsConfig() : null;

        const localBlob = await loadLocalLanguagePackBlob(
          languageId,
          text,
          signal,
        );
        if (requestIdRef.current !== requestId) return;
        if (localBlob) {
          const playbackOptions = {
            html5: !localBlob.audioSrc,
            sourceUrl: localBlob.audioSrc,
            volume: localBlob.audioSrc
              ? getLocalAudioPlaybackVolume(localBlob.audioSrc)
              : 1,
          };
          playBlob(localBlob.blob, [], playbackOptions);
          return;
        }

        if (provider === "elevenlabs" && !elevenLabsConfig) {
          setIsLoading(false);
          setError(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          return;
        }

        const modelId =
          languagePack?.modelId ||
          elevenLabsConfig?.modelId ||
          "eleven_flash_v2_5";
        const voiceIdentity = `elevenlabs:${elevenLabsConfig?.voiceId ?? "unconfigured"}:${modelId}`;

        // Local bridge providers can change voice/auth configuration outside
        // the persistent audio cache. Keep those results in memory only so the
        // next generation always reflects the current local settings.
        const cached =
          provider === "elevenlabs"
            ? await getTtsFromCache(text, voiceIdentity, speed, languageId)
            : null;
        if (requestIdRef.current !== requestId) return;
        if (cached) {
          const blob = cached.audioBlob;
          const alignment = cached.alignment as AlignmentData | null;
          const timings = alignment
            ? aggregateToWordTimings(text, alignment)
            : [];
          playBlob(blob, timings);
          return;
        }

        let blob: Blob;
        let alignment: unknown = null;
        if (provider === "hermes-grok") {
          blob = await hermesXaiTts(text, { languageId, speed, signal });
        } else if (provider === "vertex-gemini") {
          blob = await vertexGeminiTts(text, {
            languageId,
            speed,
            voiceName: getVertexGeminiTtsConfig().voiceName,
            signal,
          });
        } else {
          if (!elevenLabsConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          const data = await elevenLabsTtsAligned(
            elevenLabsConfig.apiKey,
            elevenLabsConfig.voiceId,
            text,
            modelId,
            languagePack
              ? {
                  speed,
                  languageCode: languagePack.languageCode,
                }
              : speed,
            signal,
          );
          if (!data.audio_base64) {
            throw new Error("当前标准示范服务没有返回可播放音频，请稍后重试。");
          }
          alignment = data.alignment;
          const audioBytes = Uint8Array.from(atob(data.audio_base64), (c) =>
            c.charCodeAt(0),
          );
          blob = new Blob([audioBytes], { type: "audio/mpeg" });
        }
        if (requestIdRef.current !== requestId) return;

        const timings = alignment
          ? aggregateToWordTimings(text, alignment as AlignmentData)
          : [];

        // ElevenLabs has a stable voice/model identity. Local bridge provider
        // results stay in memory for replay only.
        if (provider === "elevenlabs") {
          await setTtsToCache(
            text,
            voiceIdentity,
            speed,
            blob,
            alignment,
            languageId,
          );
        }
        if (requestIdRef.current !== requestId) return;

        // Dispatch custom event to notify usage monitor (only on actual API calls)
        if (provider === "elevenlabs") {
          window.dispatchEvent(
            new CustomEvent("speakright:elevenlabs-usage-changed"),
          );
        }

        playBlob(blob, timings);
      } catch (e) {
        if (requestIdRef.current !== requestId) return;
        console.error("[Standard TTS]", e);
        const { languageId } = resolveSpeakOptions(speedOrOptions);
        const localBlob = await loadLocalLanguagePackBlob(
          languageId,
          text,
          signal,
        );
        if (requestIdRef.current !== requestId) return;
        if (localBlob) {
          const playbackOptions = {
            html5: !localBlob.audioSrc,
            sourceUrl: localBlob.audioSrc,
            volume: localBlob.audioSrc
              ? getLocalAudioPlaybackVolume(localBlob.audioSrc)
              : 1,
          };
          playBlob(localBlob.blob, [], playbackOptions);
          return;
        }
        clearReplayAudio();
        setHasAudio(false);
        setError(normalizeStandardTtsError(e));
        setIsLoading(false);
      } finally {
        if (activeRequestControllerRef.current === controller) {
          activeRequestControllerRef.current = null;
        }
      }
    },
    [beginRequest, cleanupPlayback, clearReplayAudio, playBlob],
  );

  const replay = useCallback(() => {
    if (!lastAudioBlobRef.current) return;
    resumeHowlerAudioContext();
    cancelActiveRequest();
    playBlob(
      lastAudioBlobRef.current,
      lastWordTimingsRef.current,
      lastPlaybackOptionsRef.current,
    );
  }, [cancelActiveRequest, playBlob]);

  return {
    speak,
    replay,
    stop,
    reset,
    isLoading,
    isPlaying,
    hasAudio,
    error,
    wordTimings,
    currentTime,
  };
}
