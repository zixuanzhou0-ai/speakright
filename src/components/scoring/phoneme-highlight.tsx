"use client";

import { Howl } from "howler";
import { Volume2 } from "lucide-react";
import { motion } from "motion/react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getAssessmentPhonemeLabel,
  getPhonemeAudioInfo,
  normalizeAssessmentPhoneme,
} from "@/lib/azure-phoneme-map";
import { isPlayableHeaderAudioSrc } from "@/lib/audio-playback-policy";
import { getBarColor } from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type { AzurePhoneme, AzureSyllable } from "@/types/azure";
import type { LanguageId } from "@/types/language";

/* ---- Shared phoneme audio player (one Howl instance at a time) ---- */
let activeHowl: Howl | null = null;
let activePhonemeKey = "";
let activeStopTimer: ReturnType<typeof setTimeout> | null = null;
let activeFadeTimer: ReturnType<typeof setTimeout> | null = null;

function clearActiveStopTimer() {
  if (!activeStopTimer) return;
  clearTimeout(activeStopTimer);
  activeStopTimer = null;
}

function clearActiveFadeTimer() {
  if (!activeFadeTimer) return;
  clearTimeout(activeFadeTimer);
  activeFadeTimer = null;
}

interface PhonemeTilePlaybackOptions {
  startMs?: number;
  maxDurationMs?: number;
  fadeOutMs?: number;
}

export function isScoringTileAudioPlayable(audioUrl?: string): boolean {
  return isPlayableHeaderAudioSrc(audioUrl);
}

function playPhonemeAudio(
  audioUrl: string,
  key: string,
  options: PhonemeTilePlaybackOptions,
  onStart: () => void,
  onEnd: () => void,
) {
  if (!isScoringTileAudioPlayable(audioUrl)) {
    onEnd();
    return;
  }

  // Stop any currently playing phoneme
  clearActiveStopTimer();
  clearActiveFadeTimer();
  if (activeHowl) {
    const previousHowl = activeHowl;
    activeHowl = null;
    activePhonemeKey = "";
    previousHowl.stop();
    previousHowl.unload();
  }

  activePhonemeKey = key;
  onStart();

  const howl = new Howl({
    src: [audioUrl],
    html5:
      audioUrl.startsWith("http") ||
      /\.(mp4|m4v|webm)(?:$|\?)/i.test(audioUrl),
    onend: () => {
      clearActiveStopTimer();
      clearActiveFadeTimer();
      activePhonemeKey = "";
      if (activeHowl === howl) activeHowl = null;
      onEnd();
    },
    onstop: () => {
      clearActiveStopTimer();
      clearActiveFadeTimer();
      activePhonemeKey = "";
      if (activeHowl === howl) activeHowl = null;
      onEnd();
    },
    onloaderror: () => {
      clearActiveStopTimer();
      clearActiveFadeTimer();
      activePhonemeKey = "";
      if (activeHowl === howl) activeHowl = null;
      onEnd();
    },
  });
  activeHowl = howl;
  const soundId = howl.play();
  const numericSoundId = typeof soundId === "number" ? soundId : undefined;

  if (options.startMs && numericSoundId !== undefined) {
    howl.seek(options.startMs / 1000, numericSoundId);
  }

  if (options.maxDurationMs && options.maxDurationMs > 0) {
    const fadeOutMs = Math.max(0, options.fadeOutMs ?? 0);
    const fadeDelayMs = options.maxDurationMs - fadeOutMs;
    if (fadeOutMs > 0 && fadeDelayMs > 0) {
      activeFadeTimer = setTimeout(() => {
        if (activeHowl !== howl || activePhonemeKey !== key) return;
        howl.fade(1, 0, fadeOutMs, numericSoundId);
      }, fadeDelayMs);
    }

    activeStopTimer = setTimeout(() => {
      if (activeHowl !== howl || activePhonemeKey !== key) return;
      howl.stop(numericSoundId);
      howl.unload();
      if (activeHowl === howl) activeHowl = null;
    }, options.maxDurationMs);
  }
}

