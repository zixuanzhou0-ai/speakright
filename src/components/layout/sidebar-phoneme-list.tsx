"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPhonemesByCategory } from "@/lib/phoneme-data";
import { getBestScore } from "@/lib/score-history";
import { cn } from "@/lib/utils";
import type { PhonemeData } from "@/types/phoneme";

interface SidebarPhonemeListProps {
  currentSlug: string | null;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 80
      ? "bg-primary/15 text-primary"
      : score >= 60
        ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums",
        color,
      )}
    >
      {score}
    </span>
  );
}

function PhonemeGroup({
  label,
  phonemes,
  currentSlug,
  defaultOpen,
}: {
  label: string;
  phonemes: PhonemeData[];
  currentSlug: string | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const s: Record<string, number | null> = {};
    for (const p of phonemes) {
      s[p.slug] = getBestScore(p.slug);
    }
    setScores(s);
  }, [phonemes]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        {label} ({phonemes.length})
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {phonemes.map((p) => {
              const isActive = p.slug === currentSlug;
              return (
                <Link
                  key={p.slug}
                  href={`/phonemes/${p.slug}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-primary/10 text-foreground border-l-2 border-primary pl-1.5"
                      : "hover:bg-accent/50 text-sidebar-foreground/70",
                  )}
                >
                  <span className="w-10 shrink-0 font-mono text-sm text-primary text-center inline-block">
                    {p.ipa}
                  </span>
                  <span className="flex-1 truncate capitalize text-muted-foreground">
                    {p.chartWord}
                  </span>
                  <ScoreBadge score={scores[p.slug] ?? null} />
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SidebarPhonemeList({ currentSlug }: SidebarPhonemeListProps) {
  const vowels = getPhonemesByCategory("vowel");
  const consonants = getPhonemesByCategory("consonant");

  const currentIsVowel = vowels.some((p) => p.slug === currentSlug);

  return (
    <div className="flex flex-col gap-0.5">
      <PhonemeGroup
        label="元音"
        phonemes={vowels}
        currentSlug={currentSlug}
        defaultOpen={currentIsVowel || !currentSlug}
      />
      <PhonemeGroup
        label="辅音"
        phonemes={consonants}
        currentSlug={currentSlug}
        defaultOpen={!currentIsVowel && !!currentSlug}
      />
    </div>
  );
}
