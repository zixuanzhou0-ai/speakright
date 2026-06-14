"use client";

import { Play } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UseAudioPlayerReturn } from "@/hooks/use-audio-player";
import {
  getChartWordPlaybackOptions,
  getSoundUnitHeaderPlaybackOptions,
} from "@/lib/audio-playback-policy";
import { shouldShowSoundUnitHeaderAudio } from "@/lib/language-source-alignment";
import { getSoundUnitCardLabel } from "@/lib/language-sound-unit-groups";
import {
  getCenteredCompactTextClassName,
  getCenteredMonoTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
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
  const displayWord = word ?? phoneme.example;
  const displayIpa = phoneme.chartIpa ?? phoneme.keywords[0]?.ipa;
  const image = phoneme.chartImage;
  const unitLabel = getSoundUnitCardLabel(phoneme);
  const languageId = phoneme.languageId ?? "en-US";
  const canPlayHeaderAudio = shouldShowSoundUnitHeaderAudio(
    languageId,
    phoneme,
  );
  const wordDensity = getPracticeTextDensity(displayWord ?? "", "word");
  const ipaDensity = getPracticeTextDensity(displayIpa ?? "", "phrase");

  const handlePlayPhoneme = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canPlayHeaderAudio) return;

    const playbackOptions = getSoundUnitHeaderPlaybackOptions({
      chartWord: word,
      phonemeAudio: phoneme.phonemeAudio,
    });
    if (!playbackOptions) return;

    if (word) {
      player.play(`/audio/ipa/phoneme/${word}.mp3`, playbackOptions);
      return;
    }

    if (phoneme.phonemeAudio?.localSrc) {
      player.play(phoneme.phonemeAudio.localSrc, playbackOptions);
    }
  };

  const handlePlayWord = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!word) return;
    const next = lastWordPlay === "slow" ? "normal" : "slow";
    setLastWordPlay(next);
    player.play(`/audio/ipa/${next}/${word}.mp3`, getChartWordPlaybackOptions());
  };

  return (
    <Link href={`/phonemes/${phoneme.slug}`} className="block">
      <Card className="relative h-full cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        {/* Top row: IPA + difficulty badge */}
        <div className="mb-4 flex flex-wrap items-start justify-center gap-2 text-center">
          <motion.span
            whileHover={canPlayHeaderAudio ? { scale: 1.08 } : undefined}
            whileTap={canPlayHeaderAudio ? { scale: 0.95 } : undefined}
            transition={springTransition}
            onClick={handlePlayPhoneme}
            className={`select-none font-mono text-4xl font-bold ${
              canPlayHeaderAudio ? "cursor-pointer" : "cursor-default"
            }`}
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
        <div className="mb-5 text-center">
          <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
            {unitLabel}
          </p>
          {phoneme.description && (
            <p className="mt-1 break-words text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              {phoneme.description}
            </p>
          )}
        </div>

        {/* Bottom: image + word + play */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
            {image && (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springTransition}
                onClick={handlePlayWord}
                className="relative h-12 w-12 shrink-0 cursor-pointer"
              >
                <Image
                  src={`/images/ipa/${image}.png`}
                  alt={word || ""}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </motion.div>
            )}
            <div className="min-w-0 text-center">
              {displayWord && (
                <p
                  className={`${getCenteredCompactTextClassName(
                    wordDensity,
                  )} font-semibold capitalize`}
                >
                  {displayWord}
                </p>
              )}
              {displayIpa && (
                <p
                  className={`${getCenteredMonoTextClassName(
                    ipaDensity,
                  )} font-mono text-muted-foreground`}
                >
                  {displayIpa}
                </p>
              )}
            </div>
          </div>
          {canPlayHeaderAudio && (
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              transition={springTransition}
              onClick={handlePlayPhoneme}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Play className="h-5 w-5" />
            </motion.div>
          )}
        </div>
      </Card>
    </Link>
  );
}
