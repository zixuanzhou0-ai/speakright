"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import {
  getLanguageSoundUnitGroups,
  getSoundUnitDisplayTypeLabel,
} from "@/lib/language-sound-unit-groups";
import { getLanguageProfile } from "@/lib/language-profiles";
import { getSoundUnitReadableLabel } from "@/lib/practice-text-presentation";
import { getBestScoreForPhoneme } from "@/lib/score-history";
import { cn } from "@/lib/utils";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";
import type { SoundUnitDisplayType } from "@/lib/language-sound-unit-groups";

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

function SidebarSoundUnitItem({
  phoneme,
  isActive,
  score,
  compact,
}: {
  phoneme: PhonemeData;
  isActive: boolean;
  score: number | null;
  compact: boolean;
}) {
  const example = phoneme.chartWord ?? phoneme.example;
  const displayLabel = compact ? phoneme.ipa : getSoundUnitReadableLabel(phoneme);

  if (compact) {
    return (
      <Link
        href={`/phonemes/${phoneme.slug}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
          isActive
            ? "bg-primary/10 text-foreground border-l-2 border-primary pl-1.5"
            : "hover:bg-accent/50 text-sidebar-foreground/70",
        )}
      >
        <span className="w-10 shrink-0 font-mono text-sm text-primary text-center inline-block">
          {phoneme.ipa}
        </span>
        <span className="min-w-0 flex-1 whitespace-normal break-words text-center capitalize text-muted-foreground [overflow-wrap:anywhere]">
          {example}
        </span>
        <ScoreBadge score={score} />
      </Link>
    );
  }

  return (
    <Link
      href={`/phonemes/${phoneme.slug}`}
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 rounded-md px-2 py-2 text-xs transition-colors",
        isActive
          ? "bg-primary/10 text-foreground border-l-2 border-primary pl-1.5"
          : "hover:bg-accent/50 text-sidebar-foreground/70",
      )}
    >
      <span className="min-w-0 break-words text-center text-sm font-semibold leading-tight text-primary [overflow-wrap:anywhere]">
        {displayLabel}
      </span>
      <ScoreBadge score={score} />
      <span className="col-span-2 min-w-0 break-words text-center leading-snug text-muted-foreground [overflow-wrap:anywhere]">
        {example}
      </span>
    </Link>
  );
}

function PhonemeGroup({
  label,
  phonemes,
  currentSlug,
  defaultOpen,
  languageId,
  displayType,
}: {
  label: string;
  phonemes: PhonemeData[];
  currentSlug: string | null;
  defaultOpen: boolean;
  languageId: LanguageId;
  displayType: SoundUnitDisplayType;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    const s: Record<string, number | null> = {};
    for (const p of phonemes) {
      s[p.slug] = getBestScoreForPhoneme(languageId, p.slug);
    }
    setScores(s);
  }, [languageId, phonemes]);

  const useCompactRows = languageId === "en-US";

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
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70">
          {getSoundUnitDisplayTypeLabel(displayType)}
        </span>
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
                <SidebarSoundUnitItem
                  key={p.slug}
                  phoneme={p}
                  isActive={isActive}
                  score={scores[p.slug] ?? null}
                  compact={useCompactRows}
                />
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
  const groups = getLanguageSoundUnitGroups(languageId).filter(
    (group) => group.units.length > 0,
  );
  const currentGroupId = groups.find((group) =>
    group.units.some((unit) => unit.slug === currentSlug),
  )?.id;

  return (
    <div className="flex flex-col gap-0.5">
      {groups.map((group, index) => (
        <PhonemeGroup
          key={group.id}
          label={group.label}
          phonemes={group.units}
          currentSlug={currentSlug}
          defaultOpen={
            currentGroupId ? currentGroupId === group.id : index === 0
          }
          languageId={languageId}
          displayType={group.displayType}
        />
      ))}
      <div className="px-2 pt-2 text-[11px] text-muted-foreground/60">
        {profile.shortLabel} · {profile.soundUnitLabel}
      </div>
    </div>
  );
}
