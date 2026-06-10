"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageModuleGate } from "@/components/common/language-module-gate";
import { SentenceInputCard } from "@/components/sentences/sentence-input-card";
import { SentenceRecordingCard } from "@/components/sentences/sentence-recording-card";
import { SentenceResultsColumn } from "@/components/sentences/sentence-results-column";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import {
  clearSessionPrefix,
  loadSession,
  saveSession,
  useSessionState,
} from "@/hooks/use-session-state";
import { useSyllableStress } from "@/hooks/use-syllable-stress";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import { useWordIpa } from "@/hooks/use-word-ipa";
import {
  analyzeFreePracticeTransfer,
  buildFreePracticeTargetPreview,
  type FreePracticeTransferSummary,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import { getLanguageProfile } from "@/lib/language-profiles";
import { loadMasteryProfile, saveMasteryProfile } from "@/lib/mastery-profile";
import { reliabilityFromRecordingQuality } from "@/lib/recording-quality";
import { addScore } from "@/lib/score-history";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult, AzureWord } from "@/types/azure";
import type { MasteryProfile } from "@/types/training";

const SESSION_PREFIX_BASE = "sentences";

export default function SentencesPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const sessionPrefix = `${SESSION_PREFIX_BASE}:${languageId}`;
  const [sentence, setSentence] = useSessionState(`${sessionPrefix}:text`, "");
  const [speed, setSpeed] = useSessionState(`${sessionPrefix}:speed`, 0.85);
  const [selectedWord, setSelectedWord] = useState<AzureWord | null>(null);
  const [transferSummary, setTransferSummary] =
    useState<FreePracticeTransferSummary | null>(null);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);

  const isWordMode = !isSentence(sentence);
  const trimmedText = sentence.trim();

  const wordIpa = useWordIpa(isWordMode ? trimmedText : "");
  const [hasPlayedWord, setHasPlayedWord] = useState(false);

  const stressedSyllables = useSyllableStress(
    selectedWord?.word ?? null,
    selectedWord?.syllables ?? [],
  );

  const tts = useTtsAligned();
  const wordAudio = useWordPronunciation();
  // Free-practice page allows up to 150-char sentences; bump cap to 60s so
  // paragraph-length input isn't cut off mid-read.
  const recorder = useRecorder({ maxDurationMs: 60_000 });
  const recordingQuality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: isWordMode ? "word" : "sentence",
    minDurationMs: isWordMode ? 500 : 800,
  });
  const azure = useAzureAssessment();
  const llm = useLlmFeedback();
  const playback = useAudioPlayer();
  const autoAssessTriggered = useRef(false);
  const restoredSessionPrefixRef = useRef<string | null>(null);
  const previousTrimmedTextRef = useRef(trimmedText);
  const targetPreview = useMemo(
    () =>
      trimmedText
        ? buildFreePracticeTargetPreview({
            profile,
            text: trimmedText,
            mode: isWordMode ? "word" : "sentence",
          })
        : null,
    [profile, trimmedText, isWordMode],
  );

  // ── Session restore/save ──

  useEffect(() => {
    if (restoredSessionPrefixRef.current === sessionPrefix) return;
    restoredSessionPrefixRef.current = sessionPrefix;

    const savedResult = loadSession<AzureAssessmentResult>(
      `${sessionPrefix}:azureResult`,
    );
    const savedFeedback = loadSession<FeedbackData>(
      `${sessionPrefix}:llmFeedback`,
    );
    const savedWordIdx = loadSession<number>(
      `${sessionPrefix}:selectedWordIdx`,
    );

    if (savedResult) {
      azure.restore(savedResult);
      if (savedWordIdx != null && savedResult.words[savedWordIdx]) {
        setSelectedWord(savedResult.words[savedWordIdx]);
      }
    }
    if (savedFeedback) llm.restore(savedFeedback);
  }, [azure, llm, sessionPrefix]);

  useEffect(() => {
    const refreshProfile = () => setProfile(loadMasteryProfile());
    refreshProfile();
    window.addEventListener("storage", refreshProfile);
    return () => window.removeEventListener("storage", refreshProfile);
  }, []);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    saveSession(`${sessionPrefix}:azureResult`, azure.result);
  }, [azure.result, sessionPrefix]);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    if (llm.hasFeedback && !llm.isStreaming) {
      saveSession(`${sessionPrefix}:llmFeedback`, llm.feedback);
    }
  }, [llm.feedback, llm.hasFeedback, llm.isStreaming, sessionPrefix]);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    const idx =
      selectedWord && azure.result
        ? azure.result.words.indexOf(selectedWord)
        : null;
    saveSession(`${sessionPrefix}:selectedWordIdx`, idx);
  }, [selectedWord, azure.result, sessionPrefix]);

  // ── Handlers ──

  const handleClearSession = useCallback(() => {
    clearSessionPrefix(sessionPrefix);
    setSentence("");
    setSpeed(0.85);
    setSelectedWord(null);
    azure.reset();
    llm.reset();
    recorder.reset();
    tts.reset();
    wordAudio.stop();
    playback.stop();
    setTransferSummary(null);
    recordingQuality.reset();
    autoAssessTriggered.current = false;
  }, [
    azure,
    llm,
    recorder,
    tts,
    wordAudio,
    playback,
    recordingQuality,
    setSentence,
    setSpeed,
    sessionPrefix,
  ]);

  useEffect(() => {
    if (previousTrimmedTextRef.current === trimmedText) return;
    previousTrimmedTextRef.current = trimmedText;
    tts.reset();
    wordAudio.stop();
    playback.stop();
    setHasPlayedWord(false);
  }, [trimmedText, tts, wordAudio, playback]);

  useEffect(() => {
    if (wordAudio.isPlaying) setHasPlayedWord(true);
  }, [wordAudio.isPlaying]);

  useEffect(() => {
    setHasPlayedWord(false);
  }, []);

  const handleListen = useCallback(() => {
    if (!trimmedText) return;
    playback.stop();
    if (isWordMode) {
      tts.reset();
      wordAudio.playWord(trimmedText, "blue", languageId);
    } else {
      wordAudio.stop();
      tts.speak(trimmedText, { speed, languageId });
    }
  }, [trimmedText, isWordMode, playback, tts, wordAudio, speed, languageId]);

  const handleRecordStart = useCallback(() => {
    llm.reset();
    azure.reset();
    setSelectedWord(null);
    setTransferSummary(null);
    recordingQuality.reset();
    recorder.startRecording();
  }, [llm, azure, recorder, recordingQuality]);

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleAssess = useCallback(async () => {
    if (!recorder.audioBlob || !sentence.trim()) return;
    if (recordingQuality.isAnalyzing || !recordingQuality.report?.canSubmit) {
      return;
    }

    setSelectedWord(null);
    const result = await azure.assess(
      recorder.audioBlob,
      sentence.trim(),
      languageProfile.azureLocale,
    );

    if (result) {
      const text = sentence.trim();
      const histKey = `${languageId}:${text.slice(0, 50)}:${text.length}`;
      addScore(histKey, result.pronunciationScore);
      const profile = loadMasteryProfile();
      const transfer = analyzeFreePracticeTransfer({
        profile,
        result,
        text,
        mode: isSentence(text) ? "sentence" : "word",
      });
      if (transfer.evidences.length > 0) {
        const reliability = reliabilityFromRecordingQuality(
          recordingQuality.report,
          {
            evidenceStrength:
              transfer.evidences.length >= 2 ? "strong" : "fair",
            note:
              recordingQuality.report?.issues.length === 0
                ? "自由练习命中当前目标且录音质量稳定，可计入迁移证据。"
                : "自由练习录音存在质量提示，本次只作为观察，不提升掌握度。",
          },
        );
        const recorded = recordFreePracticeTransfer(
          profile,
          transfer,
          reliability,
        );
        saveMasteryProfile(recorded.profile);
        setProfile(recorded.profile);
        setTransferSummary(recorded.summary);
      } else {
        setTransferSummary(transfer);
      }
      llm.requestFeedback(
        text,
        result,
        isSentence(text) ? "sentence" : "phoneme",
        languageId,
      );
    }
  }, [
    recorder.audioBlob,
    sentence,
    azure,
    llm,
    recordingQuality,
    languageId,
    languageProfile.azureLocale,
  ]);

  useEffect(() => {
    if (
      recorder.autoStopped &&
      recorder.audioBlob &&
      recordingQuality.report &&
      !recordingQuality.isAnalyzing &&
      !autoAssessTriggered.current
    ) {
      autoAssessTriggered.current = true;
      handleAssess();
    }
  }, [
    recorder.autoStopped,
    recorder.audioBlob,
    recordingQuality,
    handleAssess,
  ]);

  useEffect(() => {
    if (recorder.isRecording) {
      autoAssessTriggered.current = false;
    }
  }, [recorder.isRecording]);

  const handleWordClick = useCallback(
    (word: AzureWord) => {
      setSelectedWord(word);
      playback.stop();
      tts.reset();
      wordAudio.playWord(word.word, "blue", languageId);
    },
    [playback, tts, wordAudio, languageId],
  );

  const handlePlayRecording = useCallback(() => {
    const replayBlob = recorder.rawBlob ?? recorder.audioBlob;
    if (replayBlob) {
      wordAudio.stop();
      tts.reset();
      playback.playBlob(replayBlob);
    }
  }, [recorder.rawBlob, recorder.audioBlob, wordAudio, tts, playback]);

  const handleClear = useCallback(() => {
    playback.stop();
    tts.reset();
    wordAudio.stop();
    recorder.reset();
    azure.reset();
    llm.reset();
    setSelectedWord(null);
    setTransferSummary(null);
    recordingQuality.reset();
    autoAssessTriggered.current = false;
  }, [playback, tts, wordAudio, recorder, azure, llm, recordingQuality]);

  const handleWordAudioPlay = useCallback(
    (word: string) => {
      playback.stop();
      tts.reset();
      wordAudio.playWord(word, "blue", languageId);
    },
    [playback, tts, wordAudio, languageId],
  );

  const handleRetryFeedback = useCallback(() => {
    if (!azure.result || !sentence.trim()) return;
    const text = sentence.trim();
    llm.reset();
    llm.requestFeedback(
      text,
      azure.result,
      isSentence(text) ? "sentence" : "phoneme",
      languageId,
    );
  }, [azure.result, sentence, llm, languageId]);

  const hasResult = !!(
    azure.result ||
    llm.hasFeedback ||
    llm.isStreaming ||
    llm.error
  );

  // ── Render ──

  return (
    <LanguageModuleGate moduleName="自由练习" readinessKey="sentencePractice">
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
            wordAudioIsPlaying={wordAudio.isPlaying}
            wordAudioIsLoading={wordAudio.isLoading}
            onWordAudioPlay={handleWordAudioPlay}
            ttsIsPlaying={tts.isPlaying}
            ttsIsLoading={tts.isLoading}
            ttsError={tts.error}
            ttsWordTimings={tts.wordTimings}
            ttsCurrentTime={tts.currentTime}
            onTtsReplay={() => tts.replay()}
            targetPreview={targetPreview}
            onListen={handleListen}
          />

          <SentenceRecordingCard
            sentence={sentence}
            isRecording={recorder.isRecording}
            elapsedSeconds={recorder.elapsedSeconds}
            maxDurationSeconds={recorder.maxDurationSeconds}
            audioBlob={recorder.audioBlob}
            stream={recorder.stream}
            qualityReport={recordingQuality.report}
            isAnalyzingQuality={recordingQuality.isAnalyzing}
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
            languageId={languageId}
            result={azure.result}
            selectedWord={selectedWord}
            stressedSyllables={stressedSyllables}
            onWordClick={handleWordClick}
            feedback={llm.feedback}
            isStreaming={llm.isStreaming}
            hasFeedback={llm.hasFeedback}
            llmError={llm.error}
            onRetryFeedback={handleRetryFeedback}
            transferSummary={transferSummary}
          />
        </div>
      </div>
      </div>
    </LanguageModuleGate>
  );
}
