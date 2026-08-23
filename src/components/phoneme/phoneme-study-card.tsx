"use client";

import { ChevronLeft, ChevronRight, Loader2, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { type ReactNode, useState } from "react";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { Button } from "@/components/ui/button";
import {
  type AudioPlaybackOptions,
  getChartWordPlaybackOptions,
} from "@/lib/audio-playback-policy";
import {
  getSoundUnitSourceAlignment,
  shouldShowLocalVideoAsPrimary,
  shouldShowSoundUnitHeaderAudio,
} from "@/lib/language-source-alignment";
import { getExactTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import {
  getCenteredMonoTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextPresentation,
} from "@/lib/practice-text-presentation";
import { getSpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";
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
  wordAudioError?: string | null;
  chartAudioError?: string | null;
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
  guidedRepeatAction?: ReactNode;
}

interface NonEnglishPracticeTaskProps {
  currentWord: KeywordEntry;
  practiceText: ReturnType<typeof getPracticeTextPresentation>;
  wordDirection: number;
  isWordActive: boolean;
  wordIsLoading: boolean;
  audioError?: string | null;
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

interface VoicePlaybackControlProps {
  selectedVoice: "blue" | "pink";
  isLoading: boolean;
  audioLabel: string;
  voiceTitlePrefix: string;
  onSelectVoice: (voice: "blue" | "pink") => void;
  onPlay: () => void;
}

function VoicePlaybackControl({
  selectedVoice,
  isLoading,
  audioLabel,
  voiceTitlePrefix,
  onSelectVoice,
  onPlay,
}: VoicePlaybackControlProps) {
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-full border bg-muted/30 p-0.5 shadow-xs"
      data-smoke="practice-voice-playback-cluster"
    >
      <div
        className="flex shrink-0 overflow-hidden rounded-full"
        data-smoke="practice-voice-selector"
      >
        {(["blue", "pink"] as const).map((voice) => (
          <button
            type="button"
            key={voice}
            data-smoke={`practice-voice-${voice === "blue" ? "a" : "b"}`}
            aria-label={`使用${voice === "blue" ? "A" : "B"}声线`}
            title={`${voiceTitlePrefix} ${voice === "blue" ? "A" : "B"}`}
            onClick={() => onSelectVoice(voice)}
            className={`h-11 w-11 rounded-full text-[11px] font-semibold transition-colors ${
              selectedVoice === voice
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background"
            }`}
          >
            {voice === "blue" ? "A" : "B"}
          </button>
        ))}
      </div>

      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />

      <motion.button
        type="button"
        data-smoke="practice-word-audio"
        aria-label={audioLabel}
        title={audioLabel}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onPlay}
        disabled={isLoading}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full cursor-pointer text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Volume2 className="h-5 w-5" />
        )}
      </motion.button>
    </div>
  );
}

function NonEnglishPracticeTask({
  currentWord,
  practiceText,
  wordDirection,
  isWordActive,
  wordIsLoading,
  audioError,
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
  const audioLabel =
    practiceText.mode === "word"
      ? "播放单词练习示范"
      : practiceText.mode === "phrase"
        ? "播放短语练习示范"
        : practiceText.mode === "sentence"
          ? "播放句子练习示范"
          : practiceText.density === "sentence"
            ? "播放规则句子示范"
            : "播放规则练习示范";

  return (
    <div
      className="mt-2 rounded-lg border bg-muted/15 px-3 py-2.5"
      data-practice-mode={practiceText.mode}
      data-smoke="non-english-practice-task"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
        className="mt-2 flex flex-wrap items-center justify-center gap-2"
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
            aria-label="上一个示例词"
            className="min-h-11 min-w-11 shrink-0 rounded-full cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </motion.div>

        <VoicePlaybackControl
          selectedVoice={selectedVoice}
          isLoading={wordIsLoading}
          audioLabel={audioLabel}
          voiceTitlePrefix="练习示范"
          onSelectVoice={onSetSelectedVoice}
          onPlay={() => {
            onStopPlayback();
            onStopChartAudio();
            onPlayWord(currentWord.word, selectedVoice);
          }}
        />

        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onSetWordDirection(1);
              onNext();
            }}
            aria-label="下一个示例词"
            data-smoke="phoneme-next-word"
            className="min-h-11 min-w-11 shrink-0 rounded-full cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
      {audioError && (
        <p
          role="alert"
          data-smoke="practice-word-audio-error"
          className="mt-2 break-words text-center text-xs text-destructive [overflow-wrap:anywhere]"
        >
          {audioError}
        </p>
      )}
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
  wordAudioError,
  chartAudioError,
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
  guidedRepeatAction,
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
        compact
      />
      <div className="px-3 py-2.5">
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
                chartWord={
                  hasLocalPhonemeAssets ? phoneme.chartWord : undefined
                }
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
              audioError={wordAudioError}
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
            <>
              <div className="mt-2 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-x-2 gap-y-1.5">
                <motion.div
                  className="col-start-1 row-start-1"
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onSetWordDirection(-1);
                      onPrevious();
                    }}
                    disabled={!previousEnabled}
                    aria-label="上一个示例词"
                    className="min-h-11 min-w-11 shrink-0 rounded-full cursor-pointer disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </motion.div>

                <div className="relative col-start-2 row-start-1 min-w-0 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={currentWord.word}
                      initial={{
                        x: wordDirection > 0 ? 120 : -120,
                        opacity: 0,
                      }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{
                        x: wordDirection > 0 ? -120 : 120,
                        opacity: 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                      className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-1"
                    >
                      <motion.span
                        animate={{ scale: isWordActive ? 1.05 : 1 }}
                        className={`whitespace-nowrap font-bold transition-colors ${getCenteredReadableTextClassName(practiceText.density)} ${isWordActive ? "text-primary" : ""}`}
                        data-smoke="phoneme-current-word"
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
                  className="col-start-2 row-start-2 justify-self-center"
                  data-smoke="practice-voice-control-row"
                >
                  <VoicePlaybackControl
                    selectedVoice={selectedVoice}
                    isLoading={wordIsLoading}
                    audioLabel="播放单词发音"
                    voiceTitlePrefix="标准发音"
                    onSelectVoice={setSelectedVoice}
                    onPlay={() => {
                      onStopPlayback();
                      onStopChartAudio();
                      onPlayWord(currentWord.word, selectedVoice);
                    }}
                  />
                </div>

                <motion.div
                  className="col-start-3 row-start-1"
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      onSetWordDirection(1);
                      onNext();
                    }}
                    aria-label="下一个示例词"
                    data-smoke="phoneme-next-word"
                    className="min-h-11 min-w-11 shrink-0 rounded-full cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>

              {wordAudioError && (
                <p
                  role="alert"
                  data-smoke="practice-word-audio-error"
                  className="mt-2 break-words text-center text-xs text-destructive [overflow-wrap:anywhere]"
                >
                  {wordAudioError}
                </p>
              )}
              {chartAudioError && (
                <p
                  role="alert"
                  data-smoke="practice-chart-audio-error"
                  className="mt-2 break-words text-center text-xs text-destructive [overflow-wrap:anywhere]"
                >
                  {chartAudioError}
                </p>
              )}
            </>
          )
        ) : (
          <div className="mt-3 h-8" />
        )}

        {guidedRepeatAction && (
          <div className="mt-2 flex justify-center">{guidedRepeatAction}</div>
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
