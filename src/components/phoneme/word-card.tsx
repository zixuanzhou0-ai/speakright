"use client";

import { ChevronLeft, ChevronRight, Loader2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";
import { cn } from "@/lib/utils";
import type { KeywordEntry } from "@/types/phoneme";

interface WordCardProps {
  currentWord: KeywordEntry;
  onNext: () => void;
  onPrevious: () => void;
  hasPrevious: boolean;
  practicedCount: number;
  totalCount: number;
}

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 15,
} as const;

export function WordCard({
  currentWord,
  onNext,
  onPrevious,
  hasPrevious,
  practicedCount,
  totalCount,
}: WordCardProps) {
  const mw = useMwPronunciation();
  const [direction, setDirection] = useState<number>(1);

  const handlePrev = useCallback(() => {
    if (hasPrevious) {
      setDirection(-1);
      onPrevious();
    }
  }, [hasPrevious, onPrevious]);

  const handleNext = useCallback(() => {
    setDirection(1);
    onNext();
  }, [onNext]);

  const handlePlay = () => {
    mw.playWord(currentWord.word, "blue");
  };

  const isActive = mw.isPlaying || mw.isLoading;

  return (
    <div className="w-full">
      {/* Card with arrows */}
      <div className="flex items-center gap-2">
        <motion.div
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          transition={springTransition}
        >
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            disabled={!hasPrevious}
            className="h-8 w-8 shrink-0 rounded-full cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </motion.div>

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentWord.word}
              initial={{ x: direction > 0 ? 200 : -200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -200 : 200, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="flex flex-col items-center gap-1 p-3">
                  <motion.span
                    animate={{ scale: isActive ? 1.08 : 1 }}
                    transition={springTransition}
                    className={cn(
                      "text-3xl font-bold rounded-lg px-3 py-0.5 transition-colors duration-200",
                      isActive && "bg-primary/15 text-primary",
                    )}
                  >
                    {currentWord.word}
                  </motion.span>
                  <span
                    className={cn(
                      "font-mono text-base transition-colors duration-200",
                      isActive ? "text-primary/70" : "text-muted-foreground",
                    )}
                  >
                    {currentWord.ipa}
                  </span>

                  {/* Play button with ripple animation */}
                  <div className="relative flex items-center justify-center pt-1">
                    {/* Ripple rings — visible only while playing */}
                    {mw.isPlaying && (
                      <>
                        <motion.span
                          className="absolute rounded-full border-2 border-primary/40"
                          initial={{ width: 32, height: 32, opacity: 0.6 }}
                          animate={{ width: 64, height: 64, opacity: 0 }}
                          transition={{
                            duration: 1.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeOut",
                          }}
                        />
                        <motion.span
                          className="absolute rounded-full border-2 border-primary/30"
                          initial={{ width: 32, height: 32, opacity: 0.5 }}
                          animate={{ width: 64, height: 64, opacity: 0 }}
                          transition={{
                            duration: 1.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeOut",
                            delay: 0.4,
                          }}
                        />
                        <motion.span
                          className="absolute rounded-full border-2 border-primary/20"
                          initial={{ width: 32, height: 32, opacity: 0.4 }}
                          animate={{ width: 64, height: 64, opacity: 0 }}
                          transition={{
                            duration: 1.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: "easeOut",
                            delay: 0.8,
                          }}
                        />
                      </>
                    )}

                    <motion.button
                      type="button"
                      onClick={handlePlay}
                      disabled={mw.isLoading}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      transition={springTransition}
                      className={cn(
                        "relative z-10 flex h-9 w-9 items-center justify-center rounded-full cursor-pointer transition-colors duration-200",
                        "hover:bg-primary/10 hover:text-primary",
                        "disabled:opacity-50 disabled:cursor-wait",
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground",
                      )}
                    >
                      {mw.isLoading ? (
                        <Loader2 className="h-7 w-7 animate-spin" />
                      ) : (
                        <Volume2 className="h-7 w-7" />
                      )}
                    </motion.button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          transition={springTransition}
        >
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-8 w-8 shrink-0 rounded-full cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      {/* Progress counter */}
      <div className="mt-2 flex justify-center">
        <span className="text-xs text-muted-foreground">
          已练 {practicedCount}/{totalCount}
        </span>
      </div>
    </div>
  );
}
