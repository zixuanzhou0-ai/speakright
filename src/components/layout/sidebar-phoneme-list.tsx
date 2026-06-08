"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getLanguagePhonemesByCategory } from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import { getBestScoreForPhoneme } from "@/lib/score-history";
import { cn } from "@/lib/utils";
import type { LanguageId } from "@/types/language";
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
  languageId,
}: {
  label: string;
  phonemes: PhonemeData[];
  currentSlug: string | null;
  defaultOpen: boolean;
  languageId: LanguageId;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const s: Record<string, number | null> = {};
    for (const p of phonemes) {
      s[p.slug] = getBestScoreForPhoneme(languageId, p.slug);
    }
    setScores(s);
  }, [languageId, phonemes]);

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
  const { languageId } = useLanguageConfig();
  const profile = getLanguageProfile(languageId);
  const vowels = getLanguagePhonemesByCategory(languageId, "vowel");
  const consonants = getLanguagePhonemesByCategory(languageId, "consonant");
  const prosody = getLanguagePhonemesByCategory(languageId, "prosody");
  const clusters = getLanguagePhonemesByCategory(languageId, "cluster");

  const currentIsVowel = vowels.some((p) => p.slug === currentSlug);
  const currentIsProsody = prosody.some((p) => p.slug === currentSlug);
  const currentIsCluster = clusters.some((p) => p.slug === currentSlug);

  return (
    <div className="flex flex-col gap-0.5">
      <PhonemeGroup
        label="元音"
        phonemes={vowels}
        currentSlug={currentSlug}
        defaultOpen={currentIsVowel || !currentSlug}
        languageId={languageId}
      />
      <PhonemeGroup
        label="辅音"
        phonemes={consonants}
        currentSlug={currentSlug}
        defaultOpen={!currentIsVowel && !currentIsProsody && !currentIsCluster && !!currentSlug}
        languageId={languageId}
      />
      {prosody.length > 0 && (
        <PhonemeGroup
          label="重音/连读"
          phonemes={prosody}
          currentSlug={currentSlug}
          defaultOpen={currentIsProsody}
          languageId={languageId}
        />
      )}
      {clusters.length > 0 && (
        <PhonemeGroup
          label="辅音丛"
          phonemes={clusters}
          currentSlug={currentSlug}
          defaultOpen={currentIsCluster}
          languageId={languageId}
        />
      )}
      <div className="px-2 pt-2 text-[11px] text-muted-foreground/60">
        {profile.shortLabel} · {profile.soundUnitLabel}
      </div>
    </div>
  );
}
