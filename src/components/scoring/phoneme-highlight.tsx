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
  getPhonemeAudioUrl,
  syllableToIpa,
  toIpa,
} from "@/lib/azure-phoneme-map";
import { getBarColor } from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type { AzurePhoneme, AzureSyllable } from "@/types/azure";

/* ---- Shared phoneme audio player (one Howl instance at a time) ---- */
let activeHowl: Howl | null = null;
let activePhonemeKey = "";

function playPhonemeAudio(
  azureCode: string,
  key: string,
  onStart: () => void,
  onEnd: () => void,
) {
  const url = getPhonemeAudioUrl(azureCode);
  if (!url) return;

  // Stop any currently playing phoneme
  if (activeHowl) {
    activeHowl.stop();
    activeHowl.unload();
  }

  activePhonemeKey = key;
  onStart();

  activeHowl = new Howl({
    src: [url],
    format: ["mp3"],
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
}: {
  ph: AzurePhoneme;
  index: number;
}) {
  const score = Math.round(ph.accuracyScore);
  const isGood = ph.accuracyScore >= 60;
  const audioUrl = getPhonemeAudioUrl(ph.phoneme);
  const hasAudio = !!audioUrl;
  const [isPlaying, setIsPlaying] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockKey = `${ph.phoneme}-${index}`;

  const handlePlay = useCallback(() => {
    playPhonemeAudio(
      ph.phoneme,
      blockKey,
      () => setIsPlaying(true),
      () => setIsPlaying(false),
    );
  }, [ph.phoneme, blockKey]);

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
            "flex w-14 cursor-pointer flex-col items-center rounded-lg p-1.5 transition-colors",
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
            {toIpa(ph.phoneme)}
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
            · 点击播放
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface PhonemeHighlightProps {
  phonemes: AzurePhoneme[];
  syllables?: AzureSyllable[];
}

export function PhonemeHighlight({
  phonemes,
  syllables,
}: PhonemeHighlightProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      {/* Phoneme view */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-semibold text-muted-foreground">
            音标拆解
          </p>
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60">
            <Volume2 className="h-3 w-3" />
            点击可听发音
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {phonemes.map((ph, i) => (
            <PhonemeBlock key={`${ph.phoneme}-${i}`} ph={ph} index={i} />
          ))}
        </div>
      </div>

      {/* Syllable view (hidden for single-syllable words) */}
      {syllables && syllables.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            音节
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {syllables.map((s, i) => {
              const isGood = s.accuracyScore >= 60;
              const isPrimary = s.stress === "primary";
              const isSecondary = s.stress === "secondary";
              const hasStress = isPrimary || isSecondary;
              const stressPrefix = isPrimary ? "ˈ" : isSecondary ? "ˌ" : "";
              return (
                <span
                  key={`syl-${s.syllable}-${i}`}
                  className="inline-flex items-center gap-1"
                >
                  {i > 0 && <span className="text-muted-foreground/50">·</span>}
                  <span
                    className={cn(
                      "font-ipa inline-flex items-baseline gap-0.5 rounded px-1.5 py-0.5 text-sm",
                      !isGood
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : isPrimary
                          ? "bg-primary/20 font-bold text-primary"
                          : hasStress
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {stressPrefix}
                    {syllableToIpa(s.syllable)}
                    <sup className="text-xs opacity-70">
                      {Math.round(s.accuracyScore)}
                    </sup>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
