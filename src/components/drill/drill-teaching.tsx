"use client";

import { Loader2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  getCenteredMonoTextClassName,
  getCenteredProminentTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import type { DrillItem } from "@/types/drill";
import { DrillProgress } from "./drill-progress";

interface DrillTeachingProps {
  item: DrillItem;
  index: number;
  total: number;
  isPlaying: boolean;
  isLoading: boolean;
  audioError?: string | null;
  onPlay: () => void;
  onReady: () => void;
}

export function DrillTeaching({
  item,
  index,
  total,
  isPlaying,
  isLoading,
  audioError,
  onPlay,
  onReady,
}: DrillTeachingProps) {
  const textDensity = getPracticeTextDensity(item.text);

  return (
    <div className="space-y-6">
      <DrillProgress current={index} total={total} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm"
      >
        {/* Word display */}
        <motion.span
          key={item.text}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-bold ${getCenteredProminentTextClassName(textDensity)}`}
        >
          {item.text}
        </motion.span>

        {item.ipa && (
          <span
            className={`font-mono text-muted-foreground ${getCenteredMonoTextClassName(textDensity)}`}
          >
            {item.ipa}
          </span>
        )}

        {/* Play button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPlay}
          disabled={isLoading}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Volume2 className="h-8 w-8" />
          )}
        </motion.button>

        <p className="text-xs text-muted-foreground">
          {isPlaying ? "正在播放..." : "点击听标准发音"}
        </p>
        {audioError && (
          <p
            role="alert"
            data-smoke="drill-teaching-audio-error"
            className="max-w-sm break-words text-center text-xs text-destructive [overflow-wrap:anywhere]"
          >
            {audioError}
          </p>
        )}

        {/* Pronunciation tips */}
        {item.description && (
          <div className="w-full rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              💡 发音要领
            </p>
            <p className="mt-1 text-center text-sm">{item.description}</p>
          </div>
        )}

        <Button onClick={onReady} size="lg" className="mt-2 cursor-pointer">
          我准备好了，开始录音
        </Button>
      </motion.div>
    </div>
  );
}
