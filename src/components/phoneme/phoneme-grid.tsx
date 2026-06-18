"use client";

import { useAudioPlayer } from "@/hooks/use-audio-player";
import { getLanguagePhonemePracticeGroups } from "@/lib/language-sound-unit-groups";
import type { PhonemeData } from "@/types/phoneme";
import { PhonemeCard } from "./phoneme-card";

interface PhonemeGridProps {
  phonemes: PhonemeData[];
}

export function PhonemeGrid({ phonemes }: PhonemeGridProps) {
  const player = useAudioPlayer();
  const languageId = phonemes[0]?.languageId ?? "en-US";
  const visibleSlugs = new Set(phonemes.map((phoneme) => phoneme.slug));
  const groups = getLanguagePhonemePracticeGroups(languageId)
    .map((group) => ({
      ...group,
      units: group.units.filter((unit) => visibleSlugs.has(unit.slug)),
    }))
    .filter((group) => group.units.length > 0);

  return (
    <div className="space-y-8">
      {player.error && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive [overflow-wrap:anywhere]"
          data-smoke="phoneme-grid-audio-error"
          role="alert"
        >
          {player.error}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {group.label}
              </h2>
              <span className="text-sm text-muted-foreground">
                {group.units.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.description}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.units.map((p) => (
              <PhonemeCard key={p.slug} phoneme={p} player={player} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
