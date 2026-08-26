"use client";

import { Loader2, RotateCcw, Settings2, Target, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ReadAlongText } from "@/components/audio/read-along-text";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useStandardTtsConfig } from "@/hooks/use-api-keys";
import type { FreePracticeTargetPreview } from "@/lib/free-practice-transfer";
import {
  getCenteredMonoTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import { formatTrainingTargetUnit } from "@/lib/training-criteria";
import type { LanguageId } from "@/types/language";

const MAX_CHARS = 150;
const WARN_CHARS = 120;
const WRAP_SAFE_BADGE_CLASS =
  "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

interface SentenceInputCardProps {
  sentence: string;
  onSentenceChange: (value: string) => void;
  speed: number;
  onSpeedChange: (value: number) => void;
  languageId?: LanguageId;
  isWordMode: boolean;
  trimmedText: string;
  wordIpa: string | null;
  hasPlayedWord: boolean;
  // Word pronunciation
  wordAudioIsPlaying: boolean;
  wordAudioIsLoading: boolean;
  wordAudioError?: string | null;
  onWordAudioPlay: (word: string) => void;
  // TTS
  ttsIsPlaying: boolean;
  ttsIsLoading: boolean;
  ttsHasAudio?: boolean;
  ttsError: string | null;
  ttsWordTimings: { word: string; start: number; end: number }[];
  ttsCurrentTime: number;
  onTtsReplay: () => void;
  targetPreview?: FreePracticeTargetPreview | null;
  // Actions
  onListen: () => void;
}

export function SentenceInputCard({
  sentence,
  onSentenceChange,
  speed,
  onSpeedChange,
  languageId = "en-US",
  isWordMode,
  trimmedText,
  wordIpa,
  hasPlayedWord,
  wordAudioIsPlaying,
  wordAudioIsLoading,
  wordAudioError,
  onWordAudioPlay,
  ttsIsPlaying,
  ttsIsLoading,
  ttsHasAudio = false,
  ttsError,
  ttsWordTimings,
  ttsCurrentTime,
  onTtsReplay,
  targetPreview,
  onListen,
}: SentenceInputCardProps) {
  const standardTts = useStandardTtsConfig();
  const ttsProviderLabel =
    standardTts.provider === "hermes-grok"
      ? "爱马仕 Grok TTS"
      : standardTts.provider === "vertex-gemini"
        ? "Vertex Gemini TTS"
        : standardTts.provider === "minimax"
          ? "MiniMax Speech 2.8"
          : standardTts.provider === "mimo"
            ? "小米 MiMo V2.5 TTS"
            : "ElevenLabs";

  const charCount = sentence.length;
  const trimmedTextDensity = getPracticeTextDensity(
    trimmedText,
    isWordMode ? "word" : "sentence",
  );
  const ipaDensity = getPracticeTextDensity(wordIpa ?? "", "phrase");
  const modeHelpText = isWordMode
    ? languageId === "en-US"
      ? "单词模式 · 本地音频优先，有道兜底"
      : "单词模式 · 本地语言包音频优先，无本地条目时不会用在线音频冒充"
    : `句子模式 · 发音来自 ${ttsProviderLabel}`;

  return (
    <div
      className="shrink-0 space-y-3 rounded-xl border bg-card px-4 py-4 shadow-sm"
      data-smoke="sentence-input-card"
      data-tts-provider={standardTts.provider}
      data-tts-state={
        ttsIsLoading
          ? "loading"
          : ttsIsPlaying
            ? "playing"
            : ttsError
              ? "error"
              : ttsHasAudio
                ? "ready"
                : "idle"
      }
    >
      <div
        className="flex flex-wrap items-start justify-center gap-3"
        data-smoke="sentence-input-actions"
      >
        <div className="min-w-[min(100%,16rem)] flex-1">
          <Textarea
            suppressHydrationWarning
            aria-label="练习文本"
            placeholder="输入单词或句子"
            value={sentence}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                onSentenceChange(e.target.value);
              }
            }}
            maxLength={MAX_CHARS}
            rows={4}
            className="h-[100px] resize-none text-lg"
          />
          <div
            className="mt-1 flex min-h-4 justify-end px-1"
            data-smoke="free-practice-character-count"
          >
            <span
              suppressHydrationWarning
              className={`text-xs tabular-nums ${
                charCount >= MAX_CHARS
                  ? "font-semibold text-red-500"
                  : charCount >= WARN_CHARS
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
            >
              {charCount}/{MAX_CHARS}
            </span>
          </div>
        </div>
        {isWordMode ? (
          <div className="relative flex h-[100px] w-[100px] shrink-0 items-center justify-center self-center sm:self-auto">
            {wordAudioIsPlaying && (
              <>
                <motion.span
                  className="absolute rounded-full border-2 border-primary/40"
                  initial={{ width: 50, height: 50, opacity: 0.6 }}
                  animate={{ width: 100, height: 100, opacity: 0 }}
                  transition={{
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeOut",
                  }}
                />
                <motion.span
                  className="absolute rounded-full border-2 border-primary/30"
                  initial={{ width: 50, height: 50, opacity: 0.5 }}
                  animate={{ width: 100, height: 100, opacity: 0 }}
                  transition={{
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeOut",
                    delay: 0.4,
                  }}
                />
                <motion.span
                  className="absolute rounded-full border-2 border-primary/20"
                  initial={{ width: 50, height: 50, opacity: 0.4 }}
                  animate={{ width: 100, height: 100, opacity: 0 }}
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
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              onClick={onListen}
              disabled={!trimmedText || wordAudioIsLoading}
              aria-label="播放单词发音"
              data-smoke="free-practice-listen-control"
              className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wordAudioIsLoading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Volume2 className="h-8 w-8" />
              )}
            </motion.button>
          </div>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onClick={onListen}
            disabled={!trimmedText || ttsIsLoading || ttsIsPlaying}
            aria-label="听标准发音"
            data-smoke="free-practice-listen-control"
            className="flex h-[100px] w-[100px] shrink-0 flex-col items-center justify-center gap-2 self-center rounded-xl bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer sm:self-auto"
          >
            {ttsIsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Volume2 className="h-8 w-8" />
            )}
            <span className="text-xs font-medium">
              {ttsIsPlaying ? "播放中..." : "听标准发音"}
            </span>
          </motion.button>
        )}
      </div>

      {!isWordMode && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
          data-smoke="free-practice-tts-provider-shortcut"
        >
          <span className="text-xs font-medium text-muted-foreground">
            当前标准示范
          </span>
          <Link
            href="/settings?section=services#standard-tts"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-9"
            aria-label={`当前标准示范为 ${ttsProviderLabel}，前往更换`}
          >
            {ttsProviderLabel}
            <Settings2 className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {trimmedText && isWordMode && (
        <p className="text-xs text-muted-foreground/70">{modeHelpText}</p>
      )}

      {isWordMode && wordAudioError && (
        <p
          role="alert"
          data-smoke="free-practice-word-audio-error"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {wordAudioError}
        </p>
      )}

      {trimmedText && targetPreview && (
        <TargetPreviewPanel preview={targetPreview} />
      )}

      <AnimatePresence>
        {!isWordMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">
                语速
              </span>
              <Slider
                min={0.7}
                max={1.2}
                step={0.05}
                value={[speed]}
                ariaLabel="语速"
                onValueChange={(val) =>
                  onSpeedChange(Array.isArray(val) ? val[0] : val)
                }
                className="flex-1"
              />
              <span className="text-sm font-medium tabular-nums w-10 text-right">
                {speed.toFixed(2)}x
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {ttsError && (
        <p
          role="alert"
          data-smoke="free-practice-tts-error"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {ttsError}
        </p>
      )}

      {trimmedText && (
        <AnimatePresence mode="wait">
          {isWordMode ? (
            <motion.div
              key="word-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                data-smoke="free-practice-word-card"
                data-playing={wordAudioIsPlaying ? "true" : "false"}
                className={`relative flex flex-col items-center gap-1 rounded-lg border px-6 py-5 transition-colors duration-300 ${
                  wordAudioIsPlaying
                    ? "border-primary/30 bg-primary/10"
                    : "bg-muted/30"
                }`}
              >
                <span
                  className={`${getCenteredReadableTextClassName(
                    trimmedTextDensity,
                  )} font-ipa font-bold text-primary`}
                >
                  {trimmedText}
                </span>
                {wordIpa && (
                  <span
                    className={`${getCenteredMonoTextClassName(
                      ipaDensity,
                    )} font-ipa text-muted-foreground`}
                  >
                    {wordIpa}
                  </span>
                )}
                {hasPlayedWord && !wordAudioIsPlaying && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    onClick={() => onWordAudioPlay(trimmedText)}
                    aria-label="重听单词发音"
                    data-smoke="free-practice-word-replay"
                    className="absolute right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer sm:h-7 sm:w-7"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </motion.button>
                )}
              </motion.div>
            </motion.div>
          ) : (
            (ttsIsPlaying || (!ttsIsLoading && ttsHasAudio)) && (
              <motion.div
                key="sentence-karaoke"
                initial={{ height: 0, opacity: 0, y: 8 }}
                animate={{ height: "auto", opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="overflow-hidden"
                data-smoke="free-practice-tts-output"
              >
                <div className="relative">
                  <ReadAlongText
                    text={trimmedText}
                    wordTimings={ttsWordTimings}
                    isPlaying={ttsIsPlaying}
                    currentTime={ttsCurrentTime}
                    reserveReplaySpace={ttsHasAudio || ttsIsPlaying}
                  />
                  {!ttsIsPlaying && !ttsIsLoading && ttsHasAudio && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                      onClick={onTtsReplay}
                      aria-label="重听标准发音"
                      data-smoke="free-practice-tts-replay"
                      className="absolute right-2 bottom-2 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer sm:h-7 sm:w-7"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function TargetPreviewPanel({
  preview,
}: {
  preview: FreePracticeTargetPreview;
}) {
  if (preview.targets.length === 0 && preview.suggestions.length === 0) {
    return null;
  }

  if (preview.targets.length > 0) {
    return (
      <div className="rounded-lg border bg-primary/5 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-center">
          <Target className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">
            这句话命中当前目标
          </p>
        </div>
        <div className="space-y-2">
          {preview.targets.map((target) => (
            <div key={target.packId} className="text-sm">
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
                <Badge
                  variant={target.source === "review" ? "default" : "secondary"}
                  className={WRAP_SAFE_BADGE_CLASS}
                  data-smoke="free-practice-target-pack-badge"
                >
                  {target.packTitle}
                </Badge>
                <span className="break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  目标音{" "}
                  {target.targetPhonemes
                    .map(formatTrainingTargetUnit)
                    .join(" – ")}
                </span>
              </div>
              <p className="mt-1 break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">
                命中词：{target.matchedWords.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const suggestion = preview.suggestions[0];
  if (!suggestion) return null;

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-center">
        <Target className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">
          当前句子还没命中今日目标
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
        <Badge
          variant="outline"
          className={WRAP_SAFE_BADGE_CLASS}
          data-smoke="free-practice-suggestion-pack-badge"
        >
          {suggestion.packTitle}
        </Badge>
        {suggestion.words.map((word) => (
          <Badge
            key={word}
            variant="secondary"
            className={WRAP_SAFE_BADGE_CLASS}
            data-smoke="free-practice-suggestion-word"
          >
            {word}
          </Badge>
        ))}
      </div>
      <p className="mt-2 break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">
        可参考：{suggestion.prompt}
      </p>
    </div>
  );
}
