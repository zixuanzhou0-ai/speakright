"use client";

import { ArrowLeft, PartyPopper, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DrillSummary } from "@/types/drill";

interface DrillSummaryCardProps {
  summary: DrillSummary;
  onRestart: () => void;
  onBack: () => void;
}

// Simple confetti particle
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 100;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="pointer-events-none absolute h-2 w-2 rounded-sm"
      style={{ left: `${x}%`, backgroundColor: color }}
      initial={{ top: "-5%", opacity: 1, rotate: 0, scale: 1 }}
      animate={{
        top: "110%",
        opacity: [1, 1, 0],
        rotate: rotation + 720,
        scale: [1, 0.8, 0.5],
        x: [0, (Math.random() - 0.5) * 200],
      }}
      transition={{
        duration: 2.5 + Math.random(),
        delay,
        ease: "easeOut",
      }}
    />
  );
}

const CONFETTI_COLORS = [
  "oklch(0.7 0.15 175)", // teal (brand)
  "oklch(0.7 0.15 140)", // green
  "oklch(0.75 0.15 80)", // yellow
  "oklch(0.7 0.15 280)", // purple
  "oklch(0.7 0.15 30)", // orange
];

export function DrillSummaryCard({
  summary,
  onRestart,
  onBack,
}: DrillSummaryCardProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const duration = Math.round((summary.completedAt - summary.startedAt) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 z-10 overflow-hidden">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle
              key={`confetti-${i}-${summary.completedAt}`}
              delay={i * 0.05}
              color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="rounded-xl border bg-card p-8 shadow-sm"
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 15,
              delay: 0.2,
            }}
          >
            <PartyPopper className="h-12 w-12 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold">恭喜完成训练！</h2>
        </div>

        {/* Stats grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="总词数" value={String(summary.totalItems)} />
          <StatBox
            label="一次通过"
            value={`${Math.round(summary.firstPassRate * 100)}%`}
          />
          <StatBox label="平均分" value={String(summary.averageScore)} />
          <StatBox
            label="用时"
            value={minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`}
          />
        </div>

        {/* Passed / Skipped */}
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <span className="text-primary">
            通过 {summary.passedItems}/{summary.totalItems}
          </span>
          {summary.skippedItems > 0 && (
            <span className="text-muted-foreground">
              跳过 {summary.skippedItems}
            </span>
          )}
        </div>

        {/* Weak items */}
        {summary.weakItems.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              薄弱词（需加强练习）
            </h3>
            <div className="space-y-2">
              {summary.weakItems.map((item) => (
                <div
                  key={item.item.text}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/20"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.item.text}</span>
                    {item.item.ipa && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.item.ipa}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      item.bestScore >= 60
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {item.bestScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <Button onClick={onRestart} className="gap-2 cursor-pointer">
            <RotateCcw className="h-4 w-4" />
            再练一轮
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold tabular-nums"
      >
        {value}
      </motion.span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
