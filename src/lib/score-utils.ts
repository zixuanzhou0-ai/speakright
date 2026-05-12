export function getScoreColor(score: number): string {
  if (score >= 80) return "text-primary";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export function getBarColor(score: number): string {
  if (score >= 80) return "bg-primary";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

export function getScoreBg(score: number): string {
  if (score >= 80) return "bg-primary";
  if (score >= 60) return "bg-yellow-500 dark:bg-yellow-600";
  return "bg-red-600 dark:bg-red-700";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "非常好";
  if (score >= 80) return "不错";
  if (score >= 60) return "还行";
  return "需加油";
}
