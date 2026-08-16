"use client";

import { Play } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { UseAudioPlayerReturn } from "@/hooks/use-audio-player";
import {
  getChartWordPlaybackOptions,
  getEnglishHeaderPhonemeAudioSrc,
  getSoundUnitHeaderPlaybackOptions,
  isKnownEnglishChartAudioStem,
} from "@/lib/audio-playback-policy";
import {
  getPhonologyInventoryEntry,
  getPhonologyAudioStatusLabel,
  getPhonologyLayerLabel,
  getPhonologyTilePolicyLabel,
} from "@/lib/language-phonology-inventory";
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
  const wordAudioPlayable = isKnownEnglishChartAudioStem(word);
  const unitLabel = getSoundUnitCardLabel(phoneme);
  const languageId = phoneme.languageId ?? "en-US";
  const inventoryEntry =
    languageId !== "en-US"
      ? getPhonologyInventoryEntry(languageId, phoneme.slug)
      : undefined;
  const canPlayHeaderAudio = shouldShowSoundUnitHeaderAudio(
    languageId,
    phoneme,
  );
  const headerPlaybackOptions = canPlayHeaderAudio
    ? getSoundUnitHeaderPlaybackOptions({
        chartWord: word,
        phonemeAudio: phoneme.phonemeAudio,
      })
    : undefined;
  const chartAudioSrc = getEnglishHeaderPhonemeAudioSrc(word);
  const headerAudioSrc = headerPlaybackOptions
    ? (chartAudioSrc ?? phoneme.phonemeAudio?.localSrc ?? "")
    : "";
  const headerAudioPlayable = Boolean(headerAudioSrc && headerPlaybackOptions);
  const headerAudioKind = headerAudioPlayable
    ? chartAudioSrc
      ? "chart"
      : "sound-unit"
    : "none";
  const headerAudioData = {
    "data-audio-playable": headerAudioPlayable ? "true" : "false",
    "data-audio-kind": headerAudioKind,
    "data-audio-src": headerAudioSrc,
    "data-audio-start-ms": headerPlaybackOptions?.startMs?.toString() ?? "",
    "data-audio-max-duration-ms":
      headerPlaybackOptions?.maxDurationMs?.toString() ?? "",
    "data-audio-fade-out-ms":
      headerPlaybackOptions?.fadeOutMs?.toString() ?? "",
  };
  const wordDensity = getPracticeTextDensity(displayWord ?? "", "word");
  const ipaDensity = getPracticeTextDensity(displayIpa ?? "", "phrase");

  const playHeaderAudio = () => {
    if (!headerAudioPlayable || !headerPlaybackOptions) return;
    player.play(headerAudioSrc, headerPlaybackOptions);
  };

  const handlePlayPhoneme = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playHeaderAudio();
  };

  const handlePlayWord = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!wordAudioPlayable) return;
    const next = lastWordPlay === "slow" ? "normal" : "slow";
    setLastWordPlay(next);
    player.play(`/audio/ipa/${next}/${word}.mp3`, getChartWordPlaybackOptions());
  };

  return (
    <Card className="relative h-full cursor-pointer p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <Link
        href={`/phonemes/${phoneme.slug}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        aria-label={`学习音标 ${phoneme.ipa}，示例词 ${displayWord}`}
      />
      <div className="pointer-events-none relative z-10">
        {/* Top row: IPA + difficulty badge */}
        <div className="mb-4 flex flex-wrap items-start justify-center gap-2 text-center">
          {headerAudioPlayable ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={springTransition}
              onClick={handlePlayPhoneme}
              className="pointer-events-auto select-none font-mono text-4xl font-bold cursor-pointer"
              data-smoke="phoneme-card-ipa-audio"
          aria-label={`播放音标 ${phoneme.ipa}`}
              aria-disabled={false}
              {...headerAudioData}
            >
              {phoneme.ipa}
            </motion.button>
          ) : (
            <span
              className="select-none cursor-default font-mono text-4xl font-bold"
              data-smoke="phoneme-card-ipa-audio"
              aria-disabled={true}
              tabIndex={-1}
              {...headerAudioData}
            >
              {phoneme.ipa}
            </span>
          )}
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
          {inventoryEntry && (
            <div
              className="mt-2 flex flex-wrap items-center justify-center gap-1.5"
              data-smoke="phonology-inventory-card-badges"
              data-phonology-layer={inventoryEntry.layer}
              data-audio-status={inventoryEntry.audioStatus}
              data-tile-policy={inventoryEntry.tilePolicy}
            >
              <Badge variant="outline" className="text-[10px]">
                实验
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {getPhonologyLayerLabel(inventoryEntry.layer)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                音频：{getPhonologyAudioStatusLabel(inventoryEntry.audioStatus)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                拆解：{getPhonologyTilePolicyLabel(inventoryEntry.tilePolicy)}
              </Badge>
            </div>
          )}
        </div>

        {/* Bottom: image + word + play */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
            {image && wordAudioPlayable ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={springTransition}
                onClick={handlePlayWord}
                className="pointer-events-auto relative h-12 w-12 shrink-0 cursor-pointer"
                aria-label={`播放示例词 ${word}`}
              >
                <Image
                  src={`/images/ipa/${image}.png`}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </motion.button>
            ) : image ? (
              <div className="relative h-12 w-12 shrink-0">
                <Image
                  src={`/images/ipa/${image}.png`}
                  alt={word || ""}
                  width={48}
                  height={48}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
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
          {headerAudioPlayable && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              transition={springTransition}
              onClick={handlePlayPhoneme}
              className="pointer-events-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted transition-colors hover:bg-primary hover:text-primary-foreground"
              data-smoke="phoneme-card-header-audio-button"
              aria-label={`再次播放音标 ${phoneme.ipa}`}
              aria-disabled={false}
              {...headerAudioData}
            >
              <Play className="h-5 w-5" />
            </motion.button>
          )}
        </div>
      </div>
    </Card>
  );
}
