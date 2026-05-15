import type { MasteryProfile } from "@/types/training";
import { buildReviewQueue } from "./review-queue";
import { getTrainingPack, TRAINING_PACKS } from "./training-packs";

export type TransferScenarioKind =
  | "meeting"
  | "interview"
  | "presentation"
  | "daily"
  | "technical";

export interface TransferScenario {
  id: string;
  kind: TransferScenarioKind;
  title: string;
  goal: string;
  prompt: string;
  sentenceFrame: string;
  targetPackIds: string[];
  suggestedWords: string[];
}

export interface TransferPromptPlan {
  scenario: TransferScenario;
  targetPackIds: string[];
  targetWords: string[];
  prompt: string;
  coachingFocus: string;
}

export const TRANSFER_SCENARIOS: TransferScenario[] = [
  {
    id: "standup-update",
    kind: "meeting",
    title: "会议更新",
    goal: "用工作汇报练 final consonants、弱读和句重音。",
    prompt:
      "Give a short update about what you finished and what you will do next.",
    sentenceFrame: "I finished ___ yesterday, and today I will focus on ___.",
    targetPackIds: ["final-consonants", "stress-rhythm"],
    suggestedWords: ["finished", "worked", "focused", "next", "task"],
  },
  {
    id: "interview-strength",
    kind: "interview",
    title: "面试优势",
    goal: "把核心元音和 /r/ /l/ 迁移到自然自我介绍。",
    prompt: "Answer: What is one strength you bring to a team?",
    sentenceFrame: "One strength I bring is ___, because I can ___ clearly.",
    targetPackIds: ["ee-ih", "l-r", "stress-rhythm"],
    suggestedWords: ["strength", "bring", "clearly", "team", "build"],
  },
  {
    id: "product-demo",
    kind: "presentation",
    title: "产品演示",
    goal: "练句子分组、内容词突出和词尾别吞。",
    prompt: "Explain a product feature in two clear sentences.",
    sentenceFrame:
      "This feature helps users ___. It reduces ___ and improves ___.",
    targetPackIds: ["final-consonants", "stress-rhythm", "v-w"],
    suggestedWords: ["feature", "users", "reduces", "improves", "value"],
  },
  {
    id: "daily-plan",
    kind: "daily",
    title: "日常计划",
    goal: "把弱读、to/for/of 和常见元音放进自己的句子。",
    prompt: "Say your plan for tonight in one natural sentence.",
    sentenceFrame: "Tonight I want to ___ for ___ and then ___.",
    targetPackIds: ["oo-uh", "ee-ih", "stress-rhythm"],
    suggestedWords: ["tonight", "want", "to", "for", "then"],
  },
  {
    id: "technical-tradeoff",
    kind: "technical",
    title: "技术取舍",
    goal: "练复杂词、/v/ /w/、词重音和语义停顿。",
    prompt: "Explain one technical tradeoff you made recently.",
    sentenceFrame:
      "We chose ___ because it was faster, but the tradeoff was ___.",
    targetPackIds: ["v-w", "final-consonants", "stress-rhythm"],
    suggestedWords: ["chose", "faster", "tradeoff", "was", "value"],
  },
];

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function packWords(packId: string): string[] {
  const pack = getTrainingPack(packId);
  if (!pack) return [];
  return unique([
    ...pack.wordLadder.map((item) => item.text),
    ...pack.minimalPairs.flatMap((item) => [item.wordA, item.wordB]),
    ...(pack.course?.levels.flatMap((level) =>
      level.items.flatMap(
        (item) => (item.referenceText ?? item.text).match(/[A-Za-z]+/g) ?? [],
      ),
    ) ?? []),
  ])
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3);
}

export function buildTransferPromptPlan(
  scenarioId: string,
  profile: MasteryProfile | null | undefined,
): TransferPromptPlan {
  const scenario =
    TRANSFER_SCENARIOS.find((item) => item.id === scenarioId) ??
    TRANSFER_SCENARIOS[0];
  const duePackIds = profile
    ? buildReviewQueue(profile)
        .slice(0, 2)
        .map((item) => item.packId)
    : [];
  const activePackIds = profile
    ? Object.values(profile.packs)
        .filter((pack) => pack.status !== "mastered")
        .sort((a, b) => b.failureStreak - a.failureStreak)
        .slice(0, 2)
        .map((pack) => pack.packId)
    : [];
  const targetPackIds = unique([
    ...duePackIds,
    ...activePackIds,
    ...scenario.targetPackIds,
  ]).slice(0, 3);
  const targetWords = unique([
    ...scenario.suggestedWords,
    ...targetPackIds.flatMap((packId) => packWords(packId).slice(0, 5)),
  ]).slice(0, 10);
  const packTitles = targetPackIds
    .map((packId) => TRAINING_PACKS.find((pack) => pack.id === packId)?.title)
    .filter((title): title is string => !!title);

  return {
    scenario,
    targetPackIds,
    targetWords,
    prompt: `${scenario.prompt}\nFrame: ${scenario.sentenceFrame}`,
    coachingFocus:
      packTitles.length > 0
        ? `这次只盯 ${packTitles.join(" / ")}，不要泛泛纠全部发音。`
        : "这次只盯一个主目标，先清楚，再自然。",
  };
}
