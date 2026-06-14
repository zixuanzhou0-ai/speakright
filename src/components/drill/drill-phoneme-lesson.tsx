"use client";

import { Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { PhonemePlayButton } from "@/components/phoneme/phoneme-play-button";
import { VideoPlayer } from "@/components/phoneme/video-player";
import { Button } from "@/components/ui/button";
import { getExactTeachingVideosForSoundUnit } from "@/lib/language-teaching-videos";
import {
  getSoundUnitSourceAlignment,
  shouldShowLocalVideoAsPrimary,
  shouldShowSoundUnitHeaderAudio,
} from "@/lib/language-source-alignment";
import { getSoundUnitCardLabel } from "@/lib/language-sound-unit-groups";
import {
  getCenteredCompactTextClassName,
  getCenteredMonoTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import { getSpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";
import type { PhonemeData } from "@/types/phoneme";

interface DrillPhonemeLessonProps {
  phoneme: PhonemeData;
  itemCount: number;
  kind: "word" | "sentence";
  onReady: () => void;
  onPlayExample: (word: string) => void;
  isPlayingExample: boolean;
  isLoadingExample: boolean;
}

export function DrillPhonemeLesson({
  phoneme,
  itemCount,
  kind,
  onReady,
  onPlayExample,
  isLoadingExample,
}: DrillPhonemeLessonProps) {
  const languageId = phoneme.languageId ?? "en-US";
  const hasLocalPhonemeAssets = languageId === "en-US";
  const hasExactLocalVideo = shouldShowLocalVideoAsPrimary(
    languageId,
    phoneme.slug,
  );
  const spanishVideoSet =
    languageId === "es-ES" && hasExactLocalVideo
      ? getSpanishSoundVideoSet(phoneme.slug)
      : undefined;
  const teachingVideos = getExactTeachingVideosForSoundUnit(
    languageId,
    phoneme.slug,
  );
  const sourceAlignment = getSoundUnitSourceAlignment(languageId, phoneme.slug);
  const showHeaderAudio = shouldShowSoundUnitHeaderAudio(languageId, phoneme);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Video */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card shadow-sm overflow-hidden"
      >
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
      </motion.div>

      {/* Phoneme info card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-card p-6 shadow-sm space-y-4"
      >
        {/* IPA + play + name */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-center">
          <span className="max-w-full break-words text-center font-mono text-4xl font-bold [overflow-wrap:anywhere]">
            {phoneme.ipa}
          </span>
          {showHeaderAudio && (
            <PhonemePlayButton
              chartWord={hasLocalPhonemeAssets ? phoneme.chartWord : undefined}
              phonemeAudio={
                hasLocalPhonemeAssets ? undefined : phoneme.phonemeAudio
              }
            />
          )}
          <div className="min-w-0 flex-1 text-center">
            <p className="break-words text-center text-sm font-medium [overflow-wrap:anywhere]">
              {phoneme.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {getSoundUnitCardLabel(phoneme)} ·{" "}
              {phoneme.difficulty === "easy"
                ? "简单"
                : phoneme.difficulty === "medium"
                  ? "中等"
                  : "困难"}
            </p>
          </div>
        </div>

        {/* Chinese pronunciation guidance */}
        {phoneme.description && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
            <p className="text-sm font-medium text-primary mb-1">发音要领</p>
            <p className="text-center text-sm leading-relaxed">
              {phoneme.description}
            </p>
          </div>
        )}

        {/* Example words to listen */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            示例单词（点击听发音）
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {phoneme.keywords.slice(0, 6).map((kw) => {
              const density = getPracticeTextDensity(kw.word);

              return (
                <motion.button
                  key={kw.word}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPlayExample(kw.word)}
                  disabled={isLoadingExample}
                  className="flex max-w-full items-center justify-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5 text-center text-sm transition-colors hover:bg-primary/10 hover:border-primary/30 cursor-pointer disabled:opacity-50"
                >
                  <Volume2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span
                    className={`font-medium ${getCenteredCompactTextClassName(density)}`}
                  >
                    {kw.word}
                  </span>
                  <span
                    className={`font-mono text-muted-foreground ${getCenteredMonoTextClassName(density)}`}
                  >
                    {kw.ipa}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Start drill button */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-center border-t">
          <p className="text-center text-sm text-muted-foreground">
            准备好了？接下来将练习 {itemCount} 个
            {kind === "word" ? "单词" : "句子"}
          </p>
          <Button onClick={onReady} size="lg" className="cursor-pointer">
            开始练习
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
