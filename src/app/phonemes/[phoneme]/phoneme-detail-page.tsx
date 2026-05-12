"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { PhonemeStudyCard } from "@/components/phoneme/phoneme-study-card";
import { PhonemeHighlight } from "@/components/scoring/phoneme-highlight";
import { ScoreSummary } from "@/components/scoring/score-summary";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import {
  loadSession,
  saveSession,
  useSessionState,
} from "@/hooks/use-session-state";
import { useSyllableStress } from "@/hooks/use-syllable-stress";
import { getMerriamWebsterConfig } from "@/lib/api-keys";
import { getPhonemeBySlug } from "@/lib/phoneme-data";
import { getPracticedWords, markWordPracticed } from "@/lib/practice-tracker";
import { addScore } from "@/lib/score-history";
import { getWordPool } from "@/lib/word-pool";
import { selectNextWord } from "@/lib/word-selector";
import type { AzureAssessmentResult } from "@/types/azure";
import type { KeywordEntry } from "@/types/phoneme";

export function PhonemeDetailPage() {
  const params = useParams<{ phoneme: string }>();
  const phoneme = getPhonemeBySlug(params.phoneme);

  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const llm = useLlmFeedback();
  const playback = useAudioPlayer();
  const chartAudio = useAudioPlayer();
  const mw = useMwPronunciation();
  const [lastChartPlay, setLastChartPlay] = useState<"normal" | "slow">("slow");
  const [wordDirection, setWordDirection] = useState<number>(1);
  const autoAssessTriggered = useRef(false);

  const sessionPrefix = `phonemes:${params.phoneme}`;

  const [currentWord, setCurrentWord] = useSessionState<KeywordEntry | null>(
    `${sessionPrefix}:currentWord`,
    null,
  );
  const [wordHistory, setWordHistory] = useSessionState<KeywordEntry[]>(
    `${sessionPrefix}:wordHistory`,
    [],
  );
  const [selectedWordPhonemes, setSelectedWordPhonemes] = useSessionState<
    { phoneme: string; accuracyScore: number }[]
  >(`${sessionPrefix}:phonemes`, []);
  const [selectedWordSyllables, setSelectedWordSyllables] = useSessionState<
    { syllable: string; grapheme?: string; accuracyScore: number }[]
  >(`${sessionPrefix}:syllables`, []);

  // Annotate syllables with stress data (static IPA lookup → MW API fallback)
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
    );
    const savedFeedback = loadSession<FeedbackData>(
      `${sessionPrefix}:llmFeedback`,
    );

    if (savedResult) azure.restore(savedResult);
    if (savedFeedback) llm.restore(savedFeedback);
  }, [sessionPrefix, azure.restore, llm.restore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save hook state to sessionStorage on change
  useEffect(() => {
    if (!restoredRef.current) return;
    saveSession(`${sessionPrefix}:azureResult`, azure.result);
  }, [azure.result, sessionPrefix]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (llm.hasFeedback && !llm.isStreaming) {
      saveSession(`${sessionPrefix}:llmFeedback`, llm.feedback);
    }
  }, [llm.feedback, llm.hasFeedback, llm.isStreaming, sessionPrefix]);

  // Hybrid word pool: static keywords + extended word bank + MW cached words
  const wordPool = useMemo(
    () => (phoneme ? getWordPool(phoneme.slug, phoneme.keywords) : []),
    [phoneme],
  );
  const [hasMwConfig, setHasMwConfig] = useState(false);
  const [practicedCount, setPracticedCount] = useState(0);
  useEffect(() => {
    setHasMwConfig(!!getMerriamWebsterConfig()?.apiKey);
    setPracticedCount(getPracticedWords(phoneme?.slug ?? "").length);
  }, [phoneme?.slug]);

  // Pick first random word on mount
  useEffect(() => {
    if (wordPool.length > 0 && !currentWord && phoneme) {
      setCurrentWord(selectNextWord(phoneme.slug, wordPool));
    }
  }, [wordPool, currentWord, phoneme, setCurrentWord]);

  const currentWordStr = currentWord?.word ?? phoneme?.example ?? "";

  // Clear results + recording helper
  const resetState = useCallback(() => {
    setSelectedWordPhonemes([]);
    setSelectedWordSyllables([]);
    recorder.reset();
    azure.reset();
    llm.reset();
    autoAssessTriggered.current = false;
  }, [recorder, azure, llm, setSelectedWordPhonemes, setSelectedWordSyllables]);

  // Right arrow → random next word
  const handleNext = useCallback(() => {
    if (!phoneme || wordPool.length === 0) return;
    const next = selectNextWord(phoneme.slug, wordPool, currentWord?.word);
    if (currentWord) setWordHistory((prev) => [...prev, currentWord]);
    setCurrentWord(next);
    resetState();
  }, [
    phoneme,
    wordPool,
    currentWord,
    resetState,
    setCurrentWord,
    setWordHistory,
  ]);

  // Left arrow → go back in history
  const handlePrevious = useCallback(() => {
    if (wordHistory.length === 0) return;
    const prev = wordHistory[wordHistory.length - 1];
    setWordHistory((h) => h.slice(0, -1));
    setCurrentWord(prev);
    resetState();
  }, [wordHistory, resetState, setCurrentWord, setWordHistory]);

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

    const result = await azure.assess(recorder.audioBlob, currentWordStr);

    if (result) {
      if (result.words[0]?.phonemes) {
        setSelectedWordPhonemes(result.words[0].phonemes);
      }
      if (result.words[0]?.syllables) {
        setSelectedWordSyllables(result.words[0].syllables);
      }
      addScore(`${phoneme?.slug}:${currentWordStr}`, result.pronunciationScore);
      if (phoneme) {
        markWordPracticed(phoneme.slug, currentWordStr);
        setPracticedCount(getPracticedWords(phoneme.slug).length);
      }
      llm.requestFeedback(
        `${phoneme?.ipa} — ${phoneme?.name}, example word: ${currentWordStr}`,
        result,
        "phoneme",
      );
    }
  }, [
    recorder.audioBlob,
    currentWordStr,
    phoneme,
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
    if (recorder.audioBlob) {
      mw.stop();
      chartAudio.stop();
      playback.playBlob(recorder.audioBlob);
    }
  };

  const handleRetryFeedback = useCallback(() => {
    if (!azure.result || !phoneme) return;
    llm.reset();
    llm.requestFeedback(
      `${phoneme.ipa} — ${phoneme.name}, example word: ${currentWordStr}`,
      azure.result,
      "phoneme",
    );
  }, [azure.result, phoneme, currentWordStr, llm]);

  const handleClear = () => {
    playback.stop();
    recorder.reset();
    azure.reset();
    llm.reset();
    setSelectedWordPhonemes([]);
    setSelectedWordSyllables([]);
    autoAssessTriggered.current = false;
  };

  if (!phoneme) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">音标未找到</p>
        <Link href="/phonemes">
          <Button variant="link" className="mt-2">
            返回音标列表
          </Button>
        </Link>
      </div>
    );
  }

  const isWordActive = mw.isPlaying || mw.isLoading;

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-hidden">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] flex-1 min-h-0">
        {/* ====== LEFT COLUMN ====== */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin">
          {/* ── 学习区 ── */}
          <PhonemeStudyCard
            phoneme={phoneme}
            currentWord={currentWord}
            wordDirection={wordDirection}
            wordPoolSize={wordPool.length}
            practicedCount={practicedCount}
            hasMwConfig={hasMwConfig}
            isWordActive={isWordActive}
            mwIsLoading={mw.isLoading}
            lastChartPlay={lastChartPlay}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSetWordDirection={setWordDirection}
            onSetLastChartPlay={setLastChartPlay}
            onPlayWord={(word, voice) => mw.playWord(word, voice)}
            onPlayChartAudio={(path) => chartAudio.play(path)}
            onStopPlayback={() => playback.stop()}
            onStopMw={() => mw.stop()}
            onStopChartAudio={() => chartAudio.stop()}
            wordHistoryLength={wordHistory.length}
          />

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
                hasRecording={!!recorder.audioBlob && !recorder.isRecording}
                isPlaying={playback.isPlaying}
                isAssessing={azure.isLoading}
                onReplay={handlePlayRecording}
                onClear={handleClear}
                onAssess={handleAssess}
              />

              {recorder.error && (
                <p role="alert" className="text-sm text-red-500">
                  {recorder.error}
                </p>
              )}
              {azure.error && (
                <p role="alert" className="text-sm text-red-500">
                  {azure.error}
                </p>
              )}
            </div>

            {/* Score summary — inside practice card */}
            {azure.result && (
              <div className="mt-3 border-t pt-3">
                <ScoreSummary
                  result={azure.result}
                  showProsody={false}
                  historyKey={`${phoneme.slug}:${currentWordStr}`}
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
              />
            ) : (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed bg-muted/20">
                <p className="text-center text-sm text-muted-foreground">
                  录音并评分后将在此显示音标拆解
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
