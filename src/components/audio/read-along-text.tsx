"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WordTiming } from "@/hooks/use-tts-aligned";
import {
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import { cn } from "@/lib/utils";

interface ReadAlongTextProps {
  text: string;
  wordTimings: WordTiming[];
  isPlaying: boolean;
  currentTime: number;
  reserveReplaySpace?: boolean;
}

const waveformBars = [
  { id: "soft", height: 8 },
  { id: "high", height: 14 },
  { id: "mid", height: 10 },
  { id: "peak", height: 16 },
] as const;

export function ReadAlongText({
  text,
  wordTimings,
  isPlaying,
  currentTime,
  reserveReplaySpace = false,
}: ReadAlongTextProps) {
  const reducedMotion = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const wordOccurrenceCounts = new Map<string, number>();
  const wordTokens = words.map((word) => {
    const occurrence = (wordOccurrenceCounts.get(word) ?? 0) + 1;
    wordOccurrenceCounts.set(word, occurrence);
    return { occurrence, word };
  });
  const density = getPracticeTextDensity(text, "sentence");
  const hasWordTimings = wordTimings.length > 0;
  const isUntimedPlayback = isPlaying && !hasWordTimings;
  const playbackMode = hasWordTimings ? "word-timed" : "sentence-untimed";

  return (
    <div
      className={cn(
        "flex min-h-[80px] flex-col items-center justify-center rounded-lg border bg-muted/20 px-5 py-4 font-mono transition-[background-color,border-color] duration-300",
        isUntimedPlayback && "border-primary/30 bg-primary/5",
        reserveReplaySpace && "pb-16 sm:pb-12",
        getCenteredReadableTextClassName(density),
      )}
      data-smoke="read-along-text"
      data-playback-mode={playbackMode}
      data-playing={isPlaying ? "true" : "false"}
      data-layout-motion="static"
      data-motion={reducedMotion ? "reduced" : "full"}
      data-replay-space={reserveReplaySpace ? "reserved" : "none"}
    >
      <div className="flex max-w-full flex-wrap justify-center gap-x-2 gap-y-1">
        {wordTokens.map(({ occurrence, word }, i) => {
          const timing = wordTimings[i];
          let state: "past" | "current" | "future" = "future";

          if (isPlaying && timing) {
            if (currentTime >= timing.end) {
              state = "past";
            } else if (currentTime >= timing.start) {
              state = "current";
            }
          }

          return (
            <span
              key={`${word}-${occurrence}-${timing?.start ?? "untimed"}-${timing?.end ?? "untimed"}`}
              className={cn(
                "inline-flex max-w-full justify-center rounded px-1 py-0.5 text-center transition-colors duration-200 [overflow-wrap:anywhere]",
                isUntimedPlayback && "text-foreground",
                !isUntimedPlayback &&
                  state === "current" &&
                  "bg-primary/20 font-semibold text-primary",
                !isUntimedPlayback &&
                  state === "past" &&
                  "text-muted-foreground",
                !isUntimedPlayback && state === "future" && "text-foreground",
              )}
              data-word-index={i}
              data-word-state={isUntimedPlayback ? "speaking" : state}
              data-word-motion="color-only"
            >
              {word}
            </span>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {isUntimedPlayback && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.2 }}
            className="mt-2 flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
            data-smoke="read-along-untimed-status"
          >
            <span
              aria-hidden="true"
              className="flex h-4 items-center gap-0.5"
              data-smoke="read-along-waveform"
            >
              {waveformBars.map(({ height, id }, index) => (
                <motion.span
                  key={id}
                  animate={
                    reducedMotion
                      ? { height, opacity: 0.85 }
                      : {
                          height: [4, height, 4],
                          opacity: [0.45, 1, 0.45],
                        }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.12 }
                      : {
                          duration: 0.75,
                          ease: "easeInOut",
                          repeat: Number.POSITIVE_INFINITY,
                          delay: index * 0.09,
                        }
                  }
                  className="w-0.5 rounded-full bg-primary"
                  data-smoke="read-along-waveform-bar"
                  data-motion={reducedMotion ? "static" : "animated"}
                />
              ))}
            </span>
            <span>整句播放中</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
