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

const STANDARD_TTS_UNAVAILABLE_MESSAGE =
  "无法播放标准示范：请配置 TTS provider（如 ElevenLabs）或安装当前语言的本地发音包。单词词典发音只负责单词复读；后续可接入更多 TTS provider。";

export function useTts(): UseTtsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer();

  const speak = useCallback(
    async (text: string) => {
      const config = getElevenLabsConfig();
      if (!config) {
        setError(STANDARD_TTS_UNAVAILABLE_MESSAGE);
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
        const details = e instanceof Error ? `（${e.message}）` : "";
        setError(`${STANDARD_TTS_UNAVAILABLE_MESSAGE}${details}`);
      } finally {
        setIsLoading(false);
      }
    },
    [player],
  );

  return { speak, isLoading, isPlaying: player.isPlaying, error };
}
