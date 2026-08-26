"use client";

import { Howl, Howler } from "howler";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  elevenLabsTtsAligned,
  hermesXaiTtsAligned,
  type MiniMaxWordTiming,
  mimoTts,
  miniMaxTtsAligned,
  vertexGeminiTts,
} from "@/lib/api-client";
import {
  getElevenLabsConfig,
  getMimoTtsConfig,
  getMiniMaxTtsConfig,
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
import {
  buildCacheKey,
  captureTtsCacheEpoch,
  deleteTtsFromCache,
  getTtsFromCache,
  setTtsToCache,
  subscribeToTtsCacheInvalidation,
  type TtsCacheEpochToken,
} from "@/lib/tts-cache";
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

interface TtsPlaybackCacheContext {
  cacheKey: string;
  text: string;
  voiceIdentity: string;
  speed: number;
  languageId: LanguageId;
  alignment: unknown;
  persistOnLoad: boolean;
  cacheEpochToken: TtsCacheEpochToken;
}

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface CachedWordTimingData {
  kind: "word-timings";
  items: WordTiming[];
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

function normalizeWordToken(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}'’]+/gu, "")
    .replace(/’/g, "'");
}

/**
 * MiniMax subtitles are word-granular but punctuation and contractions may be
 * split differently from the UI's whitespace tokens. Merge adjacent official
 * timings only when they can be matched deterministically; otherwise return an
 * empty timeline so the UI honestly falls back to sentence playback.
 */
function alignProviderWordTimings(
  text: string,
  providerTimings: MiniMaxWordTiming[],
): WordTiming[] {
  const sourceWords = text.split(/\s+/).filter(Boolean);
  if (sourceWords.length === 0 || providerTimings.length === 0) return [];

  const result: WordTiming[] = [];
  let providerIndex = 0;
  for (const sourceWord of sourceWords) {
    const target = normalizeWordToken(sourceWord);
    if (!target) return [];

    let combined = "";
    let start = -1;
    let end = -1;
    while (providerIndex < providerTimings.length) {
      const timing = providerTimings[providerIndex];
      providerIndex += 1;
      const token = normalizeWordToken(timing.word);
      if (!token) continue;
      if (start < 0) start = timing.start;
      end = timing.end;
      combined += token;
      if (combined === target) break;
      if (!target.startsWith(combined)) return [];
    }

    if (combined !== target || start < 0 || end <= start) return [];
    result.push({ word: sourceWord, start, end });
  }

  const remainingText = providerTimings
    .slice(providerIndex)
    .map((timing) => normalizeWordToken(timing.word))
    .join("");
  return remainingText ? [] : result;
}

function isCachedWordTimingData(value: unknown): value is CachedWordTimingData {
  if (!value || typeof value !== "object") return false;
  const record = value as { kind?: unknown; items?: unknown };
  return (
    record.kind === "word-timings" &&
    Array.isArray(record.items) &&
    record.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const timing = item as Partial<WordTiming>;
      return (
        typeof timing.word === "string" &&
        typeof timing.start === "number" &&
        Number.isFinite(timing.start) &&
        typeof timing.end === "number" &&
        Number.isFinite(timing.end) &&
        timing.start >= 0 &&
        timing.end > timing.start
      );
    })
  );
}

