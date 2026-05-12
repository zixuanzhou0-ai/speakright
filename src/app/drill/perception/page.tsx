"use client";

import { ArrowLeft, Check, Headphones, Volume2, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { PerceptionPair } from "@/lib/perception-pairs";
import { PERCEPTION_PAIRS } from "@/lib/perception-pairs";

type PlayingSlot = "A" | "B" | "X" | null;

type PerceptionPhase =
  | { type: "select" }
  | { type: "playing"; questionIndex: number; xIsA: boolean }
  | { type: "answered"; questionIndex: number; xIsA: boolean; correct: boolean }
  | { type: "completed"; correct: number; total: number };

const QUESTIONS_PER_SESSION = 10;

export default function PerceptionDrillPage() {
  const [selectedPair, setSelectedPair] = useState<PerceptionPair | null>(null);
  const [phase, setPhase] = useState<PerceptionPhase>({ type: "select" });
  const [correctCount, setCorrectCount] = useState(0);
  // Single audio player shared across A/B/X buttons enforces mutual exclusion
  // (play() cleanup unloads the previous Howl). Tracks which slot is active
  // for UI highlighting.
  const player = useAudioPlayer();
  const [activeSlot, setActiveSlot] = useState<PlayingSlot>(null);
  const questionsRef = useRef<Array<{ itemIndex: number; xIsA: boolean }>>([]);

  const handleSelectPair = (pair: PerceptionPair) => {
    setSelectedPair(pair);
    setCorrectCount(0);

    // Generate random questions
    const questions: Array<{ itemIndex: number; xIsA: boolean }> = [];
    for (let i = 0; i < QUESTIONS_PER_SESSION; i++) {
      questions.push({
        itemIndex: i % pair.items.length,
        xIsA: Math.random() > 0.5,
      });
    }
    questionsRef.current = questions;
    setPhase({ type: "playing", questionIndex: 0, xIsA: questions[0].xIsA });
  };

  const currentQuestion =
    selectedPair && phase.type !== "select" && phase.type !== "completed"
      ? questionsRef.current[phase.questionIndex]
      : null;

  const currentItem =
    selectedPair && currentQuestion
      ? selectedPair.items[currentQuestion.itemIndex]
      : null;

  const handlePlayA = () => {
    if (!currentItem) return;
    setActiveSlot("A");
    player.play(currentItem.audioA);
  };

  const handlePlayB = () => {
    if (!currentItem) return;
    setActiveSlot("B");
    player.play(currentItem.audioB);
  };

  const handlePlayX = () => {
    if (!currentItem || !currentQuestion) return;
    const xAudio = currentQuestion.xIsA
      ? currentItem.audioA
      : currentItem.audioB;
    setActiveSlot("X");
    player.play(xAudio);
  };

  const handleAnswer = useCallback(
    (answeredA: boolean) => {
      if (phase.type !== "playing") return;
      const correct = answeredA === phase.xIsA;
      if (correct) setCorrectCount((c) => c + 1);
      setPhase({
        type: "answered",
        questionIndex: phase.questionIndex,
        xIsA: phase.xIsA,
        correct,
      });
    },
    [phase],
  );

  const handleNext = () => {
    if (phase.type !== "answered" || !selectedPair) return;
    const nextIndex = phase.questionIndex + 1;
    if (nextIndex >= QUESTIONS_PER_SESSION) {
      setPhase({
        type: "completed",
        correct: correctCount,
        total: QUESTIONS_PER_SESSION,
      });
    } else {
      const q = questionsRef.current[nextIndex];
      setPhase({ type: "playing", questionIndex: nextIndex, xIsA: q.xIsA });
    }
  };

  const handleReset = () => {
    setSelectedPair(null);
    setPhase({ type: "select" });
    setCorrectCount(0);
  };

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">辨音训练</h1>
        {selectedPair && (
          <span className="text-sm text-muted-foreground">
            {selectedPair.label}
          </span>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full">
        {/* Select */}
        {phase.type === "select" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              选择一组音标，训练你的听力辨别能力。系统播放 A、B、X
              三个音，你判断 X 是 A 还是 B。
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PERCEPTION_PAIRS.map((pair) => (
                <motion.button
                  key={`${pair.phonemeA}-${pair.phonemeB}`}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectPair(pair)}
                  className="rounded-xl border bg-card p-4 text-center shadow-sm hover:border-primary/50 cursor-pointer"
                >
                  <Headphones className="mx-auto mb-2 h-6 w-6 text-primary" />
                  <span className="font-mono text-lg font-bold">
                    {pair.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Playing */}
        {phase.type === "playing" && currentItem && selectedPair && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                第 {phase.questionIndex + 1} / {QUESTIONS_PER_SESSION} 题
              </span>
              <span>正确 {correctCount}</span>
            </div>

            <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
              <p className="text-center text-sm text-muted-foreground">
                听 A、B、X 三个音，判断 X 是哪一个
              </p>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "A",
                    play: handlePlayA,
                    playing: player.isPlaying && activeSlot === "A",
                  },
                  {
                    label: "B",
                    play: handlePlayB,
                    playing: player.isPlaying && activeSlot === "B",
                  },
                  {
                    label: "X",
                    play: handlePlayX,
                    playing: player.isPlaying && activeSlot === "X",
                  },
                ].map((btn) => (
                  <motion.button
                    key={btn.label}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={btn.play}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer ${
                      btn.playing
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/30"
                    }`}
                  >
                    <Volume2
                      className={`h-6 w-6 ${btn.playing ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-lg font-bold">{btn.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => handleAnswer(true)}
                  variant="outline"
                  size="lg"
                  className="flex-1 cursor-pointer"
                >
                  X = A
                </Button>
                <Button
                  onClick={() => handleAnswer(false)}
                  variant="outline"
                  size="lg"
                  className="flex-1 cursor-pointer"
                >
                  X = B
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Answered */}
        {phase.type === "answered" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4"
          >
            {phase.correct ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
              >
                <Check className="h-8 w-8 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30"
              >
                <X className="h-8 w-8 text-red-500" />
              </motion.div>
            )}
            <p className="text-lg font-bold">
              {phase.correct ? "正确！" : "不对"}
            </p>
            <p className="text-sm text-muted-foreground">
              X = {phase.xIsA ? "A" : "B"}
            </p>
            <Button onClick={handleNext} className="cursor-pointer">
              下一题
            </Button>
          </motion.div>
        )}

        {/* Completed */}
        {phase.type === "completed" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4"
          >
            <Headphones className="mx-auto h-12 w-12 text-primary" />
            <h2 className="text-2xl font-bold">辨音训练完成</h2>
            <div
              className={`inline-flex h-20 w-20 items-center justify-center rounded-2xl text-white ${
                phase.correct >= 8
                  ? "bg-primary"
                  : phase.correct >= 6
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            >
              <span className="text-3xl font-bold">
                {correctCount}/{phase.total}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {correctCount >= 8
                ? "听力辨别能力很强！可以进入发音训练。"
                : correctCount >= 6
                  ? "还不错，建议多听几遍标准发音再练。"
                  : "建议先多听对比音频，建立听觉靶点后再练发音。"}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={handleReset}
                className="cursor-pointer"
              >
                返回
              </Button>
              <Button
                onClick={() => selectedPair && handleSelectPair(selectedPair)}
                className="cursor-pointer"
              >
                再练一轮
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
