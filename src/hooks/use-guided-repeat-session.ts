"use client";

import {
  buildGuidedRepeatSteps,
  type GuidedRepeatRhythm,
  type GuidedRepeatSessionPlan,
  type GuidedRepeatStatus,
  type GuidedRepeatStep,
  getGuidedRepeatGapMs,
} from "@speakright/core/training/guided-repeat";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GuidedRepeatAudioAdapter,
  HowlerGuidedRepeatAudioAdapter,
} from "@/lib/guided-repeat-audio";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import { markTrainingMaterialExposed } from "@/lib/training-exposure";

interface UseGuidedRepeatSessionOptions {
  plan: GuidedRepeatSessionPlan;
  rhythm: GuidedRepeatRhythm;
  onWordChange?: (word: GuidedRepeatSessionPlan["queue"][number]) => void;
  audioAdapter?: GuidedRepeatAudioAdapter;
}

interface GapClock {
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  remainingMs: number;
  token: number;
  nextStepIndex: number;
}
function persistGuidedRepeatExposure(
  plan: GuidedRepeatSessionPlan,
  item: GuidedRepeatSessionPlan["queue"][number],
): boolean {
  return markTrainingMaterialExposed({
    id: item.materialId,
    packId: `guided-repeat:${plan.languageId}:${plan.soundUnitSlug}`,
    role: "practice",
    contentKey: item.word,
    source: "guided-repeat",
  });
}

export interface GuidedRepeatSessionState {
  status: GuidedRepeatStatus;
  step: GuidedRepeatStep | null;
  currentWordIndex: number;
  completedWords: number;
  currentItem: GuidedRepeatSessionPlan["queue"][number];
  error: string | null;
  storageWarning: string | null;
  canDeferCurrent: boolean;
  pause: (automatic?: boolean) => void;
  resume: () => void;
  retry: () => void;
  deferCurrent: () => void;
  restart: () => void;
  stop: () => void;
}

