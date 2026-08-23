"use client";

import {
  type GuidedRepeatMode,
  type GuidedRepeatRhythm,
  type GuidedRepeatSessionPlan,
  type GuidedRepeatStep,
  getGuidedRepeatModePolicy,
} from "@speakright/core/training/guided-repeat";
import { Howler } from "howler";
import {
  ArrowRight,
  Check,
  Headphones,
  Loader2,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
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

interface GuidedRepeatModeOption {
  id: GuidedRepeatMode;
  label: string;
  purpose: string;
  anchorSummary: string;
  recommended?: boolean;
}

const MODES: readonly [
  GuidedRepeatModeOption,
  GuidedRepeatModeOption,
  GuidedRepeatModeOption,
] = [
  {
    id: "quick",
    label: "快速复习",
    purpose: "已经学过，快速唤醒目标音",
    anchorSummary: "开场校准音标 1 遍",
  },
  {
    id: "standard",
    label: "标准训练",
    purpose: "兼顾重复与不同单词间的迁移",
    anchorSummary: "开场 2 遍，每练 5 个词再校准 1 遍",
    recommended: true,
  },
  {
    id: "intensive",
    label: "深度强化",
    purpose: "集中稳定还不熟练的口腔动作",
    anchorSummary: "每个词前校准音标 1 遍",
  },
];
const ROUND_BEATS = ["beat-1", "beat-2", "beat-3", "beat-4"] as const;

interface StoredGuidedRepeatPreferences {
  version?: number;
  rhythm?: GuidedRepeatRhythm;
  modes?: Partial<Record<LanguageId, GuidedRepeatMode>>;
}

function isGuidedRepeatRhythm(value: unknown): value is GuidedRepeatRhythm {
  return RHYTHMS.some((item) => item.id === value);
}

function isGuidedRepeatMode(value: unknown): value is GuidedRepeatMode {
  return MODES.some((item) => item.id === value);
}

function readStoredPreferences(): StoredGuidedRepeatPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(
      localStorage.getItem(PREFERENCE_KEY) ?? "null",
    ) as StoredGuidedRepeatPreferences | null;
  } catch {
    return null;
  }
}

function readPreferences(languageId: LanguageId): {
  rhythm: GuidedRepeatRhythm;
  mode: GuidedRepeatMode;
} {
  const stored = readStoredPreferences();
  return {
    rhythm: isGuidedRepeatRhythm(stored?.rhythm) ? stored.rhythm : "standard",
    mode:
      stored?.version === 2 && isGuidedRepeatMode(stored.modes?.[languageId])
        ? stored.modes[languageId]
        : "standard",
  };
}

function writePreferences(
  languageId: LanguageId,
  patch: { rhythm?: GuidedRepeatRhythm; mode?: GuidedRepeatMode },
): void {
  try {
    const stored = readStoredPreferences();
    const current = readPreferences(languageId);
    const modes =
      stored?.version === 2 && stored.modes ? { ...stored.modes } : {};
    modes[languageId] = patch.mode ?? current.mode;
    localStorage.setItem(
      PREFERENCE_KEY,
      JSON.stringify({
        version: 2,
        rhythm: patch.rhythm ?? current.rhythm,
        modes,
      }),
    );
  } catch {
    // Preference persistence is optional and never blocks training.
  }
}

function getModeOption(mode: GuidedRepeatMode): GuidedRepeatModeOption {
  return MODES.find((option) => option.id === mode) ?? MODES[1];
}

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

function phaseLabel(step: GuidedRepeatStep | null): string {
  if (!step) return "准备下一步";
  if (step.kind === "transition") return "切换下一个单词";
  if (step.kind === "gap") {
    if (step.gapKind === "anchor-imitation") {
      return "轮到你 · 跟读音标";
    }
    return step.gapKind === "imitation" ? "轮到你 · 跟读" : "保持节奏";
  }
  const turnLabel = step.turnTotal > 1 ? ` ${step.turn}/${step.turnTotal}` : "";
  if (step.role === "anchor-single") return `听音标${turnLabel}`;
  if (step.role === "word-masculine") return `听单词 · 男声${turnLabel}`;
  return `听单词 · 女声${turnLabel}`;
}

