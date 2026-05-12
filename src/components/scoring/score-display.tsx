"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { getScoreColor } from "@/lib/score-utils";

interface ScoreDisplayProps {
  score: number;
  label: string;
  size?: "sm" | "lg";
}

export function ScoreDisplay({ score, label, size = "lg" }: ScoreDisplayProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 15 });
  const display = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    spring.set(score);
  }, [spring, score]);

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.span
        className={`font-bold ${getScoreColor(score)} ${
          size === "lg" ? "text-4xl" : "text-xl"
        }`}
      >
        {display}
      </motion.span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
