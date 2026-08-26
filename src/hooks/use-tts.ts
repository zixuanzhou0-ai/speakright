"use client";

import { useCallback, useState } from "react";
import {
  elevenLabsTts,
  hermesXaiTts,
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
} from "@/lib/api-keys";
import {
  normalizeStandardTtsError,
  STANDARD_TTS_UNAVAILABLE_MESSAGE,
} from "@/lib/tts-errors";
import { useAudioPlayer } from "./use-audio-player";

interface UseTtsReturn {
  speak: (text: string) => Promise<void>;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
}

export function useTts(): UseTtsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer();

  const speak = useCallback(
    async (text: string) => {
      const provider = getStandardTtsConfig().provider;
      const elevenLabsConfig =
        provider === "elevenlabs" ? getElevenLabsConfig() : null;
      const miniMaxConfig =
        provider === "minimax" ? getMiniMaxTtsConfig() : null;
      const mimoConfig = provider === "mimo" ? getMimoTtsConfig() : null;
      if (
        (provider === "elevenlabs" && !elevenLabsConfig) ||
        (provider === "minimax" && !miniMaxConfig) ||
        (provider === "mimo" && !mimoConfig)
      ) {
        setError(STANDARD_TTS_UNAVAILABLE_MESSAGE);
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        let blob: Blob;
        if (provider === "hermes-grok") {
          blob = await hermesXaiTts(text);
        } else if (provider === "vertex-gemini") {
          blob = await vertexGeminiTts(text, {
            voiceName: getVertexGeminiTtsConfig().voiceName,
          });
        } else if (provider === "minimax") {
          if (!miniMaxConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          blob = (
            await miniMaxTtsAligned(miniMaxConfig.apiKey, text, {
              modelId: miniMaxConfig.modelId,
              voiceId: miniMaxConfig.voiceId,
              languageId: "en-US",
              speed: 1,
            })
          ).audioBlob;
        } else if (provider === "mimo") {
          if (!mimoConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          blob = await mimoTts(mimoConfig.apiKey, text, {
            modelId: mimoConfig.modelId,
            voiceId: mimoConfig.voiceId,
            languageId: "en-US",
            speed: 1,
          });
        } else {
          if (!elevenLabsConfig) {
            throw new Error(STANDARD_TTS_UNAVAILABLE_MESSAGE);
          }
          blob = await elevenLabsTts(
            elevenLabsConfig.apiKey,
            elevenLabsConfig.voiceId,
            text,
            elevenLabsConfig.modelId || "eleven_flash_v2_5",
          );
        }
        player.playBlob(blob);
        if (provider === "elevenlabs") {
          window.dispatchEvent(
            new CustomEvent("speakright:elevenlabs-usage-changed"),
          );
        }
      } catch (e) {
        console.error("[Standard TTS]", e);
        setError(normalizeStandardTtsError(e));
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  return { speak, isLoading, isPlaying: player.isPlaying, error };
}
