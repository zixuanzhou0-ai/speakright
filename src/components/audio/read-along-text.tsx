"use client";

import { motion } from "motion/react";
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
}

const springTransition = {
  type: "spring",
  stiffness: 300,
  damping: 20,
} as const;

export function ReadAlongText({
  text,
  wordTimings,
  isPlaying,
  currentTime,
}: ReadAlongTextProps) {
  const words = text.split(/\s+/).filter(Boolean);
  const density = getPracticeTextDensity(text, "sentence");

  return (
    <div
      className={cn(
        "flex min-h-[80px] flex-wrap justify-center gap-x-2 gap-y-1 rounded-lg border bg-muted/20 px-5 py-4 font-mono",
        getCenteredReadableTextClassName(density),
      )}
    >
      {words.map((word, i) => {
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
          <motion.span
            key={`${word}-${timing?.start ?? "untimed"}-${timing?.end ?? "untimed"}`}
            animate={{
              scale: state === "current" ? 1.05 : 1,
            }}
            transition={springTransition}
            className={cn(
              "inline-flex max-w-full justify-center rounded px-1 py-0.5 text-center transition-colors duration-200 [overflow-wrap:anywhere]",
              state === "current" && "bg-primary/20 text-primary font-semibold",
              state === "past" && "text-muted-foreground",
              state === "future" && "text-foreground",
            )}
          >
            {word}
          </motion.span>
        );
      })}
    </div>
  );
}
