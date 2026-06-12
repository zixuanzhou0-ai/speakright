"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { PhonemeBlock } from "@/components/scoring/phoneme-highlight";
import { SyllableScoreGrid } from "@/components/scoring/syllable-score-grid";
import {
  getBarColor,
  getScoreBg,
  getScoreColor,
  getScoreLabel,
} from "@/lib/score-utils";
import { cn } from "@/lib/utils";
import type {
  AzureAssessmentResult,
  AzurePhoneme,
  AzureSyllable,
} from "@/types/azure";

interface ScoreBreakdownProps {
  result: AzureAssessmentResult;
  showProsody?: boolean;
  phonemes?: AzurePhoneme[];
  syllables?: AzureSyllable[];
}

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const spring = useSpring(0, { stiffness: 50, damping: 15 });
  const display = useTransform(spring, (v) => Math.round(v));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}

/* ---- Sub-score row (compact) ---- */
export function SubScoreRow({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <AnimatedNumber
          value={score}
          className={`text-base font-bold tabular-nums ${getScoreColor(score)}`}
        />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${getBarColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ---- Sub-score card (bento grid, for sentence page) ---- */
function SubScoreCard({ score, label }: { score: number; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">
        <AnimatedNumber
          value={score}
          className={`text-3xl font-bold tabular-nums ${getScoreColor(score)}`}
        />
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${getBarColor(score)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/* ---- Compact 3-column layout (phoneme detail page) ---- */
function CompactLayout({
  result,
  showProsody,
  phonemes,
  syllables,
}: {
  result: AzureAssessmentResult;
  showProsody: boolean;
  phonemes: AzurePhoneme[];
  syllables?: AzureSyllable[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[80px_100px_1fr]">
      {/* Mobile: total + sub-scores in a row */}
      <div className="flex gap-3 md:contents">
        {/* Column 1: Total score */}
        <div
          className={cn(
            "flex w-20 shrink-0 flex-col items-center justify-center rounded-xl p-3 text-white md:self-stretch",
            getScoreBg(result.pronunciationScore),
          )}
        >
          <AnimatedNumber
            value={result.pronunciationScore}
            className="text-3xl font-bold tabular-nums"
          />
          <span className="mt-0.5 text-xs opacity-80">总分</span>
        </div>

        {/* Column 2: Sub-scores */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 md:flex-none">
          <SubScoreRow score={result.accuracyScore} label="准确度" />
          <SubScoreRow score={result.fluencyScore} label="流利度" />
          <SubScoreRow score={result.completenessScore} label="完整度" />
          {showProsody && result.prosodyScore != null && (
            <SubScoreRow score={result.prosodyScore} label="韵律" />
          )}
        </div>
      </div>

      {/* Column 3: Phoneme details */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          音标拆解
        </p>
        <div className="flex flex-wrap gap-1.5">
          {phonemes.map((ph, i) => (
            <PhonemeBlock
              key={`${ph.phoneme}-${ph.accuracyScore}`}
              ph={ph}
              index={i}
            />
          ))}
        </div>

        {syllables && syllables.length > 1 && (
          <>
            <div className="my-2 border-t" />
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              音节评分
            </p>
            <SyllableScoreGrid syllables={syllables} compact />
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Bento grid layout (sentence page) ---- */
function BentoLayout({
  result,
  showProsody,
}: {
  result: AzureAssessmentResult;
  showProsody: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
      {/* Main score card */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-primary p-6 text-primary-foreground">
        <span className="text-sm font-medium opacity-80">总分</span>
        <AnimatedNumber
          value={result.pronunciationScore}
          className="text-6xl font-bold tabular-nums"
        />
        <span className="mt-2 rounded-full bg-primary-foreground/20 px-3 py-1 text-xs font-semibold">
          {getScoreLabel(result.pronunciationScore)}
        </span>
      </div>

      {/* Sub-scores 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <SubScoreCard score={result.accuracyScore} label="准确度" />
        <SubScoreCard score={result.fluencyScore} label="流利度" />
        <SubScoreCard score={result.completenessScore} label="完整度" />
        {showProsody &&
          (result.prosodyScore != null ? (
            <SubScoreCard score={result.prosodyScore} label="韵律" />
          ) : (
            <div className="rounded-xl border bg-card p-4 opacity-40">
              <span className="text-xs text-muted-foreground">韵律</span>
              <div className="mt-1 text-3xl font-bold tabular-nums">—</div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function ScoreBreakdown({
  result,
  showProsody = true,
  phonemes,
  syllables,
}: ScoreBreakdownProps) {
  if (phonemes && phonemes.length > 0) {
    return (
      <CompactLayout
        result={result}
        showProsody={showProsody}
        phonemes={phonemes}
        syllables={syllables}
      />
    );
  }

  return <BentoLayout result={result} showProsody={showProsody} />;
}
