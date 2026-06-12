"use client";

import { ChevronLeft, ChevronRight, Loader2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { Button } from "@/components/ui/button";
import { getSpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";
import { getExactTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import {
  getSoundUnitSourceAlignment,
  shouldShowLocalVideoAsPrimary,
} from "@/lib/language-source-alignment";
import type { LanguageProfile } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

interface PhonemeStudyCardProps {
  phoneme: PhonemeData;
  languageProfile: LanguageProfile;
  currentWord: KeywordEntry | null;
  wordDirection: number;
  wordPoolSize: number;
  practicedCount: number;
  isWordActive: boolean;
  wordIsLoading: boolean;
  lastChartPlay: "normal" | "slow";
  onPrevious: () => void;
  onNext: () => void;
  onSetWordDirection: (dir: number) => void;
  onSetLastChartPlay: (play: "normal" | "slow") => void;
  onPlayWord: (word: string, voice?: "blue" | "pink") => void;
  onPlayChartAudio: (path: string) => void;
  onStopPlayback: () => void;
  onStopWordAudio: () => void;
  onStopChartAudio: () => void;
  wordHistoryLength: number;
  canGoPrevious?: boolean;
}

export function PhonemeStudyCard({
  phoneme,
  languageProfile,
  currentWord,
  wordDirection,
  wordPoolSize,
  practicedCount,
  isWordActive,
  wordIsLoading,
  lastChartPlay,
  onPrevious,
  onNext,
  onSetWordDirection,
  onSetLastChartPlay,
  onPlayWord,
  onPlayChartAudio,
  onStopPlayback,
  onStopWordAudio,
  onStopChartAudio,
  wordHistoryLength,
  canGoPrevious,
}: PhonemeStudyCardProps) {
  const hasLocalPhonemeAssets = phoneme.languageId === "en-US";
  const displayWord = currentWord?.stressText ?? currentWord?.word;
  const previousEnabled = canGoPrevious ?? wordHistoryLength > 0;
  const [selectedVoice, setSelectedVoice] = useState<"blue" | "pink">("blue");
  const spanishVideoSet =
    phoneme.languageId === "es-ES" &&
    shouldShowLocalVideoAsPrimary(phoneme.languageId, phoneme.slug)
      ? getSpanishSoundVideoSet(phoneme.slug)
      : undefined;
  const teachingVideos = getExactTeachingVideosForSoundUnit(
    phoneme.languageId ?? "en-US",
    phoneme.slug,
  );
  const sourceAlignment = getSoundUnitSourceAlignment(
    phoneme.languageId ?? "en-US",
    phoneme.slug,
  );
  const hasExactLocalVideo = shouldShowLocalVideoAsPrimary(
    phoneme.languageId ?? "en-US",
    phoneme.slug,
  );

  return (
    <div className="shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden">
      <VideoPlayer
        slug={phoneme.slug}
        available={phoneme.video?.status === "ready" && hasExactLocalVideo}
        label={phoneme.video?.label}
        localSrc={phoneme.video?.localSrc}
        resources={phoneme.teachingResources}
        spanishVideoSet={spanishVideoSet}
        teachingVideos={teachingVideos}
        sourceAlignment={sourceAlignment ?? undefined}
      />
      <div className="px-4 py-3">
        {/* IPA + play + emoji */}
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-3xl font-bold">{phoneme.ipa}</h1>
          <PhonemePlayButton
            chartWord={hasLocalPhonemeAssets ? phoneme.chartWord : undefined}
            phonemeAudio={
              hasLocalPhonemeAssets ? undefined : phoneme.phonemeAudio
            }
            onBeforePlay={() => {
              onStopPlayback();
              onStopWordAudio();
              onStopChartAudio();
            }}
          />
          <span className="text-muted-foreground/30">|</span>
          <p className="text-sm text-muted-foreground flex-1 truncate">
            {languageProfile.shortLabel} · {phoneme.name}
          </p>
          {hasLocalPhonemeAssets && phoneme.chartImage && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={() => {
                if (!phoneme.chartWord) return;
                onStopPlayback();
                onStopWordAudio();
                const next = lastChartPlay === "slow" ? "normal" : "slow";
                onSetLastChartPlay(next);
                onPlayChartAudio(`/audio/ipa/${next}/${phoneme.chartWord}.mp3`);
              }}
              className="flex shrink-0 flex-col items-center cursor-pointer"
            >
              <Image
                src={`/images/ipa/${phoneme.chartImage}.png`}
                alt={phoneme.chartWord || ""}
                width={32}
                height={32}
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
                disabled={!previousEnabled}
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
                  className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1"
                >
                  <motion.span
                    animate={{ scale: isWordActive ? 1.05 : 1 }}
                    className={`max-w-full truncate text-center text-xl font-bold leading-tight transition-colors sm:text-2xl ${isWordActive ? "text-primary" : ""}`}
                  >
                    {displayWord}
                  </motion.span>
                  <span
                    className={`max-w-full break-all text-center font-mono text-xs leading-tight sm:text-sm ${isWordActive ? "text-primary/70" : "text-muted-foreground"}`}
                  >
                    {currentWord.ipa}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex shrink-0 overflow-hidden rounded-full border bg-muted/30 p-0.5">
              {(["blue", "pink"] as const).map((voice) => (
                <button
                  type="button"
                  key={voice}
                  aria-label={`使用${voice === "blue" ? "A" : "B"}声线`}
                  title={`标准发音 ${voice === "blue" ? "A" : "B"}`}
                  onClick={() => setSelectedVoice(voice)}
                  className={`h-6 w-6 rounded-full text-[11px] font-semibold transition-colors ${
                    selectedVoice === voice
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-background"
                  }`}
                >
                  {voice === "blue" ? "A" : "B"}
                </button>
              ))}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onStopPlayback();
                onStopChartAudio();
                onPlayWord(currentWord.word, selectedVoice);
              }}
              disabled={wordIsLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full cursor-pointer hover:bg-primary/10 hover:text-primary text-muted-foreground disabled:opacity-50"
            >
              {wordIsLoading ? (
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

        {/* Progress */}
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">
            已练 {practicedCount}/{wordPoolSize}
          </span>
        </div>
      </div>
    </div>
  );
}
