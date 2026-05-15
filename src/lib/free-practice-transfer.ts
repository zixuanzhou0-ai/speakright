import type { AzureAssessmentResult, AzureWord } from "@/types/azure";
import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingCourseItem,
  TrainingEvidenceItem,
  TrainingLevelKind,
  TrainingLevelSummary,
  TrainingSessionSummary,
  TransferEvidence,
} from "@/types/training";
import { getPhonemeAccuracy } from "./azure-phoneme-map";
import { recordTrainingSession } from "./mastery-profile";
import { buildReviewQueue, buildSessionReviewItems } from "./review-queue";
import { detectErrorPatterns } from "./training-error-patterns";
import { getTrainingPack } from "./training-packs";

const MAX_TRANSFER_TARGETS = 2;
const MAX_PREVIEW_TARGETS = 3;
const MAX_SUGGESTIONS = 3;

export interface FreePracticeTransferEvidence {
  packId: string;
  packTitle: string;
  levelId: string;
  targetPhonemes: string[];
  matchedWords: string[];
  targetScore: number;
  overallScore: number;
  threshold: number;
  passed: boolean;
  source: "review" | "active-pack";
  reason: string;
  nextCue: string;
  patternIds: string[];
}

export interface FreePracticeTransferSummary {
  generatedAt: number;
  text: string;
  mode: "word" | "sentence";
  recorded: boolean;
  evidences: FreePracticeTransferEvidence[];
}

export interface FreePracticeTargetPreviewTarget {
  packId: string;
  packTitle: string;
  levelId: string;
  targetPhonemes: string[];
  matchedWords: string[];
  source: "review" | "active-pack";
  reason: string;
  priority: ReviewQueueItem["priority"];
}

export interface FreePracticeTargetSuggestion {
  packId: string;
  packTitle: string;
  levelId: string;
  words: string[];
  prompt: string;
  reason: string;
}

export interface FreePracticeTargetPreview {
  generatedAt: number;
  text: string;
  targets: FreePracticeTargetPreviewTarget[];
  suggestions: FreePracticeTargetSuggestion[];
}

export interface AnalyzeFreePracticeTransferInput {
  profile: MasteryProfile | null | undefined;
  result: AzureAssessmentResult;
  text: string;
  mode: "word" | "sentence";
  now?: number;
}

export interface BuildFreePracticeTargetPreviewInput {
  profile: MasteryProfile | null | undefined;
  text: string;
  mode: "word" | "sentence";
  now?: number;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeWords(text: string): string[] {
  return unique(
    text
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)?/g)
      ?.filter((word) => word.length >= 2) ?? [],
  );
}

function normalizePhrase(text: string): string {
  return normalizeWords(text).join(" ");
}

function textContainsPhrase(
  textWords: Set<string>,
  textPhrase: string,
  phrase: string,
): boolean {
  const normalized = normalizePhrase(phrase);
  if (!normalized) return false;
  if (!normalized.includes(" ")) return textWords.has(normalized);
  return textPhrase.includes(normalized);
}

function wordScoreForTargets(
  word: AzureWord,
  targetPhonemes: string[],
): number | null {
  const scores = targetPhonemes
    .map((phoneme) => getPhonemeAccuracy({ words: [word] }, phoneme))
    .filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}

function resultScoreForTargets(
  result: AzureAssessmentResult,
  targetPhonemes: string[],
): { targetScore: number | null; matchedWords: string[] } {
  const wordScores = result.words
    .map((word) => ({
      text: word.word,
      score: wordScoreForTargets(word, targetPhonemes),
    }))
    .filter(
      (item): item is { text: string; score: number } => item.score !== null,
    );

  if (wordScores.length === 0) {
    return { targetScore: null, matchedWords: [] };
  }

  return {
    targetScore: Math.round(
      wordScores.reduce((sum, item) => sum + item.score, 0) / wordScores.length,
    ),
    matchedWords: unique(wordScores.map((item) => item.text.toLowerCase())),
  };
}

function priorityWeight(priority: ReviewQueueItem["priority"]): number {
  if (priority === "critical") return 0;
  if (priority === "major") return 1;
  return 2;
}