function phaseId(step: GuidedRepeatStep | null): string {
  if (!step) return "preparing";
  if (step.kind === "transition") return "transition";
  if (step.kind === "gap") return `gap-${step.gapKind}`;
  return `${step.role}${step.turn ? `-${step.turn}` : ""}`;
}

function isAnchorVisualStep(step: GuidedRepeatStep | null): boolean {
  if (!step) return true;
  return (
    (step.kind === "audio" && step.role === "anchor-single") ||
    (step.kind === "gap" && step.gapKind === "anchor-imitation") ||
    step.kind === "transition"
  );
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

function GuidedRepeatSetup({
  mode,
  totalWords,
  onModeChange,
  onStart,
}: {
  mode: GuidedRepeatMode;
  totalWords: number;
  onModeChange: (mode: GuidedRepeatMode) => void;
  onStart: () => void;
}) {
  const selectedRadioRef = useRef<HTMLInputElement | null>(null);
  const selectedOption = getModeOption(mode);
  const selectedPolicy = getGuidedRepeatModePolicy(mode);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      selectedRadioRef.current?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="flex min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 [@media(max-height:480px)]:!py-3"
      data-smoke="guided-repeat-setup"
    >
      <div className="m-auto w-full max-w-2xl">
        <div className="text-center">
          <span className="inline-flex rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary [@media(max-height:480px)]:hidden">
            开始前 · 选择训练强度
          </span>
          <h3 className="mt-3 font-heading text-xl font-semibold sm:text-2xl [@media(max-height:480px)]:mt-0 [@media(max-height:480px)]:text-lg">
            这轮想练到什么程度？
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground [@media(max-height:480px)]:hidden">
            三种模式都会练习本音标的全部单词，只改变每个词的重复轮数和音标校准频率。
          </p>
        </div>

        <fieldset className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3 [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:gap-2">
          <legend className="sr-only">选择强化跟读模式</legend>
          {MODES.map((option) => {
            const policy = getGuidedRepeatModePolicy(option.id);
            const selected = option.id === mode;
            return (
              <label
                key={option.id}
                className="relative block cursor-pointer"
                data-mode={option.id}
                data-smoke={`guided-repeat-mode-${option.id}`}
              >
                <input
                  type="radio"
                  name="guided-repeat-mode"
                  value={option.id}
                  checked={selected}
                  ref={selected ? selectedRadioRef : undefined}
                  className="peer sr-only"
                  onChange={() => onModeChange(option.id)}
                />
                <span
                  className={`relative block min-h-11 rounded-xl border p-3 text-left transition-all peer-focus-visible:outline-none peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 sm:min-h-[9.5rem] [@media(max-height:480px)]:!min-h-[5.5rem] [@media(max-height:480px)]:!p-2.5 ${
                    selected
                      ? "border-primary bg-primary/8 shadow-sm ring-1 ring-primary/15"
                      : "border-border bg-background hover:border-primary/30 hover:bg-primary/[0.03]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-heading text-sm font-semibold">
                          {option.label}
                        </span>
                        {option.recommended && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                            推荐
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground [@media(max-height:480px)]:hidden">
                        {option.purpose}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </span>

                  <span className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold [@media(max-height:480px)]:mt-2">
                    <span className="rounded-md bg-muted px-2 py-1">
                      每词 {policy.wordRounds} 轮
                    </span>
                  </span>
                  <span className="mt-3 flex items-center gap-3 [@media(max-height:480px)]:hidden">
                    <span aria-hidden="true" className="flex gap-1">
                      {ROUND_BEATS.slice(0, policy.wordRounds).map((beat) => (
                        <span
                          key={`${option.id}-${beat}`}
                          className={`h-1.5 w-5 rounded-full ${
                            selected ? "bg-primary" : "bg-primary/25"
                          }`}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs leading-4 text-muted-foreground [@media(max-height:480px)]:hidden">
                    {option.id === "standard" && totalWords < 6
                      ? "开场校准音标 2 遍"
                      : option.anchorSummary}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:justify-end [@media(max-height:480px)]:border-0 [@media(max-height:480px)]:bg-transparent [@media(max-height:480px)]:p-0">
          <div className="[@media(max-height:480px)]:hidden">
            <p className="text-xs font-semibold text-primary [@media(max-height:480px)]:hidden">
              本轮安排
            </p>
            <p className="mt-1 text-sm font-medium [@media(max-height:480px)]:mt-0">
              全部 {totalWords} 个词 · 每词 {selectedPolicy.wordRounds} 轮 ·
              可随时结束
            </p>
          </div>
          <Button
            type="button"
            className="min-h-12 w-full shrink-0 px-5 sm:w-auto [@media(max-height:480px)]:min-h-10 [@media(max-height:480px)]:w-auto"
            onClick={onStart}
            data-smoke="guided-repeat-start"
          >
            开始{selectedOption.label} <ArrowRight />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground [@media(max-height:480px)]:hidden">
          会记住你在当前语言中的选择，下次仍可调整。
        </p>
      </div>
    </div>
  );
}

function GuidedRepeatSession({
  plan,
  rhythm,
  phoneme,
  exitRequested,
  onRhythmChange,
  onWordChange,
  onRequestExit,
  onContinueTraining,
  onSaveAndExit,
}: {
  plan: GuidedRepeatSessionPlan;
  rhythm: GuidedRepeatRhythm;
  phoneme: PhonemeData;
  exitRequested: boolean;
  onRhythmChange: (rhythm: GuidedRepeatRhythm) => void;
  onWordChange: (word: KeywordEntry) => void;
  onRequestExit: () => void;
  onContinueTraining: () => void;
  onSaveAndExit: () => void;
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
  const showingPhoneme = isAnchorVisualStep(session.step);
  const audioStep = session.step?.kind === "audio" ? session.step : null;
  const isSpeaking = session.isAudioPlaying && audioStep !== null;
  const visualKind = showingPhoneme ? "ipa" : "word";
  const transitioning =
    session.step?.kind === "transition" ||
    (session.step?.kind === "gap" && session.step.gapKind === "transition");
  const actionStage = transitioning
    ? "transition"
    : session.canOperateOnWord
      ? "word"
      : "anchor";
  const currentActionsDisabled =
    session.status === "preloading" || transitioning;
  const isLastWord = session.currentWordIndex >= plan.totalWords - 1;
  const remainingWords = Math.max(0, plan.totalWords - session.completedWords);

  useEffect(() => {
    if (exitRequested && session.status === "playing") session.pause();
  }, [exitRequested, session.pause, session.status]);

  useEffect(() => {
    if (session.status === "preloading" && !exitRequested) return;
    const frame = requestAnimationFrame(() =>
      primaryButtonRef.current?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [exitRequested, session.status]);

  if (session.status === "completed" && !exitRequested) {
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
          本轮已完成 {plan.totalWords}{" "}
          个词。本功能只记录练习暴露，不代表系统已经判定掌握。
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
          <Button
            variant="outline"
            className="min-h-11 px-5"
            onClick={onSaveAndExit}
          >
            返回音标练习
          </Button>
        </div>
      </div>
    );
  }

  if (exitRequested) {
    return (
      <div
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-8 text-center"
        data-smoke="guided-repeat-exit-summary"
        data-completed-words={session.completedWords}
        data-remaining-words={remainingWords}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Pause className="h-7 w-7" />
        </div>
        <h3 className="mt-5 font-heading text-2xl font-semibold">
          要结束本轮跟读吗？
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          已完成跟读 {session.completedWords} / {plan.totalWords} 个词，剩余{" "}
          {remainingWords} 个词。
        </p>
        <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
          已完成的跟读记录会保存；它只代表练习经历，不代表已经掌握或评分达标。
        </p>
        {session.storageWarning && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            {session.storageWarning}
          </p>
        )}
        <div className="mt-7 flex w-full max-w-sm flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            className="min-h-11 px-5"
            onClick={onSaveAndExit}
            data-smoke="guided-repeat-save-exit"
          >
            保存并退出
          </Button>
          <Button
            ref={primaryButtonRef}
            className="min-h-11 px-5"
            onClick={() => {
              onContinueTraining();
              if (
                session.status === "paused" ||
                session.status === "auto-paused"
              ) {
                session.resume();
              }
            }}
            data-smoke="guided-repeat-continue"
          >
            <Play /> 继续训练
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-8 [@media(max-height:480px)]:!py-2">
        <div aria-atomic="true" aria-live="polite" className="sr-only">
          {showingPhoneme
            ? `\u97f3\u6807 ${phoneme.ipa}`
            : `\u5355\u8bcd ${session.currentItem.word}`}
        </div>
        <div
          aria-live="polite"
          className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary"
          data-smoke="guided-repeat-phase"
          data-phase={currentPhaseId}
        >
          {phase}
        </div>
        <div
          className="mt-5 flex min-h-[12rem] w-full items-center justify-center overflow-hidden sm:min-h-[15rem] [@media(max-height:480px)]:!mt-2 [@media(max-height:480px)]:!min-h-28"
          data-smoke="guided-repeat-hero"
          data-content-kind={visualKind}
          data-speaking={isSpeaking ? "true" : "false"}
          data-audio-role={audioStep?.role ?? "none"}
          data-audio-turn={audioStep?.turn ?? ""}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${session.currentItem.materialId}:${visualKind}`}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -18 }}
              transition={{
                duration: reducedMotion ? 0.12 : 0.24,
                ease: "easeOut",
              }}
              className="min-w-0 text-center"
            >
              <motion.div
                initial={{
                  color: "var(--foreground)",
                  opacity: 0.78,
                  scale: reducedMotion ? 1 : 0.97,
                  y: reducedMotion ? 0 : 3,
                }}
                animate={{
                  color: isSpeaking ? "var(--primary)" : "var(--foreground)",
                  opacity: isSpeaking || session.step?.kind !== "gap" ? 1 : 0.9,
                  scale: isSpeaking && !reducedMotion ? 1.04 : 1,
                  y: isSpeaking && !reducedMotion ? -2 : 0,
                }}
                transition={{
                  duration: reducedMotion ? 0.12 : 0.22,
                  ease: "easeOut",
                }}
                className={
                  showingPhoneme
                    ? "break-words font-mono font-semibold leading-none tracking-tight [font-size:clamp(3.25rem,11vw,6.5rem)] [overflow-wrap:anywhere]"
                    : "break-words font-heading font-bold leading-none tracking-tight [font-size:clamp(2.5rem,8vw,5rem)] [overflow-wrap:anywhere]"
                }
                data-smoke={
                  showingPhoneme
                    ? "guided-repeat-phoneme"
                    : "guided-repeat-word"
                }
                data-speaking={isSpeaking ? "true" : "false"}
              >
                {showingPhoneme ? phoneme.ipa : session.currentItem.word}
              </motion.div>

              <AnimatePresence mode="wait" initial={false}>
                {showingPhoneme ? (
                  <motion.div
                    key="phoneme-context"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto mt-5 h-1.5 w-12 overflow-hidden rounded-full bg-muted"
                  >
                    <motion.div
                      className="h-full origin-center rounded-full bg-primary"
                      animate={{
                        opacity: isSpeaking ? 1 : 0.3,
                        scaleX: isSpeaking && !reducedMotion ? 1 : 0.45,
                      }}
                      transition={{ duration: reducedMotion ? 0.12 : 0.22 }}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="word-context"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="mt-4 break-words font-mono text-muted-foreground [font-size:clamp(1rem,2vw,1.5rem)] [overflow-wrap:anywhere]">
                      <HighlightedIpa
                        ipa={session.currentItem.ipa}
                        target={phoneme.ipa}
                      />
                    </div>
                    <div className="mt-5 font-mono text-sm font-semibold text-muted-foreground">
                      {phoneme.ipa}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={onRequestExit}
              >
                结束训练
              </Button>
            </div>
          </div>
        )}
      </div>

      {session.status !== "recoverable-error" && (
        <div className="shrink-0 border-t bg-muted/30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:py-4 [@media(max-height:480px)]:!pt-2 [@media(max-height:480px)]:!pb-2">
          <div
            className="mx-auto max-w-2xl space-y-3 [@media(max-height:480px)]:space-y-2"
            data-smoke="guided-repeat-controls"
          >
            <fieldset
              className={`grid min-w-0 gap-2 ${
                actionStage === "word"
                  ? "grid-cols-2 sm:grid-cols-3"
                  : "grid-cols-1"
              }`}
              data-smoke="guided-repeat-actions"
              data-action-stage={actionStage}
            >
              <legend className="sr-only">
                {actionStage === "word"
                  ? "当前词操作"
                  : actionStage === "anchor"
                    ? "当前音标操作"
                    : "切换下一个词"}
              </legend>
              {actionStage === "transition" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mx-auto min-h-12 w-full max-w-sm gap-2 bg-background px-3 shadow-xs"
                  disabled
                  data-smoke="guided-repeat-transitioning"
                >
                  <Loader2 className="animate-spin" /> 准备下一个词
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className={`min-h-12 w-full gap-2 bg-background px-3 shadow-xs hover:border-primary/35 hover:bg-primary/5 ${
                    actionStage === "word" ? "" : "mx-auto max-w-sm"
                  }`}
                  disabled={currentActionsDisabled}
                  onClick={session.replayCurrent}
                  title={
                    actionStage === "word"
                      ? "重播当前单词示范"
                      : "重播当前音标示范"
                  }
                  data-smoke="guided-repeat-replay"
                >
                  <Volume2 />
                  {actionStage === "word" ? "再听单词" : "重听音标"}
                </Button>
              )}
              {actionStage === "word" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 w-full gap-2 border-primary/20 bg-primary/5 px-3 shadow-xs hover:border-primary/40 hover:bg-primary/10"
                    disabled={currentActionsDisabled}
                    onClick={session.repeatCurrent}
                    title="从当前词的第一步开始重新跟读"
                    data-smoke="guided-repeat-repeat-word"
                  >
                    <Repeat2 /> 本词再练一轮
                  </Button>
                  <Button
                    type="button"
                    className="col-span-2 min-h-12 w-full gap-2 px-3 shadow-sm sm:col-span-1"
                    disabled={currentActionsDisabled}
                    onClick={session.advanceCurrent}
                    title={
                      isLastWord
                        ? "完成当前词的跟读并结束本轮"
                        : "完成当前词的跟读并进入下一个词"
                    }
                    data-smoke="guided-repeat-next-word"
                  >
                    {isLastWord ? "完成本轮跟读" : "完成本词，下一个"}{" "}
                    <ArrowRight />
                  </Button>
                </>
              )}
            </fieldset>

            <div
              className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between [@media(max-height:480px)]:pt-2"
              data-smoke="guided-repeat-utilities"
            >
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
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                <Button
                  ref={primaryButtonRef}
                  variant="outline"
                  className="min-h-11 w-full gap-2 px-4 sm:w-auto"
                  disabled={session.status === "preloading"}
                  onClick={() => (paused ? session.resume() : session.pause())}
                  data-smoke="guided-repeat-pause"
                >
                  {paused ? <Play /> : <Pause />}
                  {paused ? "继续" : "暂停"}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={onRequestExit}
                  data-smoke="guided-repeat-end"
                >
                  结束训练
                </Button>
              </div>
            </div>
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
  const [mode, setMode] = useState<GuidedRepeatMode>("standard");
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [exitRequested, setExitRequested] = useState(false);
  const buildTokenRef = useRef(0);
  const historyMarker = useRef(
    `guided-repeat-${Math.random().toString(36).slice(2)}`,
  );
  const previousHistoryState = useRef<unknown>(null);

  const closeNow = useCallback(() => {
    buildTokenRef.current += 1;
    setOpen(false);
    setPlan(null);
    setIsBuilding(false);
    setBuildError(null);
    setExitRequested(false);
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

  const requestSessionExit = useCallback(() => {
    if (plan) {
      setExitRequested(true);
      return;
    }
    requestClose();
  }, [plan, requestClose]);

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

  const changeRhythm = useCallback(
    (next: GuidedRepeatRhythm) => {
      setRhythm(next);
      writePreferences(languageId, { rhythm: next });
    },
    [languageId],
  );

  const changeMode = useCallback(
    (next: GuidedRepeatMode) => {
      setMode(next);
      writePreferences(languageId, { mode: next });
    },
    [languageId],
  );

  const openSetup = useCallback(() => {
    onBeforeOpen();
    const preferences = readPreferences(languageId);
    buildTokenRef.current += 1;
    setRhythm(preferences.rhythm);
    setMode(preferences.mode);
    setBuildError(null);
    setPlan(null);
    setIsBuilding(false);
    setExitRequested(false);
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
  }, [languageId, onBeforeOpen, open]);

  const startTraining = useCallback(async () => {
    const token = buildTokenRef.current + 1;
    buildTokenRef.current = token;
    setBuildError(null);
    setPlan(null);
    setIsBuilding(true);
    setExitRequested(false);
    if (Howler.ctx?.state === "suspended") void Howler.ctx.resume();
    try {
      const nextPlan = await buildLocalGuidedRepeatPlan({
        languageId,
        phoneme,
        wordPool,
        currentWord,
        rhythm,
        mode,
      });
      if (buildTokenRef.current !== token) return;
      setPlan(nextPlan);
    } catch (cause) {
      if (buildTokenRef.current !== token) return;
      setBuildError(
        cause instanceof Error ? cause.message : "强化跟读音频准备失败。",
      );
    } finally {
      if (buildTokenRef.current === token) setIsBuilding(false);
    }
  }, [currentWord, languageId, mode, phoneme, rhythm, wordPool]);

  const backToSetup = useCallback(() => {
    buildTokenRef.current += 1;
    setPlan(null);
    setBuildError(null);
    setIsBuilding(false);
    setExitRequested(false);
  }, []);

  if (!isGuidedRepeatEligible(phoneme) || wordPool.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit gap-2 border-primary/25 bg-primary/5 px-3 text-primary shadow-sm hover:bg-primary/10"
        disabled={disabled || open}
        title={disabled ? disabledReason : "选择训练模式并从当前单词开始跟读"}
        onClick={openSetup}
        data-smoke="guided-repeat-trigger"
      >
        <Headphones /> 强化跟读
      </Button>

      <Dialog
        open={open}
        modal
        disablePointerDismissal
        onOpenChange={(nextOpen) => {
          if (!nextOpen) requestSessionExit();
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
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {getModeOption(plan.mode).label} · {plan.totalWords} 个词
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="关闭强化跟读"
              onClick={requestSessionExit}
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
              exitRequested={exitRequested}
              onRhythmChange={changeRhythm}
              onWordChange={onWordChange}
              onRequestExit={() => setExitRequested(true)}
              onContinueTraining={() => setExitRequested(false)}
              onSaveAndExit={requestClose}
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
                <Button
                  className="min-h-11"
                  onClick={() => void startTraining()}
                >
                  重试音频
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={backToSetup}
                >
                  返回模式选择
                </Button>
              </div>
            </div>
          ) : isBuilding ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="font-medium">
                正在准备{getModeOption(mode).label}…
              </p>
              <Button
                variant="ghost"
                className="min-h-11"
                onClick={requestClose}
              >
                退出
              </Button>
            </div>
          ) : (
            <GuidedRepeatSetup
              mode={mode}
              totalWords={wordPool.length}
              onModeChange={changeMode}
              onStart={() => void startTraining()}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
