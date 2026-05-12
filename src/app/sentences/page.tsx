"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SentenceInputCard } from "@/components/sentences/sentence-input-card";
import { SentenceRecordingCard } from "@/components/sentences/sentence-recording-card";
import { SentenceResultsColumn } from "@/components/sentences/sentence-results-column";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import {
  clearSessionPrefix,
  loadSession,
  saveSession,
  useSessionState,
} from "@/hooks/use-session-state";
import { useSyllableStress } from "@/hooks/use-syllable-stress";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import { useWordIpa } from "@/hooks/use-word-ipa";
import { addScore } from "@/lib/score-history";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult, AzureWord } from "@/types/azure";

const SESSION_PREFIX = "sentences";

export default function SentencesPage() {
  const [sentence, setSentence] = useSessionState(`${SESSION_PREFIX}:text`, "");
  const [speed, setSpeed] = useSessionState(`${SESSION_PREFIX}:speed`, 0.85);
  const [selectedWord, setSelectedWord] = useState<AzureWord | null>(null);

  const isWordMode = !isSentence(sentence);
  const trimmedText = sentence.trim();

  const wordIpa = useWordIpa(isWordMode ? trimmedText : "");
  const [hasPlayedWord, setHasPlayedWord] = useState(false);

  const stressedSyllables = useSyllableStress(
    selectedWord?.word ?? null,
    selectedWord?.syllables ?? [],
  );

  const tts = useTtsAligned();
  const mw = useMwPronunciation();
  // Free-practice page allows up to 150-char sentences; bump cap to 60s so
  // paragraph-length input isn't cut off mid-read.
  const recorder = useRecorder({ maxDurationMs: 60_000 });
  const azure = useAzureAssessment();
  const llm = useLlmFeedback();
  const playback = useAudioPlayer();
  const autoAssessTriggered = useRef(false);
  const restoredRef = useRef(false);

  // ── Session restore/save ──

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const savedResult = loadSession<AzureAssessmentResult>(
      `${SESSION_PREFIX}:azureResult`,
    );
    const savedFeedback = loadSession<FeedbackData>(
      `${SESSION_PREFIX}:llmFeedback`,
    );
    const savedWordIdx = loadSession<number>(
      `${SESSION_PREFIX}:selectedWordIdx`,
    );

    if (savedResult) {
      azure.restore(savedResult);
      if (savedWordIdx != null && savedResult.words[savedWordIdx]) {
        setSelectedWord(savedResult.words[savedWordIdx]);
      }
    }
    if (savedFeedback) llm.restore(savedFeedback);
  }, [azure.restore, llm.restore]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restoredRef.current) return;
    saveSession(`${SESSION_PREFIX}:azureResult`, azure.result);
  }, [azure.result]);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (llm.hasFeedback && !llm.isStreaming) {
      saveSession(`${SESSION_PREFIX}:llmFeedback`, llm.feedback);
    }
  }, [llm.feedback, llm.hasFeedback, llm.isStreaming]);

  useEffect(() => {
    if (!restoredRef.current) return;
    const idx =
      selectedWord && azure.result
        ? azure.result.words.indexOf(selectedWord)
        : null;
    saveSession(`${SESSION_PREFIX}:selectedWordIdx`, idx);
  }, [selectedWord, azure.result]);

  // ── Handlers ──

  const handleClearSession = useCallback(() => {
    clearSessionPrefix(SESSION_PREFIX);
    setSentence("");
    setSpeed(0.85);
    setSelectedWord(null);
    azure.reset();
    llm.reset();
    recorder.reset();
    playback.stop();
    autoAssessTriggered.current = false;
  }, [azure, llm, recorder, playback, setSentence, setSpeed]);

  useEffect(() => {
    if (mw.isPlaying) setHasPlayedWord(true);
  }, [mw.isPlaying]);

  useEffect(() => {
    setHasPlayedWord(false);
  }, []);

  const handleListen = useCallback(() => {
    if (!trimmedText) return;
    playback.stop();
    if (isWordMode) {
      tts.stop();
      mw.playWord(trimmedText);
    } else {
      mw.stop();
      tts.speak(trimmedText, speed);
    }
  }, [trimmedText, isWordMode, playback, tts, mw, speed]);

  const handleRecordStart = useCallback(() => {
    llm.reset();
    azure.reset();
    setSelectedWord(null);
    recorder.startRecording();
  }, [llm, azure, recorder]);

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleAssess = useCallback(async () => {
    if (!recorder.audioBlob || !sentence.trim()) return;

    setSelectedWord(null);
    const result = await azure.assess(recorder.audioBlob, sentence.trim());

    if (result) {
      const text = sentence.trim();
      const histKey = `${text.slice(0, 50)}:${text.length}`;
      addScore(histKey, result.pronunciationScore);
      llm.requestFeedback(
        text,
        result,
        isSentence(text) ? "sentence" : "phoneme",
      );
    }
  }, [recorder.audioBlob, sentence, azure, llm]);

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

  const handleWordClick = useCallback(
    (word: AzureWord) => {
      setSelectedWord(word);
      playback.stop();
      tts.stop();
      mw.playWord(word.word);
    },
    [playback, tts, mw],
  );

  const handlePlayRecording = useCallback(() => {
    if (recorder.audioBlob) {
      mw.stop();
      tts.stop();
      playback.playBlob(recorder.audioBlob);
    }
  }, [recorder.audioBlob, mw, tts, playback]);

  const handleClear = useCallback(() => {
    playback.stop();
    recorder.reset();
    azure.reset();
    llm.reset();
    setSelectedWord(null);
    autoAssessTriggered.current = false;
  }, [playback, recorder, azure, llm]);

  const handleMwPlay = useCallback(
    (word: string) => {
      playback.stop();
      mw.playWord(word);
    },
    [playback, mw],
  );

  const handleRetryFeedback = useCallback(() => {
    if (!azure.result || !sentence.trim()) return;
    const text = sentence.trim();
    llm.reset();
    llm.requestFeedback(
      text,
      azure.result,
      isSentence(text) ? "sentence" : "phoneme",
    );
  }, [azure.result, sentence, llm]);

  const hasResult = !!(
    azure.result ||
    llm.hasFeedback ||
    llm.isStreaming ||
    llm.error
  );

  // ── Render ──

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-hidden">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">自由练习</h1>
        {(azure.result || llm.hasFeedback) && (
          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            清除练习记录
          </button>
        )}
      </div>
      <p className="mb-4 shrink-0 text-muted-foreground">
        输入单词或句子，听标准发音，跟读录音，获得 AI 评分与反馈
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr] flex-1 min-h-0">
        {/* Left Column */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin">
          <SentenceInputCard
            sentence={sentence}
            onSentenceChange={setSentence}
            speed={speed}
            onSpeedChange={setSpeed}
            isWordMode={isWordMode}
            trimmedText={trimmedText}
            wordIpa={wordIpa}
            hasPlayedWord={hasPlayedWord}
            mwIsPlaying={mw.isPlaying}
            mwIsLoading={mw.isLoading}
            onMwPlay={handleMwPlay}
            ttsIsPlaying={tts.isPlaying}
            ttsIsLoading={tts.isLoading}
            ttsError={tts.error}
            ttsWordTimings={tts.wordTimings}
            ttsCurrentTime={tts.currentTime}
            onTtsReplay={() => tts.replay()}
            onListen={handleListen}
          />

          <SentenceRecordingCard
            sentence={sentence}
            isRecording={recorder.isRecording}
            elapsedSeconds={recorder.elapsedSeconds}
            maxDurationSeconds={recorder.maxDurationSeconds}
            audioBlob={recorder.audioBlob}
            stream={recorder.stream}
            recorderError={recorder.error}
            onRecordStart={handleRecordStart}
            onRecordStop={handleRecordStop}
            isPlaying={playback.isPlaying}
            onReplay={handlePlayRecording}
            isAssessing={azure.isLoading}
            assessError={azure.error}
            result={azure.result}
            onClear={handleClear}
            onAssess={handleAssess}
          />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin lg:pb-4">
          <SentenceResultsColumn
            hasResult={hasResult}
            result={azure.result}
            selectedWord={selectedWord}
            stressedSyllables={stressedSyllables}
            onWordClick={handleWordClick}
            feedback={llm.feedback}
            isStreaming={llm.isStreaming}
            hasFeedback={llm.hasFeedback}
            llmError={llm.error}
            onRetryFeedback={handleRetryFeedback}
          />
        </div>
      </div>
    </div>
  );
}
