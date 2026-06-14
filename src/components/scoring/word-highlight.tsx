"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AzureWord } from "@/types/azure";

interface WordHighlightProps {
  words: AzureWord[];
  onWordClick?: (word: AzureWord) => void;
}

const ERROR_LABELS: Record<string, string> = {
  Omission: "漏读",
  Insertion: "多读",
  Mispronunciation: "错读",
};

export function WordHighlight({ words, onWordClick }: WordHighlightProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2 text-center">
      {words.map((word, i) => {
        const isCorrect = word.errorType === "None" && word.accuracyScore >= 60;
        const hasError = word.errorType !== "None";

        return (
          <motion.button
            key={`${word.word}-${word.accuracyScore}-${word.errorType}`}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              x: hasError ? [0, -3, 3, -3, 0] : 0,
            }}
            transition={{
              delay: i * 0.05,
              x: { delay: i * 0.05 + 0.2, duration: 0.3 },
            }}
            onClick={() => onWordClick?.(word)}
            className={cn(
              "relative inline-flex max-w-full items-center justify-center whitespace-normal rounded-md px-2 py-1 text-center text-lg font-mono transition-colors break-words [overflow-wrap:anywhere]",
              isCorrect && "bg-primary/15 text-primary",
              !isCorrect &&
                "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
            )}
          >
            {word.word}
            <sup className="ml-0.5 text-xs opacity-70">
              {Math.round(word.accuracyScore)}
            </sup>
            {hasError && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-2 text-[10px] px-1 py-0"
              >
                {ERROR_LABELS[word.errorType] ?? word.errorType}
              </Badge>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
