"use client";

import type {
  GuidedRepeatRhythm,
  GuidedRepeatSessionPlan,
  GuidedRepeatStep,
} from "@speakright/core/training/guided-repeat";
import { Howler } from "howler";
import { Headphones, Loader2, Pause, Play, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGuidedRepeatSession } from "@/hooks/use-guided-repeat-session";
import {
  buildLocalGuidedRepeatPlan,
  isGuidedRepeatEligible,
} from "@/lib/guided-repeat-plan";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import type { LanguageId } from "@/types/language";
import type { KeywordEntry, PhonemeData } from "@/types/phoneme";

const PREFERENCE_KEY = "speakright_guided_repeat_preferences_v1";
const RHYTHMS: { id: GuidedRepeatRhythm; label: string }[] = [
  { id: "flow", label: "流畅" },
  { id: "standard", label: "标准" },
  { id: "relaxed", label: "从容" },
];

interface GuidedRepeatExperienceProps {
  languageId: LanguageId;
  phoneme: PhonemeData;
  wordPool: readonly KeywordEntry[];
  currentWord: KeywordEntry;
  disabled?: boolean;
  disabledReason?: string;
  onBeforeOpen: () => void;
  onWordChange: (word: KeywordEntry) => void;
}

function readRhythm(): GuidedRepeatRhythm {
  if (typeof window === "undefined") return "standard";
  try {
    const parsed = JSON.parse(
      localStorage.getItem(PREFERENCE_KEY) ?? "null",
    ) as {
      version?: number;
      rhythm?: GuidedRepeatRhythm;
    } | null;
    return parsed?.version === 1 &&
      parsed.rhythm &&
      RHYTHMS.some((item) => item.id === parsed.rhythm)
      ? parsed.rhythm
      : "standard";
  } catch {
    return "standard";
  }
}

function phaseLabel(step: GuidedRepeatStep | null): string {
  if (!step) return "准备下一步";
  if (step.kind === "transition") return "切换下一个单词";
  if (step.kind === "gap") {
    return step.gapKind === "imitation" ? "轮到你 · 跟读" : "保持节奏";
  }
  if (step.role === "anchor-single") return `听音标 · ${step.turn}/2`;
  if (step.role === "word-masculine") return `听单词 · 男声 ${step.turn}/2`;
  return `听单词 · 女声 ${step.turn}/2`;
}

function phaseId(step: GuidedRepeatStep | null): string {
  if (!step) return "preparing";
  if (step.kind === "transition") return "transition";
  if (step.kind === "gap") return `gap-${step.gapKind}`;
  return `${step.role}${step.turn ? `-${step.turn}` : ""}`;
}

function HighlightedIpa({ ipa, target }: { ipa: string; target: string }) {
  const needle = target.replaceAll("/", "");
  if (!needle || !ipa.includes(needle)) return <>{ipa}</>;
  const [before, ...after] = ipa.split(needle);
  return (
    <>
      {before}
      <span className="font-bold text-primary">{needle}</span>
      {after.join(needle)}
    </>
  );
}

