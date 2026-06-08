"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { LanguageModuleGate } from "@/components/common/language-module-gate";
import { DrillConfig } from "@/components/drill/drill-config";
import { DrillFeedback } from "@/components/drill/drill-feedback";
import { DrillPhonemeLesson } from "@/components/drill/drill-phoneme-lesson";
import { DrillRecording } from "@/components/drill/drill-recording";
import { DrillSummaryCard } from "@/components/drill/drill-summary";
import { DrillTeaching } from "@/components/drill/drill-teaching";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useDrillSession } from "@/hooks/use-drill-session";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";
import { buildWordDrillItems } from "@/lib/drill-utils";
import { getLanguagePhonemeBySlug } from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import { getPhonemeBySlug } from "@/lib/phoneme-data";
import type { LanguageId } from "@/types/language";

export default function WordDrillPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const drill = useDrillSession({
    azureLocale: languageProfile.azureLocale,
    scoreHistoryPrefix: languageId,
  });
  const mw = useMwPronunciation();

  const handleStart = useCallback(
    (phonemeSlug: string, itemCount: number, passThreshold: number) => {
      const phoneme =
        getLanguagePhonemeBySlug(languageId, phonemeSlug) ??
        getPhonemeBySlug(phonemeSlug);
      if (!phoneme) return;

      const items = buildWordDrillItems(phoneme, itemCount);
      drill.start(
        { kind: "word", phonemeSlug, itemCount, passThreshold },
        items,
      );
    },
    [drill, languageId],
  );

  const handlePlayReference = useCallback(() => {
    if (drill.phase.type === "teaching" || drill.phase.type === "feedback") {
      const item = "item" in drill.phase ? drill.phase.item : null;
      if (item) mw.playWord(item.text, "blue", languageId);
    }
  }, [drill.phase, mw, languageId]);

  const handleRestart = useCallback(() => {
    if (!drill.config) return;
    handleStart(
      drill.config.phonemeSlug,
      drill.config.itemCount,
      drill.config.passThreshold,
    );
  }, [drill.config, handleStart]);

  return (
    <LanguageModuleGate moduleName="单词训练" readinessKey="wordPractice">
      <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">单词训练</h1>
        {drill.config &&
          drill.phase.type !== "configuring" &&
          drill.phase.type !== "completed" && (
            <span className="text-sm text-muted-foreground">
              {getPhonemeBySlug(drill.config.phonemeSlug)?.ipa}
            </span>
          )}
      </div>

      {/* State machine-driven content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {drill.phase.type === "configuring" && (
          <DrillConfig kind="word" onStart={handleStart} />
        )}

        {drill.phase.type === "phonemeLesson" && drill.config && (
          <PhonemeLessonView
            config={drill.config}
            onReady={drill.finishPhonemeLesson}
            mw={mw}
            languageId={languageId}
          />
        )}

        {drill.phase.type === "teaching" && (
          <DrillTeaching
            item={drill.phase.item}
            index={drill.phase.index}
            total={drill.items.length}
            isPlaying={mw.isPlaying}
            isLoading={mw.isLoading}
            onPlay={handlePlayReference}
            onReady={drill.finishTeaching}
          />
        )}

        {(drill.phase.type === "readyToRecord" ||
          drill.phase.type === "recording" ||
          drill.phase.type === "assessing") && (
          <DrillRecording
            item={
              drill.phase.type === "readyToRecord"
                ? drill.phase.item
                : drill.phase.type === "recording"
                  ? drill.phase.item
                  : drill.items[drill.currentIndex]
            }
            index={drill.currentIndex}
            total={drill.items.length}
            isRecording={drill.isRecording}
            isAssessing={drill.isAssessing}
            audioBlob={drill.audioBlob}
            stream={drill.recorderStream}
            onStartRecording={drill.startRecording}
            onStopRecording={drill.stopRecording}
          />
        )}

        {drill.phase.type === "feedback" && (
          <DrillFeedback
            item={drill.phase.item}
            index={drill.phase.index}
            total={drill.items.length}
            attempt={drill.phase.attempt}
            passed={drill.phase.passed}
            attemptCount={drill.phase.attemptCount}
            maxAttempts={drill.maxAttempts}
            passThreshold={drill.config?.passThreshold ?? 70}
            onNext={drill.nextItem}
            onRetry={drill.retryItem}
            onSkip={drill.skipItem}
            onPlayReference={handlePlayReference}
          />
        )}

        {drill.phase.type === "completed" && (
          <DrillSummaryCard
            summary={drill.phase.summary}
            onRestart={handleRestart}
            onBack={drill.reset}
          />
        )}

        {drill.phase.type === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
            <p className="text-red-700 dark:text-red-400">
              {drill.phase.message}
            </p>
            <button
              type="button"
              onClick={drill.retryItem}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer"
            >
              重试
            </button>
          </div>
        )}
      </div>
      </div>
    </LanguageModuleGate>
  );
}

function PhonemeLessonView({
  config,
  onReady,
  mw,
  languageId,
}: {
  config: { phonemeSlug: string; itemCount: number };
  onReady: () => void;
  mw: {
    playWord: (w: string, v?: "blue" | "pink", l?: LanguageId) => void;
    isPlaying: boolean;
    isLoading: boolean;
  };
  languageId: LanguageId;
}) {
  const phoneme =
    getLanguagePhonemeBySlug(languageId, config.phonemeSlug) ??
    getPhonemeBySlug(config.phonemeSlug);
  if (!phoneme) return null;
  return (
    <DrillPhonemeLesson
      phoneme={phoneme}
      itemCount={config.itemCount}
      kind="word"
      onReady={onReady}
      onPlayExample={(word) => mw.playWord(word, "blue", languageId)}
      isPlayingExample={mw.isPlaying}
      isLoadingExample={mw.isLoading}
    />
  );
}