export function useGuidedRepeatSession({
  plan,
  rhythm,
  onWordChange,
  audioAdapter,
}: UseGuidedRepeatSessionOptions): GuidedRepeatSessionState {
  const adapterRef = useRef<GuidedRepeatAudioAdapter>(
    audioAdapter ?? new HowlerGuidedRepeatAudioAdapter(),
  );
  const workingPlanRef = useRef(plan);
  const stepsRef = useRef(buildGuidedRepeatSteps(plan));
  const tokenRef = useRef(0);
  const stepIndexRef = useRef(0);
  const rhythmRef = useRef(rhythm);
  const onWordChangeRef = useRef(onWordChange);
  const lastAudioDurationRef = useRef(0);
  const gapRef = useRef<GapClock | null>(null);
  const stoppedRef = useRef(false);
  const exposedRef = useRef(new Set<string>());
  const pausedRef = useRef(false);
  const pendingStepIndexRef = useRef<number | null>(null);
  const statusRef = useRef<GuidedRepeatStatus>("preloading");
  const completedRef = useRef(new Set<string>());
  const requeuedRef = useRef(new Set<string>());
  const pendingExposureRef = useRef(
    new Map<string, GuidedRepeatSessionPlan["queue"][number]>(),
  );
  const [status, setStatus] = useState<GuidedRepeatStatus>("preloading");
  const [step, setStep] = useState<GuidedRepeatStep | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [completedWords, setCompletedWords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  rhythmRef.current = rhythm;
  onWordChangeRef.current = onWordChange;
  statusRef.current = status;

  const clearGap = useCallback(() => {
    const gap = gapRef.current;
    if (!gap) return;
    if (gap.timer) clearTimeout(gap.timer);
    gapRef.current = null;
  }, []);

  const runStepRef = useRef<(index: number, token: number) => void>(() => {});

  const scheduleGap = useCallback((clock: GapClock) => {
    clock.startedAt = performance.now();
    clock.timer = setTimeout(() => {
      if (tokenRef.current !== clock.token || stoppedRef.current) return;
      gapRef.current = null;
      runStepRef.current(clock.nextStepIndex, clock.token);
    }, clock.remainingMs);
    gapRef.current = clock;
  }, []);

  const markCompleted = useCallback((wordIndex: number) => {
    const item = workingPlanRef.current.queue[wordIndex];
    if (!item) return;
    completedRef.current.add(item.materialId);
    setCompletedWords(completedRef.current.size);
  }, []);

  const exposeWord = useCallback((wordIndex: number) => {
    const item = workingPlanRef.current.queue[wordIndex];
    if (!item || exposedRef.current.has(item.materialId)) return;
    exposedRef.current.add(item.materialId);
    const saved = persistGuidedRepeatExposure(workingPlanRef.current, item);
    if (saved) pendingExposureRef.current.delete(item.materialId);
    else pendingExposureRef.current.set(item.materialId, item);
    if (!saved) setStorageWarning("本轮材料记录未能保存，但不影响继续跟读。");
  }, []);

  const flushPendingExposures = useCallback(() => {
    for (const [materialId, item] of pendingExposureRef.current) {
      if (persistGuidedRepeatExposure(workingPlanRef.current, item)) {
        pendingExposureRef.current.delete(materialId);
      }
    }
    if (pendingExposureRef.current.size === 0) setStorageWarning(null);
  }, []);
  const preloadFollowingWord = useCallback((wordIndex: number) => {
    const next = workingPlanRef.current.queue[wordIndex + 1];
    if (!next) return;
    void Promise.all([
      adapterRef.current.preload(next.masculineAudioSrc),
      adapterRef.current.preload(next.feminineAudioSrc),
    ]).catch(() => {
      // Do not interrupt the current word. The next word reports its own error.
    });
  }, []);

  const runStep = useCallback(
    async (index: number, token: number) => {
      if (tokenRef.current !== token || stoppedRef.current) return;
      if (pausedRef.current) {
        pendingStepIndexRef.current = index;
        return;
      }
      const steps = stepsRef.current;
      if (index >= steps.length) {
        markCompleted(Math.max(0, workingPlanRef.current.queue.length - 1));
        setStep(null);
        setStatus("completed");
        flushPendingExposures();
        return;
      }
      const nextStep = steps[index];
      stepIndexRef.current = index;
      setStep(nextStep);
      setCurrentWordIndex(
        nextStep.kind === "transition"
          ? nextStep.toWordIndex
          : nextStep.wordIndex,
      );
      setError(null);
      setStatus("playing");

      if (nextStep.kind === "transition") {
        markCompleted(nextStep.fromWordIndex);
        const previousItem =
          workingPlanRef.current.queue[nextStep.fromWordIndex];
        if (previousItem) {
          adapterRef.current.unload(previousItem.masculineAudioSrc);
          adapterRef.current.unload(previousItem.feminineAudioSrc);
        }
        const item = workingPlanRef.current.queue[nextStep.toWordIndex];
        if (item) onWordChangeRef.current?.(item);
        queueMicrotask(() => runStepRef.current(index + 1, token));
        return;
      }

      if (nextStep.kind === "gap") {
        const remainingMs = getGuidedRepeatGapMs(
          lastAudioDurationRef.current,
          rhythmRef.current,
          nextStep.gapKind,
        );
        scheduleGap({
          timer: null,
          startedAt: performance.now(),
          remainingMs,
          token,
          nextStepIndex: index + 1,
        });
        return;
      }

      try {
        const metadata = await adapterRef.current.preload(nextStep.src);
        if (tokenRef.current !== token || stoppedRef.current) return;
        lastAudioDurationRef.current = metadata.durationMs;
        if (pausedRef.current) {
          pendingStepIndexRef.current = index;
          return;
        }
        if (nextStep.role === "word-masculine" && nextStep.turn === 1) {
          exposeWord(nextStep.wordIndex);
          preloadFollowingWord(nextStep.wordIndex);
        }
        await adapterRef.current.play(nextStep.src);
        if (tokenRef.current !== token || stoppedRef.current) return;
        if (pausedRef.current) {
          pendingStepIndexRef.current = index + 1;
          return;
        }
        runStepRef.current(index + 1, token);
      } catch (cause) {
        if (tokenRef.current !== token || stoppedRef.current) return;
        setError(cause instanceof Error ? cause.message : "本地音频无法播放。");
        setStatus("recoverable-error");
      }
    },
    [
      exposeWord,
      flushPendingExposures,
      markCompleted,
      preloadFollowingWord,
      scheduleGap,
    ],
  );
  runStepRef.current = (index, token) => void runStep(index, token);

  const start = useCallback(
    async (nextPlan: GuidedRepeatSessionPlan) => {
      const token = tokenRef.current + 1;
      tokenRef.current = token;
      stoppedRef.current = false;
      pausedRef.current = false;
      pendingStepIndexRef.current = null;
      clearGap();
      adapterRef.current.unload();
      workingPlanRef.current = nextPlan;
      stepsRef.current = buildGuidedRepeatSteps(nextPlan);
      stepIndexRef.current = 0;
      lastAudioDurationRef.current = 0;
      exposedRef.current = new Set();
      completedRef.current = new Set();
      requeuedRef.current = new Set();
      setCompletedWords(0);
      setCurrentWordIndex(0);
      setStep(null);
      setError(null);
      if (pendingExposureRef.current.size === 0) setStorageWarning(null);
      setStatus("preloading");
      onWordChangeRef.current?.(nextPlan.queue[0]);
      try {
        const first = nextPlan.queue[0];
        const sources = [
          nextPlan.anchorAudio.single,
          first?.masculineAudioSrc,
          first?.feminineAudioSrc,
        ].filter((src): src is string => Boolean(src));
        await Promise.all(
          sources.map((src) => adapterRef.current.preload(src)),
        );
        if (tokenRef.current !== token || stoppedRef.current) return;
        runStepRef.current(0, token);
      } catch (cause) {
        if (tokenRef.current !== token || stoppedRef.current) return;
        setError(cause instanceof Error ? cause.message : "本地音频准备失败。");
        setStatus("recoverable-error");
      }
    },
    [clearGap],
  );

  const pause = useCallback((automatic = false) => {
    if (statusRef.current !== "playing") return;
    pausedRef.current = true;
    const gap = gapRef.current;
    if (gap) {
      if (gap.timer) clearTimeout(gap.timer);
      gap.remainingMs = Math.max(
        0,
        gap.remainingMs - (performance.now() - gap.startedAt),
      );
      gap.timer = null;
    } else {
      adapterRef.current.pause();
    }
    const nextStatus = automatic ? "auto-paused" : "paused";
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    statusRef.current = "playing";
    setStatus("playing");
    const gap = gapRef.current;
    if (gap) scheduleGap(gap);
    else if (pendingStepIndexRef.current !== null) {
      const pendingIndex = pendingStepIndexRef.current;
      pendingStepIndexRef.current = null;
      runStepRef.current(pendingIndex, tokenRef.current);
    } else {
      void adapterRef.current.resume();
    }
  }, [scheduleGap]);

  const retry = useCallback(() => {
    pausedRef.current = false;
    pendingStepIndexRef.current = null;
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    clearGap();
    adapterRef.current.stop();
    setError(null);
    runStepRef.current(stepIndexRef.current, token);
  }, [clearGap]);

  const deferCurrent = useCallback(() => {
    const oldPlan = workingPlanRef.current;
    const index = currentWordIndex;
    const item = oldPlan.queue[index];
    if (
      !item ||
      index >= oldPlan.queue.length - 1 ||
      requeuedRef.current.has(item.materialId)
    ) {
      setError("这个词已经移到本轮末尾，请重试音频或结束训练。");
      setStatus("recoverable-error");
      return;
    }
    requeuedRef.current.add(item.materialId);
    const queue = [...oldPlan.queue];
    queue.splice(index, 1);
    queue.push(item);
    const nextPlan = { ...oldPlan, queue, totalWords: queue.length };
    pausedRef.current = false;
    pendingStepIndexRef.current = null;
    workingPlanRef.current = nextPlan;
    stepsRef.current = buildGuidedRepeatSteps(nextPlan);
    const nextIndex = stepsRef.current.findIndex(
      (candidate) =>
        candidate.kind === "audio" && candidate.wordIndex === index,
    );
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    clearGap();
    adapterRef.current.stop();
    const nextItem = queue[index];
    if (nextItem) onWordChangeRef.current?.(nextItem);
    runStepRef.current(Math.max(0, nextIndex), token);
  }, [clearGap, currentWordIndex]);

  const restart = useCallback(() => {
    void start(workingPlanRef.current);
  }, [start]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    pendingStepIndexRef.current = null;
    tokenRef.current += 1;
    clearGap();
    flushPendingExposures();
    adapterRef.current.unload();
    setStatus("idle");
  }, [clearGap, flushPendingExposures]);

  useEffect(() => {
    void start(plan);
    return stop;
  }, [plan, start, stop]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pause(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pause]);

  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      if (disposed) return;
      unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
        if (!payload) pause(true);
      });
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [pause]);

  const currentItem =
    workingPlanRef.current.queue[currentWordIndex] ??
    workingPlanRef.current.queue[0];
  const canDeferCurrent =
    Boolean(currentItem) &&
    currentWordIndex < workingPlanRef.current.queue.length - 1 &&
    !requeuedRef.current.has(currentItem.materialId);

  return {
    status,
    step,
    currentWordIndex,
    completedWords,
    currentItem,
    error,
    storageWarning,
    canDeferCurrent,
    pause,
    resume,
    retry,
    deferCurrent,
    restart,
    stop,
  };
}