function candidateTasks(
  profile: MasteryProfile | null | undefined,
  now: number,
): ReviewQueueItem[] {
  if (!profile) return [];
  return buildReviewQueue(profile, now)
    .slice()
    .sort((a, b) => {
      const priority = priorityWeight(a.priority) - priorityWeight(b.priority);
      if (priority !== 0) return priority;
      return a.dueAt - b.dueAt;
    });
}

function activePackIds(profile: MasteryProfile | null | undefined): string[] {
  if (!profile) return [];
  return Object.values(profile.packs)
    .filter((pack) => pack.status !== "mastered")
    .sort((a, b) => {
      const aTime = a.nextReviewAt ?? a.lastPracticedAt ?? 0;
      const bTime = b.nextReviewAt ?? b.lastPracticedAt ?? 0;
      return bTime - aTime;
    })
    .map((pack) => pack.packId);
}

function levelKindFromId(packId: string, levelId: string): TrainingLevelKind {
  const level = getTrainingPack(packId)?.course?.levels.find(
    (item) => item.id === levelId,
  );
  return level?.kind ?? "sentence";
}

function nextCueForEvidence(
  packId: string,
  patternIds: string[],
  fallback: string,
): string {
  const pack = getTrainingPack(packId);
  const pattern = pack?.course?.errorPatterns.find((item) =>
    patternIds.includes(item.id),
  );
  return pattern?.immediateCue ?? fallback;
}

function evidenceReason(
  task: ReviewQueueItem | undefined,
  packTitle: string,
  matchedWords: string[],
): string {
  if (task) return `命中复习任务：${task.reason}`;
  return `这句话包含 ${packTitle} 的目标音：${matchedWords.slice(0, 4).join(", ")}。`;
}

function textFromCourseItem(item: TrainingCourseItem): string {
  return item.referenceText ?? item.text;
}

function candidateItemWords(item: TrainingCourseItem): string[] {
  return [
    ...normalizeWords(textFromCourseItem(item)),
    ...normalizeWords(item.contrastText ?? ""),
  ].filter((word) => word.length >= 3);
}

function packTargetWords(packId: string): string[] {
  const pack = getTrainingPack(packId);
  if (!pack) return [];
  const words = [
    ...pack.wordLadder.flatMap((item) => normalizeWords(item.text)),
    ...pack.sentenceLadder.flatMap((item) => normalizeWords(item.text)),
    ...pack.minimalPairs.flatMap((item) => [
      ...normalizeWords(item.wordA),
      ...normalizeWords(item.wordB),
    ]),
    ...(pack.course?.levels.flatMap((level) =>
      level.items.flatMap(candidateItemWords),
    ) ?? []),
  ];

  return unique(words.filter((word) => word.length >= 3));
}

function suggestionPrompt(packId: string, task?: ReviewQueueItem): string {
  const pack = getTrainingPack(packId);
  const preferredLevel = task?.levelId
    ? pack?.course?.levels.find((level) => level.id === task.levelId)
    : undefined;
  const sentenceLevel =
    preferredLevel ??
    pack?.course?.levels.find(
      (level) => level.kind === "sentence" || level.kind === "shadowing",
    ) ??
    pack?.course?.levels.find((level) => level.kind === "word");
  const item = sentenceLevel?.items.find((candidate) =>
    normalizeWords(textFromCourseItem(candidate)).some(
      (word) => word.length >= 3,
    ),
  );

  return item
    ? textFromCourseItem(item)
    : (pack?.focus ?? "换一句包含目标音的短句。");
}

function taskMatchedWords(
  task: ReviewQueueItem | undefined,
  textWords: Set<string>,
  textPhrase: string,
): string[] {
  if (!task?.itemText) return [];
  return normalizeWords(task.itemText).filter((word) =>
    textContainsPhrase(textWords, textPhrase, word),
  );
}

function previewReason(
  task: ReviewQueueItem | undefined,
  packTitle: string,
): string {
  if (task) return `命中复习任务：${task.reason}`;
  return `命中当前训练目标：${packTitle}`;
}

