"use client";

import {
  bindFreePracticeValue,
  getFreePracticeTextFingerprint,
  isCurrentFreePracticeRequest,
  readBoundFreePracticeValue,
} from "@speakright/core/training/free-practice-session";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageModuleGate } from "@/components/common/language-module-gate";
import { SentenceInputCard } from "@/components/sentences/sentence-input-card";
import { SentenceRecordingCard } from "@/components/sentences/sentence-recording-card";
import { SentenceResultsColumn } from "@/components/sentences/sentence-results-column";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import type { FeedbackData } from "@/hooks/use-llm-feedback";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useMicrophoneDevice } from "@/hooks/use-microphone-device";
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
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { buildFreePracticeAttemptEvidence } from "@/lib/free-practice-evidence";
import {
  analyzeFreePracticeTransfer,
  buildFreePracticeTargetPreview,
  type FreePracticeTransferSummary,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import { getLanguageProfile } from "@/lib/language-profiles";
import { appendLearningEvidence } from "@/lib/learning-evidence";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";
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
  const [sessionStorageWarning, setSessionStorageWarning] = useState<
    string | null
  >(null);
  const handleSessionStorageError = useCallback((message: string) => {
    setSessionStorageWarning(message);
  }, []);
  const [sentence, setSentence] = useSessionState(`${sessionPrefix}:text`, "", {
    onPersistenceError: handleSessionStorageError,
  });
  const [speed, setSpeed] = useSessionState(`${sessionPrefix}:speed`, 0.85, {
    onPersistenceError: handleSessionStorageError,
  });
  const [selectedWord, setSelectedWord] = useState<AzureWord | null>(null);
  const [transferSummary, setTransferSummary] =
    useState<FreePracticeTransferSummary | null>(null);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [localSaveError, setLocalSaveError] = useState<string | null>(null);

  const isWordMode = !isSentence(sentence);
  const trimmedText = sentence.trim();
  const textFingerprint = getFreePracticeTextFingerprint(sentence);
  const canUseMasteryTransfer = canRecordFormalMastery(languageId);

  const wordIpa = useWordIpa(isWordMode ? trimmedText : "");
  const [hasPlayedWord, setHasPlayedWord] = useState(false);

  const stressedSyllables = useSyllableStress(
    selectedWord?.word ?? null,
    selectedWord?.syllables ?? [],
  );

  const tts = useTtsAligned();
  const wordAudio = useWordPronunciation();
  const microphone = useMicrophoneDevice();
  // Free-practice page allows up to 150-char sentences; bump cap to 60s so
  // paragraph-length input isn't cut off mid-read.
  const recorder = useRecorder({
    maxDurationMs: 60_000,
    deviceId: microphone.selectedDeviceId,
  });
  const [recordingTextFingerprint, setRecordingTextFingerprint] = useState<
    string | null
  >(null);
  const [azureResultTextFingerprint, setAzureResultTextFingerprint] = useState<
    string | null
  >(null);
  const [llmTextFingerprint, setLlmTextFingerprint] = useState<string | null>(
    null,
  );
  const [assessmentTextFingerprint, setAssessmentTextFingerprint] = useState<
    string | null
  >(null);
  const boundAudioBlob =
    recordingTextFingerprint === textFingerprint ? recorder.audioBlob : null;
  const boundRawBlob =
    recordingTextFingerprint === textFingerprint ? recorder.rawBlob : null;
  const boundRecordingStream =
    recordingTextFingerprint === textFingerprint ? recorder.stream : null;
  const recordingQuality = useRecordingQuality(boundAudioBlob, {
    expectedMode: isWordMode ? "word" : "sentence",
    minDurationMs: isWordMode ? 500 : 800,
  });
  const azure = useAzureAssessment();
  const llm = useLlmFeedback();
  const playback = useAudioPlayer();
  const autoAssessTriggered = useRef(false);
  const assessmentRequestIdRef = useRef(0);
  const restoredSessionPrefixRef = useRef<string | null>(null);
  const currentTextFingerprintRef = useRef(textFingerprint);
  const previousTextFingerprintRef = useRef(textFingerprint);
  const previousTtsPlaybackSettingsRef = useRef({ languageId, speed });
  const visibleAzureResult =
    azureResultTextFingerprint === textFingerprint ? azure.result : null;
  const isLlmBoundToCurrentText = llmTextFingerprint === textFingerprint;
  const targetPreview = useMemo(
    () =>
      trimmedText && canUseMasteryTransfer
        ? buildFreePracticeTargetPreview({
            profile,
            text: trimmedText,
            mode: isWordMode ? "word" : "sentence",
          })
        : null,
    [profile, trimmedText, isWordMode, canUseMasteryTransfer],
  );

  // ── Session restore/save ──

  useEffect(() => {
    if (restoredSessionPrefixRef.current === sessionPrefix) return;
    restoredSessionPrefixRef.current = sessionPrefix;

    const savedResultEntry = loadSession<unknown>(
      `${sessionPrefix}:azureResult`,
      { onPersistenceError: handleSessionStorageError },
    );
    const savedFeedbackEntry = loadSession<unknown>(
      `${sessionPrefix}:llmFeedback`,
      { onPersistenceError: handleSessionStorageError },
    );
    const savedWordIdx = loadSession<number>(
      `${sessionPrefix}:selectedWordIdx`,
      { onPersistenceError: handleSessionStorageError },
    );
    const savedResult = readBoundFreePracticeValue<AzureAssessmentResult>(
      savedResultEntry,
      textFingerprint,
    );
    const savedFeedback = readBoundFreePracticeValue<FeedbackData>(
      savedFeedbackEntry,
      textFingerprint,
    );

    if (savedResult) {
      setAzureResultTextFingerprint(textFingerprint);
      azure.restore(savedResult);
      if (savedWordIdx != null && savedResult.words[savedWordIdx]) {
        setSelectedWord(savedResult.words[savedWordIdx]);
      }
    }
    if (savedFeedback) {
      setLlmTextFingerprint(textFingerprint);
      llm.restore(savedFeedback);
    }
  }, [azure, llm, sessionPrefix, textFingerprint, handleSessionStorageError]);

  useEffect(() => {
    const refreshProfile = () => setProfile(loadMasteryProfile());
    refreshProfile();
    window.addEventListener("storage", refreshProfile);
    return () => window.removeEventListener("storage", refreshProfile);
  }, []);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    const value =
      azureResultTextFingerprint === textFingerprint && azure.result
        ? bindFreePracticeValue(textFingerprint, azure.result)
        : null;
    saveSession(`${sessionPrefix}:azureResult`, value, {
      onPersistenceError: handleSessionStorageError,
    });
  }, [
    azure.result,
    azureResultTextFingerprint,
    textFingerprint,
    sessionPrefix,
    handleSessionStorageError,
  ]);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    const value =
      llmTextFingerprint === textFingerprint &&
      llm.hasFeedback &&
      !llm.isStreaming
        ? bindFreePracticeValue(textFingerprint, llm.feedback)
        : null;
    saveSession(`${sessionPrefix}:llmFeedback`, value, {
      onPersistenceError: handleSessionStorageError,
    });
  }, [
    llm.feedback,
    llm.hasFeedback,
    llm.isStreaming,
    llmTextFingerprint,
    textFingerprint,
    sessionPrefix,
    handleSessionStorageError,
  ]);

  useEffect(() => {
    if (restoredSessionPrefixRef.current !== sessionPrefix) return;
    const idx =
      selectedWord && visibleAzureResult
        ? visibleAzureResult.words.indexOf(selectedWord)
        : null;
    saveSession(`${sessionPrefix}:selectedWordIdx`, idx, {
      onPersistenceError: handleSessionStorageError,
    });
  }, [
    selectedWord,
    visibleAzureResult,
    sessionPrefix,
    handleSessionStorageError,
  ]);

  // ── Handlers ──

  const invalidatePracticeForTextChange = useCallback(
    (nextTextFingerprint: string) => {
      assessmentRequestIdRef.current += 1;
      currentTextFingerprintRef.current = nextTextFingerprint;
      previousTextFingerprintRef.current = nextTextFingerprint;
      if (recorder.isRecording) recorder.stopRecording();
      playback.stop();
      tts.reset();
      wordAudio.stop();
      wordAudio.clearError();
      recorder.reset();
      recordingQuality.reset();
      azure.reset();
      llm.reset();
      setRecordingTextFingerprint(null);
      setAzureResultTextFingerprint(null);
      setLlmTextFingerprint(null);
      setAssessmentTextFingerprint(null);
      setSelectedWord(null);
      setTransferSummary(null);
      setHasPlayedWord(false);
      setLocalSaveError(null);
      autoAssessTriggered.current = false;
      saveSession(`${sessionPrefix}:azureResult`, null, {
        onPersistenceError: handleSessionStorageError,
      });
      saveSession(`${sessionPrefix}:llmFeedback`, null, {
        onPersistenceError: handleSessionStorageError,
      });
      saveSession(`${sessionPrefix}:selectedWordIdx`, null, {
        onPersistenceError: handleSessionStorageError,
      });
    },
    [
      recorder,
      playback,
      tts,
      wordAudio,
      recordingQuality,
      azure,
      llm,
      sessionPrefix,
      handleSessionStorageError,
    ],
  );

  const handleSentenceChange = useCallback(
    (nextSentence: string) => {
      const nextTextFingerprint = getFreePracticeTextFingerprint(nextSentence);
      if (currentTextFingerprintRef.current !== nextTextFingerprint) {
        invalidatePracticeForTextChange(nextTextFingerprint);
      }
      setSentence(nextSentence);
    },
    [invalidatePracticeForTextChange, setSentence],
  );

  const handleClearSession = useCallback(() => {
    clearSessionPrefix(sessionPrefix, {
      onPersistenceError: handleSessionStorageError,
    });
    invalidatePracticeForTextChange(getFreePracticeTextFingerprint(""));
    setSentence("");
    setSpeed(0.85);
  }, [
    invalidatePracticeForTextChange,
    setSentence,
    setSpeed,
    sessionPrefix,
    handleSessionStorageError,
  ]);

  useEffect(() => {
    if (previousTextFingerprintRef.current === textFingerprint) return;
    invalidatePracticeForTextChange(textFingerprint);
  }, [textFingerprint, invalidatePracticeForTextChange]);

  useEffect(() => {
    const previous = previousTtsPlaybackSettingsRef.current;
    if (previous.languageId === languageId && previous.speed === speed) return;

    previousTtsPlaybackSettingsRef.current = { languageId, speed };
    tts.reset();
  }, [languageId, speed, tts]);

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
    assessmentRequestIdRef.current += 1;
    playback.stop();
    tts.reset();
    wordAudio.stop();
    wordAudio.clearError();
    llm.reset();
    azure.reset();
    recorder.reset();
    setRecordingTextFingerprint(textFingerprint);
    setAzureResultTextFingerprint(null);
    setLlmTextFingerprint(null);
    setAssessmentTextFingerprint(null);
    setSelectedWord(null);
    setTransferSummary(null);
    setLocalSaveError(null);
    recordingQuality.reset();
    void recorder.startRecording();
  }, [
    playback,
    tts,
    wordAudio,
    llm,
    azure,
    recorder,
    recordingQuality,
    textFingerprint,
  ]);

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleAssess = useCallback(async () => {
    if (!boundAudioBlob || !trimmedText) return;
    if (recordingQuality.isAnalyzing || !recordingQuality.report?.canSubmit) {
      return;
    }

    const requestId = ++assessmentRequestIdRef.current;
    const requestTextFingerprint = textFingerprint;
    const text = trimmedText;
    const audioBlob = boundAudioBlob;
    const qualityReport = recordingQuality.report;
    setAssessmentTextFingerprint(requestTextFingerprint);
    setAzureResultTextFingerprint(null);
    setLlmTextFingerprint(null);
    setSelectedWord(null);
    const result = await azure.assess(
      audioBlob,
      text,
      languageProfile.azureLocale,
    );

    if (
      !isCurrentFreePracticeRequest({
        requestId,
        currentRequestId: assessmentRequestIdRef.current,
        textFingerprint: requestTextFingerprint,
        currentTextFingerprint: currentTextFingerprintRef.current,
      })
    ) {
      return;
    }

    if (result) {
      setAzureResultTextFingerprint(requestTextFingerprint);
      setLocalSaveError(null);
      const histKey = `${languageId}:${text.slice(0, 50)}:${text.length}`;
      const scoreSaved = addScore(histKey, result.pronunciationScore);
      let masterySaved = true;
      let evidenceSaved = true;

      if (canUseMasteryTransfer) {
        const profile = loadMasteryProfile();
        const transfer = analyzeFreePracticeTransfer({
          profile,
          result,
          text,
          mode: isSentence(text) ? "sentence" : "word",
        });
        if (transfer.evidences.length > 0) {
          const reliability = reliabilityFromRecordingQuality(qualityReport, {
            languageId,
            evidenceStrength:
              transfer.evidences.length >= 2 ? "strong" : "fair",
            note:
              qualityReport.issues.length === 0
                ? "自由练习命中当前目标且录音质量稳定，可保存为原始观察。"
                : "自由练习录音存在质量提示，本次只作为观察，不提升正式证据阶段。",
          });
          const reliableTransfer = {
            ...transfer,
            assessmentReliability: reliability,
          };
          evidenceSaved = buildFreePracticeAttemptEvidence({
            sessionId: `free-${transfer.generatedAt}`,
            languageId,
            summary: reliableTransfer,
          })
            .map((evidence) => appendLearningEvidence(evidence))
            .every(Boolean);
          const recorded = recordFreePracticeTransfer(
            profile,
            reliableTransfer,
            reliability,
          );
          masterySaved = saveMasteryProfile(recorded.profile);
          setProfile(recorded.profile);
          setTransferSummary(recorded.summary);
        } else {
          setTransferSummary(transfer);
        }
      } else {
        setTransferSummary(null);
      }
      if (!scoreSaved || !masterySaved || !evidenceSaved) {
        setLocalSaveError(
          "本次评分已完成，但本机趋势图、练习记录或迁移证据未保存。可能是本机存储空间不足或系统限制了本地存储；你可以继续练习，稍后在设置页导出/重置本机数据后重试。",
        );
      }
      setLlmTextFingerprint(requestTextFingerprint);
      llm.requestFeedback(
        text,
        result,
        isSentence(text) ? "sentence" : "phoneme",
        languageId,
      );
    }
  }, [
    boundAudioBlob,
    trimmedText,
    textFingerprint,
    azure,
    llm,
    recordingQuality,
    languageId,
    languageProfile.azureLocale,
    canUseMasteryTransfer,
  ]);

  useEffect(() => {
    if (
      recorder.autoStopped &&
      boundAudioBlob &&
      recordingQuality.report &&
      !recordingQuality.isAnalyzing &&
      !autoAssessTriggered.current
    ) {
      autoAssessTriggered.current = true;
      handleAssess();
    }
  }, [recorder.autoStopped, boundAudioBlob, recordingQuality, handleAssess]);

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
    const replayBlob = boundRawBlob ?? boundAudioBlob;
    if (replayBlob) {
      wordAudio.stop();
      tts.reset();
      playback.playBlob(replayBlob);
    }
  }, [boundRawBlob, boundAudioBlob, wordAudio, tts, playback]);

  const handleClear = useCallback(() => {
    assessmentRequestIdRef.current += 1;
    playback.stop();
    tts.reset();
    wordAudio.stop();
    recorder.reset();
    azure.reset();
    llm.reset();
    setRecordingTextFingerprint(null);
    setAzureResultTextFingerprint(null);
    setLlmTextFingerprint(null);
    setAssessmentTextFingerprint(null);
    setLocalSaveError(null);
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
    if (!visibleAzureResult || !trimmedText) return;
    const text = trimmedText;
    llm.reset();
    setLlmTextFingerprint(textFingerprint);
    llm.requestFeedback(
      text,
      visibleAzureResult,
      isSentence(text) ? "sentence" : "phoneme",
      languageId,
    );
  }, [visibleAzureResult, trimmedText, textFingerprint, llm, languageId]);

  const visibleLlmHasFeedback = isLlmBoundToCurrentText && llm.hasFeedback;
  const visibleLlmIsStreaming = isLlmBoundToCurrentText && llm.isStreaming;
  const visibleLlmError = isLlmBoundToCurrentText ? llm.error : null;
  const isAssessingCurrentText =
    assessmentTextFingerprint === textFingerprint && azure.isLoading;
  const visibleAssessmentError =
    assessmentTextFingerprint === textFingerprint ? azure.error : null;
  const hasResult = !!(
    visibleAzureResult ||
    visibleLlmHasFeedback ||
    visibleLlmIsStreaming ||
    visibleLlmError
  );

  // ── Render ──

  return (
    <LanguageModuleGate
      moduleName="自由练习"
      readinessKey="sentencePractice"
      capabilityRoute="freePractice"
    >
      <div
        className="flex min-h-full flex-col overflow-visible px-4 py-4 sm:px-6 lg:h-full lg:overflow-hidden"
        data-smoke="sentences-page"
      >
        <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
              自由练习
            </h1>
          </div>
          {(visibleAzureResult || visibleLlmHasFeedback) && (
            <button
              type="button"
              onClick={handleClearSession}
              className="inline-flex h-auto min-h-7 max-w-full items-center justify-center gap-1 whitespace-normal break-words rounded-md px-2 py-1 text-center text-xs text-muted-foreground transition-colors [overflow-wrap:anywhere] hover:bg-muted hover:text-foreground"
              data-smoke="free-practice-clear-session"
            >
              <Trash2 className="h-3 w-3" />
              清除练习记录
            </button>
          )}
        </div>
        <p className="mb-4 shrink-0 break-words text-muted-foreground [overflow-wrap:anywhere]">
          输入单词或句子，听标准发音，跟读录音，获得 AI 评分与反馈
        </p>
        {sessionStorageWarning && (
          <p
            className="mb-3 shrink-0 break-words rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 [overflow-wrap:anywhere] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
            data-smoke="free-practice-session-storage-warning"
            role="alert"
          >
            {sessionStorageWarning}
          </p>
        )}

        <div
          data-smoke="free-practice-layout"
          className={
            hasResult
              ? "grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_2fr]"
              : "mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 lg:min-h-0 lg:flex-1"
          }
        >
          {/* Left Column */}
          <div
            className="flex min-h-0 flex-col gap-3 pb-4 lg:overflow-y-auto scrollbar-thin"
            data-smoke="free-practice-left-column"
          >
            {!hasResult && (
              <ol
                className="grid grid-cols-3 gap-2 rounded-xl border bg-primary/5 p-3 text-center text-xs font-medium text-muted-foreground"
                aria-label="自由练习步骤"
              >
                <li className="rounded-lg bg-background px-2 py-2">
                  1. 输入内容
                </li>
                <li className="rounded-lg bg-background px-2 py-2">
                  2. 听示范
                </li>
                <li className="rounded-lg bg-background px-2 py-2">3. 录音</li>
              </ol>
            )}
            <SentenceInputCard
              sentence={sentence}
              onSentenceChange={handleSentenceChange}
              speed={speed}
              onSpeedChange={setSpeed}
              languageId={languageId}
              isWordMode={isWordMode}
              trimmedText={trimmedText}
              wordIpa={wordIpa}
              hasPlayedWord={hasPlayedWord}
              wordAudioIsPlaying={wordAudio.isPlaying}
              wordAudioIsLoading={wordAudio.isLoading}
              wordAudioError={wordAudio.error}
              onWordAudioPlay={handleWordAudioPlay}
              ttsIsPlaying={tts.isPlaying}
              ttsIsLoading={tts.isLoading}
              ttsHasAudio={tts.hasAudio}
              ttsError={tts.error}
              ttsWordTimings={tts.wordTimings}
              ttsCurrentTime={tts.currentTime}
              onTtsReplay={() => tts.replay()}
              targetPreview={targetPreview}
              onListen={handleListen}
            />

            <SentenceRecordingCard
              sentence={sentence}
              languageId={languageId}
              isRecording={recorder.isRecording}
              elapsedSeconds={recorder.elapsedSeconds}
              maxDurationSeconds={recorder.maxDurationSeconds}
              audioBlob={boundAudioBlob}
              stream={boundRecordingStream}
              microphoneDevices={microphone.devices}
              selectedMicrophoneDeviceId={microphone.selectedDeviceId}
              isLoadingMicrophones={microphone.isLoading}
              onMicrophoneChange={microphone.setSelectedDeviceId}
              onMicrophoneRefresh={microphone.refresh}
              qualityReport={recordingQuality.report}
              isAnalyzingQuality={recordingQuality.isAnalyzing}
              recorderError={recorder.error}
              onRecordStart={handleRecordStart}
              onRecordStop={handleRecordStop}
              isPlaying={playback.isPlaying}
              onReplay={handlePlayRecording}
              isAssessing={isAssessingCurrentText}
              assessError={visibleAssessmentError}
              localSaveError={localSaveError}
              result={visibleAzureResult}
              onClear={handleClear}
              onAssess={handleAssess}
            />
          </div>

          {/* Right Column */}
          {hasResult && (
            <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto scrollbar-thin lg:pb-4">
              <SentenceResultsColumn
                hasResult={hasResult}
                languageId={languageId}
                result={visibleAzureResult}
                selectedWord={selectedWord}
                stressedSyllables={stressedSyllables}
                onWordClick={handleWordClick}
                feedback={llm.feedback}
                isStreaming={visibleLlmIsStreaming}
                hasFeedback={visibleLlmHasFeedback}
                llmError={visibleLlmError}
                onRetryFeedback={handleRetryFeedback}
                transferSummary={transferSummary}
              />
            </div>
          )}
        </div>
      </div>
    </LanguageModuleGate>
  );
}
