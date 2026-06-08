"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCoachMode, useLanguageConfig } from "@/hooks/use-api-keys";
import { getAvailableWordCount, getPassThreshold } from "@/lib/drill-utils";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import type { DrillKind } from "@/types/drill";
import type { PhonemeData } from "@/types/phoneme";

interface DrillConfigProps {
  kind: DrillKind;
  onStart: (
    phonemeSlug: string,
    itemCount: number,
    passThreshold: number,
  ) => void;
}

const WORD_COUNT_OPTIONS = [5, 10, 15, 20];
const SENTENCE_COUNT_OPTIONS = [3, 5, 8, 10];

export function DrillConfig({ kind, onStart }: DrillConfigProps) {
  const { languageId } = useLanguageConfig();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(kind === "word" ? 10 : 5);

  const profile = getLanguageProfile(languageId);
  const phonemes = getLanguagePhonemes(languageId);
  const vowels = phonemes.filter((p) => p.category === "vowel");
  const consonants = phonemes.filter((p) => p.category === "consonant");
  const ruleUnits = phonemes.filter(
    (p) => p.category !== "vowel" && p.category !== "consonant",
  );
  const countOptions =
    kind === "word" ? WORD_COUNT_OPTIONS : SENTENCE_COUNT_OPTIONS;
  const coachMode = useCoachMode();
  const threshold = getPassThreshold(coachMode);

  const selectedPhoneme = selectedSlug
    ? phonemes.find((p) => p.slug === selectedSlug)
    : null;
  const availableWords = selectedPhoneme
    ? getAvailableWordCount(selectedPhoneme)
    : 0;

  const handleStart = () => {
    if (!selectedSlug) return;
    onStart(selectedSlug, itemCount, threshold);
  };

  return (
    <div className="space-y-6">
      {/* Phoneme selection */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          元音（{vowels.length}）
        </h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {vowels.map((p) => (
            <PhonemeChip
              key={p.slug}
              phoneme={p}
              selected={selectedSlug === p.slug}
              onClick={() => setSelectedSlug(p.slug)}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          辅音（{consonants.length}）
        </h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {consonants.map((p) => (
            <PhonemeChip
              key={p.slug}
              phoneme={p}
              selected={selectedSlug === p.slug}
              onClick={() => setSelectedSlug(p.slug)}
            />
          ))}
        </div>
      </div>

      {ruleUnits.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            规则 / 语流（{ruleUnits.length}）
          </h3>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {ruleUnits.map((p) => (
              <PhonemeChip
                key={p.slug}
                phoneme={p}
                selected={selectedSlug === p.slug}
                onClick={() => setSelectedSlug(p.slug)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Count selection + start */}
      {selectedSlug && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-4 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold">
              {selectedPhoneme?.ipa}
            </span>
            <span className="text-sm text-muted-foreground">
              {selectedPhoneme?.name} · {profile.shortLabel}
            </span>
          </div>

          {selectedPhoneme?.description && (
            <p className="text-sm text-muted-foreground">
              💡 {selectedPhoneme.description}
            </p>
          )}

          <div>
            <p className="mb-2 block text-sm font-medium">
              {kind === "word" ? "训练单词数" : "训练句子数"}
            </p>
            <div className="flex gap-2">
              {countOptions.map((n) => {
                const disabled = kind === "word" && n > availableWords;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => !disabled && setItemCount(n)}
                    disabled={disabled}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      itemCount === n
                        ? "bg-primary text-primary-foreground"
                        : disabled
                          ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                          : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {kind === "word" && (
              <p className="mt-1 text-xs text-muted-foreground">
                可用 {availableWords} 个词
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              达标分数：{threshold} 分（
              {coachMode === "easy"
                ? "简单"
                : coachMode === "normal"
                  ? "正常"
                  : coachMode === "hard"
                    ? "略难"
                    : "严师"}
              模式）
            </p>
            <Button onClick={handleStart} className="cursor-pointer">
              开始训练
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function PhonemeChip({
  phoneme,
  selected,
  onClick,
}: {
  phoneme: PhonemeData;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg border p-2 text-center transition-colors cursor-pointer ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-primary/50"
      }`}
    >
      <span className="font-mono text-lg font-bold">{phoneme.ipa}</span>
      <span className="text-[10px] text-muted-foreground truncate w-full">
        {phoneme.example}
      </span>
    </motion.button>
  );
}
