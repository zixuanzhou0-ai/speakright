"use client";

import { motion } from "motion/react";

interface DrillProgressProps {
  current: number;
  total: number;
}

export function DrillProgress({ current, total }: DrillProgressProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        {current}/{total}
      </span>
    </div>
  );
}
