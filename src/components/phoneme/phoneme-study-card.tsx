"use client";

import { ChevronLeft, ChevronRight, Loader2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { Button } from "@/components/ui/button";
import {
  type AudioPlaybackOptions,
  getChartWordPlaybackOptions,
} from "@/lib/audio-playback-policy";
import { getSpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";
import { getExactTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import {
  getSoundUnitSourceAlignment,
  shouldShowSoundUnitHeaderAudio,
  shouldShowLocalVideoAsPrimary,
} from "@/lib/language-source-alignment";
import {
  getCenteredMonoTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextPresentation,
} from "@/lib/practice-text-presentation";
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
  onPlayChartAudio: (path: string, options?: AudioPlaybackOptions) => void;
  onStopPlayback: () => void;
  onStopWordAudio: () => void;
  onStopChartAudio: () => void;
  wordHistoryLength: number;
  canGoPrevious?: boolean;
}

interface NonEnglishPracticeTaskProps {
  currentWord: KeywordEntry;
  practiceText: ReturnType<typeof getPracticeTextPresentation>;
  wordDirection: number;
  isWordActive: boolean;
  wordIsLoading: boolean;
  selectedVoice: "blue" | "pink";
  previousEnabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSetWordDirection: (dir: number) => void;
  onSetSelectedVoice: (voice: "blue" | "pink") => void;
  onPlayWord: (word: string, voice?: "blue" | "pink") => void;
  onStopPlayback: () => void;
  onStopChartAudio: () => void;
}

function NonEnglishPracticeTask({
  currentWord,
  practiceText,
  wordDirection,
  isWordActive,
  wordIsLoading,
  selectedVoice,
  previousEnabled,
  onPrevious,
  onNext,
  onSetWordDirection,
  onSetSelectedVoice,
  onPlayWord,
  onStopPlayback,
  onStopChartAudio,
}: NonEnglishPracticeTaskProps) {
  const primaryTextClassName = getCenteredReadableTextClassName(
    practiceText.density,
  );
  const secondaryTextClassName = getCenteredMonoTextClassName(
    practiceText.density,
  );

  return (
    <div
      className="mt-3 rounded-lg border bg-muted/15 px-3 py-3"
      data-practice-mode={practiceText.mode}
      data-smoke="non-english-practice-task"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          请朗读
        </span>
        <span className="text-xs text-muted-foreground">
          {practiceText.titleLabel}
        </span>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentWord.word}
            initial={{ x: wordDirection > 0 ? 80 : -80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: wordDirection > 0 ? -80 : 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex min-w-0 flex-col gap-2"
          >
            <motion.div
              animate={{ scale: isWordActive ? 1.02 : 1 }}
              data-smoke="practice-primary-text"
              className={`font-bold transition-colors ${primaryTextClassName} ${
                isWordActive ? "text-primary" : ""
              }`}
              style={{ textAlign: practiceText.textAlign }}
            >
              {practiceText.primaryText}
            </motion.div>
            {practiceText.secondaryText && (
              <div
                data-smoke="practice-secondary-text"
                className={`rounded-md bg-background/80 px-2.5 py-1.5 font-mono text-muted-foreground ${secondaryTextClassName}`}
                style={{ textAlign: practiceText.textAlign }}
              >
                {practiceText.secondaryText}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-2"
        data-smoke="practice-controls"
      >
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSetWordDirection(-1);
              onPrevious();
            }}
            disabled={!previousEnabled}
            className="h-8 w-8 shrink-0 rounded-full cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </motion.div>

        <div
          className="flex shrink-0 overflow-hidden rounded-full border bg-background/70 p-0.5"
          data-smoke="practice-voice-selector"
        >
          {(["blue", "pink"] as const).map((voice) => (
            <button
              type="button"
              key={voice}
              data-smoke={`practice-voice-${voice === "blue" ? "a" : "b"}`}
              aria-label={`使用${voice === "blue" ? "A" : "B"}声线`}
              title={`标准发音 ${voice === "blue" ? "A" : "B"}`}
              onClick={() => onSetSelectedVoice(voice)}
              className={`h-7 w-7 rounded-full text-[11px] font-semibold transition-colors ${
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
          data-smoke="practice-word-audio"
          aria-label="播放单词发音"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            onStopPlayback();
            onStopChartAudio();
            onPlayWord(currentWord.word, selectedVoice);
          }}
          disabled={wordIsLoading}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
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
            className="h-8 w-8 shrink-0 rounded-full cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
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
  const practiceText = getPracticeTextPresentation(
    currentWord,
    phoneme,
    languageProfile.id,
  );
  const isNonEnglish = practiceText.isNonEnglish;
  const isRulePracticeHeader = isNonEnglish && practiceText.mode === "rule";
  const headerParts = practiceText.titleLabel.split(" · ");
  const headerPrimary = isRulePracticeHeader
    ? (headerParts[1] ?? practiceText.titleLabel)
    : phoneme.ipa;
  const headerMeta = isRulePracticeHeader
    ? `${languageProfile.shortLabel} · ${headerParts[0] ?? "规则训练"}`
    : `${languageProfile.shortLabel} · ${
        isNonEnglish ? practiceText.titleLabel : phoneme.name
      }`;
  const showHeaderAudio = shouldShowSoundUnitHeaderAudio(
    languageProfile.id,
    phoneme,
  );
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
          <h1
            className={`font-bold ${
              isRulePracticeHeader
                ? "max-w-[12rem] break-words text-center text-lg leading-tight text-primary [overflow-wrap:anywhere]"
                : isNonEnglish
                  ? "max-w-[11rem] break-words text-center font-mono text-2xl leading-tight [overflow-wrap:anywhere]"
                  : "font-mono text-3xl text-center"
            }`}
          >
            {headerPrimary}
          </h1>
          {showHeaderAudio && (
            <span
              className="inline-flex shrink-0 items-center gap-3"
              data-smoke="sound-unit-header-audio"
            >
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
            </span>
          )}
          <p
            className={`min-w-0 flex-1 text-sm text-muted-foreground ${
              isNonEnglish
                ? "whitespace-normal break-words text-center leading-snug [overflow-wrap:anywhere]"
                : "whitespace-normal break-words text-center leading-snug [overflow-wrap:anywhere]"
            }`}
          >
            {headerMeta}
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
                onPlayChartAudio(
                  `/audio/ipa/${next}/${phoneme.chartWord}.mp3`,
                  getChartWordPlaybackOptions(),
                );
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
          isNonEnglish ? (
            <NonEnglishPracticeTask
              currentWord={currentWord}
              practiceText={practiceText}
              wordDirection={wordDirection}
              isWordActive={isWordActive}
              wordIsLoading={wordIsLoading}
              selectedVoice={selectedVoice}
              previousEnabled={previousEnabled}
              onPrevious={onPrevious}
              onNext={onNext}
              onSetWordDirection={onSetWordDirection}
              onSetSelectedVoice={setSelectedVoice}
              onPlayWord={onPlayWord}
              onStopPlayback={onStopPlayback}
              onStopChartAudio={onStopChartAudio}
            />
          ) : (
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
                    className={`font-bold transition-colors ${getCenteredReadableTextClassName(practiceText.density)} ${isWordActive ? "text-primary" : ""}`}
                  >
                    {displayWord}
                  </motion.span>
                  <span
                    className={`font-mono ${getCenteredMonoTextClassName(practiceText.density)} ${isWordActive ? "text-primary/70" : "text-muted-foreground"}`}
                  >
                    {currentWord.ipa}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            <div
              className="flex shrink-0 overflow-hidden rounded-full border bg-muted/30 p-0.5"
              data-smoke="practice-voice-selector"
            >
              {(["blue", "pink"] as const).map((voice) => (
                <button
                  type="button"
                  key={voice}
                  data-smoke={`practice-voice-${voice === "blue" ? "a" : "b"}`}
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
              data-smoke="practice-word-audio"
              aria-label="播放单词发音"
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
          )
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
