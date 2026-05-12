"use client";

import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { PhonemeData } from "@/types/phoneme";
import { PhonemeCard } from "./phoneme-card";

interface PhonemeGridProps {
  phonemes: PhonemeData[];
}

export function PhonemeGrid({ phonemes }: PhonemeGridProps) {
  const player = useAudioPlayer();

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {phonemes.map((p) => (
        <PhonemeCard key={p.slug} phoneme={p} player={player} />
      ))}
    </div>
  );
}
