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
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
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
  const wordAudio = useWordPronunciation();

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
      if (item) wordAudio.playWord(item.text, "blue", languageId);
    }
  }, [drill.phase, wordAudio, languageId]);

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
      <div
        data-smoke="word-drill-page"
        className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin"
      >
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start gap-3 shrink-0">
          <Link
            href="/drill"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
                单词训练
              </h1>
              {drill.config &&
                drill.phase.type !== "configuring" &&
                drill.phase.type !== "completed" && (
                  <span className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {getLanguagePhonemeBySlug(
                      languageId,
                      drill.config.phonemeSlug,
                    )?.ipa ?? getPhonemeBySlug(drill.config.phonemeSlug)?.ipa}
                  </span>
                )}
            </div>
          </div>
        </div>

        {/* State machine-driven content */}
        <div className="flex-1 max-w-2xl mx-auto w-full">
          {drill.localSaveError && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
              data-smoke="drill-local-save-error"
            >
              {drill.localSaveError}
            </p>
          )}

          {drill.phase.type === "configuring" && (
            <div data-smoke="word-drill-config-card">
              <DrillConfig kind="word" onStart={handleStart} />
            </div>
          )}

          {drill.phase.type === "phonemeLesson" && drill.config && (
            <PhonemeLessonView
              config={drill.config}
              onReady={drill.finishPhonemeLesson}
              wordAudio={wordAudio}
              languageId={languageId}
            />
          )}

          {drill.phase.type === "teaching" && (
            <DrillTeaching
              item={drill.phase.item}
              index={drill.phase.index}
              total={drill.items.length}
              isPlaying={wordAudio.isPlaying}
              isLoading={wordAudio.isLoading}
              audioError={wordAudio.error}
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
              recorderError={drill.recorderError}
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
              audioError={wordAudio.error}
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
  wordAudio,
  languageId,
}: {
  config: { phonemeSlug: string; itemCount: number };
  onReady: () => void;
  wordAudio: {
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
      onPlayExample={(word) => wordAudio.playWord(word, "blue", languageId)}
      isPlayingExample={wordAudio.isPlaying}
      isLoadingExample={wordAudio.isLoading}
    />
  );
}