function GuidedRepeatSession({
  plan,
  rhythm,
  phoneme,
  onRhythmChange,
  onWordChange,
  onClose,
}: {
  plan: GuidedRepeatSessionPlan;
  rhythm: GuidedRepeatRhythm;
  phoneme: PhonemeData;
  onRhythmChange: (rhythm: GuidedRepeatRhythm) => void;
  onWordChange: (word: KeywordEntry) => void;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const session = useGuidedRepeatSession({
    plan,
    rhythm,
    onWordChange: (item) => onWordChange({ word: item.word, ipa: item.ipa }),
  });
  const paused =
    session.status === "paused" || session.status === "auto-paused";
  const phase =
    session.status === "auto-paused"
      ? "已自动暂停，准备好后继续"
      : session.status === "paused"
        ? "已暂停"
        : phaseLabel(session.step);

  const currentPhaseId =
    session.status === "auto-paused"
      ? "auto-paused"
      : session.status === "paused"
        ? "paused"
        : phaseId(session.step);
  useEffect(() => {
    if (session.status === "preloading") return;
    const frame = requestAnimationFrame(() =>
      primaryButtonRef.current?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [session.status]);

  if (session.status === "completed") {
    return (
      <div
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 text-center"
        data-smoke="guided-repeat-phase"
        data-phase="completed"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Headphones className="h-7 w-7" />
        </div>
        <h3 className="mt-5 font-heading text-2xl font-semibold">
          本轮跟读完成
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          已连续练习 {plan.totalWords}{" "}
          个词。本功能只记录练习暴露，不代表已经掌握。
        </p>
        {session.storageWarning && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            {session.storageWarning}
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button
            ref={primaryButtonRef}
            className="min-h-11 px-5"
            onClick={session.restart}
          >
            <RotateCcw /> 再来一轮
          </Button>
          <Button variant="outline" className="min-h-11 px-5" onClick={onClose}>
            返回音标练习
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-8">
        <div
          aria-live="polite"
          className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary"
          data-smoke="guided-repeat-phase"
          data-phase={currentPhaseId}
        >
          {phase}
        </div>
        <div className="mt-5 flex min-h-[12rem] w-full items-center justify-center overflow-hidden sm:min-h-[15rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={session.currentItem.materialId}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -36 }}
              transition={{
                duration: reducedMotion ? 0.15 : 0.32,
                ease: "easeOut",
              }}
              className="min-w-0 text-center"
            >
              <motion.div
                animate={{ opacity: session.step?.kind === "gap" ? 0.88 : 1 }}
                transition={{ duration: 0.2 }}
                className="break-words font-heading font-bold leading-none tracking-tight [font-size:clamp(2.5rem,8vw,5rem)] [overflow-wrap:anywhere]"
                data-smoke="guided-repeat-word"
              >
                {session.currentItem.word}
              </motion.div>
              <div className="mt-4 break-words font-mono text-muted-foreground [font-size:clamp(1rem,2vw,1.5rem)] [overflow-wrap:anywhere]">
                <HighlightedIpa
                  ipa={session.currentItem.ipa}
                  target={phoneme.ipa}
                />
              </div>
              <div className="mt-5 font-mono text-sm font-semibold text-primary">
                {phoneme.ipa}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {session.currentWordIndex + 1} / {plan.totalWords}
        </p>
        {session.error && (
          <div
            role="alert"
            className="mt-5 w-full max-w-lg rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center"
            data-smoke="guided-repeat-error"
          >
            <p className="font-medium text-destructive">{session.error}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                ref={primaryButtonRef}
                className="min-h-11"
                onClick={session.retry}
              >
                重试音频
              </Button>
              {session.canDeferCurrent && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={session.deferCurrent}
                >
                  稍后再练这个词
                </Button>
              )}
              <Button variant="ghost" className="min-h-11" onClick={onClose}>
                结束训练
              </Button>
            </div>
          </div>
        )}
      </div>

      {session.status !== "recoverable-error" && (
        <div className="shrink-0 border-t bg-muted/30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              ref={primaryButtonRef}
              className="min-h-11 w-full gap-2 px-5 sm:w-auto"
              disabled={session.status === "preloading"}
              onClick={() => (paused ? session.resume() : session.pause())}
              data-smoke="guided-repeat-pause"
            >
              {paused ? <Play /> : <Pause />}
              {paused ? "继续" : "暂停"}
            </Button>
            <fieldset
              aria-label="跟读节奏"
              className="flex min-h-11 w-full rounded-lg border bg-background p-1 sm:w-auto"
            >
              {RHYTHMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={rhythm === item.id}
                  onClick={() => onRhythmChange(item.id)}
                  data-rhythm={item.id}
                  className={`min-h-9 flex-1 rounded-md px-3 text-xs font-semibold transition-colors sm:flex-none ${
                    rhythm === item.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </fieldset>
            {session.canDeferCurrent && (
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={session.deferCurrent}
              >
                稍后再练这个词
              </Button>
            )}
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={onClose}
              data-smoke="guided-repeat-end"
            >
              结束训练
            </Button>
          </div>
          {session.storageWarning && (
            <p className="mt-2 text-center text-xs text-amber-600 dark:text-amber-400">
              {session.storageWarning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function GuidedRepeatExperience({
  languageId,
  phoneme,
  wordPool,
  currentWord,
  disabled,
  disabledReason,
  onBeforeOpen,
  onWordChange,
}: GuidedRepeatExperienceProps) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<GuidedRepeatSessionPlan | null>(null);
  const [rhythm, setRhythm] = useState<GuidedRepeatRhythm>("standard");
  const [buildError, setBuildError] = useState<string | null>(null);
  const historyMarker = useRef(
    `guided-repeat-${Math.random().toString(36).slice(2)}`,
  );
  const previousHistoryState = useRef<unknown>(null);

  const closeNow = useCallback(() => {
    setOpen(false);
    setPlan(null);
    setBuildError(null);
  }, []);

  const requestClose = useCallback(() => {
    if (
      !isTauriEnvironment() &&
      history.state?.speakrightGuidedRepeat === historyMarker.current
    ) {
      history.back();
      return;
    }
    closeNow();
  }, [closeNow]);

  useEffect(() => {
    if (!open || isTauriEnvironment()) return;
    const onPopState = () => closeNow();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeNow, open]);

  useEffect(
    () => () => {
      if (
        typeof window !== "undefined" &&
        history.state?.speakrightGuidedRepeat === historyMarker.current
      ) {
        history.replaceState(previousHistoryState.current, "");
      }
    },
    [],
  );

  const changeRhythm = useCallback((next: GuidedRepeatRhythm) => {
    setRhythm(next);
    try {
      localStorage.setItem(
        PREFERENCE_KEY,
        JSON.stringify({ version: 1, rhythm: next }),
      );
    } catch {
      // Preference persistence is optional and never blocks training.
    }
  }, []);

  const prepare = useCallback(async () => {
    onBeforeOpen();
    const nextRhythm = readRhythm();
    setRhythm(nextRhythm);
    setBuildError(null);
    setPlan(null);
    setOpen(true);
    if (!open && !isTauriEnvironment()) {
      previousHistoryState.current = history.state;
      history.pushState(
        {
          ...(history.state ?? {}),
          speakrightGuidedRepeat: historyMarker.current,
        },
        "",
      );
    }
    if (Howler.ctx?.state === "suspended") void Howler.ctx.resume();
    try {
      setPlan(
        await buildLocalGuidedRepeatPlan({
          languageId,
          phoneme,
          wordPool,
          currentWord,
          rhythm: nextRhythm,
        }),
      );
    } catch (cause) {
      setBuildError(
        cause instanceof Error ? cause.message : "强化跟读音频准备失败。",
      );
    }
  }, [currentWord, languageId, onBeforeOpen, open, phoneme, wordPool]);

  if (!isGuidedRepeatEligible(phoneme) || wordPool.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit gap-2 border-primary/25 bg-primary/5 px-3 text-primary shadow-sm hover:bg-primary/10"
        disabled={disabled || open}
        title={disabled ? disabledReason : "从当前单词开始连续强化跟读"}
        onClick={() => void prepare()}
        data-smoke="guided-repeat-trigger"
      >
        <Headphones /> 强化跟读
      </Button>

      <Dialog
        open={open}
        modal
        disablePointerDismissal
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          initialFocus={false}
          data-guided-repeat-dialog
          data-smoke="guided-repeat-dialog"
          className="!top-2 !right-2 !bottom-2 !left-2 !flex !h-[calc(100dvh-16px)] !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:!inset-auto sm:!top-1/2 sm:!left-1/2 sm:!h-[min(620px,calc(100vh-48px))] sm:!max-h-[min(680px,calc(100vh-48px))] sm:!w-[min(780px,calc(100vw-48px))] sm:!-translate-x-1/2 sm:!-translate-y-1/2"
        >
          <div className="flex min-h-14 items-center gap-3 border-b px-4 py-3 sm:px-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate font-heading text-base font-semibold">
                强化跟读{" "}
                <span className="ml-1 font-mono text-primary">
                  {phoneme.ipa}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1 truncate text-xs">
                音标锚点与男女声交替示范 · 不录音、不评分
              </DialogDescription>
            </div>
            {plan && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {plan.totalWords} 个词
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="关闭强化跟读"
              onClick={requestClose}
              className="min-h-11 min-w-11"
            >
              <X />
            </Button>
          </div>

          {plan ? (
            <GuidedRepeatSession
              plan={plan}
              rhythm={rhythm}
              phoneme={phoneme}
              onRhythmChange={changeRhythm}
              onWordChange={onWordChange}
              onClose={requestClose}
            />
          ) : buildError ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <p className="font-medium text-destructive" role="alert">
                {buildError}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                核心模式不会改用在线发音。请重试本地音频或退出。
              </p>
              <div className="mt-5 flex gap-3">
                <Button className="min-h-11" onClick={() => void prepare()}>
                  重试音频
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={requestClose}
                >
                  退出
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="font-medium">正在准备本地音频…</p>
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={requestClose}
              >
                退出
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
