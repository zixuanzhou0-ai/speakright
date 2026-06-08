"use client";

import { motion } from "motion/react";
import { RecordButton } from "@/components/audio/record-button";
import { WaveformDisplay } from "@/components/audio/waveform-display";
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
  onStartRecording,
  onStopRecording,
}: DrillRecordingProps) {
  return (
    <div className="space-y-6">
      <DrillProgress current={index} total={total} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 shadow-sm"
      >
        <span className="text-3xl font-bold">{item.text}</span>
        {item.ipa && (
          <span className="font-mono text-base text-muted-foreground">
            {item.ipa}
          </span>
        )}

        <p className="text-sm text-muted-foreground">
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
