import type { AzureAssessmentResult } from "@/types/azure";

export type ProsodyExerciseKind =
  | "sentence-stress"
  | "weak-forms"
  | "thought-groups"
  | "linking"
  | "shadowing";

export interface ProsodyExercise {
  id: string;
  kind: ProsodyExerciseKind;
  title: string;
  text: string;
  displayText: string;
  coachCue: string;
  targetPattern: string;
  focusWords: string[];
  weakWords: string[];
  expectedPauses: string[];
  pass: {
    minProsody: number;
    minFluency: number;
    minAccuracy: number;
  };
}

export interface ProsodyAnalysis {
  exerciseId: string;
  passed: boolean;
  prosodyScore: number;
  fluencyScore: number;
  accuracyScore: number;
  completenessScore: number;
  missingFocusWords: string[];
  overHeavyFunctionWords: string[];
  missingExpectedPauses: string[];
  unexpectedPauses: string[];
  evidenceConfidence: "low" | "medium" | "high";
  likelyIssue:
    | "unclear-text"
    | "flat-prosody"
    | "choppy-rhythm"
    | "over-heavy-function-words"
    | "good-control";
  nextCue: string;
}

export const PROSODY_EXERCISES: ProsodyExercise[] = [
  {
    id: "content-word-stress-1",
    kind: "sentence-stress",
    title: "内容词突出",
    text: "I need a quick update before the meeting.",
    displayText: "I NEED a QUICK UPDATE / before the MEETING.",
    coachCue:
      "这题只练内容词突出：need, quick, update, meeting 更清楚，a/the/before 轻一点。",
    targetPattern: "内容词重，功能词轻；before 前可以轻微分组。",
    focusWords: ["need", "quick", "update", "meeting"],
    weakWords: ["a", "the", "before"],
    expectedPauses: ["update|before"],
    pass: { minProsody: 78, minFluency: 78, minAccuracy: 78 },
  },
  {
    id: "weak-form-to-1",
    kind: "weak-forms",
    title: "to / of / for 弱读",
    text: "I want to ask for a copy of the report.",
    displayText: "I WANT to ASK for a COPY of the REPORT.",
    coachCue:
      "这题只练弱读：to 像 /tə/，for 和 of 不要读满，不要每个词一样重。",
    targetPattern: "want to 连成一块；for/of/a 弱化。",
    focusWords: ["want", "ask", "copy", "report"],
    weakWords: ["to", "for", "a", "of", "the"],
    expectedPauses: ["copy|of"],
    pass: { minProsody: 76, minFluency: 76, minAccuracy: 76 },
  },
  {
    id: "thought-group-1",
    kind: "thought-groups",
    title: "按意义分组",
    text: "After the call, we can review the numbers and make a decision.",
    displayText:
      "After the CALL, / we can review the NUMBERS / and make a DECISION.",
    coachCue:
      "这题只练停顿位置：call 后短停，numbers 后短停，不要在 we can 中间断开。",
    targetPattern: "意义边界短停，组内连起来。",
    focusWords: ["call", "review", "numbers", "make", "decision"],
    weakWords: ["the", "we", "can", "and", "a"],
    expectedPauses: ["call|we", "numbers|and"],
    pass: { minProsody: 76, minFluency: 78, minAccuracy: 76 },
  },
  {
    id: "linking-1",
    kind: "linking",
    title: "辅音接元音连读",
    text: "Turn it off and put it on the desk.",
    displayText: "Tur-nit OFF / and pu-dit ON the DESK.",
    coachCue: "这题只练辅音+元音连读：turn it, put it 要连，不是逐词断开。",
    targetPattern: "turn it / put it 连成小块，但词尾 consonant 仍保留。",
    focusWords: ["turn", "off", "put", "desk"],
    weakWords: ["it", "and", "it", "on", "the"],
    expectedPauses: ["off|and"],
    pass: { minProsody: 76, minFluency: 80, minAccuracy: 76 },
  },
  {
    id: "contrastive-focus-1",
    kind: "sentence-stress",
    title: "对比重音",
    text: "I asked for the blue file, not the black one.",
    displayText: "I asked for the BLUE file, / not the BLACK one.",
    coachCue: "这题只练对比重音：blue 和 black 要明显突出，其他词收轻。",
    targetPattern: "对比词 blue/black 给更高能量和更长时值。",
    focusWords: ["blue", "black"],
    weakWords: ["I", "for", "the", "not", "the"],
    expectedPauses: ["file|not"],
    pass: { minProsody: 80, minFluency: 78, minAccuracy: 78 },
  },
  {
    id: "shadowing-chunk-1",
    kind: "shadowing",
    title: "短块影子跟读",
    text: "If we start small, we can improve the whole system step by step.",
    displayText:
      "If we start SMALL, / we can improve the WHOLE SYSTEM / step by STEP.",
    coachCue:
      "这题只练短块跟读：先分三块，再连成整句；不要为了速度吞掉 final consonants。",
    targetPattern: "三块语流，最后 step by step 稳定降调。",
    focusWords: ["start", "small", "improve", "whole", "system", "step"],
    weakWords: ["if", "we", "the", "by"],
    expectedPauses: ["small|we", "system|step"],
    pass: { minProsody: 78, minFluency: 80, minAccuracy: 78 },
  },
];