export function buildFreePracticeTargetPreview({
  profile,
  text,
  now = Date.now(),
}: BuildFreePracticeTargetPreviewInput): FreePracticeTargetPreview {
  const trimmed = text.trim();
  const textWords = new Set(normalizeWords(trimmed));
  const textPhrase = normalizePhrase(trimmed);
  const tasks = candidateTasks(profile, now);
  const taskByPack = new Map(tasks.map((task) => [task.packId, task]));
  const candidatePackIds = unique([
    ...tasks.map((task) => task.packId),
    ...activePackIds(profile),
  ]);

  const targets = candidatePackIds
    .map((packId): FreePracticeTargetPreviewTarget | null => {
      const pack = getTrainingPack(packId);
      if (!pack) return null;
      const task = taskByPack.get(packId);
      const taskWords = taskMatchedWords(task, textWords, textPhrase);
      const targetWords =
        taskWords.length > 0
          ? taskWords
          : packTargetWords(packId).filter((word) =>
              textContainsPhrase(textWords, textPhrase, word),
            );
      const matchedWords = unique(targetWords).slice(0, 6);
      if (matchedWords.length === 0) return null;

      return {
        packId,
        packTitle: pack.title,
        levelId:
          task?.levelId ??
          (trimmed.includes(" ") ? "shadowing-transfer" : "word-ladder"),
        targetPhonemes: pack.targetPhonemes,
        matchedWords,
        source: task ? "review" : "active-pack",
        reason: previewReason(task, pack.title),
        priority: task?.priority ?? "major",
      };
    })
    .filter((item): item is FreePracticeTargetPreviewTarget => item !== null)
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "review" ? -1 : 1;
      return priorityWeight(a.priority) - priorityWeight(b.priority);
    })
    .slice(0, MAX_PREVIEW_TARGETS);

  const coveredPackIds = new Set(targets.map((target) => target.packId));
  const suggestions = candidatePackIds
    .filter((packId) => !coveredPackIds.has(packId))
    .map((packId): FreePracticeTargetSuggestion | null => {
      const pack = getTrainingPack(packId);
      if (!pack) return null;
      const task = taskByPack.get(packId);
      const words = unique([
        ...normalizeWords(task?.itemText ?? ""),
        ...packTargetWords(packId),
      ])
        .filter((word) => word.length >= 3)
        .slice(0, 4);
      return {
        packId,
        packTitle: pack.title,
        levelId:
          task?.levelId ??
          (trimmed.includes(" ") ? "shadowing-transfer" : "word-ladder"),
        words,
        prompt: suggestionPrompt(packId, task),
        reason: task?.reason ?? `当前 ${pack.title} 还需要迁移到自己的句子。`,
      };
    })
    .filter((item): item is FreePracticeTargetSuggestion => item !== null)
    .slice(0, MAX_SUGGESTIONS);

  return {
    generatedAt: now,
    text: trimmed,
    targets,
    suggestions,
  };
}

export function analyzeFreePracticeTransfer({
  profile,
  result,
  text,
  mode,
  now = Date.now(),
}: AnalyzeFreePracticeTransferInput): FreePracticeTransferSummary {
  const tasks = candidateTasks(profile, now);
  const taskByPack = new Map(tasks.map((task) => [task.packId, task]));
  const candidatePackIds = unique([
    ...tasks.map((task) => task.packId),
    ...activePackIds(profile),
  ]);

  const evidences = candidatePackIds
    .map((packId): FreePracticeTransferEvidence | null => {
      const pack = getTrainingPack(packId);
      if (!pack) return null;
      const task = taskByPack.get(packId);
      const levelId =
        task?.levelId ??
        (mode === "sentence" ? "shadowing-transfer" : "word-ladder");
      const { targetScore, matchedWords } = resultScoreForTargets(
        result,
        pack.targetPhonemes,
      );
      if (targetScore == null || matchedWords.length === 0) return null;

      const threshold = Math.max(80, pack.masteryRule.targetPassScore);
      const passed = targetScore >= threshold && result.completenessScore >= 75;
      const patternIds = passed
        ? []
        : detectErrorPatterns({
            packId,
            targetPhonemes: pack.targetPhonemes,
            targetScore,
            overallScore: result.pronunciationScore,
            isFinalPosition: packId === "final-consonants",
            issueType: packId === "stress-rhythm" ? "rhythm" : undefined,
          }).map((pattern) => pattern.id);

      return {
        packId,
        packTitle: pack.title,
        levelId,
        targetPhonemes: pack.targetPhonemes,
        matchedWords,
        targetScore,
        overallScore: result.pronunciationScore,
        threshold,
        passed,
        source: task ? "review" : "active-pack",
        reason: evidenceReason(task, pack.title, matchedWords),
        nextCue: nextCueForEvidence(packId, patternIds, pack.mouthCue),
        patternIds,
      };
    })
    .filter((item): item is FreePracticeTransferEvidence => item !== null)
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "review" ? -1 : 1;
      if (a.passed !== b.passed) return a.passed ? 1 : -1;
      return a.targetScore - b.targetScore;
    })
    .slice(0, MAX_TRANSFER_TARGETS);

  return {
    generatedAt: now,
    text,
    mode,
    recorded: false,
    evidences,
  };
}

