"use client";

import { motion } from "motion/react";
import { syllableToIpa } from "@/lib/azure-phoneme-map";
import { getBarColor } from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type { AzureSyllable } from "@/types/azure";

interface SyllableScoreGridProps {
  syllables: AzureSyllable[];
  compact?: boolean;
}

function stressLabel(stress?: AzureSyllable["stress"]): string {
  if (stress === "primary") return "主重音";
  if (stress === "secondary") return "次重音";
  return "重音未标注";
}

function stressMark(stress?: AzureSyllable["stress"]): string {
  if (stress === "primary") return "ˈ";
  if (stress === "secondary") return "ˌ";
  return "";
}

export function SyllableScoreGrid({
  syllables,
  compact = false,
}: SyllableScoreGridProps) {
  const hasStress = syllables.some(
    (syllable) =>
      syllable.stress === "primary" || syllable.stress === "secondary",
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "grid gap-2",
          compact
            ? "grid-cols-[repeat(auto-fit,minmax(74px,1fr))]"
            : "grid-cols-[repeat(auto-fit,minmax(88px,1fr))]",
        )}
      >
        {syllables.map((syllable) => {
          const score = Math.round(syllable.accuracyScore);
          const isGood = score >= 60;
          const stress = stressLabel(syllable.stress);
          const mark = stressMark(syllable.stress);

          return (
            <div
              key={`${syllable.syllable}-${syllable.grapheme ?? ""}-${syllable.accuracyScore}-${syllable.stress ?? "none"}`}
              className={cn(
                "min-w-0 rounded-lg border bg-background p-2 shadow-sm",
                syllable.stress === "primary" && "border-primary/40 bg-primary/5",
                !isGood &&
                  "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "font-ipa min-w-0 truncate font-semibold",
                    compact ? "text-sm" : "text-base",
                  )}
                >
                  {mark}
                  {syllableToIpa(syllable.syllable)}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                  {score}
                </span>
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={`h-full rounded-full ${getBarColor(score)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(score, 100)}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              </div>

              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {stress}
              </p>
            </div>
          );
        })}
      </div>

      {!hasStress && (
        <p className="text-[11px] text-muted-foreground/70">
          Azure 音节分数；重音未标注。
        </p>
      )}
    </div>
  );
}