function timingsFromCachedAlignment(
  text: string,
  value: unknown,
): WordTiming[] {
  if (isCachedWordTimingData(value)) {
    return alignProviderWordTimings(text, value.items);
  }
  return value ? aggregateToWordTimings(text, value as AlignmentData) : [];
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
  const invalidCacheKeysRef = useRef(new Set<string>());

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
    (
      blob: Blob,
      timings: WordTiming[],
      options: TtsPlaybackOptions = {},
      cacheContext?: TtsPlaybackCacheContext,
    ) => {
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
      let audioReady = false;
      let cacheWriteStarted = false;
      const markAudioReady = () => {
        if (!isCurrentPlayback() || audioReady) return;
        audioReady = true;
        lastAudioBlobRef.current = blob;
        lastWordTimingsRef.current = timings;
        lastPlaybackOptionsRef.current = options;
        setHasAudio(true);
      };
      const persistDecodedAudio = () => {
        if (
          !isCurrentPlayback() ||
          !cacheContext?.persistOnLoad ||
          cacheWriteStarted
        ) {
          return;
        }
        cacheWriteStarted = true;
        void setTtsToCache(
          cacheContext.text,
          cacheContext.voiceIdentity,
          cacheContext.speed,
          blob,
          cacheContext.alignment,
          cacheContext.languageId,
          cacheContext.cacheEpochToken,
        ).then(() => {
          invalidCacheKeysRef.current.delete(cacheContext.cacheKey);
        });
      };
      const evictUndecodableAudio = () => {
        if (!cacheContext) return;
        invalidCacheKeysRef.current.add(cacheContext.cacheKey);
        void deleteTtsFromCache(
          cacheContext.text,
          cacheContext.voiceIdentity,
          cacheContext.speed,
          cacheContext.languageId,
        );
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
          onload: () => {
            if (!isCurrentPlayback()) return;
            markAudioReady();
            persistDecodedAudio();
          },
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
            evictUndecodableAudio();
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
        evictUndecodableAudio();
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

  useEffect(() => subscribeToTtsCacheInvalidation(reset), [reset]);

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
      const cacheEpochToken = captureTtsCacheEpoch();
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
        const miniMaxConfig =
          provider === "minimax" ? getMiniMaxTtsConfig() : null;
        const mimoConfig = provider === "mimo" ? getMimoTtsConfig() : null;

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

        if (
          (provider === "elevenlabs" && !elevenLabsConfig) ||
          (provider === "minimax" && !miniMaxConfig) ||
          (provider === "mimo" && !mimoConfig)
        ) {
          setIsLoading(false);
          setError(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          return;
        }

        const elevenLabsModelId =
          languagePack?.modelId ||
          elevenLabsConfig?.modelId ||
          "eleven_flash_v2_5";
        const voiceIdentity =
          provider === "minimax"
            ? `minimax:${miniMaxConfig?.voiceId ?? "unconfigured"}:${miniMaxConfig?.modelId ?? "unconfigured"}`
            : provider === "mimo"
              ? `mimo:${mimoConfig?.voiceId ?? "unconfigured"}:${mimoConfig?.modelId ?? "unconfigured"}:prompt-v1`
              : `elevenlabs:${elevenLabsConfig?.voiceId ?? "unconfigured"}:${elevenLabsModelId}`;
        const usesPersistentCache =
          provider === "elevenlabs" ||
          provider === "minimax" ||
          provider === "mimo";

        // Local bridge providers can change voice/auth configuration outside
        // the persistent audio cache. Keep those results in memory only so the
        // next generation always reflects the current local settings.
        const persistentCacheKey = usesPersistentCache
          ? buildCacheKey(text, voiceIdentity, speed, languageId)
          : null;
        const cached =
          usesPersistentCache &&
          persistentCacheKey &&
          !invalidCacheKeysRef.current.has(persistentCacheKey)
            ? await getTtsFromCache(text, voiceIdentity, speed, languageId)
            : null;
        if (requestIdRef.current !== requestId) return;
        const cacheEpochIsCurrent = captureTtsCacheEpoch() === cacheEpochToken;
        if (cached && persistentCacheKey && cacheEpochIsCurrent) {
          const blob = cached.audioBlob;
          const timings = timingsFromCachedAlignment(text, cached.alignment);
          playBlob(
            blob,
            timings,
            {},
            {
              cacheKey: persistentCacheKey,
              text,
              voiceIdentity,
              speed,
              languageId,
              alignment: cached.alignment,
              persistOnLoad: false,
              cacheEpochToken,
            },
          );
          return;
        }

        let blob: Blob;
        let alignment: unknown = null;
        let timings: WordTiming[] = [];
        let persistGeneratedAudio = usesPersistentCache;
        if (provider === "hermes-grok") {
          const result = await hermesXaiTtsAligned(text, {
            languageId,
            speed,
            signal,
          });
          blob = result.audioBlob;
          alignment = result.alignment;
          timings = alignment
            ? aggregateToWordTimings(text, alignment as AlignmentData)
            : [];
        } else if (provider === "vertex-gemini") {
          blob = await vertexGeminiTts(text, {
            languageId,
            speed,
            voiceName: getVertexGeminiTtsConfig().voiceName,
            signal,
          });
        } else if (provider === "minimax") {
          if (!miniMaxConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          const result = await miniMaxTtsAligned(miniMaxConfig.apiKey, text, {
            modelId: miniMaxConfig.modelId,
            voiceId: miniMaxConfig.voiceId,
            languageId,
            speed,
            signal,
          });
          blob = result.audioBlob;
          timings = alignProviderWordTimings(text, result.wordTimings);
          if (result.alignmentOutcome === "transient-unavailable") {
            persistGeneratedAudio = false;
          }
          alignment = {
            kind: "word-timings",
            items: timings,
          } satisfies CachedWordTimingData;
        } else if (provider === "mimo") {
          if (!mimoConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          blob = await mimoTts(mimoConfig.apiKey, text, {
            modelId: mimoConfig.modelId,
            voiceId: mimoConfig.voiceId,
            languageId,
            speed,
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
            elevenLabsModelId,
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
          timings = alignment
            ? aggregateToWordTimings(text, alignment as AlignmentData)
            : [];
          const audioBytes = Uint8Array.from(atob(data.audio_base64), (c) =>
            c.charCodeAt(0),
          );
          blob = new Blob([audioBytes], { type: "audio/mpeg" });
        }
        if (requestIdRef.current !== requestId) return;

        // Dispatch custom event to notify usage monitor (only on actual API calls)
        if (provider === "elevenlabs") {
          window.dispatchEvent(
            new CustomEvent("speakright:elevenlabs-usage-changed"),
          );
        }

        const cacheContext = persistentCacheKey
          ? {
              cacheKey: persistentCacheKey,
              text,
              voiceIdentity,
              speed,
              languageId,
              alignment,
              persistOnLoad: persistGeneratedAudio,
              cacheEpochToken,
            }
          : undefined;
        playBlob(blob, timings, {}, cacheContext);
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
