"use client";

import { motion } from "motion/react";
import { RecordButton } from "@/components/audio/record-button";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import {
  getCenteredMonoTextClassName,
  getCenteredProminentTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import type { DrillItem } from "@/types/drill";
import { DrillProgress } from "./drill-progress";

interface DrillRecordingProps {
  item: DrillItem;
  index: number;
  total: number;
  isRecording: boolean;
  isAssessing: boolean;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  recorderError?: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function DrillRecording({
  item,
  index,
  total,
  isRecording,
  isAssessing,
  audioBlob,
  stream,
  recorderError,
  onStartRecording,
  onStopRecording,
}: DrillRecordingProps) {
  const textDensity = getPracticeTextDensity(item.text);

  return (
    <div className="space-y-6">
      <DrillProgress current={index} total={total} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm"
      >
        <span
          className={`font-bold ${getCenteredProminentTextClassName(textDensity)}`}
        >
          {item.text}
        </span>
        {item.ipa && (
          <span
            className={`font-mono text-muted-foreground ${getCenteredMonoTextClassName(textDensity)}`}
          >
            {item.ipa}
          </span>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isRecording
            ? "正在录音，请朗读上方单词..."
            : isAssessing
              ? "评分中..."
              : "点击按钮开始录音"}
        </p>

        <RecordButton
          isRecording={isRecording}
          onStart={onStartRecording}
          onStop={onStopRecording}
          disabled={isAssessing}
        />

        <WaveformDisplay audioBlob={audioBlob} stream={stream} />

        {recorderError && (
          <p
            role="alert"
            data-smoke="drill-recording-recorder-error"
            className="max-w-md break-words text-center text-sm text-destructive [overflow-wrap:anywhere]"
          >
            {recorderError}
          </p>
        )}

        {isAssessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent"
            />
            正在分析你的发音...
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
