"use client";

import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { ScoreSummary } from "@/components/scoring/score-summary";
import type { RecordingQualityReport } from "@/lib/recording-quality";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";

interface SentenceRecordingCardProps {
  sentence: string;
  // Recorder
  isRecording: boolean;
  elapsedSeconds: number;
  maxDurationSeconds: number;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  qualityReport: RecordingQualityReport | null;
  isAnalyzingQuality?: boolean;
  recorderError: string | null;
  onRecordStart: () => void;
  onRecordStop: () => void;
  // Playback
  isPlaying: boolean;
  onReplay: () => void;
  // Assessment
  isAssessing: boolean;
  assessError: string | null;
  result: AzureAssessmentResult | null;
  onClear: () => void;
  onAssess: () => void;
}

export function SentenceRecordingCard({
  sentence,
  isRecording,
  elapsedSeconds,
  maxDurationSeconds,
  audioBlob,
  stream,
  qualityReport,
  isAnalyzingQuality = false,
  recorderError,
  onRecordStart,
  onRecordStop,
  isPlaying,
  onReplay,
  isAssessing,
  assessError,
  result,
  onClear,
  onAssess,
}: SentenceRecordingCardProps) {
  const remaining = maxDurationSeconds - elapsedSeconds;
  const progressPct = (elapsedSeconds / maxDurationSeconds) * 100;
  const trimmed = sentence.trim();
  const assessDisabled =
    !!audioBlob && (isAnalyzingQuality || qualityReport?.canSubmit === false);
  const assessDisabledReason = isAnalyzingQuality
    ? "录音质量检查完成后再评分"
    : "这段录音无效，请先重录";

  return (
    <div className="shrink-0 rounded-xl border bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-col items-center gap-2">
        <RecordButton
          isRecording={isRecording}
          onStart={onRecordStart}
          onStop={onRecordStop}
          disabled={!trimmed || isAssessing}
        />

        {isRecording && (
          <div className="w-full max-w-xs space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  remaining <= 5 ? "bg-red-500" : "bg-primary"
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p
              className={`text-center text-xs tabular-nums ${
                remaining <= 5
                  ? "font-semibold text-red-500"
                  : "text-muted-foreground"
              }`}
            >
              {elapsedSeconds}s / {maxDurationSeconds}s
            </p>
          </div>
        )}

        <WaveformDisplay audioBlob={audioBlob} stream={stream} />

        {isAnalyzingQuality && (
          <p className="text-xs text-muted-foreground">正在检查录音质量...</p>
        )}

        <RecordingQualityPanel report={qualityReport} />

        <RecordingActions
          hasRecording={!!audioBlob && !isRecording}
          isPlaying={isPlaying}
          isAssessing={isAssessing}
          onReplay={onReplay}
          onClear={onClear}
          onAssess={onAssess}
          assessDisabled={assessDisabled}
          assessDisabledReason={assessDisabledReason}
        />

        {recorderError && (
          <p role="alert" className="text-sm text-red-500">
            {recorderError}
          </p>
        )}
        {assessError && (
          <p role="alert" className="text-sm text-red-500">
            {assessError}
          </p>
        )}
      </div>

      {result && (
        <div className="mt-3 border-t pt-3">
          <ScoreSummary
            result={result}
            showProsody={isSentence(sentence)}
            historyKey={`${trimmed.slice(0, 50)}:${trimmed.length}`}
          />
        </div>
      )}
    </div>
  );
}
