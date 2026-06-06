import type { CoachMode } from "@/lib/api-keys";
import { DEFAULT_LANGUAGE_ID } from "@/lib/language-profiles";
import type {
  DrillItem,
  DrillProgressItem,
  DrillSessionConfig,
  DrillSummary,
} from "@/types/drill";
import type { LanguageId } from "@/types/language";
import type { PhonemeData } from "@/types/phoneme";
import { getWordPool } from "./word-pool";

// ── Threshold by coach mode ──

const THRESHOLDS: Record<CoachMode, number> = {
  easy: 60,
  normal: 70,
  hard: 80,
  strict: 85,
};

export function getPassThreshold(mode: CoachMode): number {
  return THRESHOLDS[mode];
}

// ── Build drill items from word pool ──

export function buildWordDrillItems(
  phoneme: PhonemeData,
  count: number,
  languageId: LanguageId = phoneme.languageId ?? DEFAULT_LANGUAGE_ID,
): DrillItem[] {
  const pool = getWordPool(phoneme.slug, phoneme.keywords, languageId);

  // Shuffle and pick `count` items (or all if pool is smaller)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, pool.length));

  return selected.map((entry) => ({
    text: entry.word,
    ipa: entry.ipa,
    phoneme: phoneme.slug,
    description: phoneme.description,
  }));
}

// ── Build drill items from sentence bank ──

export interface SentenceBankEntry {
  text: string;
  phonemes: string[];
  category: "tongue-twister" | "minimal-pair" | "daily" | "interview";
}

export function buildSentenceDrillItems(
  sentences: SentenceBankEntry[],
  phonemeSlug: string,
  count: number,
  phonemeDescription?: string,
): DrillItem[] {
  const filtered = sentences.filter((s) => s.phonemes.includes(phonemeSlug));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, filtered.length));

  return selected.map((s) => ({
    text: s.text,
    phoneme: phonemeSlug,
    description: phonemeDescription,
  }));
}

// ── Compute summary from progress ──

export function computeDrillSummary(
  config: DrillSessionConfig,
  progress: DrillProgressItem[],
  startedAt: number,
): DrillSummary {
  const completedAt = Date.now();
  const passedItems = progress.filter((p) => p.passed).length;
  const skippedItems = progress.filter((p) => p.skipped).length;
  const _totalAttempts = progress.reduce(
    (sum, p) => sum + p.attempts.length,
    0,
  );

  // First-pass rate: items passed on first attempt
  const firstPassCount = progress.filter(
    (p) => p.passed && p.attempts.length === 1,
  ).length;

  // Average score: best score across all items (exclude skipped)
  const scored = progress.filter((p) => p.bestScore > 0);
  const averageScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, p) => s + p.bestScore, 0) / scored.length)
      : 0;

  // Weak items: bottom 3 by best score (exclude skipped with 0)
  const weakItems = [...scored]
    .sort((a, b) => a.bestScore - b.bestScore)
    .slice(0, 3);

  return {
    config,
    startedAt,
    completedAt,
    totalItems: progress.length,
    passedItems,
    skippedItems,
    firstPassRate: progress.length > 0 ? firstPassCount / progress.length : 0,
    averageScore,
    weakItems,
    items: progress,
  };
}

// ── Available word count per phoneme ──

export function getAvailableWordCount(phoneme: PhonemeData): number {
  return getWordPool(
    phoneme.slug,
    phoneme.keywords,
    phoneme.languageId ?? DEFAULT_LANGUAGE_ID,
  ).length;
}
