"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getPhonologyInventoryEntry,
  getPhonologyLayerLabel,
  type PhonologyInventoryLayer,
} from "@/lib/language-phonology-inventory";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { PHONEMES } from "@/lib/phoneme-data";
import type { LanguageId } from "@/types/language";

interface PhonemeHealthMapProps {
  scores: Record<string, number | { score: number; sampleCount: number }>;
  languageId?: LanguageId;
}

function normalizeScore(
  value: number | { score: number; sampleCount: number } | undefined,
): { score: number; sampleCount: number } {
  if (typeof value === "number") {
    return { score: value, sampleCount: value > 0 ? 1 : 0 };
  }
  return value ?? { score: 0, sampleCount: 0 };
}

function getColor(score: number): string {
  if (score >= 80) return "bg-primary text-primary-foreground";
  if (score >= 60) return "bg-yellow-500 text-white";
  if (score > 0) return "bg-red-500 text-white";
  return "bg-muted text-muted-foreground";
}

function getLabel(score: number, languageId: LanguageId): string {
  const isExperimentalLanguage = languageId !== "en-US";
  if (score >= 80) return isExperimentalLanguage ? "高分" : "掌握";
  if (score >= 60) return isExperimentalLanguage ? "中等" : "还行";
  if (score > 0) return isExperimentalLanguage ? "待加强" : "薄弱";
  return "未测";
}

export function PhonemeHealthMap({
  scores,
  languageId = "en-US",
}: PhonemeHealthMapProps) {
  const inventory =
    languageId === "en-US" ? PHONEMES : getLanguagePhonemes(languageId);
  const vowels = inventory.filter((p) => p.category === "vowel");
  const consonants = inventory.filter((p) => p.category === "consonant");
  const otherUnits = inventory.filter(
    (p) => p.category !== "vowel" && p.category !== "consonant",
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          元音（{vowels.length}）
        </h3>
        <div className="grid grid-cols-8 gap-1.5">
          {vowels.map((p, i) => {
            const normalized = normalizeScore(scores[p.slug]);
            const inventoryEntry =
              languageId !== "en-US"
                ? getPhonologyInventoryEntry(languageId, p.slug)
                : undefined;
            return (
              <PhonemeCell
                key={p.slug}
                languageId={languageId}
                ipa={p.ipa}
                slug={p.slug}
                name={p.name}
                score={normalized.score}
                sampleCount={normalized.sampleCount}
                delay={i * 0.03}
                layer={inventoryEntry?.layer}
              />
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          辅音（{consonants.length}）
        </h3>
        <div className="grid grid-cols-8 gap-1.5">
          {consonants.map((p, i) => {
            const normalized = normalizeScore(scores[p.slug]);
            const inventoryEntry =
              languageId !== "en-US"
                ? getPhonologyInventoryEntry(languageId, p.slug)
                : undefined;
            return (
              <PhonemeCell
                key={p.slug}
                languageId={languageId}
                ipa={p.ipa}
                slug={p.slug}
                name={p.name}
                score={normalized.score}
                sampleCount={normalized.sampleCount}
                delay={(vowels.length + i) * 0.03}
                layer={inventoryEntry?.layer}
              />
            );
          })}
        </div>
      </div>
      {otherUnits.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            规则/语流（{otherUnits.length}）
          </h3>
          <div className="grid grid-cols-8 gap-1.5">
            {otherUnits.map((p, i) => {
              const normalized = normalizeScore(scores[p.slug]);
              const inventoryEntry =
                languageId !== "en-US"
                  ? getPhonologyInventoryEntry(languageId, p.slug)
                  : undefined;
              return (
                <PhonemeCell
                  key={p.slug}
                  languageId={languageId}
                  ipa={p.ipa}
                  slug={p.slug}
                  name={p.name}
                  score={normalized.score}
                  sampleCount={normalized.sampleCount}
                  delay={(vowels.length + consonants.length + i) * 0.03}
                  layer={inventoryEntry?.layer}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PhonemeCell({
  languageId,
  ipa,
  slug,
  name,
  score,
  sampleCount,
  delay,
  layer,
}: {
  languageId: LanguageId;
  ipa: string;
  slug: string;
  name: string;
  score: number;
  sampleCount: number;
  delay: number;
  layer?: PhonologyInventoryLayer;
}) {
  const label = getLabel(score, languageId);
  const layerLabel = layer ? getPhonologyLayerLabel(layer) : undefined;
  const experimentalNote =
    languageId === "en-US" ? "" : " · experimental 练习观察";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/phonemes/${slug}`}
            aria-label={`${ipa} ${name} — ${label}${
              layerLabel ? ` · ${layerLabel}` : ""
            }${experimentalNote}`}
          />
        }
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay, type: "spring", stiffness: 300, damping: 20 }}
          className={`flex flex-col items-center justify-center rounded-lg p-1.5 text-center cursor-pointer transition-shadow hover:shadow-md ${getColor(score)}`}
          data-smoke="phoneme-health-cell"
          data-language-id={languageId}
          data-phonology-layer={layer ?? ""}
        >
          <span className="font-mono text-sm font-bold">{ipa}</span>
          <span className="text-[10px] tabular-nums">
            {score > 0 ? score : "—"}
          </span>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">
          {ipa} — {name}
        </p>
        <p className="text-xs">
          {label} {score > 0 ? `(${score}分)` : ""}
          {sampleCount > 0 ? ` · ${sampleCount} 个样本` : ""}
          {layerLabel ? ` · ${layerLabel}` : ""}
          {languageId !== "en-US" ? " · experimental 练习观察" : ""} ·
          点击进入学习
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
