"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UseAudioPlayerReturn } from "@/hooks/use-audio-player";
import type { Difficulty, PhonemeData } from "@/types/phoneme";

interface PhonemeCardProps {
  phoneme: PhonemeData;
  player: UseAudioPlayerReturn;
}

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 10,
} as const;

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "简单",
  medium: "中等",
  high: "困难",
};

const DIFFICULTY_VARIANT: Record<
  Difficulty,
  "secondary" | "outline" | "default"
> = {
  easy: "secondary",
  medium: "outline",
  high: "default",
};

export function PhonemeCard({ phoneme, player }: PhonemeCardProps) {
  const [lastWordPlay, setLastWordPlay] = useState<"normal" | "slow">("slow");

  const word = phoneme.chartWord;
  const image = phoneme.chartImage;

  const handlePlayPhoneme = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!word) return;
    player.play(`/audio/ipa/phoneme/${word}.mp3`);
  };

  const handlePlayWord = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!word) return;
    const next = lastWordPlay === "slow" ? "normal" : "slow";
    setLastWordPlay(next);
    player.play(`/audio/ipa/${next}/${word}.mp3`);
  };

  return (
    <Link href={`/phonemes/${phoneme.slug}`} className="block">
      <Card className="relative h-full cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        {/* Top row: IPA + difficulty badge */}
        <div className="mb-4 flex items-start justify-between">
          <motion.span
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            transition={springTransition}
            onClick={handlePlayPhoneme}
            className="cursor-pointer select-none font-mono text-4xl font-bold"
          >
            {phoneme.ipa}
          </motion.span>
          <Badge
            variant={DIFFICULTY_VARIANT[phoneme.difficulty]}
            className="text-xs"
          >
            {DIFFICULTY_LABEL[phoneme.difficulty]}
          </Badge>
        </div>

        {/* Category + description */}
        <div className="mb-5">
          <p className="text-sm font-semibold">
            {phoneme.category === "vowel" ? "元音" : "辅音"}
          </p>
          {phoneme.description && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground line-clamp-2">
              {phoneme.description}
            </p>
          )}
        </div>

        {/* Bottom: image + word + play */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {image && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springTransition}
                onClick={handlePlayWord}
                className="relative h-12 w-12 shrink-0 cursor-pointer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/ipa/${image}.png`}
                  alt={word || ""}
                  className="h-full w-full object-contain"
                />
              </motion.div>
            )}
            <div>
              {word && <p className="font-semibold capitalize">{word}</p>}
              {phoneme.chartIpa && (
                <p className="text-sm text-muted-foreground font-mono">
                  {phoneme.chartIpa}
                </p>
              )}
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            transition={springTransition}
            onClick={handlePlayPhoneme}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.div>
        </div>
      </Card>
    </Link>
  );
}