function evidenceText(evidence: FreePracticeTransferEvidence): string {
  return evidence.matchedWords.length > 0
    ? evidence.matchedWords.join(", ")
    : evidence.packTitle;
}

function buildFailedItem(
  summary: FreePracticeTransferSummary,
  evidence: FreePracticeTransferEvidence,
): TrainingEvidenceItem | undefined {
  if (evidence.passed) return undefined;
  return {
    itemId: `free-${evidence.packId}-${summary.generatedAt}`,
    levelId: evidence.levelId,
    levelKind: levelKindFromId(evidence.packId, evidence.levelId),
    text: evidenceText(evidence),
    targetPhonemes: evidence.targetPhonemes,
    targetScore: evidence.targetScore,
    overallScore: evidence.overallScore,
    patternIds: evidence.patternIds,
    nextCue: evidence.nextCue,
    passed: false,
  };
}

function buildTransferSession(
  summary: FreePracticeTransferSummary,
  evidence: FreePracticeTransferEvidence,
): TrainingSessionSummary {
  const failedItem = buildFailedItem(summary, evidence);
  const levelKind = levelKindFromId(evidence.packId, evidence.levelId);
  const levelSummary: TrainingLevelSummary = {
    levelId: evidence.levelId,
    kind: levelKind,
    attempts: 1,
    passed: evidence.passed,
    bestScore: evidence.targetScore,
    stuckCount: evidence.passed ? 0 : 1,
  };
  const transferEvidence: TransferEvidence = {
    layer: "guided",
    prompt: summary.text,
    score: evidence.targetScore,
    passed: evidence.passed,
    completedAt: summary.generatedAt,
  };
  const session: TrainingSessionSummary = {
    id: `free-${evidence.packId}-${summary.generatedAt}`,
    packId: evidence.packId,
    startedAt: summary.generatedAt,
    completedAt: summary.generatedAt,
    perceptionCorrect: 0,
    perceptionTotal: 0,
    targetScores: [evidence.targetScore],
    wordScores: summary.mode === "word" ? [evidence.targetScore] : [],
    sentenceScores: summary.mode === "sentence" ? [evidence.targetScore] : [],
    mastered: false,
    mixedReviewScores: [],
    levelSummaries: [levelSummary],
    failedItems: failedItem ? [failedItem] : [],
    remediationResults: [],
    stuckPatternIds: [],
    recommendedNextLevelId: evidence.passed ? undefined : evidence.levelId,
    transferEvidence: [transferEvidence],
    isReviewSession: evidence.source === "review",
  };

  return {
    ...session,
    reviewItems: buildSessionReviewItems(session, summary.generatedAt),
  };
}

export function recordFreePracticeTransfer(
  profile: MasteryProfile,
  summary: FreePracticeTransferSummary,
): {
  profile: MasteryProfile;
  summary: FreePracticeTransferSummary;
  sessions: TrainingSessionSummary[];
} {
  let nextProfile = profile;
  const sessions = summary.evidences.map((evidence) =>
    buildTransferSession(summary, evidence),
  );

  for (const session of sessions) {
    nextProfile = recordTrainingSession(nextProfile, session);
  }

  return {
    profile: nextProfile,
    summary: { ...summary, recorded: sessions.length > 0 },
    sessions,
  };
}
