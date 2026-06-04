import type {
  DiagnosisIssue,
  DiagnosisReport,
  EvidenceStrength,
} from "@/types/diagnosis";
import { getCurrentLanguageId } from "@/lib/api-keys";
import { languageScopedStorageKey } from "@/lib/language-storage";
import type { LanguageId } from "@/types/language";

export const COVERAGE_BENCHMARKS_STORAGE_KEY =
  "speakright_coverage_benchmarks_v1";

const MAX_BENCHMARKS = 8;
const WEAK_PHONEME_LIMIT = 8;

type DiagnosisDimensionKey = keyof DiagnosisReport["dimensions"];

export interface CoverageBenchmarkWeakPhoneme {
  phoneme: string;
  score: number;
  sampleCount: number;
}

export interface CoverageBenchmarkIssue {
  id: string;
  title: string;
  severity: DiagnosisIssue["severity"];
  evidenceStrength?: EvidenceStrength;
  recommendedPackIds: string[];
}

export interface CoverageBenchmarkSnapshot {
  id: string;
  languageId: LanguageId;
  timestamp: number;
  overallScore: number;
  dimensions: DiagnosisReport["dimensions"];
  weakPhonemes: CoverageBenchmarkWeakPhoneme[];
  issues: CoverageBenchmarkIssue[];
  usableRecordings: number;
  invalidRecordings: number;
}

export interface CoverageBenchmarkComparison {
  current: CoverageBenchmarkSnapshot;
  previous?: CoverageBenchmarkSnapshot;
  overallDelta: number;
  dimensionDeltas: Record<DiagnosisDimensionKey, number>;
  resolvedIssueIds: string[];
  repeatedIssueIds: string[];
  newIssueIds: string[];
  improvedPhonemes: CoverageBenchmarkWeakPhoneme[];
  regressedPhonemes: CoverageBenchmarkWeakPhoneme[];
  summary: string;
  nextAction: string;
}

function storageKey(languageId?: LanguageId): string {
  return languageScopedStorageKey(COVERAGE_BENCHMARKS_STORAGE_KEY, languageId);
}

function round(value: number): number {
  return Math.round(value);
}

function sortedWeakPhonemes(
  report: DiagnosisReport,
): CoverageBenchmarkWeakPhoneme[] {
  return Object.entries(report.phonemeScores)
    .map(([phoneme, score]) => ({
      phoneme,
      score: round(score.score),
      sampleCount: score.sampleCount,
    }))
    .filter((item) => item.score < 82 || item.sampleCount < 2)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.sampleCount - b.sampleCount;
    })
    .slice(0, WEAK_PHONEME_LIMIT);
}

function snapshotIssue(issue: DiagnosisIssue): CoverageBenchmarkIssue {
  return {
    id: issue.id,
    title: issue.title,
    severity: issue.severity,
    evidenceStrength: issue.evidenceStrength,
    recommendedPackIds: issue.recommendedPackIds,
  };
}

export function createCoverageBenchmarkSnapshot(
  report: DiagnosisReport,
  languageId: LanguageId = report.languageId ?? getCurrentLanguageId(),
): CoverageBenchmarkSnapshot {
  return {
    id: `coverage-${report.timestamp}`,
    languageId,
    timestamp: report.timestamp,
    overallScore: round(report.overallScore),
    dimensions: {
      vowels: round(report.dimensions.vowels),
      consonants: round(report.dimensions.consonants),
      stress: round(report.dimensions.stress),
      rhythm: round(report.dimensions.rhythm),
      fluency: round(report.dimensions.fluency),
      connectedSpeech: round(report.dimensions.connectedSpeech),
    },
    weakPhonemes: sortedWeakPhonemes(report),
    issues: report.issues.slice(0, 6).map(snapshotIssue),
    usableRecordings: report.evidenceSummary?.usableRecordings ?? 0,
    invalidRecordings: report.evidenceSummary?.invalidRecordings ?? 0,
  };
}

function parseBenchmarks(raw: string | null): CoverageBenchmarkSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CoverageBenchmarkSnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.timestamp === "number" &&
        typeof item.overallScore === "number" &&
        !!item.dimensions &&
        Array.isArray(item.weakPhonemes) &&
        Array.isArray(item.issues),
    );
  } catch {
    return [];
  }
}

export function loadCoverageBenchmarks(): CoverageBenchmarkSnapshot[] {
  return loadCoverageBenchmarksForLanguage();
}

export function loadCoverageBenchmarksForLanguage(
  languageId: LanguageId = getCurrentLanguageId(),
): CoverageBenchmarkSnapshot[] {
  if (typeof window === "undefined") return [];
  return parseBenchmarks(localStorage.getItem(storageKey(languageId)))
    .map((item) => ({ ...item, languageId: item.languageId ?? languageId }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_BENCHMARKS);
}

function saveBenchmarks(
  benchmarks: CoverageBenchmarkSnapshot[],
  languageId: LanguageId = getCurrentLanguageId(),
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    storageKey(languageId),
    JSON.stringify(benchmarks.slice(0, MAX_BENCHMARKS)),
  );
}

function issueIds(snapshot?: CoverageBenchmarkSnapshot): Set<string> {
  return new Set(snapshot?.issues.map((issue) => issue.id) ?? []);
}