/* ---- Shared phoneme tile (used by PhonemeHighlight & ScoreBreakdown) ---- */
export function PhonemeBlock({
  ph,
  index,
  languageId = "en-US",
}: {
  ph: AzurePhoneme;
  index: number;
  languageId?: LanguageId;
}) {
  const score = Math.round(ph.accuracyScore);
  const isGood = ph.accuracyScore >= 60;
  const rawAudioInfo = getPhonemeAudioInfo(ph.phoneme, languageId);
  const audioInfo =
    rawAudioInfo && isScoringTileAudioPlayable(rawAudioInfo.url)
      ? rawAudioInfo
      : null;
  const hasAudio = !!audioInfo;
  const [isPlaying, setIsPlaying] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const blockKey = `${ph.phoneme}-${index}`;
  const displayLabel = getAssessmentPhonemeLabel(ph.phoneme, languageId);

  const setPlayingIfMounted = useCallback((value: boolean) => {
    if (mountedRef.current) setIsPlaying(value);
  }, []);

  const handlePlay = useCallback(() => {
    if (!audioInfo) return;

    playPhonemeAudio(
      audioInfo.url,
      blockKey,
      {
        startMs: audioInfo.startMs,
        maxDurationMs: audioInfo.maxDurationMs,
        fadeOutMs: audioInfo.fadeOutMs,
      },
      () => setPlayingIfMounted(true),
      () => setPlayingIfMounted(false),
    );
  }, [audioInfo, blockKey, setPlayingIfMounted]);

  const handleClick = useCallback(() => {
    if (!hasAudio) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      handlePlay();
    }, 120);
  }, [hasAudio, handlePlay]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!hasAudio) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleClick();
    },
    [handleClick, hasAudio],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      if (activePhonemeKey === blockKey && activeHowl) {
        clearActiveStopTimer();
        clearActiveFadeTimer();
        const currentHowl = activeHowl;
        activeHowl = null;
        activePhonemeKey = "";
        currentHowl.stop();
        currentHowl.unload();
      }
    };
  }, [blockKey]);

  const tile = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        x: !isGood ? [0, -2, 2, -2, 0] : 0,
      }}
      transition={{
        delay: index * 0.03,
        x: { delay: index * 0.03 + 0.1, duration: 0.3 },
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={hasAudio ? "button" : undefined}
      tabIndex={hasAudio ? 0 : -1}
      aria-disabled={hasAudio ? "false" : "true"}
      aria-label={hasAudio ? `播放音标 ${displayLabel}` : undefined}
      title={hasAudio ? undefined : `${score} 分 · ${ph.phoneme} · 暂无本地音频`}
      data-smoke="assessment-phoneme-tile"
      data-audio-playable={hasAudio ? "true" : "false"}
      data-audio-kind={audioInfo?.kind ?? "none"}
      data-audio-src={audioInfo?.url ?? ""}
      data-audio-max-duration-ms={audioInfo?.maxDurationMs ?? ""}
      data-audio-fade-out-ms={audioInfo?.fadeOutMs ?? ""}
      className={cn(
        "flex w-14 flex-col items-center rounded-lg p-1.5 transition-colors",
        hasAudio ? "cursor-pointer" : "cursor-default",
        isPlaying
          ? "ring-2 ring-primary bg-primary/25"
          : isGood
            ? "bg-primary/15"
            : "bg-destructive/10",
      )}
    >
      <span
        className={cn(
          "font-ipa flex h-5 items-center justify-center text-[15px] font-bold leading-none",
          isGood ? "text-primary" : "text-destructive",
        )}
      >
        {displayLabel}
      </span>
      <span
        className={cn(
          "text-xs tabular-nums leading-tight",
          isGood ? "text-primary" : "text-red-700 dark:text-red-400",
        )}
      >
        {score}
      </span>
      <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${getBarColor(ph.accuracyScore)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </motion.div>
  );

  if (!hasAudio) return tile;

  return (
    <Tooltip>
      <TooltipTrigger>{tile}</TooltipTrigger>
      <TooltipContent>
        <span className="tabular-nums">{score} 分</span>
        <span className="ml-1.5 text-xs text-muted-foreground">
          {ph.phoneme}
        </span>
        <span className="ml-1.5 text-xs text-muted-foreground">
          ·{" "}
          {audioInfo.kind === "sound-unit"
            ? "点击播放左侧同一音标标准音"
            : "点击播放 IPA 标准音"}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

interface PhonemeHighlightProps {
  phonemes: AzurePhoneme[];
  syllables?: AzureSyllable[];
  languageId?: LanguageId;
  expectedText?: string;
  expectedIpa?: string;
}

export function PhonemeHighlight({
  phonemes,
  languageId = "en-US",
  expectedText,
  expectedIpa,
}: PhonemeHighlightProps) {
  const visiblePhonemes = phonemes.filter((ph) =>
    normalizeAssessmentPhoneme(ph.phoneme),
  );
  const hasAnyAudio = visiblePhonemes.some((ph) =>
    getPhonemeAudioInfo(ph.phoneme, languageId),
  );
  const occurrenceCounts = new Map<string, number>();
  const visiblePhonemeItems = visiblePhonemes.map((ph) => {
    const baseKey = `${ph.phoneme}-${ph.accuracyScore}`;
    const occurrence = (occurrenceCounts.get(baseKey) ?? 0) + 1;
    occurrenceCounts.set(baseKey, occurrence);
    return {
      ph,
      key: `${baseKey}-${occurrence}`,
    };
  });
  const breakdownLabel = languageId === "en-US" ? "音标拆解" : "发音拆解";
  const showTargetReference = languageId !== "en-US" && !!expectedIpa;

  return (
    <div className="rounded-xl border bg-card p-4">
      {/* Phoneme view */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            {breakdownLabel}
          </p>
          {hasAnyAudio ? (
            <span
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60"
              data-smoke="assessment-phoneme-audio-hint"
            >
              <Volume2 className="h-3 w-3" />
              有本地音频的片段可点击
            </span>
          ) : (
            <span
              className="text-xs text-muted-foreground/60"
              data-smoke="assessment-phoneme-audio-hint"
            >
              暂无本地音频
            </span>
          )}
        </div>
        {showTargetReference && (
          <div
            className="mb-3 rounded-lg border bg-muted/20 px-3 py-2 text-center"
            data-smoke="assessment-target-ipa-reference"
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              目标 IPA 参考
            </p>
            {expectedText && (
              <p className="mx-auto mt-1 max-w-full break-words text-center text-xs font-medium [overflow-wrap:anywhere]">
                {expectedText}
              </p>
            )}
            <p className="mx-auto mt-1 max-w-full break-words text-center font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {expectedIpa}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80">
              下方是本次录音识别到的片段；若数量较少或和目标 IPA 不完全一致，以目标参考为准。
            </p>
          </div>
        )}
        {visiblePhonemes.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {visiblePhonemeItems.map((item, i) => (
              <PhonemeBlock
                key={item.key}
                ph={item.ph}
                index={i}
                languageId={languageId}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
            Azure 返回了评分，但没有返回可用的分段音素标签；请重新录制或换一个示例词复测。
          </p>
        )}
      </div>

    </div>
  );
}