function normalizedWords(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z]+(?:'[a-z]+)?/g)
      ?.map((word) => word.replace(/'s$/, "")) ?? []
  );
}

function wordKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z']/g, "")
    .replace(/'s$/, "");
}

function breakErrors(word: AzureAssessmentResult["words"][number]): string[] {
  return word.feedback?.prosody?.break?.errorTypes ?? [];
}

function hasBreakFeedback(result: AzureAssessmentResult): boolean {
  return result.words.some((word) => breakErrors(word).length > 0);
}

function boundaryKey(left: string, right: string): string {
  return `${wordKey(left)}|${wordKey(right)}`;
}

function pauseEvidence(
  exercise: ProsodyExercise,
  result: AzureAssessmentResult,
): {
  missingExpectedPauses: string[];
  unexpectedPauses: string[];
  confidence: "low" | "medium" | "high";
} {
  const expected = new Set(
    exercise.expectedPauses.map((item) => item.toLowerCase()),
  );
  const missingExpectedPauses: string[] = [];
  const unexpectedPauses: string[] = [];
  const feedbackAvailable = hasBreakFeedback(result);

  for (let index = 0; index < result.words.length - 1; index += 1) {
    const current = result.words[index];
    const next = result.words[index + 1];
    const key = boundaryKey(current.word, next.word);
    const errors = breakErrors(current);
    if (expected.has(key) && errors.includes("MissingBreak")) {
      missingExpectedPauses.push(key);
    }
    if (!expected.has(key) && errors.includes("UnexpectedBreak")) {
      unexpectedPauses.push(key);
    }
  }

  return {
    missingExpectedPauses,
    unexpectedPauses,
    confidence: feedbackAvailable
      ? missingExpectedPauses.length > 0 || unexpectedPauses.length > 0
        ? "high"
        : "medium"
      : "low",
  };
}

export function getProsodyExercise(id: string): ProsodyExercise | undefined {
  return PROSODY_EXERCISES.find((exercise) => exercise.id === id);
}

export function analyzeProsodyAttempt(
  exercise: ProsodyExercise,
  result: AzureAssessmentResult,
): ProsodyAnalysis {
  const spokenWords = new Set(
    normalizedWords(result.words.map((w) => w.word).join(" ")),
  );
  const missingFocusWords = exercise.focusWords.filter(
    (word) => !spokenWords.has(word.toLowerCase()),
  );
  const pause = pauseEvidence(exercise, result);
  const breakFeedbackAvailable = pause.confidence !== "low";
  const overHeavyFunctionWords = breakFeedbackAvailable
    ? []
    : exercise.weakWords.filter((word) => {
        const azureWord = result.words.find(
          (item) => item.word.toLowerCase() === word.toLowerCase(),
        );
        return (
          (azureWord?.accuracyScore ?? 0) >= 92 &&
          result.prosodyScore != null &&
          result.prosodyScore < exercise.pass.minProsody
        );
      });

  const prosodyScore = result.prosodyScore ?? result.fluencyScore;
  const passed =
    prosodyScore >= exercise.pass.minProsody &&
    result.fluencyScore >= exercise.pass.minFluency &&
    result.accuracyScore >= exercise.pass.minAccuracy &&
    result.completenessScore >= 75 &&
    missingFocusWords.length === 0 &&
    pause.missingExpectedPauses.length === 0 &&
    pause.unexpectedPauses.length === 0;

  const likelyIssue: ProsodyAnalysis["likelyIssue"] =
    result.completenessScore < 75 || missingFocusWords.length > 0
      ? "unclear-text"
      : pause.missingExpectedPauses.length > 0 ||
          pause.unexpectedPauses.length > 0
        ? "choppy-rhythm"
        : prosodyScore < exercise.pass.minProsody
          ? overHeavyFunctionWords.length > 0
            ? "over-heavy-function-words"
            : "flat-prosody"
          : result.fluencyScore < exercise.pass.minFluency
            ? "choppy-rhythm"
            : "good-control";

  const nextCueByIssue: Record<ProsodyAnalysis["likelyIssue"], string> = {
    "unclear-text": "先把原句读完整；漏词时不要急着练节奏。",
    "flat-prosody": "下一次只把大写词读得更突出，其他词保持轻短。",
    "choppy-rhythm": "下一次按斜线分块，组内词连起来，组间轻停。",
    "over-heavy-function-words":
      "下一次只把功能词压轻：to/for/of/a/the 不要读满。",
    "good-control": "这一层可以过，下一步把同样节奏迁移到自己的句子。",
  };

  return {
    exerciseId: exercise.id,
    passed,
    prosodyScore,
    fluencyScore: result.fluencyScore,
    accuracyScore: result.accuracyScore,
    completenessScore: result.completenessScore,
    missingFocusWords,
    overHeavyFunctionWords,
    missingExpectedPauses: pause.missingExpectedPauses,
    unexpectedPauses: pause.unexpectedPauses,
    evidenceConfidence: pause.confidence,
    likelyIssue,
    nextCue: nextCueByIssue[likelyIssue],
  };
}

export function recommendProsodyExercises(
  lastAnalyses: ProsodyAnalysis[] = [],
): ProsodyExercise[] {
  const failedKinds = new Set(
    lastAnalyses
      .filter((analysis) => !analysis.passed)
      .map((analysis) => getProsodyExercise(analysis.exerciseId)?.kind)
      .filter((kind): kind is ProsodyExerciseKind => !!kind),
  );
  const prioritized = PROSODY_EXERCISES.filter((exercise) =>
    failedKinds.has(exercise.kind),
  );
  return [...prioritized, ...PROSODY_EXERCISES].filter(
    (exercise, index, items) =>
      items.findIndex((item) => item.id === exercise.id) === index,
  );
}
