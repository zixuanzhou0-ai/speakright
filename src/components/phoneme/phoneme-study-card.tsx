"use client";

import { ChevronLeft, ChevronRight, Loader2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { Button } from "@/components/ui/button";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

interface PhonemeStudyCardProps {
  phoneme: PhonemeData;
  currentWord: KeywordEntry | null;
  wordDirection: number;
  wordPoolSize: number;
  practicedCount: number;
  hasMwConfig: boolean;
  isWordActive: boolean;
  mwIsLoading: boolean;
  lastChartPlay: "normal" | "slow";
  onPrevious: () => void;
  onNext: () => void;
  onSetWordDirection: (dir: number) => void;
  onSetLastChartPlay: (play: "normal" | "slow") => void;
  onPlayWord: (word: string, voice?: "blue" | "pink") => void;
  onPlayChartAudio: (path: string) => void;
  onStopPlayback: () => void;
  onStopMw: () => void;
  onStopChartAudio: () => void;
  wordHistoryLength: number;
}

export function PhonemeStudyCard({
  phoneme,
  currentWord,
  wordDirection,
  wordPoolSize,
  practicedCount,
  hasMwConfig,
  isWordActive,
  mwIsLoading,
  lastChartPlay,
  onPrevious,
  onNext,
  onSetWordDirection,
  onSetLastChartPlay,
  onPlayWord,
  onPlayChartAudio,
  onStopPlayback,
  onStopMw,
  onStopChartAudio,
  wordHistoryLength,
}: PhonemeStudyCardProps) {
  return (
    <div className="shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden">
      <VideoPlayer slug={phoneme.slug} />
      <div className="px-4 py-3">
        {/* IPA + play + emoji */}
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-3xl font-bold">{phoneme.ipa}</h1>
          <PhonemePlayButton chartWord={phoneme.chartWord} />
          <span className="text-muted-foreground/30">|</span>
          <p className="text-sm text-muted-foreground flex-1 truncate">
            {phoneme.name}
          </p>
          {phoneme.chartImage && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={() => {
                if (!phoneme.chartWord) return;
                onStopPlayback();
                onStopMw();
                const next = lastChartPlay === "slow" ? "normal" : "slow";
                onSetLastChartPlay(next);
                onPlayChartAudio(`/audio/ipa/${next}/${phoneme.chartWord}.mp3`);
              }}
              className="flex shrink-0 flex-col items-center cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/ipa/${phoneme.chartImage}.png`}
                alt={phoneme.chartWord || ""}
                className="h-8 w-8 object-contain"
              />
              <span className="text-[10px] text-muted-foreground capitalize">
                {phoneme.chartWord}
              </span>
            </motion.button>
          )}
        </div>

        {/* Word navigation */}
        {currentWord ? (
          <div className="mt-3 flex items-center gap-2">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onSetWordDirection(-1);
                  onPrevious();
                }}
                disabled={wordHistoryLength === 0}
                className="h-7 w-7 shrink-0 rounded-full cursor-pointer disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </motion.div>

            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentWord.word}
                  initial={{ x: wordDirection > 0 ? 120 : -120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: wordDirection > 0 ? -120 : 120, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="flex items-center justify-center gap-2"
                >
                  <motion.span
                    animate={{ scale: isWordActive ? 1.05 : 1 }}
                    className={`text-2xl font-bold transition-colors ${isWordActive ? "text-primary" : ""}`}
                  >
                    {currentWord.word}
                  </motion.span>
                  <span
                    className={`font-mono text-sm ${isWordActive ? "text-primary/70" : "text-muted-foreground"}`}
                  >
                    {currentWord.ipa}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onStopPlayback();
                onStopChartAudio();
                onPlayWord(currentWord.word, "blue");
              }}
              disabled={mwIsLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full cursor-pointer hover:bg-primary/10 hover:text-primary text-muted-foreground disabled:opacity-50"
            >
              {mwIsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </motion.button>

            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  onSetWordDirection(1);
                  onNext();
                }}
                className="h-7 w-7 shrink-0 rounded-full cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        ) : (
          <div className="mt-3 h-8" />
        )}

        {/* Progress + MW attribution */}
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">
            已练 {practicedCount}/{wordPoolSize}
          </span>
          {hasMwConfig && (
            <>
              <span className="text-muted-foreground/20">|</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                <Image
                  src="/images/mw-logo.svg"
                  alt="MW"
                  width={12}
                  height={12}
                  className="opacity-50"
                />
                <span>Merriam-Webster</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
