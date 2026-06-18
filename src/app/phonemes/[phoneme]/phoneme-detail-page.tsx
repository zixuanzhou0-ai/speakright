"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { PhonemeStudyCard } from "@/components/phoneme/phoneme-study-card";
import { PhonemeHighlight } from "@/components/scoring/phoneme-highlight";
import { ScoreSummary } from "@/components/scoring/score-summary";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useRecorder } from "@/hooks/use-recorder";
import {
  loadSession,
  saveSession,
  useSessionState,
} from "@/hooks/use-session-state";
import { useSyllableStress } from "@/hooks/use-syllable-stress";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import {
  collectDetailAssessmentPhonemes,
  collectDetailAssessmentSyllables,
} from "@/lib/detail-assessment-breakdown";
import {
  getAnyLanguagePhonemeBySlug,
  getLanguagePhonemeBySlug,
} from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  getDefaultPhonemePracticeSlug,
  isRuleLikeSoundUnit,
  isVisibleInPhonemePractice,
} from "@/lib/language-sound-unit-groups";
import {
  getPracticedWordsForLanguage,
  markWordPracticedForLanguage,
} from "@/lib/practice-tracker";
import { addScore, scoreHistoryKey } from "@/lib/score-history";
import { getAdjacentSpanishWord } from "@/lib/spanish-sound-examples";
import { getWordPool } from "@/lib/word-pool";
import { selectNextWord } from "@/lib/word-selector";
import type { AzureAssessmentResult } from "@/types/azure";
import type { KeywordEntry } from "@/types/phoneme";

const SMOKE_ASSESSMENT_TILE_PHONEMES: Record<
  string,
  { phoneme: string; accuracyScore: number }[]
> = {
  "en-US": [{ phoneme: "iy", accuracyScore: 88 }],
  "es-ES": [
    { phoneme: "a", accuracyScore: 72 },
    { phoneme: "k", accuracyScore: 68 },
  ],
  "fr-FR": [
    { phoneme: "t", accuracyScore: 72 },
    { phoneme: "ʁ", accuracyScore: 70 },
  ],
  "ru-RU": [
    { phoneme: "a", accuracyScore: 74 },
    { phoneme: "tʲ", accuracyScore: 69 },
  ],
};

