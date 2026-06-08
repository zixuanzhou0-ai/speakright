import type { MasteryProfile, TrainingSessionSummary } from "@/types/training";
import { buildReviewQueue, buildSessionReviewItems } from "./review-queue";
import { getTrainingPack } from "./training-packs";

export type HvptSpeaker = "blue" | "pink";
export type HvptAnswer = "A" | "B";

export interface HvptContrastItem {
  wordA: string;
  wordB: string;
  context: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface HvptContrast {
  id: string;
  packId: string;
  label: string;
  targetA: string;
  targetB: string;
  learnerRisk: string;
  passRate: number;
  items: HvptContrastItem[];
}

export interface HvptTrial {
  id: string;
  contrastId: string;
  index: number;
  wordA: string;
  wordB: string;
  xWord: string;
  xIsA: boolean;
  speakerA: HvptSpeaker;
  speakerB: HvptSpeaker;
  speakerX: HvptSpeaker;
  context: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface HvptResponse {
  trialId: string;
  answer: HvptAnswer;
}

export interface HvptSummary {
  contrastId: string;
  total: number;
  correct: number;
  accuracy: number;
  passed: boolean;
  passRate: number;
  confusionMatrix: {
    aAsA: number;
    aAsB: number;
    bAsA: number;
    bAsB: number;
  };
  biasDirection?: string;
  focusedReviewTrials: HvptTrial[];
  nextAction: string;
}

export const HVPT_CONTRASTS: HvptContrast[] = [
  {
    id: "ee-ih",
    packId: "ee-ih",
    label: "/i:/ vs /I/",
    targetA: "/i:/",
    targetB: "/I/",
    learnerRisk: "不要只靠长短判断；重点听紧张 /i:/ 和松弛 /I/ 的舌位差。",
    passRate: 0.9,
    items: [
      {
        wordA: "sheep",
        wordB: "ship",
        context: "front vowel before /p/",
        difficulty: 2,
      },
      {
        wordA: "beat",
        wordB: "bit",
        context: "front vowel before /t/",
        difficulty: 2,
      },
      {
        wordA: "leave",
        wordB: "live",
        context: "voiced final context",
        difficulty: 3,
      },
      { wordA: "seat", wordB: "sit", context: "sibilant onset", difficulty: 2 },
      {
        wordA: "green",
        wordB: "grin",
        context: "cluster onset",
        difficulty: 4,
      },
      { wordA: "feel", wordB: "fill", context: "final /l/", difficulty: 4 },
    ],
  },
  {
    id: "eh-ae",
    packId: "eh-ae",
    label: "/e/ vs /ae/",
    targetA: "/e/",
    targetB: "/ae/",
    learnerRisk: "/ae/ 需要下巴更打开；不要把 bad 读成 bed。",
    passRate: 0.88,
    items: [
      { wordA: "bed", wordB: "bad", context: "final /d/", difficulty: 2 },
      { wordA: "pen", wordB: "pan", context: "nasal ending", difficulty: 3 },
      {
        wordA: "men",
        wordB: "man",
        context: "high frequency pair",
        difficulty: 3,
      },
      {
        wordA: "guess",
        wordB: "gas",
        context: "sibilant final",
        difficulty: 4,
      },
      {
        wordA: "head",
        wordB: "had",
        context: "sentence-like frequency",
        difficulty: 3,
      },
      {
        wordA: "left",
        wordB: "laughed",
        context: "spelling trap",
        difficulty: 5,
      },
    ],
  },
  {
    id: "oo-uh",
    packId: "oo-uh",
    label: "/u:/ vs /U/",
    targetA: "/u:/",
    targetB: "/U/",
    learnerRisk: "/U/ 更短更松，嘴唇不要像 /u:/ 那样收得太圆。",
    passRate: 0.88,
    items: [
      { wordA: "pool", wordB: "pull", context: "final /l/", difficulty: 4 },
      { wordA: "Luke", wordB: "look", context: "final /k/", difficulty: 3 },
      {
        wordA: "fool",
        wordB: "full",
        context: "common contrast",
        difficulty: 3,
      },
      { wordA: "suit", wordB: "soot", context: "spelling trap", difficulty: 5 },
      {
        wordA: "food",
        wordB: "foot",
        context: "voiced/unvoiced final",
        difficulty: 3,
      },
      {
        wordA: "choose",
        wordB: "could",
        context: "lexical frequency",
        difficulty: 4,
      },
    ],
  },
  {
    id: "s-th",
    packId: "s-th",
    label: "/s/ vs /th/",
    targetA: "/s/",
    targetB: "/th/",
    learnerRisk: "齿间音不是 /s/；舌尖要到齿边，气流从齿缝出去。",
    passRate: 0.85,
    items: [
      { wordA: "sink", wordB: "think", context: "minimal pair", difficulty: 2 },
      {
        wordA: "sick",
        wordB: "thick",
        context: "short vowel context",
        difficulty: 3,
      },
      { wordA: "some", wordB: "thumb", context: "nasal final", difficulty: 4 },
      { wordA: "sing", wordB: "thing", context: "nasal coda", difficulty: 3 },
      { wordA: "saw", wordB: "thaw", context: "open vowel", difficulty: 4 },
      {
        wordA: "mouse",
        wordB: "mouth",
        context: "final contrast",
        difficulty: 5,
      },
    ],
  },
  {
    id: "z-dh",
    packId: "z-dh",
    label: "/z/ vs /dh/",
    targetA: "/z/",
    targetB: "/dh/",
    learnerRisk: "/dh/ 要带声带振动，但舌尖仍在齿边；不要缩回成 /z/。",
    passRate: 0.85,
    items: [
      {
        wordA: "zen",
        wordB: "then",
        context: "initial contrast",
        difficulty: 3,
      },
      {
        wordA: "breeze",
        wordB: "breathe",
        context: "final contrast",
        difficulty: 5,
      },
      {
        wordA: "close",
        wordB: "clothe",
        context: "spelling trap",
        difficulty: 5,
      },
      {
        wordA: "zoo",
        wordB: "though",
        context: "rounded vowel",
        difficulty: 4,
      },
      {
        wordA: "buzz",
        wordB: "bathe",
        context: "voiced fricative",
        difficulty: 5,
      },
      {
        wordA: "raise",
        wordB: "rather",
        context: "connected speech risk",
        difficulty: 4,
      },
    ],
  },
  {
    id: "v-w",
    packId: "v-w",
    label: "/v/ vs /w/",
    targetA: "/v/",
    targetB: "/w/",
    learnerRisk: "/v/ 是上齿轻碰下唇摩擦，/w/ 是双唇收圆滑开。",
    passRate: 0.88,
    items: [
      {
        wordA: "vest",
        wordB: "west",
        context: "initial contrast",
        difficulty: 2,
      },
      {
        wordA: "vine",
        wordB: "wine",
        context: "diphthong context",
        difficulty: 3,
      },
      { wordA: "very", wordB: "wary", context: "two syllables", difficulty: 4 },
      { wordA: "veal", wordB: "wheel", context: "front vowel", difficulty: 3 },
      {
        wordA: "verse",
        wordB: "worse",
        context: "r-colored vowel",
        difficulty: 5,
      },
      {
        wordA: "save",
        wordB: "sway",
        context: "final/cluster contrast",
        difficulty: 5,
      },
    ],
  },
  {
    id: "l-r",
    packId: "l-r",
    label: "/l/ vs /r/",
    targetA: "/l/",
    targetB: "/r/",
    learnerRisk: "/l/ 舌尖触上齿龈；/r/ 舌头悬空，不能碰上颚。",
    passRate: 0.88,
    items: [
      {
        wordA: "light",
        wordB: "right",
        context: "initial contrast",
        difficulty: 2,
      },
      {
        wordA: "glass",
        wordB: "grass",
        context: "cluster onset",
        difficulty: 4,
      },
      { wordA: "fly", wordB: "fry", context: "cluster onset", difficulty: 4 },
      { wordA: "long", wordB: "wrong", context: "w/r context", difficulty: 4 },
      {
        wordA: "collect",
        wordB: "correct",
        context: "medial contrast",
        difficulty: 5,
      },
      {
        wordA: "belly",
        wordB: "berry",
        context: "intervocalic contrast",
        difficulty: 4,
      },
    ],
  },
  {
    id: "n-ng",
    packId: "n-ng",
    label: "/n/ vs /ng/",
    targetA: "/n/",
    targetB: "/ng/",
    learnerRisk: "/n/ 舌尖在前，/ng/ 舌根在后；不要把 thing 结尾读成 thin。",
    passRate: 0.85,
    items: [
      {
        wordA: "thin",
        wordB: "thing",
        context: "final contrast",
        difficulty: 3,
      },
      { wordA: "sin", wordB: "sing", context: "final contrast", difficulty: 3 },
      { wordA: "ran", wordB: "rang", context: "past forms", difficulty: 4 },
      {
        wordA: "win",
        wordB: "wing",
        context: "high frequency pair",
        difficulty: 3,
      },
      {
        wordA: "ban",
        wordB: "bang",
        context: "plosive context",
        difficulty: 4,
      },
      { wordA: "sun", wordB: "sung", context: "vowel context", difficulty: 4 },
    ],
  },
];

const SPEAKERS: HvptSpeaker[] = ["blue", "pink"];

function shuffle<T>(items: T[], seed = Date.now()): T[] {
  const next = [...items];
  let state = seed % 2147483647;
  for (let i = next.length - 1; i > 0; i--) {
    state = (state * 48271) % 2147483647;
    const j = state % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function speakerFor(index: number, offset: number): HvptSpeaker {
  return SPEAKERS[(index + offset) % SPEAKERS.length];
}

export function getHvptContrast(id: string): HvptContrast | undefined {
  return HVPT_CONTRASTS.find((contrast) => contrast.id === id);
}

export function buildHvptSession(
  contrastId: string,
  count = 12,
  seed = Date.now(),
): HvptTrial[] {
  const contrast = getHvptContrast(contrastId);
  if (!contrast) return [];

  const base = shuffle(contrast.items, seed);
  const trials: HvptTrial[] = [];

  for (let i = 0; i < count; i++) {
    const item = base[i % base.length];
    const xIsA = (seed + i * 7) % 2 === 0;
    trials.push({
      id: `${contrastId}-${seed}-${i}`,
      contrastId,
      index: i,
      wordA: item.wordA,
      wordB: item.wordB,
      xWord: xIsA ? item.wordA : item.wordB,
      xIsA,
      speakerA: speakerFor(i, 0),
      speakerB: speakerFor(i, 1),
      speakerX: speakerFor(i, 2),
      context: item.context,
      difficulty: item.difficulty,
    });
  }

  return trials;
}

export function summarizeHvptSession(
  contrast: HvptContrast,
  trials: HvptTrial[],
  responses: HvptResponse[],
): HvptSummary {
  const responseById = new Map(responses.map((item) => [item.trialId, item]));
  const matrix = { aAsA: 0, aAsB: 0, bAsA: 0, bAsB: 0 };
  const missed: HvptTrial[] = [];

  for (const trial of trials) {
    const response = responseById.get(trial.id);
    if (!response) continue;
    const answeredA = response.answer === "A";
    if (trial.xIsA && answeredA) matrix.aAsA += 1;
    if (trial.xIsA && !answeredA) {
      matrix.aAsB += 1;
      missed.push(trial);
    }
    if (!trial.xIsA && answeredA) {
      matrix.bAsA += 1;
      missed.push(trial);
    }
    if (!trial.xIsA && !answeredA) matrix.bAsB += 1;
  }

  const total = responses.length;
  const correct = matrix.aAsA + matrix.bAsB;
  const accuracy = total > 0 ? correct / total : 0;
  const passed = accuracy >= contrast.passRate;
  const biasDirection =
    matrix.aAsB > matrix.bAsA
      ? `更容易把 ${contrast.targetA} 听成 ${contrast.targetB}`
      : matrix.bAsA > matrix.aAsB
        ? `更容易把 ${contrast.targetB} 听成 ${contrast.targetA}`
        : undefined;
  const focusedReviewTrials = missed.slice(0, 4);

  return {
    contrastId: contrast.id,
    total,
    correct,
    accuracy,
    passed,
    passRate: contrast.passRate,
    confusionMatrix: matrix,
    biasDirection,
    focusedReviewTrials,
    nextAction: passed
      ? "听觉边界基本稳定，可以进入发音动作和句子整合。"
      : "先追加错过的具体对比，不急着录音；听不稳时发音会回到中文默认类别。",
  };
}

export function buildHvptTrainingSession(
  contrast: HvptContrast,
  summary: HvptSummary,
  now = Date.now(),
): TrainingSessionSummary {
  const score = Math.round(summary.accuracy * 100);
  const pack = getTrainingPack(contrast.packId);
  const targetPhonemes =
    pack?.targetPhonemes ??
    [contrast.targetA, contrast.targetB].map((item) => item.replace(/\//g, ""));
  const failedItems = summary.focusedReviewTrials.map((trial) => ({
    itemId: `hvpt-${trial.id}`,
    levelId: "perception-abx",
    levelKind: "perception" as const,
    text: `${trial.wordA} / ${trial.wordB}`,
    targetPhonemes,
    targetScore: score,
    overallScore: score,
    patternIds: [`hvpt-${contrast.id}`],
    nextCue: summary.biasDirection ?? contrast.learnerRisk,
    passed: false,
    assessmentReliability: {
      alignment: "good" as const,
      evidenceStrength: "strong" as const,
      canPromoteMastery: true,
      note: "听辨题不依赖录音质量，可作为 perception 层证据。",
    },
  }));
  const session: TrainingSessionSummary = {
    id: `hvpt-${contrast.id}-${now}`,
    packId: contrast.packId,
    modality: "perception",
    startedAt: now,
    completedAt: now,
    perceptionCorrect: summary.correct,
    perceptionTotal: summary.total,
    targetScores: [],
    wordScores: [],
    sentenceScores: [],
    mixedReviewScores: [],
    levelSummaries: [
      {
        levelId: "perception-abx",
        kind: "perception",
        attempts: summary.total,
        passed: summary.passed,
        bestScore: score,
        stuckCount: summary.passed ? 0 : 1,
      },
    ],
    stuckPatternIds: [],
    recommendedNextLevelId: summary.passed ? "articulation" : "perception-abx",
    failedItems,
    remediationResults: [],
    assessmentReliability: {
      alignment: "good",
      evidenceStrength: "strong",
      canPromoteMastery: true,
      note: "高变异听辨结果已计入 perception 层。",
    },
    mastered: false,
  };

  return {
    ...session,
    reviewItems: buildSessionReviewItems(session, now),
  };
}

export function recommendedHvptContrastIds(
  profile: MasteryProfile | null | undefined,
): string[] {
  if (!profile) return ["ee-ih", "eh-ae", "s-th", "v-w", "l-r"];
  const reviewPackIds = buildReviewQueue(profile)
    .filter((item) => item.source !== "due-review")
    .map((item) => item.packId);
  const weakPackIds = Object.values(profile.packs)
    .filter((pack) => pack.status !== "mastered")
    .sort((a, b) => (b.failureStreak ?? 0) - (a.failureStreak ?? 0))
    .map((pack) => pack.packId);
  const ids = [...reviewPackIds, ...weakPackIds]
    .map(
      (packId) =>
        HVPT_CONTRASTS.find((contrast) => contrast.packId === packId)?.id,
    )
    .filter((id): id is string => !!id);

  return Array.from(new Set([...ids, "ee-ih", "eh-ae", "s-th"])).slice(0, 5);
}
