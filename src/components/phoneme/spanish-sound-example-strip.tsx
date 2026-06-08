"use client";

import { Volume2 } from "lucide-react";
import {
  highlightSpanishTargetInIpa,
  type HighlightedIpaPart,
} from "@/lib/spanish-sound-examples";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

interface SpanishSoundExampleStripProps {
  phoneme: PhonemeData;
  currentWord: KeywordEntry | null;
  exampleWords: KeywordEntry[];
  onPlayTarget: () => void;
  onPlayWord: (word: string) => void;
}

function sameWord(a?: KeywordEntry | null, b?: KeywordEntry | null): boolean {
  return Boolean(
    a && b && a.word.toLocaleLowerCase() === b.word.toLocaleLowerCase(),
  );
}

function cleanIpaPart(text: string): string {
  return text.replace(/\//g, "");
}

function keyedIpaParts(parts: HighlightedIpaPart[]) {
  const seen = new Map<string, number>();

  return parts.map((part) => {
    const baseKey = `${part.highlight ? "target" : "text"}:${part.text}`;
    const count = seen.get(baseKey) ?? 0;
    seen.set(baseKey, count + 1);

    return {
      ...part,
      key: count === 0 ? baseKey : `${baseKey}:${count}`,
    };
  });
}

function wordChipClassName(isCurrent: boolean): string {
  const base =
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors";
  if (isCurrent) {
    return `${base} border-primary/40 bg-primary/10 text-foreground shadow-sm`;
  }
  return `${base} border-border bg-background hover:border-primary/30 hover:bg-muted/40`;
}

export function SpanishSoundExampleStrip({
  phoneme,
  currentWord,
  exampleWords,
  onPlayTarget,
  onPlayWord,
}: SpanishSoundExampleStripProps) {
  return (
    <div className="border-t bg-gradient-to-b from-muted/25 to-background px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Escucha y compara
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            先听单音，再听它在西语单词里的位置
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={onPlayTarget}
          aria-label={`播放目标音 ${phoneme.ipa}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <Volume2 className="h-4 w-4" />
          <span className="font-mono">{phoneme.ipa}</span>
        </button>

        {exampleWords.map((word) => {
          const isCurrent = sameWord(word, currentWord);
          const parts = keyedIpaParts(
            highlightSpanishTargetInIpa(word.ipa, phoneme),
          );

          return (
            <button
              key={`${word.word}-${word.ipa}`}
              type="button"
              aria-label={`播放 ${word.word}`}
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => onPlayWord(word.word)}
              className={wordChipClassName(isCurrent)}
            >
              <Volume2 className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">
                [
                {parts.map((part) =>
                  part.highlight ? (
                    <mark
                      key={part.key}
                      className="rounded bg-primary/15 px-1 py-0.5 font-semibold text-primary"
                    >
                      {cleanIpaPart(part.text)}
                    </mark>
                  ) : (
                    <span key={part.key}>{cleanIpaPart(part.text)}</span>
                  ),
                )}
                ]
              </span>
              <span className="h-4 w-px bg-border" />
              <span className="font-medium">{word.word}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
