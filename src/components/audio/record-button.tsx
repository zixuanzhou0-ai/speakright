"use client";

import { Mic, Square } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface RecordButtonProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function RecordButton({
  isRecording,
  onStart,
  onStop,
  disabled,
}: RecordButtonProps) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Pulse rings when recording */}
      {isRecording &&
        [0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full bg-red-500/20"
            animate={{
              scale: [1, 2.5],
              opacity: [0.6, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
              ease: "easeOut",
            }}
          />
        ))}
      <motion.div
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="relative z-10"
      >
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          className={`h-16 w-16 cursor-pointer rounded-full ${
            isRecording
              ? ""
              : "bg-gradient-to-b from-primary to-primary/80 shadow-lg shadow-primary/25"
          }`}
          onClick={isRecording ? onStop : onStart}
          disabled={disabled}
          aria-label={isRecording ? "停止录音" : "开始录音"}
        >
          {isRecording ? (
            <Square className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </motion.div>
    </div>
  );
}