export function PhonemeDetailPage() {
  const params = useParams<{ phoneme: string }>();
  const router = useRouter();
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const selectedLanguagePhoneme = getLanguagePhonemeBySlug(
    languageId,
    params.phoneme,
  );
  const requestedPhoneme =
    selectedLanguagePhoneme ?? getAnyLanguagePhonemeBySlug(params.phoneme);
  const requestedLanguageId = requestedPhoneme?.languageId ?? languageId;
  const isRequestedHiddenPracticeRule =
    requestedPhoneme &&
    requestedLanguageId !== "en-US" &&
    !isVisibleInPhonemePractice(requestedLanguageId, requestedPhoneme);
  const phoneme = isRequestedHiddenPracticeRule
    ? requestedPhoneme
    : selectedLanguagePhoneme;

  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const llm = useLlmFeedback();
  const playback = useAudioPlayer();
  const chartAudio = useAudioPlayer();
  const wordAudio = useWordPronunciation();
  const [lastChartPlay, setLastChartPlay] = useState<"normal" | "slow">("slow");
  const [wordDirection, setWordDirection] = useState<number>(1);
  const [showSmokeAssessmentTiles, setShowSmokeAssessmentTiles] =
    useState(false);
  const autoAssessTriggered = useRef(false);

  const sessionPrefix = `phonemes:${languageId}:${params.phoneme}`;
  const [sessionStorageWarning, setSessionStorageWarning] = useState<
    string | null
  >(null);
  const handleSessionStorageError = useCallback((message: string) => {
    setSessionStorageWarning(message);
  }, []);

  const [currentWord, setCurrentWord] = useSessionState<KeywordEntry | null>(
    `${sessionPrefix}:currentWord`,
    null,
    { onPersistenceError: handleSessionStorageError },
  );
  const [wordHistory, setWordHistory] = useSessionState<KeywordEntry[]>(
    `${sessionPrefix}:wordHistory`,
    [],
    { onPersistenceError: handleSessionStorageError },
  );
  const [selectedWordPhonemes, setSelectedWordPhonemes] = useSessionState<
    { phoneme: string; accuracyScore: number }[]
  >(`${sessionPrefix}:phonemes`, [], {
    onPersistenceError: handleSessionStorageError,
  });
  const [selectedWordSyllables, setSelectedWordSyllables] = useSessionState<
    { syllable: string; grapheme?: string; accuracyScore: number }[]
  >(`${sessionPrefix}:syllables`, [], {
    onPersistenceError: handleSessionStorageError,
  });
  const [localSaveError, setLocalSaveError] = useState<string | null>(null);

  // Annotate syllables with stress data (static IPA lookup → legacy local cache).
  const stressedSyllables = useSyllableStress(
    currentWord?.word ?? null,
    selectedWordSyllables,
  );

  const restoredRef = useRef(false);

  // Restore hook state from sessionStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const savedResult = loadSession<AzureAssessmentResult>(
      `${sessionPrefix}:azureResult`,
      { onPersistenceError: handleSessionStorageError },
    );
    const savedFeedback = loadSession<FeedbackData>(
      `${sessionPrefix}:llmFeedback`,
      { onPersistenceError: handleSessionStorageError },
    );

    if (savedResult) azure.restore(savedResult);
    if (savedFeedback) llm.restore(savedFeedback);
  }, [sessionPrefix, azure.restore, llm.restore, handleSessionStorageError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save hook state to sessionStorage on change
  useEffect(() => {
    if (!restoredRef.current) return;
    saveSession(`${sessionPrefix}:azureResult`, azure.result, {
      onPersistenceError: handleSessionStorageError,
    });
  }, [azure.result, sessionPrefix, handleSessionStorageError]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (llm.hasFeedback && !llm.isStreaming) {
      saveSession(`${sessionPrefix}:llmFeedback`, llm.feedback, {
        onPersistenceError: handleSessionStorageError,
      });
    }
  }, [
    llm.feedback,
    llm.hasFeedback,
    llm.isStreaming,
    sessionPrefix,
    handleSessionStorageError,
  ]);

  // Deterministic word pool: static keywords + extended word bank.
  const wordPool = useMemo(
    () => (phoneme ? getWordPool(phoneme.slug, phoneme.keywords) : []),
    [phoneme],
  );
  const [practicedCount, setPracticedCount] = useState(0);
  const smokeAssessmentTilePhonemes = useMemo(
    () =>
      showSmokeAssessmentTiles
        ? (SMOKE_ASSESSMENT_TILE_PHONEMES[languageId] ??
          SMOKE_ASSESSMENT_TILE_PHONEMES["en-US"])
        : [],
    [languageId, showSmokeAssessmentTiles],
  );

  useEffect(() => {
    setShowSmokeAssessmentTiles(
      new URLSearchParams(window.location.search).get(
        "smokeAssessmentTiles",
      ) === "1",
    );
  }, []);

  useEffect(() => {
    setPracticedCount(
      getPracticedWordsForLanguage(languageId, phoneme?.slug ?? "").length,
    );
  }, [languageId, phoneme?.slug]);

  useEffect(() => {
    if (!phoneme) {
      router.replace(`/phonemes/${getDefaultPhonemePracticeSlug(languageId)}`);
    }
  }, [languageId, phoneme, router]);

  // Pick first random word on mount
  useEffect(() => {
    if (wordPool.length > 0 && !currentWord && phoneme) {
      const firstWord =
        languageId === "es-ES"
          ? wordPool[0]
          : selectNextWord(phoneme.slug, wordPool);
      setCurrentWord(firstWord);
    }
  }, [wordPool, currentWord, phoneme, languageId, setCurrentWord]);

  const currentWordStr = currentWord?.word ?? phoneme?.example ?? "";

  // Clear results + recording helper
  const resetState = useCallback(() => {
    setSelectedWordPhonemes([]);
    setSelectedWordSyllables([]);
    recorder.reset();
    azure.reset();
    llm.reset();
    wordAudio.clearError();
    setLocalSaveError(null);
    autoAssessTriggered.current = false;
  }, [
    recorder,
    azure,
    llm,
    wordAudio.clearError,
    setSelectedWordPhonemes,
    setSelectedWordSyllables,
  ]);

  // Right arrow → random next word
  const handleNext = useCallback(() => {
    if (!phoneme || wordPool.length === 0) return;
    const next =
      languageId === "es-ES"
        ? (getAdjacentSpanishWord(wordPool, currentWord, 1) ??
          selectNextWord(phoneme.slug, wordPool, currentWord?.word))
        : selectNextWord(phoneme.slug, wordPool, currentWord?.word);
    if (currentWord) setWordHistory((prev) => [...prev, currentWord]);
    setCurrentWord(next);
    resetState();
  }, [
    phoneme,
    wordPool,
    languageId,
    currentWord,
    resetState,
    setCurrentWord,
    setWordHistory,
  ]);

  // Left arrow → go back in history
  const handlePrevious = useCallback(() => {
    if (languageId === "es-ES" && phoneme && wordPool.length > 0) {
      const prev = getAdjacentSpanishWord(wordPool, currentWord, -1);
      if (!prev) return;
      setCurrentWord(prev);
      resetState();
      return;
    }

    if (wordHistory.length === 0) return;
    const prev = wordHistory[wordHistory.length - 1];
    setWordHistory((h) => h.slice(0, -1));
    setCurrentWord(prev);
    resetState();
  }, [
    languageId,
    phoneme,
    wordPool,
    currentWord,
    wordHistory,
    resetState,
    setCurrentWord,
    setWordHistory,
  ]);

  // Keyboard navigation for cards
  useEffect(() => {
    if (!phoneme) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      else if (e.key === "ArrowLeft") handlePrevious();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phoneme, handleNext, handlePrevious]);

  const handleRecordStart = useCallback(() => {
    // Clear previous results before new recording
    llm.reset();
    azure.reset();
    setSelectedWordPhonemes([]);
    setSelectedWordSyllables([]);
    recorder.startRecording();
  }, [llm, azure, recorder, setSelectedWordPhonemes, setSelectedWordSyllables]);

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleAssess = useCallback(async () => {
    if (!recorder.audioBlob || !currentWordStr) return;

    const result = await azure.assess(
      recorder.audioBlob,
      currentWordStr,
      languageProfile.azureLocale,
    );

    if (result) {
      setLocalSaveError(null);
      setSelectedWordPhonemes(
        collectDetailAssessmentPhonemes(result, currentWord?.ipa),
      );
      setSelectedWordSyllables(collectDetailAssessmentSyllables(result));
      const scoreSaved = addScore(
        scoreHistoryKey(languageId, phoneme?.slug ?? "", currentWordStr),
        result.pronunciationScore,
      );
      let practiceSaved = true;
      if (phoneme) {
        practiceSaved = markWordPracticedForLanguage(
          languageId,
          phoneme.slug,
          currentWordStr,
        );
        setPracticedCount(
          getPracticedWordsForLanguage(languageId, phoneme.slug).length,
        );
      }
      if (!scoreSaved || !practiceSaved) {
        setLocalSaveError(
          "本次评分已完成，但本机练习记录或趋势图未保存。可能是本机存储空间不足或系统限制了本地存储；你可以继续练习，稍后清理空间或在设置页导出/重置本机数据后重试。",
        );
      }
      llm.requestFeedback(
        `${languageProfile.displayName} ${phoneme?.ipa} — ${phoneme?.name}, example word: ${currentWordStr}`,
        result,
        "phoneme",
        languageId,
        { targetUnitSlugs: phoneme ? [phoneme.slug] : [] },
      );
    }
  }, [
    recorder.audioBlob,
    currentWordStr,
    currentWord?.ipa,
    phoneme,
    languageId,
    languageProfile.azureLocale,
    languageProfile.displayName,
    azure,
    llm,
    setSelectedWordPhonemes,
    setSelectedWordSyllables,
  ]);

  // Auto-assess on 30s auto-stop
  useEffect(() => {
    if (
      recorder.autoStopped &&
      recorder.audioBlob &&
      !autoAssessTriggered.current
    ) {
      autoAssessTriggered.current = true;
      handleAssess();
    }
  }, [recorder.autoStopped, recorder.audioBlob, handleAssess]);

  useEffect(() => {
    if (recorder.isRecording) {
      autoAssessTriggered.current = false;
    }
  }, [recorder.isRecording]);

  const handlePlayRecording = () => {
    const replayBlob = recorder.rawBlob ?? recorder.audioBlob;
    if (replayBlob) {
      wordAudio.stop();
      chartAudio.stop();
      playback.playBlob(replayBlob);
    }
  };

  const handleRetryFeedback = useCallback(() => {
    if (!azure.result || !phoneme) return;
    llm.reset();
    llm.requestFeedback(
      `${languageProfile.displayName} ${phoneme.ipa} — ${phoneme.name}, example word: ${currentWordStr}`,
      azure.result,
      "phoneme",
      languageId,
      { targetUnitSlugs: [phoneme.slug] },
    );
  }, [
    azure.result,
    phoneme,
    currentWordStr,
    languageProfile.displayName,
    llm,
    languageId,
  ]);

  const handleClear = () => {
    playback.stop();
    recorder.reset();
    azure.reset();
    llm.reset();
    setLocalSaveError(null);
    setSelectedWordPhonemes([]);
    setSelectedWordSyllables([]);
    autoAssessTriggered.current = false;
  };

  if (!phoneme) {
    const unitLabel = languageId === "en-US" ? "音标" : "发音单位";
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">{unitLabel}未找到</p>
        <Link href="/phonemes">
          <Button variant="link" className="mt-2">
            返回{unitLabel}列表
          </Button>
        </Link>
      </div>
    );
  }

  const hiddenPracticeRuleLanguageId = phoneme.languageId ?? languageId;
  const isHiddenPracticeRule =
    hiddenPracticeRuleLanguageId !== "en-US" &&
    !isVisibleInPhonemePractice(hiddenPracticeRuleLanguageId, phoneme);

  if (isHiddenPracticeRule) {
    return (
      <div
        className="flex h-full items-center justify-center px-6 py-8"
        data-smoke="phoneme-rule-route-blocked"
        data-language-id={hiddenPracticeRuleLanguageId}
        data-sound-unit={phoneme.slug}
      >
        <div className="max-w-xl rounded-xl border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-lg font-semibold">这不是单音标练习</p>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            该内容属于规则/短语训练，不属于单音标练习。连读、静音、重音、
            弱化和短语韵律会保留在句子训练、AI 反馈或后续规则训练中，不会作为单个音标播放或晋级。
          </p>
          <Link
            href={`/phonemes/${getDefaultPhonemePracticeSlug(
              hiddenPracticeRuleLanguageId,
            )}`}
          >
            <Button className="mt-4">返回当前语言音标练习</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isWordActive = wordAudio.isPlaying || wordAudio.isLoading;
  const breakdownLabel = languageId === "en-US" ? "音标拆解" : "发音拆解";
  const showRuleEvidenceNote =
    languageId !== "en-US" && isRuleLikeSoundUnit(phoneme);

  return (
    <div
      className="h-full flex flex-col px-6 py-4 overflow-hidden"
      data-smoke="phoneme-detail-page"
      data-language-id={languageId}
      data-sound-unit={phoneme.slug}
    >
      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] flex-1 min-h-0">
        {/* ====== LEFT COLUMN ====== */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin">
          {/* ── 学习区 ── */}
          <PhonemeStudyCard
            phoneme={phoneme}
            languageProfile={languageProfile}
            currentWord={currentWord}
            wordDirection={wordDirection}
            wordPoolSize={wordPool.length}
            practicedCount={practicedCount}
            isWordActive={isWordActive}
            wordIsLoading={wordAudio.isLoading}
            wordAudioError={wordAudio.error}
            chartAudioError={chartAudio.error}
            lastChartPlay={lastChartPlay}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSetWordDirection={setWordDirection}
            onSetLastChartPlay={setLastChartPlay}
            onPlayWord={(word, voice) =>
              wordAudio.playWord(word, voice, languageId)
            }
            onPlayChartAudio={(path, options) => chartAudio.play(path, options)}
            onStopPlayback={() => playback.stop()}
            onStopWordAudio={() => wordAudio.stop()}
            onStopChartAudio={() => chartAudio.stop()}
            wordHistoryLength={wordHistory.length}
            canGoPrevious={
              languageId === "es-ES"
                ? wordPool.length > 1
                : wordHistory.length > 0
            }
          />

          {showRuleEvidenceNote && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              这是规则/语流训练，评分以词或短语证据为准，不会用单个音素分数直接晋级掌握状态。
            </div>
          )}

          {sessionStorageWarning && (
            <p
              className="break-words rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 [overflow-wrap:anywhere] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
              data-smoke="phoneme-session-storage-warning"
              role="alert"
            >
              {sessionStorageWarning}
            </p>
          )}

          {/* ── 练习区 ── */}
          <div className="shrink-0 rounded-xl border bg-card px-4 py-4 shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <RecordButton
                isRecording={recorder.isRecording}
                onStart={handleRecordStart}
                onStop={handleRecordStop}
                disabled={azure.isLoading}
              />

              <WaveformDisplay
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
              />

              <RecordingActions
                hasRecording={
                  !!(recorder.rawBlob ?? recorder.audioBlob) &&
                  !recorder.isRecording
                }
                isPlaying={playback.isPlaying}
                isAssessing={azure.isLoading}
                onReplay={handlePlayRecording}
                onClear={handleClear}
                onAssess={handleAssess}
              />

              {recorder.error && (
                <p
                  role="alert"
                  className="max-w-full break-words text-center text-sm text-red-500 [overflow-wrap:anywhere]"
                  data-smoke="phoneme-recorder-error"
                >
                  {recorder.error}
                </p>
              )}
              {azure.error && (
                <p
                  role="alert"
                  className="max-w-full break-words text-center text-sm text-red-500 [overflow-wrap:anywhere]"
                  data-smoke="phoneme-azure-error"
                >
                  {azure.error}
                </p>
              )}
              {localSaveError && (
                <p
                  role="alert"
                  className="max-w-full break-words text-center text-sm text-amber-600 [overflow-wrap:anywhere] dark:text-amber-400"
                  data-smoke="local-practice-save-error"
                >
                  {localSaveError}
                </p>
              )}
            </div>

            {/* Score summary — inside practice card */}
            {azure.result && (
              <div className="mt-3 border-t pt-3">
                <ScoreSummary
                  result={azure.result}
                  showProsody={false}
                  historyKey={scoreHistoryKey(
                    languageId,
                    phoneme.slug,
                    currentWordStr,
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* ====== RIGHT COLUMN ====== */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin lg:pb-4">
          {/* Phoneme details — wrapped in card */}
          <div className="shrink-0 rounded-xl border bg-card px-4 py-4 shadow-sm">
            {azure.result &&
            (selectedWordPhonemes.length > 0 ||
              stressedSyllables.length > 0) ? (
              <PhonemeHighlight
                phonemes={selectedWordPhonemes}
                syllables={stressedSyllables}
                languageId={languageId}
                expectedText={currentWord?.word}
                expectedIpa={currentWord?.ipa}
              />
            ) : smokeAssessmentTilePhonemes.length > 0 ? (
              <div data-smoke="assessment-phoneme-tile-fixture">
                <PhonemeHighlight
                  phonemes={smokeAssessmentTilePhonemes}
                  languageId={languageId}
                  expectedText={currentWord?.word ?? phoneme?.name}
                  expectedIpa={currentWord?.ipa ?? phoneme?.ipa}
                />
              </div>
            ) : (
              <div
                className="flex h-20 items-center justify-center rounded-lg border border-dashed bg-muted/20"
                data-smoke="assessment-breakdown-placeholder"
              >
                <p className="text-center text-sm text-muted-foreground">
                  录音并评分后将在此显示{breakdownLabel}
                </p>
              </div>
            )}
          </div>

          {/* LLM Feedback */}
          <div className="flex-1 min-h-0">
            {llm.hasFeedback || llm.isStreaming || llm.error ? (
              <FeedbackDisplay
                feedback={llm.feedback}
                isStreaming={llm.isStreaming}
                error={llm.error}
                onRetry={handleRetryFeedback}
              />
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed bg-muted/20">
                <p className="text-center text-sm text-muted-foreground">
                  AI 教练反馈区
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
