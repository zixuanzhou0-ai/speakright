"use client";

import { useCallback, useState } from "react";
import { elevenLabsTts } from "@/lib/api-client";
import { getElevenLabsConfig } from "@/lib/api-keys";
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
      const config = getElevenLabsConfig();
      if (!config) {
        setError("请先在设置页面配置 ElevenLabs API 密钥");
        return;
      }

      setError(null);
      setIsLoading(true);

      try {
        const blob = await elevenLabsTts(
          config.apiKey,
          config.voiceId,
          text,
          config.modelId || "eleven_flash_v2_5",
        );
        player.playBlob(blob);
      } catch (e) {
        console.error("[ElevenLabs TTS]", e);
        setError(e instanceof Error ? e.message : "语音合成失败");
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  return { speak, isLoading, isPlaying: player.isPlaying, error };
}