function matchingPrevious(
  current: CoverageBenchmarkSnapshot,
  benchmarks: CoverageBenchmarkSnapshot[],
): CoverageBenchmarkSnapshot | undefined {
  return benchmarks
    .filter((item) => item.timestamp < current.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}

function dimensionDeltas(
  current: CoverageBenchmarkSnapshot,
  previous?: CoverageBenchmarkSnapshot,
): Record<DiagnosisDimensionKey, number> {
  const keys = Object.keys(current.dimensions) as DiagnosisDimensionKey[];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      previous ? current.dimensions[key] - previous.dimensions[key] : 0,
    ]),
  ) as Record<DiagnosisDimensionKey, number>;
}

function phonemeDeltaLists(
  current: CoverageBenchmarkSnapshot,
  previous?: CoverageBenchmarkSnapshot,
): Pick<CoverageBenchmarkComparison, "improvedPhonemes" | "regressedPhonemes"> {
  if (!previous) return { improvedPhonemes: [], regressedPhonemes: [] };
  const previousScores = new Map(
    previous.weakPhonemes.map((item) => [item.phoneme, item.score]),
  );
  const currentScores = new Map(
    current.weakPhonemes.map((item) => [item.phoneme, item.score]),
  );
  const phonemes = new Set([...previousScores.keys(), ...currentScores.keys()]);
  const deltas = Array.from(phonemes)
    .map((phoneme) => {
      const currentScore = currentScores.get(phoneme) ?? 100;
      const previousScore = previousScores.get(phoneme) ?? 100;
      return {
        phoneme,
        score: currentScore - previousScore,
        sampleCount:
          current.weakPhonemes.find((item) => item.phoneme === phoneme)
            ?.sampleCount ?? 0,
      };
    })
    .filter((item) => Math.abs(item.score) >= 5);

  return {
    improvedPhonemes: deltas
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
    regressedPhonemes: deltas
      .filter((item) => item.score < 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3),
  };
}

function comparisonSummary(
  _current: CoverageBenchmarkSnapshot,
  previous: CoverageBenchmarkSnapshot | undefined,
  overallDelta: number,
  repeatedIssueIds: string[],
): string {
  if (!previous) {
    return "这是你的第一份全音覆盖基线。以后用同一篇材料复测，系统会比较前后变化。";
  }
  if (overallDelta >= 5) {
    return `总体提升 ${overallDelta} 分，说明阶段训练已经开始迁移到整段朗读。`;
  }
  if (overallDelta <= -5) {
    return `总体下降 ${Math.abs(overallDelta)} 分，先检查录音质量，再回到反复出现的问题。`;
  }
  if (repeatedIssueIds.length > 0) {
    return "总体变化不大，但有问题连续出现，下一轮优先处理这些稳定弱点。";
  }
  return "总体保持稳定，可以继续推进到更高负荷的句子和自由表达任务。";
}

function nextAction(
  current: CoverageBenchmarkSnapshot,
  repeatedIssueIds: string[],
  newIssueIds: string[],
): string {
  const topIssue =
    current.issues.find((issue) => repeatedIssueIds.includes(issue.id)) ??
    current.issues.find((issue) => newIssueIds.includes(issue.id)) ??
    current.issues[0];
  if (!topIssue) return "下一步：进入自由练习，用自己的句子做迁移复测。";
  const packId = topIssue.recommendedPackIds[0];
  return packId
    ? `下一步：先练 ${packId}，因为它在阶段复测里证据最稳定。`
    : `下一步：先处理「${topIssue.title}」。`;
}

export function compareCoverageBenchmarks(
  current: CoverageBenchmarkSnapshot,
  previous?: CoverageBenchmarkSnapshot,
): CoverageBenchmarkComparison {
  const previousIssueIds = issueIds(previous);
  const currentIssueIds = issueIds(current);
  const resolvedIssueIds = Array.from(previousIssueIds).filter(
    (id) => !currentIssueIds.has(id),
  );
  const repeatedIssueIds = Array.from(currentIssueIds).filter((id) =>
    previousIssueIds.has(id),
  );
  const newIssueIds = Array.from(currentIssueIds).filter(
    (id) => !previousIssueIds.has(id),
  );
  const overallDelta = previous
    ? current.overallScore - previous.overallScore
    : 0;

  return {
    current,
    previous,
    overallDelta,
    dimensionDeltas: dimensionDeltas(current, previous),
    resolvedIssueIds,
    repeatedIssueIds,
    newIssueIds,
    ...phonemeDeltaLists(current, previous),
    summary: comparisonSummary(
      current,
      previous,
      overallDelta,
      repeatedIssueIds,
    ),
    nextAction: nextAction(current, repeatedIssueIds, newIssueIds),
  };
}

export function compareCoverageReportToHistory(
  report: DiagnosisReport,
  languageId: LanguageId = report.languageId ?? getCurrentLanguageId(),
  benchmarks = loadCoverageBenchmarksForLanguage(languageId),
): CoverageBenchmarkComparison {
  const current = createCoverageBenchmarkSnapshot(report, languageId);
  return compareCoverageBenchmarks(
    current,
    matchingPrevious(current, benchmarks),
  );
}

export function saveCoverageBenchmark(
  report: DiagnosisReport,
  languageId: LanguageId = report.languageId ?? getCurrentLanguageId(),
): CoverageBenchmarkComparison {
  const current = createCoverageBenchmarkSnapshot(report, languageId);
  const existing = loadCoverageBenchmarksForLanguage(languageId);
  const previous = matchingPrevious(current, existing);
  const next = [
    current,
    ...existing.filter((item) => item.id !== current.id),
  ].sort((a, b) => b.timestamp - a.timestamp);
  saveBenchmarks(next, languageId);
  return compareCoverageBenchmarks(current, previous);
}
