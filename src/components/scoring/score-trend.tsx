"use client";

import { getScores } from "@/lib/score-history";

function dotColor(score: number): string {
  if (score >= 80) return "var(--color-primary)";
  if (score >= 60) return "#eab308";
  return "#ef4444";
}

interface ScoreTrendProps {
  historyKey: string;
}

export function ScoreTrend({ historyKey }: ScoreTrendProps) {
  const scores = getScores(historyKey);

  if (scores.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无历史</p>;
  }

  const W = 120;
  const H = 40;
  const padX = 10;
  const padY = 6;
  const plotW = W - padX * 2;
  const plotH = H - padY * 2;

  const points = scores.map((s, i) => {
    const x =
      scores.length === 1 ? W / 2 : padX + (i / (scores.length - 1)) * plotW;
    const y = padY + (1 - s / 100) * plotH;
    return { x, y, score: s };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
      {points.length > 1 && (
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
        />
      )}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 4 : 3}
          fill={dotColor(p.score)}
        />
      ))}
    </svg>
  );
}
