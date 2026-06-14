"use client";

import {
  ArrowLeft,
  Check,
  Headphones,
  RotateCcw,
  TrendingUp,
  Volume2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import {
  buildHvptSession,
  buildHvptTrainingSession,
  getHvptContrast,
  HVPT_CONTRASTS,
  type HvptAnswer,
  type HvptContrast,
  type HvptResponse,
  type HvptSpeaker,
  type HvptSummary,
  type HvptTrial,
  recommendedHvptContrastIds,
  summarizeHvptSession,
} from "@/lib/hvpt-training";
import {
  loadMasteryProfile,
  recordTrainingSession,
  saveMasteryProfile,
} from "@/lib/mastery-profile";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";

type PlayingSlot = "A" | "B" | "X" | null;

type PerceptionPhase =
  | { type: "select" }
  | { type: "playing"; questionIndex: number }
  | { type: "answered"; questionIndex: number; correct: boolean }
  | { type: "focused-review"; trials: HvptTrial[] }
  | { type: "completed"; summary: HvptSummary };

const QUESTIONS_PER_SESSION = 12;

function speakerLabel(speaker: HvptSpeaker): string {
  return speaker === "blue" ? "Max" : "Nichalia";
}

function answerIsCorrect(trial: HvptTrial, answer: HvptAnswer): boolean {
  return (answer === "A") === trial.xIsA;
}

export default function PerceptionDrillPage() {
  const [selectedContrast, setSelectedContrast] = useState<HvptContrast | null>(
    null,
  );
  const [phase, setPhase] = useState<PerceptionPhase>({ type: "select" });
  const [responses, setResponses] = useState<HvptResponse[]>([]);
  const [trials, setTrials] = useState<HvptTrial[]>([]);
  const [activeSlot, setActiveSlot] = useState<PlayingSlot>(null);
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const canRecordHvptMastery = canRecordFormalMastery(languageId);
  const pronunciation = useWordPronunciation();

  const recommendedIds = useMemo(
    () =>
      typeof window === "undefined"
        ? ["ee-ih", "eh-ae", "s-th", "v-w", "l-r"]
        : recommendedHvptContrastIds(loadMasteryProfile()),
    [],
  );

  const startSession = (contrast: HvptContrast, reviewTrials?: HvptTrial[]) => {
    setSelectedContrast(contrast);
    const nextTrials =
      reviewTrials && reviewTrials.length > 0
        ? reviewTrials
        : buildHvptSession(contrast.id, QUESTIONS_PER_SESSION);
    setTrials(nextTrials);
    setResponses([]);
    setActiveSlot(null);
    setPhase({ type: "playing", questionIndex: 0 });
  };

  const currentTrial =
    (phase.type === "playing" || phase.type === "answered") &&
    trials[phase.questionIndex]
      ? trials[phase.questionIndex]
      : null;

  const playSlot = (slot: Exclude<PlayingSlot, null>) => {
    if (!currentTrial) return;
    setActiveSlot(slot);
    const word =
      slot === "A"
        ? currentTrial.wordA
        : slot === "B"
          ? currentTrial.wordB
          : currentTrial.xWord;
    const speaker =
      slot === "A"
        ? currentTrial.speakerA
        : slot === "B"
          ? currentTrial.speakerB
          : currentTrial.speakerX;
    pronunciation.playWord(word, speaker, languageId);
  };

  const answer = (answerValue: HvptAnswer) => {
    if (phase.type !== "playing" || !currentTrial) return;
    const nextResponse = { trialId: currentTrial.id, answer: answerValue };
    setResponses((prev) => [...prev, nextResponse]);
    setPhase({
      type: "answered",
      questionIndex: phase.questionIndex,
      correct: answerIsCorrect(currentTrial, answerValue),
    });
  };

  const completeSession = (nextResponses: HvptResponse[]) => {
    if (!selectedContrast) return;
    const summary = summarizeHvptSession(
      selectedContrast,
      trials,
      nextResponses,
    );
    if (!summary.passed && summary.focusedReviewTrials.length > 0) {
      setPhase({ type: "focused-review", trials: summary.focusedReviewTrials });
      return;
    }
    finishWithSummary(summary);
  };

  const finishWithSummary = (summary: HvptSummary) => {
    if (
      !selectedContrast ||
      typeof window === "undefined" ||
      !canRecordHvptMastery
    ) {
      setPhase({ type: "completed", summary });
      return;
    }
    const session = buildHvptTrainingSession(selectedContrast, summary);
    const nextProfile = recordTrainingSession(loadMasteryProfile(), session);
    saveMasteryProfile(nextProfile);
    setPhase({ type: "completed", summary });
  };

  const next = () => {
    if (phase.type !== "answered" || !selectedContrast) return;
    const nextIndex = phase.questionIndex + 1;
    if (nextIndex >= trials.length) {
      completeSession(responses);
      return;
    }
    setActiveSlot(null);
    setPhase({ type: "playing", questionIndex: nextIndex });
  };

  const finishFocusedReview = () => {
    if (!selectedContrast) return;
    finishWithSummary(
      summarizeHvptSession(selectedContrast, trials, responses),
    );
  };

  const reset = () => {
    setSelectedContrast(null);
    setTrials([]);
    setResponses([]);
    setActiveSlot(null);
    setPhase({ type: "select" });
  };

  if (!canRecordHvptMastery) {
    return (
      <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <Headphones className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 text-2xl font-bold">
              {languageProfile.shortLabel}听辨训练开发中
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              当前高变异 ABX 听辨题库仍是英语专属。西语、法语、俄语保持 experimental，不混入英语听辨材料。
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/drill/contrast">
                <Button className="cursor-pointer">先做对比训练</Button>
              </Link>
              <Link href="/drill">
                <Button variant="outline" className="cursor-pointer">
                  返回训练首页
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const correctCount = responses.filter((response) => {
    const trial = trials.find((item) => item.id === response.trialId);
    return trial ? answerIsCorrect(trial, response.answer) : false;
  }).length;

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">高变异听辨训练</h1>
          <p className="text-sm text-muted-foreground">
            多说话人、多语境 ABX，先重建听觉边界再发音
          </p>
        </div>
        {selectedContrast && (
          <Badge variant="secondary">{selectedContrast.label}</Badge>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {phase.type === "select" && (
          <div className="space-y-5">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">系统推荐先练</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {recommendedIds.map((id) => {
                  const contrast = getHvptContrast(id);
                  if (!contrast) return null;
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => startSession(contrast)}
                    >
                      {contrast.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {HVPT_CONTRASTS.map((contrast) => (
                <motion.button
                  key={contrast.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startSession(contrast)}
                  className="rounded-xl border bg-card p-4 text-center shadow-sm hover:border-primary/50 cursor-pointer"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Headphones className="h-5 w-5 text-primary" />
                    <Badge variant="outline">
                      通过线 {Math.round(contrast.passRate * 100)}%
                    </Badge>
                  </div>
                  <p className="break-words text-center font-mono text-xl font-bold [overflow-wrap:anywhere]">
                    {contrast.label}
                  </p>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {contrast.learnerRisk}
                  </p>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {phase.type === "playing" && currentTrial && selectedContrast && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                第 {phase.questionIndex + 1} / {trials.length} 题
              </span>
              <span>正确 {correctCount}</span>
            </div>

            <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
              <div className="text-center">
                <p className="text-sm font-medium text-primary">
                  这一题只练：{selectedContrast.label} 的听觉边界
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  场景：{currentTrial.context} · 难度 {currentTrial.difficulty}
                  /5
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {(["A", "B", "X"] as const).map((slot) => {
                  const speaker =
                    slot === "A"
                      ? currentTrial.speakerA
                      : slot === "B"
                        ? currentTrial.speakerB
                        : currentTrial.speakerX;
                  return (
                    <motion.button
                      key={slot}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => playSlot(slot)}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer ${
                        activeSlot === slot && pronunciation.isPlaying
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/30"
                      }`}
                    >
                      <Volume2
                        className={`h-6 w-6 ${
                          activeSlot === slot && pronunciation.isPlaying
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-lg font-bold">{slot}</span>
                      <span className="text-xs text-muted-foreground">
                        {speakerLabel(speaker)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  onClick={() => answer("A")}
                  variant="outline"
                  size="lg"
                  className="cursor-pointer"
                >
                  X = A
                </Button>
                <Button
                  onClick={() => answer("B")}
                  variant="outline"
                  size="lg"
                  className="cursor-pointer"
                >
                  X = B
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {phase.type === "answered" && currentTrial && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border bg-card p-8 text-center shadow-sm"
          >
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                phase.correct
                  ? "bg-primary/10 text-primary"
                  : "bg-red-100 text-red-500 dark:bg-red-950/30"
              }`}
            >
              {phase.correct ? (
                <Check className="h-8 w-8" />
              ) : (
                <X className="h-8 w-8" />
              )}
            </div>
            <h2 className="text-xl font-bold">
              {phase.correct ? "听对了" : "这次混淆了"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              X 是 {currentTrial.xIsA ? "A" : "B"} · 词是{" "}
              <span
                className={`inline-block font-semibold ${getCenteredReadableTextClassName(getPracticeTextDensity(currentTrial.xWord))}`}
              >
                {currentTrial.xWord}
              </span>
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => playSlot("X")}
                className="gap-2 cursor-pointer"
              >
                <Volume2 className="h-4 w-4" />
                再听 X
              </Button>
              <Button type="button" onClick={next} className="cursor-pointer">
                下一题
              </Button>
            </div>
          </motion.div>
        )}

        {phase.type === "focused-review" && selectedContrast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">追加错项复听</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              听辨低于通过线时，先复听刚才错过的具体对比，不直接进入发音。
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {phase.trials.map((trial) => (
                <div key={trial.id} className="rounded-lg border p-3 text-center">
                  <p className="break-words text-center text-sm font-semibold [overflow-wrap:anywhere]">
                    {trial.wordA} / {trial.wordB}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">
                    {trial.context}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pronunciation.playWord(
                          trial.wordA,
                          trial.speakerA,
                          languageId,
                        )
                      }
                      className="cursor-pointer"
                    >
                      听 A
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        pronunciation.playWord(
                          trial.wordB,
                          trial.speakerB,
                          languageId,
                        )
                      }
                      className="cursor-pointer"
                    >
                      听 B
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => startSession(selectedContrast, phase.trials)}
                className="cursor-pointer"
              >
                用错题再测
              </Button>
              <Button
                type="button"
                onClick={finishFocusedReview}
                className="cursor-pointer"
              >
                查看总结
              </Button>
            </div>
          </motion.div>
        )}

        {phase.type === "completed" && selectedContrast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-8 text-center shadow-sm"
          >
            <Headphones className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-3 text-2xl font-bold">听辨训练完成</h2>
            <div
              className={`mx-auto mt-5 inline-flex h-24 w-24 items-center justify-center rounded-2xl text-white ${
                phase.summary.passed
                  ? "bg-primary"
                  : phase.summary.accuracy >= 0.7
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
            >
              <span className="text-3xl font-bold">
                {Math.round(phase.summary.accuracy * 100)}%
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {phase.summary.nextAction}
            </p>
            {phase.summary.biasDirection && (
              <p className="mt-2 text-sm font-medium text-primary">
                偏误方向：{phase.summary.biasDirection}
              </p>
            )}
            <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">
                  {selectedContrast.targetA} 听成自己
                </p>
                <p className="text-xl font-bold">
                  {phase.summary.confusionMatrix.aAsA}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">
                  {selectedContrast.targetA} 听成 {selectedContrast.targetB}
                </p>
                <p className="text-xl font-bold">
                  {phase.summary.confusionMatrix.aAsB}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">
                  {selectedContrast.targetB} 听成 {selectedContrast.targetA}
                </p>
                <p className="text-xl font-bold">
                  {phase.summary.confusionMatrix.bAsA}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">
                  {selectedContrast.targetB} 听成自己
                </p>
                <p className="text-xl font-bold">
                  {phase.summary.confusionMatrix.bAsB}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="cursor-pointer"
              >
                返回
              </Button>
              <Button
                type="button"
                onClick={() => startSession(selectedContrast)}
                className="cursor-pointer"
              >
                再练一轮
              </Button>
              {phase.summary.passed && (
                <Link href={`/drill/pack/${selectedContrast.packId}`}>
                  <Button type="button" className="cursor-pointer">
                    进入发音课
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
