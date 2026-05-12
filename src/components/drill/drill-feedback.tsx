"use client";

import { Check, RotateCcw, SkipForward, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { DrillAttempt, DrillItem } from "@/types/drill";
import { DrillProgress } from "./drill-progress";

interface DrillFeedbackProps {
  item: DrillItem;
  index: number;
  total: number;
  attempt: DrillAttempt;
  passed: boolean;
  attemptCount: number;
  maxAttempts: number;
  passThreshold: number;
  onNext: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onPlayReference: () => void;
}

export function DrillFeedback({
  item,
  index,
  total,
  attempt,
  passed,
  attemptCount,
  maxAttempts,
  passThreshold,
  onNext,
  onRetry,
  onSkip,
  onPlayReference,
}: DrillFeedbackProps) {
  const canRetry = !passed && attemptCount < maxAttempts;
  const mustDecide = !passed && attemptCount >= maxAttempts;

  return (
    <div className="space-y-6">
      <DrillProgress current={index} total={total} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-5 rounded-xl border bg-card p-8 shadow-sm"
      >
        <span className="text-3xl font-bold">{item.text}</span>

        {/* Score display */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`flex h-24 w-24 items-center justify-center rounded-2xl text-white ${
            passed
              ? "bg-primary"
              : attempt.score.pronunciationScore >= 50
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
        >
          <span className="text-3xl font-bold tabular-nums">
            {attempt.score.pronunciationScore}
          </span>
        </motion.div>

        {passed ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-primary"
          >
            <Check className="h-5 w-5" />
            <span className="font-medium">达标！发音很棒</span>
          </motion.div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-red-500">
              目标音素未达标（需要 {passThreshold} 分）
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              第 {attemptCount}/{maxAttempts} 次尝试
            </p>
          </div>
        )}

        {attempt.score.overallScore != null && (
          <div className="grid w-full grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
            <div>
              <p className="text-xs text-muted-foreground">目标音素分</p>
              <p className="text-xl font-bold tabular-nums">
                {attempt.score.targetScore ?? attempt.score.pronunciationScore}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">整词/整句分</p>
              <p className="text-xl font-bold tabular-nums">
                {attempt.score.overallScore}
              </p>
            </div>
          </div>
        )}

        {/* Pronunciation tip for failed attempts */}
        {!passed && item.description && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-400">
              💡 {item.description}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {passed && (
            <Button onClick={onNext} className="gap-2 cursor-pointer">
              下一个
              <SkipForward className="h-4 w-4" />
            </Button>
          )}

          {canRetry && (
            <>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayReference}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
              </motion.button>
              <Button
                onClick={onRetry}
                variant="default"
                className="gap-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                再试一次
              </Button>
            </>
          )}

          {mustDecide && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                已尝试 {maxAttempts} 次，先慢速拆解再继续：
              </p>
              <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                先只模仿目标音的口型，再读单词前半段，最后读完整内容。慢一点，目标音素过线比整词分更重要。
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={onPlayReference}
                  variant="outline"
                  className="gap-2 cursor-pointer"
                >
                  <Volume2 className="h-4 w-4" />
                  再听一遍
                </Button>
                <Button
                  onClick={onSkip}
                  variant="secondary"
                  className="gap-2 cursor-pointer"
                >
                  <SkipForward className="h-4 w-4" />
                  跳过此词
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
