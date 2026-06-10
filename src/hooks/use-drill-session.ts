"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { computeDrillSummary } from "@/lib/drill-utils";
import { addScore } from "@/lib/score-history";
import { getPassScore } from "@/lib/training-score";
import type {
  DrillAttempt,
  DrillEvent,
  DrillItem,
  DrillPhase,
  DrillProgressItem,
  DrillSessionConfig,
  DrillState,
} from "@/types/drill";
import { useAzureAssessment } from "./use-azure-assessment";
import { useRecorder } from "./use-recorder";

const MAX_ATTEMPTS = 3;

// ── Initial state ──

const initialState: DrillState = {
  phase: { type: "configuring" },
  config: null,
  items: [],
  progress: [],
  currentIndex: 0,
  currentAttempts: [],
  startedAt: 0,
};

// ── Reducer ──

function drillReducer(state: DrillState, event: DrillEvent): DrillState {
  switch (event.type) {
    case "START":
      return {
        ...state,
        phase: { type: "phonemeLesson" },
        config: event.config,
        items: event.items,
        progress: [],
        currentIndex: 0,
        currentAttempts: [],
        startedAt: Date.now(),
      };

    case "FINISH_PHONEME_LESSON":
      return {
        ...state,
        phase: { type: "teaching", index: 0, item: state.items[0] },
      };

    case "FINISH_TEACHING":
      return {
        ...state,
        phase: {
          type: "readyToRecord",
          index: state.currentIndex,
          item: state.items[state.currentIndex],
        },
      };

    case "START_RECORDING":
      return {
        ...state,
        phase: {
          type: "recording",
          index: state.currentIndex,
          item: state.items[state.currentIndex],
        },
      };

    case "STOP_RECORDING":
      return {
        ...state,
        phase: {
          type: "assessing",
          index: state.currentIndex,
          item: state.items[state.currentIndex],
        },
      };

    case "ASSESS_SUCCESS": {
      const item = state.items[state.currentIndex];
      const passed =
        event.score.pronunciationScore >= (state.config?.passThreshold ?? 70);
      const attempt: DrillAttempt = {
        attemptNumber: state.currentAttempts.length + 1,
        score: event.score,
        passed,
      };
      const attempts = [...state.currentAttempts, attempt];

      return {
        ...state,
        currentAttempts: attempts,
        phase: {
          type: "feedback",
          index: state.currentIndex,
          item,
          attempt,
          passed,
          attemptCount: attempts.length,
        },
      };
    }

    case "ASSESS_ERROR":
      return {
        ...state,
        phase: { type: "error", message: event.message },
      };

    case "NEXT_ITEM": {
      const item = state.items[state.currentIndex];
      const bestScore = Math.max(
        ...state.currentAttempts.map((a) => a.score.pronunciationScore),
        0,
      );
      const progressItem: DrillProgressItem = {
        item,
        attempts: state.currentAttempts,
        passed: state.currentAttempts.some((a) => a.passed),
        skipped: false,
        bestScore,
      };
      const newProgress = [...state.progress, progressItem];
      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= state.items.length) {
        // All items done
        const summary = computeDrillSummary(
          state.config ?? {
            kind: "word",
            phonemeSlug: "",
            itemCount: 0,
            passThreshold: 70,
          },
          newProgress,
          state.startedAt,
        );
        return {
          ...state,
          progress: newProgress,
          currentIndex: nextIndex,
          currentAttempts: [],
          phase: { type: "completed", summary },
        };
      }

      return {
        ...state,
        progress: newProgress,
        currentIndex: nextIndex,
        currentAttempts: [],
        phase: {
          type: "teaching",
          index: nextIndex,
          item: state.items[nextIndex],
        },
      };
    }

    case "RETRY_ITEM":
      return {
        ...state,
        phase: {
          type: "readyToRecord",
          index: state.currentIndex,
          item: state.items[state.currentIndex],
        },
      };

    case "SKIP_ITEM": {
      const item = state.items[state.currentIndex];
      const bestScore = Math.max(
        ...state.currentAttempts.map((a) => a.score.pronunciationScore),
        0,
      );
      const progressItem: DrillProgressItem = {
        item,
        attempts: state.currentAttempts,
        passed: false,
        skipped: true,
        bestScore,
      };
      const newProgress = [...state.progress, progressItem];
      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= state.items.length) {
        const summary = computeDrillSummary(
          state.config ?? {
            kind: "word",
            phonemeSlug: "",
            itemCount: 0,
            passThreshold: 70,
          },
          newProgress,
          state.startedAt,
        );
        return {
          ...state,
          progress: newProgress,
          currentIndex: nextIndex,
          currentAttempts: [],
          phase: { type: "completed", summary },
        };
      }

      return {
        ...state,
        progress: newProgress,
        currentIndex: nextIndex,
        currentAttempts: [],
        phase: {
          type: "teaching",
          index: nextIndex,
          item: state.items[nextIndex],
        },
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ── Hook ──

export interface UseDrillSessionResult {
  phase: DrillPhase;
  config: DrillSessionConfig | null;
  items: DrillItem[];
  progress: DrillProgressItem[];
  currentIndex: number;
  attemptCount: number;
  maxAttempts: number;
  // Recorder passthrough
  isRecording: boolean;
  recorderStream: MediaStream | null;
  audioBlob: Blob | null;
  recorderError: string | null;
  // Azure passthrough
  isAssessing: boolean;
  assessError: string | null;
  // Actions
  start: (config: DrillSessionConfig, items: DrillItem[]) => void;
  finishPhonemeLesson: () => void;
  finishTeaching: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  submitRecording: () => Promise<void>;
  nextItem: () => void;
  retryItem: () => void;
  skipItem: () => void;
  reset: () => void;
}

export interface UseDrillSessionOptions {
  azureLocale?: string;
  scoreHistoryPrefix?: string;
}

export function useDrillSession(
  options: UseDrillSessionOptions = {},
): UseDrillSessionResult {
  const [state, dispatch] = useReducer(drillReducer, initialState);
  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const assessingRef = useRef(false);

  const start = useCallback(
    (config: DrillSessionConfig, items: DrillItem[]) => {
      recorder.reset();
      azure.reset();
      dispatch({ type: "START", items, config });
    },
    [recorder, azure],
  );

  const finishPhonemeLesson = useCallback(() => {
    dispatch({ type: "FINISH_PHONEME_LESSON" });
  }, []);

  const finishTeaching = useCallback(() => {
    dispatch({ type: "FINISH_TEACHING" });
  }, []);

  const startRecording = useCallback(() => {
    recorder.reset();
    azure.reset();
    dispatch({ type: "START_RECORDING" });
    recorder.startRecording();
  }, [recorder, azure]);

  const stopRecording = useCallback(() => {
    recorder.stopRecording();
    dispatch({ type: "STOP_RECORDING" });
  }, [recorder]);

  const submitRecording = useCallback(async () => {
    if (!recorder.audioBlob || assessingRef.current) return;
    const item = state.items[state.currentIndex];
    if (!item) return;

    assessingRef.current = true;
    const result = await azure.assess(
      recorder.audioBlob,
      item.text,
      options.azureLocale ?? "en-US",
    );
    assessingRef.current = false;

    if (result) {
      const target = getPassScore(result, [item.phoneme], {
        allowFallback: (options.scoreHistoryPrefix ?? "en-US") === "en-US",
      });
      // Save score to history
      addScore(
        `${options.scoreHistoryPrefix ?? "en-US"}:${item.phoneme}:${item.text}`,
        target.targetScore,
      );
      dispatch({
        type: "ASSESS_SUCCESS",
        score: {
          pronunciationScore: target.targetScore,
          accuracyScore: result.accuracyScore,
          targetScore: target.targetScore,
          overallScore: target.overallScore,
          usedTargetFallback: target.usedFallback,
        },
      });
    } else {
      dispatch({
        type: "ASSESS_ERROR",
        message: azure.error || "评分失败，请重试",
      });
    }
  }, [
    recorder.audioBlob,
    state.items,
    state.currentIndex,
    azure,
    options.azureLocale,
    options.scoreHistoryPrefix,
  ]);

  // Auto-submit when recording stops and blob is ready
  useEffect(() => {
    if (
      state.phase.type === "assessing" &&
      recorder.audioBlob &&
      !assessingRef.current
    ) {
      submitRecording();
    }
  }, [state.phase, recorder.audioBlob, submitRecording]);

  // Auto-stop triggers auto-assess
  useEffect(() => {
    if (
      recorder.autoStopped &&
      recorder.audioBlob &&
      state.phase.type === "recording"
    ) {
      dispatch({ type: "STOP_RECORDING" });
    }
  }, [recorder.autoStopped, recorder.audioBlob, state.phase]);

  const nextItem = useCallback(() => {
    recorder.reset();
    azure.reset();
    dispatch({ type: "NEXT_ITEM" });
  }, [recorder, azure]);

  const retryItem = useCallback(() => {
    recorder.reset();
    azure.reset();
    dispatch({ type: "RETRY_ITEM" });
  }, [recorder, azure]);

  const skipItem = useCallback(() => {
    recorder.reset();
    azure.reset();
    dispatch({ type: "SKIP_ITEM" });
  }, [recorder, azure]);

  const resetAll = useCallback(() => {
    recorder.reset();
    azure.reset();
    dispatch({ type: "RESET" });
  }, [recorder, azure]);

  return {
    phase: state.phase,
    config: state.config,
    items: state.items,
    progress: state.progress,
    currentIndex: state.currentIndex,
    attemptCount: state.currentAttempts.length,
    maxAttempts: MAX_ATTEMPTS,
    isRecording: recorder.isRecording,
    recorderStream: recorder.stream,
    audioBlob: recorder.audioBlob,
    recorderError: recorder.error,
    isAssessing: azure.isLoading,
    assessError: azure.error,
    start,
    finishPhonemeLesson,
    finishTeaching,
    startRecording,
    stopRecording,
    submitRecording,
    nextItem,
    retryItem,
    skipItem,
    reset: resetAll,
  };
}
