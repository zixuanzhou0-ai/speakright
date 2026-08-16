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

function isCurrentWordStep(step: GuidedRepeatStep | null | undefined): boolean {
  if (!step || step.kind === "transition") return false;
  if (step.kind === "audio") return step.role !== "anchor-single";
  return step.gapKind === "imitation";
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
  canOperateOnWord: boolean;
  isAudioPlaying: boolean;
  pause: (automatic?: boolean) => void;
  resume: () => void;
  retry: () => void;
  replayCurrent: () => void;
  repeatCurrent: () => void;
  advanceCurrent: () => void;
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
  const audioPlayingRef = useRef(false);
  const pausedAudioRef = useRef(false);
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
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  rhythmRef.current = rhythm;
  onWordChangeRef.current = onWordChange;
  statusRef.current = status;
  const setAudioPlayingState = useCallback((playing: boolean) => {
    if (audioPlayingRef.current === playing) return;
    audioPlayingRef.current = playing;
    setIsAudioPlaying(playing);
  }, []);

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
        pausedAudioRef.current = false;
        setAudioPlayingState(false);
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
        pausedAudioRef.current = false;
        setAudioPlayingState(false);
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
        pausedAudioRef.current = false;
        setAudioPlayingState(false);
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
        if (nextStep.role !== "anchor-single") {
          const item = workingPlanRef.current.queue[nextStep.wordIndex];
          const firstWordAudio =
            Boolean(item) && !exposedRef.current.has(item.materialId);
          exposeWord(nextStep.wordIndex);
          if (firstWordAudio) preloadFollowingWord(nextStep.wordIndex);
        }
        await adapterRef.current.play(nextStep.src, 0, () => {
          if (
            tokenRef.current !== token ||
            stoppedRef.current ||
            pausedRef.current
          ) {
            return;
          }
          setAudioPlayingState(true);
        });
        setAudioPlayingState(false);
        pausedAudioRef.current = false;
        if (tokenRef.current !== token || stoppedRef.current) return;
        if (pausedRef.current) {
          pendingStepIndexRef.current = index + 1;
          return;
        }
        runStepRef.current(index + 1, token);
      } catch (cause) {
        if (tokenRef.current !== token || stoppedRef.current) return;
        pausedAudioRef.current = false;
        setAudioPlayingState(false);
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
      setAudioPlayingState,
    ],
  );
  runStepRef.current = (index, token) => void runStep(index, token);

  const start = useCallback(
    async (nextPlan: GuidedRepeatSessionPlan) => {
      const token = tokenRef.current + 1;
      tokenRef.current = token;
      stoppedRef.current = false;
      pausedRef.current = false;
      pausedAudioRef.current = false;
      setAudioPlayingState(false);
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
        pausedAudioRef.current = false;
        setAudioPlayingState(false);
        setError(cause instanceof Error ? cause.message : "本地音频准备失败。");
        setStatus("recoverable-error");
      }
    },
    [clearGap, setAudioPlayingState],
  );

  const pause = useCallback(
    (automatic = false) => {
      if (statusRef.current !== "playing") return;
      pausedRef.current = true;
      const gap = gapRef.current;
      if (gap) {
        pausedAudioRef.current = false;
        if (gap.timer) clearTimeout(gap.timer);
        gap.remainingMs = Math.max(
          0,
          gap.remainingMs - (performance.now() - gap.startedAt),
        );
        gap.timer = null;
      } else {
        const position = adapterRef.current.pause();
        pausedAudioRef.current = position.src !== null;
      }
      const nextStatus = automatic ? "auto-paused" : "paused";
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setAudioPlayingState(false);
    },
    [setAudioPlayingState],
  );

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    statusRef.current = "playing";
    setStatus("playing");
    const gap = gapRef.current;
    if (gap) {
      pausedAudioRef.current = false;
      scheduleGap(gap);
    } else if (pendingStepIndexRef.current !== null) {
      pausedAudioRef.current = false;
      const pendingIndex = pendingStepIndexRef.current;
      pendingStepIndexRef.current = null;
      runStepRef.current(pendingIndex, tokenRef.current);
    } else {
      const token = tokenRef.current;
      const shouldResumeAudio = pausedAudioRef.current;
      pausedAudioRef.current = false;
      void adapterRef.current
        .resume(
          shouldResumeAudio
            ? () => {
                if (
                  tokenRef.current !== token ||
                  stoppedRef.current ||
                  pausedRef.current
                ) {
                  return;
                }
                setAudioPlayingState(true);
              }
            : undefined,
        )
        .catch((cause) => {
          if (tokenRef.current !== token || stoppedRef.current) return;
          setAudioPlayingState(false);
          setError(
            cause instanceof Error
              ? cause.message
              : "\u672c\u5730\u97f3\u9891\u65e0\u6cd5\u7ee7\u7eed\u64ad\u653e\u3002",
          );
          setStatus("recoverable-error");
        });
    }
  }, [scheduleGap, setAudioPlayingState]);

  const retry = useCallback(() => {
    pausedRef.current = false;
    pendingStepIndexRef.current = null;
    pausedAudioRef.current = false;
    setAudioPlayingState(false);
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    clearGap();
    adapterRef.current.stop();
    setError(null);
    runStepRef.current(stepIndexRef.current, token);
  }, [clearGap, setAudioPlayingState]);

  const runFromStep = useCallback(
    (index: number) => {
      const token = tokenRef.current + 1;
      tokenRef.current = token;
      pausedRef.current = false;
      pendingStepIndexRef.current = null;
      pausedAudioRef.current = false;
      setAudioPlayingState(false);
      clearGap();
      adapterRef.current.stop();
      setError(null);
      statusRef.current = "playing";
      setStatus("playing");
      runStepRef.current(index, token);
    },
    [clearGap, setAudioPlayingState],
  );

  const replayCurrent = useCallback(() => {
    if (
      statusRef.current !== "playing" &&
      statusRef.current !== "paused" &&
      statusRef.current !== "auto-paused"
    ) {
      return;
    }
    const steps = stepsRef.current;
    let audioIndex = -1;
    for (
      let index = Math.min(stepIndexRef.current, steps.length - 1);
      index >= 0;
      index -= 1
    ) {
      const candidate = steps[index];
      if (
        candidate.kind === "audio" &&
        candidate.wordIndex === currentWordIndex
      ) {
        audioIndex = index;
        break;
      }
    }
    if (audioIndex < 0) {
      audioIndex = steps.findIndex(
        (candidate) =>
          candidate.kind === "audio" &&
          candidate.wordIndex === currentWordIndex,
      );
    }
    if (audioIndex >= 0) runFromStep(audioIndex);
  }, [currentWordIndex, runFromStep]);

  const repeatCurrent = useCallback(() => {
    if (
      statusRef.current !== "playing" &&
      statusRef.current !== "paused" &&
      statusRef.current !== "auto-paused"
    ) {
      return;
    }
    if (!isCurrentWordStep(stepsRef.current[stepIndexRef.current])) return;
    const firstStepIndex = stepsRef.current.findIndex(
      (candidate) =>
        candidate.kind === "audio" && candidate.wordIndex === currentWordIndex,
    );
    if (firstStepIndex >= 0) runFromStep(firstStepIndex);
  }, [currentWordIndex, runFromStep]);

  const advanceCurrent = useCallback(() => {
    if (
      statusRef.current !== "playing" &&
      statusRef.current !== "paused" &&
      statusRef.current !== "auto-paused"
    ) {
      return;
    }
    if (!isCurrentWordStep(stepsRef.current[stepIndexRef.current])) return;
    const steps = stepsRef.current;
    const transitionIndex = steps.findIndex(
      (candidate) =>
        candidate.kind === "transition" &&
        candidate.fromWordIndex === currentWordIndex,
    );
    exposeWord(currentWordIndex);
    runFromStep(transitionIndex >= 0 ? transitionIndex : steps.length);
  }, [currentWordIndex, exposeWord, runFromStep]);

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
    pausedAudioRef.current = false;
    setAudioPlayingState(false);
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
  }, [clearGap, currentWordIndex, setAudioPlayingState]);

  const restart = useCallback(() => {
    void start(workingPlanRef.current);
  }, [start]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    pendingStepIndexRef.current = null;
    pausedAudioRef.current = false;
    setAudioPlayingState(false);
    tokenRef.current += 1;
    clearGap();
    flushPendingExposures();
    adapterRef.current.unload();
    setStatus("idle");
  }, [clearGap, flushPendingExposures, setAudioPlayingState]);

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
  const canOperateOnWord = isCurrentWordStep(step);

  return {
    status,
    step,
    currentWordIndex,
    completedWords,
    currentItem,
    error,
    storageWarning,
    canDeferCurrent,
    canOperateOnWord,
    isAudioPlaying,
    pause,
    resume,
    retry,
    replayCurrent,
    repeatCurrent,
    advanceCurrent,
    deferCurrent,
    restart,
    stop,
  };
}
