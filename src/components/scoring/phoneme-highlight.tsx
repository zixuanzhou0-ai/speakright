"use client";

import { Howl } from "howler";
import { Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
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
import { getBarColor } from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type { AzurePhoneme, AzureSyllable } from "@/types/azure";
import type { LanguageId } from "@/types/language";

/* ---- Shared phoneme audio player (one Howl instance at a time) ---- */
let activeHowl: Howl | null = null;
let activePhonemeKey = "";

function playPhonemeAudio(
  audioUrl: string,
  key: string,
  onStart: () => void,
  onEnd: () => void,
) {
  // Stop any currently playing phoneme
  if (activeHowl) {
    activeHowl.stop();
    activeHowl.unload();
  }

  activePhonemeKey = key;
  onStart();

  activeHowl = new Howl({
    src: [audioUrl],
    html5: true,
    onend: () => {
      activePhonemeKey = "";
      onEnd();
    },
    onstop: () => {
      activePhonemeKey = "";
      onEnd();
    },
    onloaderror: () => {
      activePhonemeKey = "";
      onEnd();
    },
  });
  activeHowl.play();
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
  const audioInfo = getPhonemeAudioInfo(ph.phoneme, languageId);
  const hasAudio = !!audioInfo;
  const [isPlaying, setIsPlaying] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockKey = `${ph.phoneme}-${index}`;

  const handlePlay = useCallback(() => {
    if (!audioInfo) return;

    playPhonemeAudio(
      audioInfo.url,
      blockKey,
      () => setIsPlaying(true),
      () => setIsPlaying(false),
    );
  }, [audioInfo, blockKey]);

  const handleClick = useCallback(() => {
    if (!hasAudio) return;

    // Single click: normal play; double click detected via timer
    if (clickTimer.current) {
      // Double click: play twice
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handlePlay();
      // Play again after first ends
      const checkAndReplay = () => {
        if (activePhonemeKey !== blockKey) {
          handlePlay();
        } else {
          setTimeout(checkAndReplay, 100);
        }
      };
      setTimeout(checkAndReplay, 400);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        handlePlay();
      }, 200);
    }
  }, [hasAudio, handlePlay, blockKey]);

  return (
    <Tooltip>
      <TooltipTrigger>
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
            {getAssessmentPhonemeLabel(ph.phoneme, languageId)}
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
      </TooltipTrigger>
      <TooltipContent>
        <span className="tabular-nums">{score} 分</span>
        <span className="ml-1.5 text-xs text-muted-foreground">
          {ph.phoneme}
        </span>
        {hasAudio && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            ·{" "}
            {audioInfo.kind === "word-example"
              ? `点击播放示例 ${audioInfo.label}`
              : "点击播放"}
          </span>
        )}
        {!hasAudio && (
          <span className="ml-1.5 text-xs text-muted-foreground">
            · 暂无本地音频
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface PhonemeHighlightProps {
  phonemes: AzurePhoneme[];
  syllables?: AzureSyllable[];
  languageId?: LanguageId;
}

export function PhonemeHighlight({
  phonemes,
  languageId = "en-US",
}: PhonemeHighlightProps) {
  const visiblePhonemes = phonemes.filter((ph) =>
    normalizeAssessmentPhoneme(ph.phoneme),
  );
  const hasAnyAudio = visiblePhonemes.some((ph) =>
    getPhonemeAudioInfo(ph.phoneme, languageId),
  );
  const breakdownLabel = languageId === "en-US" ? "音标拆解" : "发音拆解";

  return (
    <div className="rounded-xl border bg-card p-4">
      {/* Phoneme view */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {breakdownLabel}
          </p>
          {hasAnyAudio ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60">
              <Volume2 className="h-3 w-3" />
              点击可听发音
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">
              暂无本地音频
            </span>
          )}
        </div>
        {visiblePhonemes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visiblePhonemes.map((ph, i) => (
              <PhonemeBlock
                key={`${ph.phoneme}-${ph.accuracyScore}`}
                ph={ph}
                index={i}
                languageId={languageId}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Azure 返回了评分，但没有返回可用的分段音素标签；请重新录制或换一个示例词复测。
          </p>
        )}
      </div>

    </div>
  );
}
