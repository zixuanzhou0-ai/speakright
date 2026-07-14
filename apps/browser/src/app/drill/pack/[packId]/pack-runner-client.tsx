"use client";

import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import { evaluateTrainingCriterion } from "@speakright/core/training/criteria";
import type { TrainingMaterialNovelty } from "@speakright/core/training/exposure";
import {
  isCrossSpeakerPerceptionTrial,
  type PerceptionTrial,
} from "@speakright/core/training/perception";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Ear,
  ListChecks,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  Target,
  Volume2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { getAzureConfig } from "@/lib/api-keys";
import { analyzeAttempt } from "@/lib/attempt-analysis";
import { isAzureConfigReady } from "@/lib/azure-config";
import {
  buildCourseMap,
  type CourseLevelMapItem,
  type CourseLevelMapStatus,
  type CourseMapSummary,
} from "@/lib/course-map";
import {
  createCourseStartPosition,
  evaluateLevelGate,
  getCourseItemPlaybackText,
  getCourseItemReference,
} from "@/lib/course-runner";
import {
  buildDeepPracticeCoach,
  type DeepPracticeCoach,
} from "@/lib/deep-practice-coach";
import {
  loadDeepTrainingSession,
  saveDeepTrainingSession,
} from "@/lib/deep-training-session";
import { buildGuidedAttemptEvidence } from "@/lib/guided-attempt-evidence";
import { buildGuidedTrainingEvidence } from "@/lib/guided-training-evidence";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  appendLearningEvidence,
  DEFAULT_CALIBRATION_VERSION,
} from "@/lib/learning-evidence";
import {
  buildLessonBrief,
  buildSessionDebrief,
  type LessonBrief,
} from "@/lib/lesson-brief";
import { LOCAL_MASTERY_SAVE_WARNING } from "@/lib/local-save-warning";
import {
  canRecordFormalMastery,
  getExperimentalMasteryBlocker,
} from "@/lib/mastery-language-policy";
import {
  loadMasteryProfile,
  recordTrainingSession,
  saveMasteryProfile,
} from "@/lib/mastery-profile";
import { buildPerceptionAttemptEvidence } from "@/lib/perception-attempt-evidence";
import {
  getCenteredCompactTextClassName,
  getCenteredMonoTextClassName,
  getCenteredProminentTextClassName,
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import {
  type RecordingQualityReport,
  reliabilityFromRecordingQuality,
} from "@/lib/recording-quality";
import { scheduleRetentionAfterTransfer } from "@/lib/retention-schedule";
import { buildReviewQueue, buildSessionReviewItems } from "@/lib/review-queue";
import {
  type CourseAttemptSnapshot,
  type CoursePosition,
  nextCoursePosition,
  shouldEnterRemediation,
  shouldMarkStuck,
  toLevelSummary,
} from "@/lib/training-course-session";
import {
  criterionTargetScore,
  describeTrainingCriterion,
  formatTrainingTargetUnit,
} from "@/lib/training-criteria";
import {
  getRemediationPath,
  TRAINING_ERROR_PATTERNS,
} from "@/lib/training-error-patterns";
import {
  markCourseItemExposed,
  presentCourseItem,
} from "@/lib/training-exposure";
import { getRetentionMaterialIds, getTrainingPack } from "@/lib/training-packs";
import {
  createFocusedPackPerceptionTrials,
  createPackPerceptionTrials,
  perceptionTrialToCourseItem,
} from "@/lib/training-perception";
import { cn } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";
import type { LanguageId } from "@/types/language";
import type {
  AttemptAnalysis,
  ErrorPattern,
  RemediationPath,
  RemediationResult,
  TrainingCourseItem,
  TrainingEvidenceItem,
  TrainingLevel,
  TrainingPack,
  TrainingSessionSummary,
} from "@/types/training";

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";
const WRAP_SAFE_BADGE_CLASS =
  "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

type RunnerPhase =
  | { type: "intro" }
  | { type: "course"; position: CoursePosition }
  | { type: "completed"; summary: TrainingSessionSummary };

type ActiveSlot = "A" | "B" | "X" | null;

interface MotorFormationEvidence {
  completedSelfChecks: number;
  recordedSampleCount: number;
  playbackComparisonCompleted: boolean;
}

function mergeMaterialNovelty(
  current: TrainingMaterialNovelty | undefined,
  next: TrainingMaterialNovelty | undefined,
): TrainingMaterialNovelty | undefined {
  if (!next) return current;
  if (!current) return next;
  if (current === "exposed" || next === "exposed") return "exposed";
  if (current === "unknown" || next === "unknown") return "unknown";
  return "confirmed-untrained";
}

interface AttemptResult {
  text: string;
  targetScore: number;
  overallScore: number;
  passed: boolean;
  azureResult: AzureAssessmentResult;
  patterns: ErrorPattern[];
  analysis: AttemptAnalysis;
}

interface RemediationAttemptResult {
  text: string;
  pathId: string;
  stepIndex: number;
  beforeTargetScore: number;
  targetScore: number;
  overallScore: number;
  passed: boolean;
  analysis: AttemptAnalysis;
}

function emptySnapshot(level: TrainingLevel): CourseAttemptSnapshot {
  return {
    levelId: level.id,
    kind: level.kind,
    scores: [],
    attempts: 0,
    passedCount: 0,
    stuckCount: 0,
  };
}

function average(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
}

function fallbackPath(
  patterns: ErrorPattern[],
  pack: TrainingPack,
): RemediationPath | null {
  const pathId =
    patterns[0]?.remediationPathId ?? pack.course?.remediation[0]?.id;
  return pathId ? getRemediationPath(pathId) : null;
}

function remediationStepReference(
  step: RemediationPath["steps"][number],
): string {
  return step.referenceText ?? step.text;
}

function itemFromRemediationStep(
  baseItem: TrainingCourseItem,
  step: RemediationPath["steps"][number],
  index: number,
): TrainingCourseItem {
  const reference = remediationStepReference(step);
  return {
    ...baseItem,
    id: `${baseItem.id}-remediation-${index + 1}`,
    text: reference,
    displayText: step.text,
    referenceText: reference,
    playbackText: step.playbackText ?? reference,
    targetPhonemes:
      step.targetPhonemes.length > 0
        ? step.targetPhonemes
        : baseItem.targetPhonemes,
    focusPoint: step.prompt,
    commonMistake: baseItem.commonMistake,
    successCue: "补救步骤过线后，再回到原题复测。",
    isRecordable: true,
  };
}

export default function TrainingPackPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const params = useParams<{ packId: string }>();
  const searchParams = useSearchParams();
  const packId = Array.isArray(params.packId)
    ? params.packId[0]
    : params.packId;
  const pack = getTrainingPack(packId);
  const requestedLevelId = searchParams.get("level");

  const [phase, setPhase] = useState<RunnerPhase>({ type: "intro" });
  const [activeSlot, setActiveSlot] = useState<ActiveSlot>(null);
  const [perceptionTrials, setPerceptionTrials] = useState<PerceptionTrial[]>(
    [],
  );
  const [perceptionCorrect, setPerceptionCorrect] = useState(0);
  const [perceptionTotal, setPerceptionTotal] = useState(0);
  const [perceptionExtraRemaining, setPerceptionExtraRemaining] = useState(0);
  const [perceptionAnswer, setPerceptionAnswer] = useState<boolean | null>(
    null,
  );
  const [missedPerceptionPairIds, setMissedPerceptionPairIds] = useState<
    string[]
  >([]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lastAttempt, setLastAttempt] = useState<AttemptResult | null>(null);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [worstAttempt, setWorstAttempt] = useState<AttemptResult | null>(null);
  const [levelStats, setLevelStats] = useState<
    Record<string, CourseAttemptSnapshot>
  >({});
  const [stuckPatternIds, setStuckPatternIds] = useState<string[]>([]);
  const [focusedReviewItems, setFocusedReviewItems] = useState<
    TrainingCourseItem[]
  >([]);
  const [gateBlockedReason, setGateBlockedReason] = useState<string | null>(
    null,
  );
  const [remediationStepIndex, setRemediationStepIndex] = useState(0);
  const [remediationAttempt, setRemediationAttempt] =
    useState<RemediationAttemptResult | null>(null);
  const [failedItems, setFailedItems] = useState<TrainingEvidenceItem[]>([]);
  const [remediationResults, setRemediationResults] = useState<
    RemediationResult[]
  >([]);
  const [localSaveWarning, setLocalSaveWarning] = useState<string | null>(null);
  const [materialNovelty, setMaterialNovelty] = useState<
    Record<string, TrainingMaterialNovelty>
  >({});
  const [sessionReady, setSessionReady] = useState(false);

  const startedAtRef = useRef(Date.now());
  const qualityReportsRef = useRef<RecordingQualityReport[]>([]);
  const restoredPackRef = useRef<string | null>(null);
  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const wordAudio = useWordPronunciation();
  const tts = useTtsAligned();
  const llm = useLlmFeedback();

  const course = pack?.course;
  const scoringAvailable = isAzureConfigReady(getAzureConfig());
  const currentLevel =
    phase.type === "course" && course
      ? course.levels[phase.position.levelIndex]
      : null;
  const perceptionItems = useMemo(
    () => perceptionTrials.map(perceptionTrialToCourseItem),
    [perceptionTrials],
  );
  const currentItems =
    currentLevel?.kind === "perception"
      ? perceptionItems
      : currentLevel && focusedReviewItems.length > 0
        ? focusedReviewItems
        : (currentLevel?.items ?? []);
  const currentItem =
    currentLevel && phase.type === "course"
      ? currentItems[phase.position.itemIndex % currentItems.length]
      : null;
  const currentMaterialId =
    pack && currentLevel && currentItem
      ? currentItem.materialRole
        ? currentItem.id
        : `${pack.id}:${currentLevel.id}:${currentItem.id}`
      : null;
  const currentMaterialNovelty = currentMaterialId
    ? materialNovelty[currentMaterialId]
    : undefined;
  const currentPerceptionTrial =
    currentLevel?.kind === "perception" &&
    phase.type === "course" &&
    perceptionTrials.length > 0
      ? perceptionTrials[phase.position.itemIndex % perceptionTrials.length]
      : null;
  useEffect(() => {
    if (!pack || !currentLevel || !currentItem) return;
    if (currentLevel.kind === "perception" && currentPerceptionTrial) {
      for (const asset of [
        currentPerceptionTrial.referenceA,
        currentPerceptionTrial.referenceB,
        currentPerceptionTrial.probe,
      ]) {
        markCourseItemExposed({
          materialId: `${pack.id}:perception:${asset.speakerId}:${asset.word}`,
          packId: pack.id,
          role: "baseline",
          contentKey: asset.word,
          source: "guided-course",
        });
      }
      return;
    }
    const role =
      currentItem.materialRole ??
      (currentLevel.kind === "articulation" ? "instruction" : "practice");
    if (!currentMaterialId) return;
    const presented = presentCourseItem({
      materialId: currentMaterialId,
      packId: pack.id,
      role,
      contentKey: currentItem.referenceText ?? currentItem.text,
      source: "guided-course",
    });
    setMaterialNovelty((current) =>
      current[currentMaterialId]
        ? current
        : {
            ...current,
            [currentMaterialId]: presented.noveltyBeforeExposure,
          },
    );
    if (!presented.saved) {
      setLocalSaveWarning(
        "当前材料的暴露记录未能保存；本轮不会宣称材料未经训练。",
      );
    }
  }, [
    pack,
    currentLevel,
    currentItem,
    currentPerceptionTrial,
    currentMaterialId,
  ]);

  useEffect(() => {
    if (!pack || !course || restoredPackRef.current === pack.id) return;
    restoredPackRef.current = pack.id;
    const saved = loadDeepTrainingSession(pack.id);
    if (saved) {
      startedAtRef.current = saved.startedAt;
      setPhase(
        saved.phase.type === "course"
          ? { type: "course", position: saved.phase.position }
          : { type: "intro" },
      );
      setPerceptionTrials(saved.perceptionTrials);
      setPerceptionCorrect(saved.perceptionCorrect);
      setPerceptionTotal(saved.perceptionTotal);
      setPerceptionExtraRemaining(saved.perceptionExtraRemaining);
      setLevelStats(saved.levelStats);
      setPerceptionAnswer(null);
    }
    setSessionReady(true);
  }, [pack, course]);

  useEffect(() => {
    if (!sessionReady || !pack) return;
    const persistedPhase =
      phase.type === "completed" ? { type: "completed" as const } : phase;
    const saved = saveDeepTrainingSession({
      version: 1,
      packId: pack.id,
      startedAt: startedAtRef.current,
      updatedAt: Date.now(),
      phase: persistedPhase,
      perceptionTrials,
      perceptionCorrect,
      perceptionTotal,
      perceptionExtraRemaining,
      levelStats,
    });
    if (!saved) {
      setLocalSaveWarning("当前训练进度未能保存；请保持页面打开并稍后重试。");
    }
  }, [
    sessionReady,
    pack,
    phase,
    perceptionTrials,
    perceptionCorrect,
    perceptionTotal,
    perceptionExtraRemaining,
    levelStats,
  ]);

  const xIsA = currentPerceptionTrial?.probeMatches === "A";
  const progressText =
    phase.type === "course" && currentLevel
      ? `${phase.position.levelIndex + 1}/${course?.levels.length ?? 0} · ${
          phase.position.itemIndex + 1
        }/${currentItems.length}`
      : "";
  const recordingQuality = useRecordingQuality(recorder.audioBlob, {
    expectedMode:
      currentLevel?.kind === "sentence" ||
      currentLevel?.kind === "shadowing" ||
      currentLevel?.kind === "mixed-review"
        ? "sentence"
        : "word",
    minDurationMs:
      currentLevel?.kind === "sentence" ||
      currentLevel?.kind === "shadowing" ||
      currentLevel?.kind === "mixed-review"
        ? 800
        : 500,
  });

  const currentSnapshot = useMemo(() => {
    if (!currentLevel) return null;
    return levelStats[currentLevel.id] ?? emptySnapshot(currentLevel);
  }, [currentLevel, levelStats]);
  const savedProfile = useMemo(() => {
    if (!pack || !course) return null;
    return loadMasteryProfile();
  }, [pack, course]);
  const savedReviewQueue = useMemo(
    () => buildReviewQueue(savedProfile),
    [savedProfile],
  );
  const lessonBrief = useMemo(() => {
    if (!pack || !course) return null;
    return buildLessonBrief({
      pack,
      requestedLevelId,
      profile: savedProfile,
      reviewQueue: savedReviewQueue,
    });
  }, [pack, course, requestedLevelId, savedProfile, savedReviewQueue]);
  const courseMap = useMemo(() => {
    if (!pack || !course) return null;
    return buildCourseMap({
      pack,
      profile: savedProfile,
      reviewQueue: savedReviewQueue,
      requestedLevelId,
      currentLevelId: phase.type === "course" ? currentLevel?.id : null,
    });
  }, [
    pack,
    course,
    savedProfile,
    savedReviewQueue,
    requestedLevelId,
    phase.type,
    currentLevel?.id,
  ]);

  if (!pack || !course) {
    return (
      <div className="h-full flex flex-col px-6 py-4">
        <Link href="/drill" className="mb-4 inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          返回刻意练习
        </Link>
        <div className="rounded-xl border bg-card p-6">
          <h1 className="text-xl font-bold">训练包不存在</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            这个训练包可能已被移除，请回到刻意练习页重新选择。
          </p>
        </div>
      </div>
    );
  }

  if (!canRecordFormalMastery(languageId)) {
    return (
      <div
        className="h-full flex flex-col overflow-y-auto px-6 py-4 scrollbar-thin"
        data-smoke="pack-runner-experimental-blocker"
      >
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <Link
            href="/drill"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted sm:h-8 sm:w-8"
            aria-label="返回刻意练习"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="min-w-0 flex-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            返回刻意练习
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-start pt-8 sm:justify-center sm:pt-0">
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <Target className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-3 break-words text-2xl font-bold [overflow-wrap:anywhere]">
              {languageProfile.shortLabel} Labs 暂不使用英语训练包
            </h1>
            <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              当前页面是英语深度训练包。{languageProfile.shortLabel}属于
              Labs（experimental），请使用当前语言的单词、
              句子、对比训练或发音诊断；这里不会混入英语训练包，也不会生成正式
              mastery。
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/drill/word" className="max-w-full">
                <Button
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  当前语言单词训练
                </Button>
              </Link>
              <Link href="/drill/contrast" className="max-w-full">
                <Button
                  variant="outline"
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  当前语言对比训练
                </Button>
              </Link>
              <Link href="/drill" className="max-w-full">
                <Button
                  variant="outline"
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  返回训练首页
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const defaultStartLevelId =
    lessonBrief?.startLevelId ?? courseMap?.startLevelId ?? requestedLevelId;

  const clearReferenceAudioState = () => {
    wordAudio.clearError();
    tts.reset();
  };

  const resetSession = (levelId = defaultStartLevelId) => {
    startedAtRef.current = Date.now();
    clearReferenceAudioState();
    setActiveSlot(null);
    setPerceptionTrials(
      createPackPerceptionTrials(
        pack.id,
        `${pack.id}-${Date.now().toString()}`,
      ),
    );
    setPerceptionCorrect(0);
    setPerceptionTotal(0);
    setPerceptionExtraRemaining(0);
    setPerceptionAnswer(null);
    setFailedAttempts(0);
    setMissedPerceptionPairIds([]);
    setLastAttempt(null);
    setResults([]);
    setWorstAttempt(null);
    setLevelStats({});
    setMaterialNovelty({});
    setStuckPatternIds([]);
    setFocusedReviewItems([]);
    setGateBlockedReason(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    setFailedItems([]);
    setRemediationResults([]);
    setLocalSaveWarning(null);
    qualityReportsRef.current = [];
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    llm.reset();
    setPhase({
      type: "course",
      position: createCourseStartPosition(course, levelId),
    });
  };

  const updateLevelStats = (
    level: TrainingLevel,
    score: number | undefined,
    passed: boolean,
    stuck = false,
    details?: {
      contextId: string;
      validSample: boolean;
      recordingQualityValid?: boolean;
      alignmentValid?: boolean;
      materialId?: string;
      position?: TrainingCourseItem["position"];
      novelty?: TrainingMaterialNovelty;
      completedSelfChecks?: number;
      recordedSampleCount?: number;
      playbackComparisonCompleted?: boolean;
      speakerIds?: string[];
      speakerPairings?: string[];
    },
  ) => {
    setLevelStats((current) => {
      const snapshot = current[level.id] ?? emptySnapshot(level);
      return {
        ...current,
        [level.id]: {
          ...snapshot,
          scores:
            score === undefined ? snapshot.scores : [...snapshot.scores, score],
          attempts: snapshot.attempts + 1,
          passedCount: snapshot.passedCount + (passed ? 1 : 0),
          stuckCount: snapshot.stuckCount + (stuck ? 1 : 0),
          contextIds: details?.contextId
            ? [...(snapshot.contextIds ?? []), details.contextId]
            : snapshot.contextIds,
          validSampleCount: details
            ? (snapshot.validSampleCount ?? 0) + (details.validSample ? 1 : 0)
            : snapshot.validSampleCount,
          recordingQualityValid:
            details?.recordingQualityValid === undefined
              ? snapshot.recordingQualityValid
              : (snapshot.recordingQualityValid ?? true) &&
                details.recordingQualityValid,
          alignmentValid:
            details?.alignmentValid === undefined
              ? snapshot.alignmentValid
              : (snapshot.alignmentValid ?? true) && details.alignmentValid,
          completedSelfChecks:
            details?.completedSelfChecks ?? snapshot.completedSelfChecks,
          recordedSampleCount:
            details?.recordedSampleCount ?? snapshot.recordedSampleCount,
          playbackComparisonCompleted:
            details?.playbackComparisonCompleted ??
            snapshot.playbackComparisonCompleted,
          speakerIds: details?.speakerIds ?? snapshot.speakerIds,
          speakerPairings: details?.speakerPairings ?? snapshot.speakerPairings,
          materialIds: details?.materialId
            ? [...(snapshot.materialIds ?? []), details.materialId]
            : snapshot.materialIds,
          positions: details?.position
            ? [...(snapshot.positions ?? []), details.position]
            : snapshot.positions,
          novelty: mergeMaterialNovelty(snapshot.novelty, details?.novelty),
        },
      };
    });
  };

  const advance = () => {
    if (phase.type !== "course" || !currentLevel) return;
    const nextItem = phase.position.itemIndex + 1;
    const next = nextCoursePosition(course, phase.position);
    clearReferenceAudioState();
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setLastAttempt(null);
    setFailedAttempts(0);
    setPerceptionAnswer(null);
    setActiveSlot(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    setGateBlockedReason(null);

    if (nextItem < currentItems.length) {
      setPhase({
        type: "course",
        position: { ...phase.position, itemIndex: nextItem },
      });
      return;
    }

    if (currentLevel.kind === "transfer") {
      completeSession();
      return;
    }

    if (focusedReviewItems.length > 0) {
      const gate = evaluateLevelGate(
        currentLevel,
        levelStats[currentLevel.id] ?? emptySnapshot(currentLevel),
        currentItem,
      );
      setFocusedReviewItems([]);
      if (!gate.passed) {
        setGateBlockedReason(
          `${gate.reason} 这次先停在本关，避免把还没稳的动作带进下一层。`,
        );
        setPhase({
          type: "course",
          position: { ...phase.position, itemIndex: 0 },
        });
        return;
      }
      const nextLevel = phase.position.levelIndex + 1;
      if (nextLevel >= course.levels.length) {
        completeSession();
      } else {
        setPhase({
          type: "course",
          position: { levelIndex: nextLevel, itemIndex: 0 },
        });
      }
      return;
    } else if (!["perception", "articulation"].includes(currentLevel.kind)) {
      const gate = evaluateLevelGate(
        currentLevel,
        levelStats[currentLevel.id] ?? emptySnapshot(currentLevel),
        currentItem,
      );
      if (!gate.passed && gate.focusedReviewItems.length > 0) {
        setFocusedReviewItems(gate.focusedReviewItems);
        setPhase({
          type: "course",
          position: { ...phase.position, itemIndex: 0 },
        });
        return;
      }
    }

    if (next && next.levelIndex !== phase.position.levelIndex) {
      setPhase({ type: "course", position: next });
    } else if (next) {
      setPhase({ type: "course", position: next });
    } else {
      completeSession();
    }
  };

  const skipBlockedGate = () => {
    if (phase.type !== "course") return;
    setGateBlockedReason(null);
    const nextLevel = phase.position.levelIndex + 1;
    if (nextLevel >= course.levels.length) {
      completeSession();
      return;
    }
    setPhase({
      type: "course",
      position: { levelIndex: nextLevel, itemIndex: 0 },
    });
  };

  const completeSession = () => {
    clearReferenceAudioState();
    const sessionId = `${pack.id}-${startedAtRef.current}`;
    const levelSummaries = course.levels.map((level) =>
      toLevelSummary(level, levelStats[level.id] ?? emptySnapshot(level)),
    );
    const targetScores = results.map((result) => result.targetScore);
    const usedTargetFallback =
      results.some((result) => result.analysis.usedFallback) ||
      remediationResults.some((result) => result.usedFallback);
    const canPromoteMastery = canRecordFormalMastery(languageId);
    const promotionBlockers = [
      usedTargetFallback
        ? "目标音素未成功对齐，本轮整体分只作反馈，不提升正式证据阶段。"
        : null,
      getExperimentalMasteryBlocker(languageId),
    ].filter((item): item is string => item !== null);
    const qualityIssues = qualityReportsRef.current.flatMap((report) =>
      report.issues.map((issue) => issue.title),
    );
    const minQualityScore =
      qualityReportsRef.current.length > 0
        ? Math.min(...qualityReportsRef.current.map((report) => report.score))
        : undefined;
    const uniqueQualityIssues = Array.from(new Set(qualityIssues));
    const summary: TrainingSessionSummary = {
      id: sessionId,
      packId: pack.id,
      startedAt: startedAtRef.current,
      completedAt: Date.now(),
      perceptionCorrect,
      perceptionTotal,
      targetScores,
      wordScores: levelSummaries
        .filter(
          (level) => level.kind === "word" || level.kind === "minimal-pair",
        )
        .flatMap((level) => levelStats[level.levelId]?.scores ?? []),
      sentenceScores: levelSummaries
        .filter(
          (level) => level.kind === "sentence" || level.kind === "shadowing",
        )
        .flatMap((level) => levelStats[level.levelId]?.scores ?? []),
      mixedReviewScores: levelStats["mixed-review"]?.scores ?? [],
      levelSummaries,
      stuckPatternIds: Array.from(new Set(stuckPatternIds)),
      recommendedNextLevelId:
        levelSummaries.find((level) => !level.passed)?.levelId ??
        (Array.from(new Set(stuckPatternIds)).length > 0
          ? levelSummaries.find((level) => level.stuckCount > 0)?.levelId
          : undefined),
      failedItems,
      remediationResults,
      assessmentReliability:
        qualityReportsRef.current.length > 0
          ? {
              ...reliabilityFromRecordingQuality(null, {
                languageId,
                evidenceStrength: targetScores.length >= 3 ? "strong" : "fair",
                note:
                  uniqueQualityIssues.length > 0
                    ? "本轮存在录音质量提示，结果只作为观察，不提升正式证据阶段。"
                    : "本轮录音质量稳定，可计入当前训练证据。",
              }),
              audioQualityScore: minQualityScore,
              audioQualityIssues: uniqueQualityIssues,
              canPromoteMastery:
                uniqueQualityIssues.length === 0 &&
                promotionBlockers.length === 0,
            }
          : undefined,
      promotionBlockers,
      mastered: false,
    };
    summary.reviewItems = buildSessionReviewItems(summary);
    const completedSummary = { ...summary, mastered: false };
    const guidedEvidence = buildGuidedTrainingEvidence({
      sessionId,
      languageId,
      pack,
      levels: course.levels.map((level) => ({
        level,
        snapshot: levelStats[level.id] ?? emptySnapshot(level),
      })),
      createdAt: completedSummary.completedAt,
    });
    const evidenceSaveResults = guidedEvidence.map((item) =>
      appendLearningEvidence(item),
    );
    const evidenceSaved = evidenceSaveResults.every(Boolean);
    const transferEvidence = guidedEvidence.find(
      (item) => item.evidenceStage === "transfer_observed",
    );
    const retentionScheduled = transferEvidence
      ? scheduleRetentionAfterTransfer({
          packId: pack.id,
          transferEvidenceId: transferEvidence.id,
          observedAt: completedSummary.completedAt,
          materialIdsByDelay: {
            24: getRetentionMaterialIds(pack.id, 24),
            168: getRetentionMaterialIds(pack.id, 168),
            504: getRetentionMaterialIds(pack.id, 504),
          },
        })
      : true;
    let nextLocalSaveWarning: string | null = null;
    if (canPromoteMastery) {
      const profile = recordTrainingSession(
        loadMasteryProfile(),
        completedSummary,
      );
      const profileSaved = saveMasteryProfile(profile);
      if (!profileSaved) {
        nextLocalSaveWarning = LOCAL_MASTERY_SAVE_WARNING;
      }
    }
    if (!evidenceSaved) {
      nextLocalSaveWarning = "训练已完成，但 V3 学习证据未能写入本机存储。";
    }
    if (!retentionScheduled) {
      nextLocalSaveWarning =
        "迁移证据已保存，但 1/7/21 天复测任务未能写入本机存储。";
    }
    setLocalSaveWarning(nextLocalSaveWarning);
    setPhase({ type: "completed", summary: completedSummary });
  };

  const playReference = () => {
    if (!currentItem) return;
    clearReferenceAudioState();
    const reference = getCourseItemPlaybackText(currentItem);
    if (reference.split(/\s+/).length > 1) {
      tts.speak(reference, { speed: 0.85, languageId });
    } else {
      wordAudio.playWord(reference.toLowerCase(), "blue", languageId);
    }
  };

  const playRemediationText = (text: string) => {
    clearReferenceAudioState();
    if (text.split(/\s+/).length > 1) {
      tts.speak(text, { speed: 0.75, languageId });
    } else {
      wordAudio.playWord(text.toLowerCase(), "blue", languageId);
    }
  };

  const playSlot = (slot: ActiveSlot) => {
    if (!currentPerceptionTrial || !slot) return;
    clearReferenceAudioState();
    const asset =
      slot === "A"
        ? currentPerceptionTrial.referenceA
        : slot === "B"
          ? currentPerceptionTrial.referenceB
          : currentPerceptionTrial.probe;
    setActiveSlot(slot);
    wordAudio.playLocalAsset(asset.uri, asset.word);
  };

  const answerPerception = (answeredA: boolean) => {
    if (!currentLevel || !currentPerceptionTrial || phase.type !== "course")
      return;
    const correct = answeredA === (currentPerceptionTrial.probeMatches === "A");
    const nextCorrect = perceptionCorrect + (correct ? 1 : 0);
    const nextTotal = perceptionTotal + 1;
    setPerceptionCorrect(nextCorrect);
    setPerceptionTotal(nextTotal);
    setPerceptionAnswer(correct);
    if (!correct) {
      setMissedPerceptionPairIds((current) =>
        Array.from(
          new Set([
            ...current,
            currentPerceptionTrial.pairId,
            currentPerceptionTrial.probePairId,
          ]),
        ),
      );
    }
    const evidenceSaved = appendLearningEvidence(
      buildPerceptionAttemptEvidence({
        sessionId: `${pack.id}-${startedAtRef.current}`,
        pack,
        levelId: currentLevel.id,
        trial: currentPerceptionTrial,
        correct,
        attemptNumber: nextTotal,
        createdAt: Date.now(),
      }),
    );
    if (!evidenceSaved) {
      setLocalSaveWarning(
        "本次辨音结果已保留在当前页面，但原始 V3 学习证据未能写入本机存储。",
      );
    }
    setLevelStats((current) => {
      const snapshot = current[currentLevel.id] ?? emptySnapshot(currentLevel);
      return {
        ...current,
        [currentLevel.id]: {
          ...snapshot,
          attempts: snapshot.attempts + 1,
          passedCount: snapshot.passedCount + (correct ? 1 : 0),
          contextIds: [
            ...(snapshot.contextIds ?? []),
            currentPerceptionTrial.pairId,
          ],
          crossSpeakerValid:
            (snapshot.crossSpeakerValid ?? true) &&
            isCrossSpeakerPerceptionTrial(currentPerceptionTrial),
          speakerIds: [
            ...(snapshot.speakerIds ?? []),
            currentPerceptionTrial.referenceSpeakerId,
            currentPerceptionTrial.probeSpeakerId,
          ],
          speakerPairings: [
            ...(snapshot.speakerPairings ?? []),
            currentPerceptionTrial.referenceSpeakerId +
              "->" +
              currentPerceptionTrial.probeSpeakerId,
          ],
        },
      };
    });
  };

  const nextPerception = () => {
    if (phase.type !== "course" || !currentLevel) return;
    const nextIndex = phase.position.itemIndex + 1;
    clearReferenceAudioState();
    setPerceptionAnswer(null);
    setActiveSlot(null);
    if (nextIndex < currentItems.length) {
      if (perceptionExtraRemaining > 0) {
        setPerceptionExtraRemaining(currentItems.length - nextIndex);
      }
      setPhase({
        type: "course",
        position: { ...phase.position, itemIndex: nextIndex },
      });
      return;
    }
    const gate = evaluateLevelGate(
      currentLevel,
      levelStats[currentLevel.id] ?? emptySnapshot(currentLevel),
      currentItem,
    );
    if (!gate.passed) {
      const reviewTrials = createFocusedPackPerceptionTrials(
        pack.id,
        `${pack.id}-review-${perceptionTotal.toString()}`,
        missedPerceptionPairIds,
        4,
      );
      setPerceptionTrials(reviewTrials);
      setPerceptionExtraRemaining(reviewTrials.length);
      setGateBlockedReason(
        `${gate.reason} 先完成 4 次跨说话人复听，再重新判断。`,
      );
      setPhase({
        type: "course",
        position: { ...phase.position, itemIndex: 0 },
      });
      return;
    }
    const [aggregateEvidence] = buildGuidedTrainingEvidence({
      sessionId: `${pack.id}-${startedAtRef.current}`,
      languageId,
      pack,
      levels: [
        {
          level: currentLevel,
          snapshot: levelStats[currentLevel.id] ?? emptySnapshot(currentLevel),
        },
      ],
      createdAt: Date.now(),
    });
    if (aggregateEvidence && !appendLearningEvidence(aggregateEvidence)) {
      setLocalSaveWarning(
        "本轮辨音已过线，但聚合 V3 学习证据未能写入本机存储。",
      );
    }
    setPerceptionExtraRemaining(0);
    setGateBlockedReason(null);
    setMissedPerceptionPairIds([]);
    const nextLevel = phase.position.levelIndex + 1;
    if (nextLevel >= course.levels.length) {
      completeSession();
      return;
    }
    setPhase({
      type: "course",
      position: { levelIndex: nextLevel, itemIndex: 0 },
    });
  };

  const submitRecording = async () => {
    if (
      !currentLevel ||
      !currentItem ||
      !recorder.audioBlob ||
      recordingQuality.isAnalyzing ||
      !recordingQuality.report?.canSubmit ||
      azure.isLoading
    ) {
      return;
    }
    const qualityReport = recordingQuality.report;
    if (qualityReport) {
      qualityReportsRef.current = [...qualityReportsRef.current, qualityReport];
    }
    const reference = getCourseItemReference(currentItem);
    const result = await azure.assess(
      recorder.audioBlob,
      reference,
      languageProfile.azureLocale,
    );
    if (!result) return;
    recorder.reset();
    recordingQuality.reset();
    setRemediationStepIndex(0);
    setRemediationAttempt(null);

    const analysis = analyzeAttempt({
      pack,
      item: currentItem,
      result,
      levelKind: currentLevel.kind,
      criterion: currentLevel.criterion,
    });
    const attemptEvidenceSaved = appendLearningEvidence(
      buildGuidedAttemptEvidence({
        sessionId: `${pack.id}-${startedAtRef.current}`,
        languageId,
        pack,
        level: currentLevel,
        item: currentItem,
        targetScore: analysis.targetScore,
        overallScore: analysis.overallScore,
        recordingQualityScore: qualityReport?.score,
        recordingQualityValid: qualityReport?.canSubmit === true,
        alignmentValid: !analysis.usedFallback,
        createdAt: Date.now(),
      }),
    );
    if (!attemptEvidenceSaved) {
      setLocalSaveWarning(
        "本次评分已完成，但原始 V3 学习证据未能写入本机存储。",
      );
    }
    const passed = analysis.passed;
    const nextFailedAttempts = passed ? 0 : failedAttempts + 1;
    const patterns = TRAINING_ERROR_PATTERNS.filter((pattern) =>
      analysis.detectedPatternIds.includes(pattern.id),
    );
    const stuck = !passed && shouldMarkStuck(nextFailedAttempts);
    const attempt: AttemptResult = {
      text: reference,
      targetScore: analysis.targetScore,
      overallScore: analysis.overallScore,
      passed,
      azureResult: result,
      patterns,
      analysis,
    };

    updateLevelStats(currentLevel, analysis.targetScore, passed, stuck, {
      contextId: currentItem.id,
      validSample: qualityReport?.canSubmit === true && !analysis.usedFallback,
      recordingQualityValid: qualityReport?.canSubmit === true,
      alignmentValid: !analysis.usedFallback,
      materialId: currentMaterialId ?? currentItem.id,
      position: currentItem.position,
      novelty: currentMaterialNovelty,
    });
    setFailedAttempts(nextFailedAttempts);
    setLastAttempt(attempt);
    setResults((current) => [...current, attempt]);
    setWorstAttempt((current) =>
      !current || attempt.targetScore < current.targetScore ? attempt : current,
    );
    if (!passed) {
      setFailedItems((current) => [
        ...current,
        {
          itemId: currentItem.id,
          levelId: currentLevel.id,
          levelKind: currentLevel.kind,
          text: reference,
          targetPhonemes: currentItem.targetPhonemes,
          targetScore: analysis.targetScore,
          overallScore: analysis.overallScore,
          patternIds: analysis.detectedPatternIds,
          nextCue: analysis.nextCue,
          passed: false,
          usedFallback: analysis.usedFallback,
          assessmentReliability: reliabilityFromRecordingQuality(
            qualityReport,
            {
              languageId,
            },
          ),
        },
      ]);
    }
    if (stuck) {
      const ids =
        patterns.length > 0
          ? patterns.map((pattern) => pattern.id)
          : ["target-low-overall-high"];
      setStuckPatternIds((current) => [...current, ...ids]);
    }
  };

  const retryCurrent = () => {
    clearReferenceAudioState();
    setLastAttempt(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
  };

  const startRemediationRecording = () => {
    clearReferenceAudioState();
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setRemediationAttempt(null);
    recorder.startRecording();
  };

  const submitRemediationStep = async (remediation: RemediationPath) => {
    if (
      !currentItem ||
      !recorder.audioBlob ||
      recordingQuality.isAnalyzing ||
      !recordingQuality.report?.canSubmit ||
      azure.isLoading ||
      !remediation.steps[remediationStepIndex]
    ) {
      return;
    }
    const step = remediation.steps[remediationStepIndex];
    const qualityReport = recordingQuality.report;
    if (qualityReport) {
      qualityReportsRef.current = [...qualityReportsRef.current, qualityReport];
    }
    const stepItem = itemFromRemediationStep(
      currentItem,
      step,
      remediationStepIndex,
    );
    const reference = getCourseItemReference(stepItem);
    const result = await azure.assess(
      recorder.audioBlob,
      reference,
      languageProfile.azureLocale,
    );
    if (!result) return;
    recorder.reset();
    recordingQuality.reset();
    const analysis = analyzeAttempt({
      pack,
      item: stepItem,
      result,
      levelKind: currentLevel?.kind,
      criterion: currentLevel?.criterion,
    });
    const remediationResult: RemediationAttemptResult = {
      text: reference,
      pathId: remediation.id,
      stepIndex: remediationStepIndex,
      beforeTargetScore: lastAttempt?.targetScore ?? 0,
      targetScore: analysis.targetScore,
      overallScore: analysis.overallScore,
      passed: analysis.passed,
      analysis,
    };
    setRemediationAttempt(remediationResult);
    setRemediationResults((current) => [
      ...current,
      {
        pathId: remediationResult.pathId,
        stepIndex: remediationResult.stepIndex,
        text: remediationResult.text,
        targetPhonemes: stepItem.targetPhonemes,
        beforeTargetScore: remediationResult.beforeTargetScore,
        targetScore: remediationResult.targetScore,
        overallScore: remediationResult.overallScore,
        passed: remediationResult.passed,
        usedFallback: remediationResult.analysis.usedFallback,
      },
    ]);
  };

  const nextRemediationStep = () => {
    setRemediationStepIndex((current) => current + 1);
    setRemediationAttempt(null);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
  };

  const finishRemediation = () => {
    setFailedAttempts(0);
    setLastAttempt(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
  };

  const completeMotorFormation = (evidence: MotorFormationEvidence) => {
    if (currentLevel && currentItem) {
      updateLevelStats(currentLevel, undefined, true, false, {
        contextId: currentItem.id,
        validSample: false,
        recordingQualityValid: true,
        alignmentValid: true,
        materialId: currentMaterialId ?? currentItem.id,
        position: currentItem.position,
        novelty: currentMaterialNovelty,
        ...evidence,
      });
    }
    advance();
  };

  const completeOpenResponse = () => {
    if (!currentLevel || !currentItem || !recorder.audioBlob) return;
    const quality = recordingQuality.report;
    const materialId = currentMaterialId ?? currentItem.id;
    const evidenceSaved = appendLearningEvidence(
      buildTrainingAttemptEvidence({
        id: `${pack.id}-${startedAtRef.current}-${currentItem.id}-open`,
        languageId,
        taskType: "spontaneous-transfer",
        targetUnits: pack.targetPhonemes,
        observations: [
          {
            metric: "task-completion",
            text: "Learner recorded and reviewed an open response; no automatic pronunciation conclusion was produced.",
            source: "task",
          },
        ],
        recordingQuality: {
          status:
            quality == null
              ? "unknown"
              : quality.canSubmit
                ? "good"
                : "invalid",
          score: quality?.score,
          reasons: quality?.issues.map((issue) => issue.title) ?? [
            "Open response quality was not automatically verified.",
          ],
        },
        alignmentQuality: {
          status: "unknown",
          reasons: [
            "Open responses are observations only and do not use reference-text alignment.",
          ],
        },
        calibrationVersion: DEFAULT_CALIBRATION_VERSION,
        createdAt: Date.now(),
        trace: {
          sessionId: `${pack.id}-${startedAtRef.current}`,
          levelId: currentLevel.id,
          materialIds: [materialId],
          criterionKind: "open-response-observation",
          materialRole: currentItem.materialRole,
          novelty: currentMaterialNovelty,
        },
      }),
    );
    updateLevelStats(currentLevel, undefined, false, false, {
      contextId: currentItem.id,
      validSample: false,
      materialId,
      position: currentItem.position,
      novelty: currentMaterialNovelty,
    });
    if (!evidenceSaved) {
      setLocalSaveWarning(
        "表达录音仍保留在当前页面，但原始观察未能写入本机存储。",
      );
    }
    recorder.reset();
    recordingQuality.reset();
    advance();
  };

  const completeNonRecordingItem = completeMotorFormation;
  const shouldShowOpenResponse =
    currentLevel && currentItem?.responseMode === "open-response";
  const shouldShowRecording =
    currentLevel &&
    currentItem &&
    currentItem.responseMode !== "open-response" &&
    !["perception", "articulation"].includes(currentLevel.kind);

  return (
    <div
      className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin"
      data-smoke="pack-runner-page"
    >
      <div className="mb-4 flex flex-wrap items-start gap-3 shrink-0">
        <Link
          href="/drill"
          aria-label="返回训练首页"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer sm:h-8 sm:w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
            {pack.title}
          </h1>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {pack.focus}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4">
        {phase.type === "intro" && (
          <IntroCard
            pack={pack}
            brief={lessonBrief}
            courseMap={courseMap}
            requestedLevelId={requestedLevelId}
            onStart={() => resetSession()}
            onStartLevel={(levelId) => resetSession(levelId)}
          />
        )}

        {phase.type === "course" && currentLevel && currentItem && (
          <>
            <CourseHeader
              pack={pack}
              level={currentLevel}
              progressText={progressText}
              levelIndex={phase.position.levelIndex}
              brief={lessonBrief}
            />

            <details
              className="overflow-hidden rounded-xl border bg-card shadow-sm"
              data-smoke="pack-runner-course-map-collapsible"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  查看完整课程地图
                </span>
                <Badge variant="secondary" className={WRAP_SAFE_BADGE_CLASS}>
                  {courseMap?.passedLevels ?? 0}/{courseMap?.totalLevels ?? 0}{" "}
                  已过
                </Badge>
              </summary>
              <CourseMapPanel
                map={courseMap}
                compact
                onStartLevel={(levelId) => resetSession(levelId)}
              />
            </details>

            {currentLevel.kind !== "perception" && (
              <CoachMissionCard
                level={currentLevel}
                item={currentItem}
                snapshot={currentSnapshot}
                failedAttempts={failedAttempts}
                lastAttempt={lastAttempt}
                isFocusedReview={focusedReviewItems.length > 0}
              />
            )}

            {gateBlockedReason && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="font-semibold">本关还没有真正过线</p>
                <p className="mt-1">{gateBlockedReason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setGateBlockedReason(null)}
                    className="cursor-pointer"
                  >
                    继续补本关
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={skipBlockedGate}
                    className="cursor-pointer"
                  >
                    暂时跳过，不计入正式证据
                  </Button>
                </div>
              </div>
            )}

            {currentLevel.kind === "perception" && (
              <PerceptionStep
                item={currentItem}
                activeSlot={activeSlot}
                xIsA={xIsA}
                answer={perceptionAnswer}
                correct={perceptionCorrect}
                total={perceptionTotal}
                extraRemaining={perceptionExtraRemaining}
                onPlaySlot={playSlot}
                onAnswer={answerPerception}
                onNext={nextPerception}
                isPlaying={wordAudio.isPlaying}
                audioError={wordAudio.error}
              />
            )}
            {currentLevel.kind === "perception" && (
              <CoachMissionCard
                level={currentLevel}
                item={currentItem}
                snapshot={currentSnapshot}
                failedAttempts={failedAttempts}
                lastAttempt={lastAttempt}
                isFocusedReview={focusedReviewItems.length > 0}
              />
            )}

            {currentLevel.kind === "articulation" && (
              <ArticulationStep
                level={currentLevel}
                item={currentItem}
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
                isRecording={recorder.isRecording}
                recorderError={recorder.error}
                isReferencePlaying={wordAudio.isPlaying || tts.isPlaying}
                onPlayReference={playReference}
                onStartRecording={() => {
                  clearReferenceAudioState();
                  recorder.startRecording();
                }}
                onStopRecording={recorder.stopRecording}
                onResetRecording={recorder.reset}
                onNext={completeNonRecordingItem}
              />
            )}

            {shouldShowOpenResponse && currentItem && (
              <OpenResponseStep
                item={currentItem}
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
                isRecording={recorder.isRecording}
                recorderError={recorder.error}
                qualityReport={recordingQuality.report}
                isAnalyzingQuality={recordingQuality.isAnalyzing}
                onStartRecording={() => {
                  clearReferenceAudioState();
                  recorder.startRecording();
                }}
                onStopRecording={recorder.stopRecording}
                onResetRecording={recorder.reset}
                onComplete={completeOpenResponse}
              />
            )}

            {shouldShowRecording && currentSnapshot && (
              <RecordingStep
                pack={pack}
                level={currentLevel}
                scoringAvailable={scoringAvailable}
                allowReferencePlayback={currentLevel.kind !== "transfer"}
                item={currentItem}
                threshold={criterionTargetScore(currentLevel)}
                failedAttempts={failedAttempts}
                lastAttempt={lastAttempt}
                remediation={
                  lastAttempt ? fallbackPath(lastAttempt.patterns, pack) : null
                }
                remediationStepIndex={remediationStepIndex}
                remediationAttempt={remediationAttempt}
                isRecording={recorder.isRecording}
                isAssessing={azure.isLoading}
                isPlaying={wordAudio.isPlaying || tts.isPlaying}
                isLoadingReference={wordAudio.isLoading || tts.isLoading}
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
                qualityReport={recordingQuality.report}
                isAnalyzingQuality={recordingQuality.isAnalyzing}
                referenceError={wordAudio.error ?? tts.error}
                assessmentError={recorder.error ?? azure.error}
                onPlayReference={playReference}
                onPlayRemediationText={playRemediationText}
                onStartRecording={() => {
                  clearReferenceAudioState();
                  recorder.reset();
                  recordingQuality.reset();
                  azure.reset();
                  recorder.startRecording();
                }}
                onStopRecording={() => recorder.stopRecording()}
                onSubmit={submitRecording}
                onStartRemediationRecording={startRemediationRecording}
                onSubmitRemediationStep={submitRemediationStep}
                onNextRemediationStep={nextRemediationStep}
                onFinishRemediation={finishRemediation}
                onRetry={retryCurrent}
                onContinue={advance}
                onContinueUnscored={() => {
                  recorder.reset();
                  recordingQuality.reset();
                  skipBlockedGate();
                }}
              />
            )}
          </>
        )}

        {phase.type === "completed" && (
          <CompletedStep
            pack={pack}
            summary={phase.summary}
            worstAttempt={worstAttempt}
            llm={llm}
            languageId={languageId}
            localSaveWarning={localSaveWarning}
            onRestart={() => setPhase({ type: "intro" })}
            onStartLevel={(levelId) => resetSession(levelId)}
          />
        )}
      </div>
    </div>
  );
}

function IntroCard({
  pack,
  brief,
  courseMap,
  requestedLevelId,
  onStart,
  onStartLevel,
}: {
  pack: TrainingPack;
  brief: LessonBrief | null;
  courseMap: CourseMapSummary | null;
  requestedLevelId?: string | null;
  onStart: () => void;
  onStartLevel: (levelId: string) => void;
}) {
  const requestedLevel = pack.course?.levels.find(
    (level) => level.id === requestedLevelId,
  );
  const redirected = courseMap?.redirectedByGate;
  return (
    <motion.div
      data-smoke="pack-runner-intro-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap gap-2">
        {pack.targetPhonemes.map((phoneme) => (
          <Badge
            key={phoneme}
            variant="secondary"
            className={WRAP_SAFE_BADGE_CLASS}
            data-smoke="pack-runner-intro-phoneme-badge"
          >
            {formatTrainingTargetUnit(phoneme)}
          </Badge>
        ))}
        <Badge
          variant="outline"
          className={WRAP_SAFE_BADGE_CLASS}
          data-smoke="pack-runner-intro-meta-badge"
        >
          {pack.estimatedMinutes} 分钟
        </Badge>
        <Badge
          variant="outline"
          className={WRAP_SAFE_BADGE_CLASS}
          data-smoke="pack-runner-intro-meta-badge"
        >
          {pack.course?.levels.length ?? 0} 个关卡
        </Badge>
        {requestedLevel && !redirected && (
          <Badge
            variant="default"
            className={WRAP_SAFE_BADGE_CLASS}
            data-smoke="pack-runner-requested-level-badge"
          >
            从 {requestedLevel.title} 开始
          </Badge>
        )}
        {redirected && (
          <Badge
            variant="secondary"
            className={WRAP_SAFE_BADGE_CLASS}
            data-smoke="pack-runner-redirected-level-badge"
          >
            先补 {courseMap.startLevelTitle}
          </Badge>
        )}
      </div>
      <h2 className="mt-4 break-words text-xl font-bold [overflow-wrap:anywhere]">
        {brief?.headline ?? "教练式微课程"}
      </h2>
      <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {brief?.reason ??
          "听辨 → 动作 → 音节 → 单词 → 对比 → 句子 → 影子跟读 → 混合复测。失败会进入慢速拆解，训练总结会记录 stuck 错因。"}
      </p>
      <Button
        onClick={onStart}
        size="lg"
        className="mt-4 min-h-11 w-full cursor-pointer sm:w-auto"
      >
        {brief?.nextActionLabel ?? "开始本轮训练"}
      </Button>
      {courseMap?.redirectedByGate && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">已自动回到前置关卡</p>
          <p className="mt-1">{courseMap.gateReason}</p>
        </div>
      )}
      <details className="mt-4 rounded-xl border bg-muted/10">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-semibold">
          查看课程说明、常见难点与完整路线
        </summary>
        {brief && (
          <div className="grid gap-3 border-t p-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">课前任务单</p>
              </div>
              <div className="mt-3 grid gap-2">
                {brief.warmupSteps.map((step, index) => (
                  <div key={step} className="flex gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">通过标准</p>
              </div>
              <div className="mt-3 space-y-2">
                {brief.successCriteria.map((criterion) => (
                  <p key={criterion} className="text-sm text-muted-foreground">
                    {criterion}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 rounded-lg bg-muted/40 p-4">
          <p className="text-sm font-semibold">常见母语干扰</p>
          <p className="mt-1 text-sm text-muted-foreground">{pack.l1Problem}</p>
        </div>
        {brief && brief.risks.length > 0 && (
          <div className="mt-4 rounded-lg border bg-background p-4">
            <p className="text-sm font-semibold">这节课重点防的错因</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {brief.risks.map((risk) => (
                <div key={risk.id} className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{risk.title}</p>
                    {risk.active && (
                      <Badge
                        variant="destructive"
                        className={WRAP_SAFE_BADGE_CLASS}
                        data-smoke="pack-runner-risk-badge"
                      >
                        近期出现
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {risk.cue}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <CourseMapPanel map={courseMap} onStartLevel={onStartLevel} />
      </details>
    </motion.div>
  );
}

function courseMapStatusLabel(status: CourseLevelMapStatus): string {
  const labels: Record<CourseLevelMapStatus, string> = {
    current: "当前",
    due: "复习",
    "needs-work": "卡点",
    passed: "已过",
    locked: "先补",
    new: "未练",
  };
  return labels[status];
}

function courseMapStatusClass(status: CourseLevelMapStatus): string {
  const classes: Record<CourseLevelMapStatus, string> = {
    current: "border-primary bg-primary/10 ring-1 ring-primary/30",
    due: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    "needs-work": "border-destructive/30 bg-destructive/5",
    passed: "border-primary/25 bg-primary/5",
    locked: "border-dashed bg-muted/35 text-muted-foreground",
    new: "bg-background",
  };
  return classes[status];
}

function CourseMapPanel({
  map,
  compact = false,
  onStartLevel,
}: {
  map: CourseMapSummary | null;
  compact?: boolean;
  onStartLevel?: (levelId: string) => void;
}) {
  if (!map) return null;

  return (
    <div
      data-smoke="pack-runner-course-map"
      className={cn(
        "rounded-xl border bg-card shadow-sm",
        compact ? "p-3" : "mt-4 p-4",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">课程关卡地图</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{map.guidance}</p>
        </div>
        <div className="min-w-[160px]">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {map.passedLevels}/{map.totalLevels} 已过
            </span>
            <span>{map.completionPercent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${map.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-3 grid gap-2",
          compact
            ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-8"
            : "md:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {map.levels.map((level) => (
          <CourseMapLevelCard
            key={level.id}
            level={level}
            compact={compact}
            onStartLevel={onStartLevel}
          />
        ))}
      </div>
    </div>
  );
}

function CourseMapLevelCard({
  level,
  compact,
  onStartLevel,
}: {
  level: CourseLevelMapItem;
  compact: boolean;
  onStartLevel?: (levelId: string) => void;
}) {
  const hasWarning =
    level.status === "due" ||
    level.status === "needs-work" ||
    level.status === "locked";

  return (
    <button
      type="button"
      onClick={() => onStartLevel?.(level.startLevelId)}
      className={cn(
        "min-h-[116px] rounded-lg border p-3 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
        compact && "min-h-[104px] p-2.5",
        courseMapStatusClass(level.status),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold shadow-sm">
          {level.index + 1}
        </span>
        <Badge
          variant={
            level.status === "needs-work"
              ? "destructive"
              : level.status === "passed"
                ? "secondary"
                : "outline"
          }
          className={WRAP_SAFE_BADGE_CLASS}
          data-smoke="pack-runner-course-map-status-badge"
        >
          {courseMapStatusLabel(level.status)}
        </Badge>
      </div>
      <p className="mt-2 break-words text-sm font-semibold [overflow-wrap:anywhere]">
        {level.title}
      </p>
      <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {level.passRuleText}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-1 text-[11px] text-muted-foreground">
        {level.bestScore > 0 && <span>最佳 {level.bestScore}</span>}
        {level.attempts > 0 && <span>{level.attempts} 次</span>}
        {level.dueTaskCount > 0 && <span>复习 {level.dueTaskCount}</span>}
        {level.stuckCount > 0 && <span>卡点 {level.stuckCount}</span>}
        {level.lockedByLevelId && <span>先补 #{level.lockedByLevelId}</span>}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-center gap-1.5 text-center text-xs text-muted-foreground">
          {hasWarning ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <p className="break-words [overflow-wrap:anywhere]">
            {level.lockReason ?? level.reviewReason ?? level.coachCue}
          </p>
        </div>
      )}
    </button>
  );
}

function CourseHeader({
  pack,
  level,
  progressText,
  levelIndex,
  brief,
}: {
  pack: TrainingPack;
  level: TrainingLevel;
  progressText: string;
  levelIndex: number;
  brief: LessonBrief | null;
}) {
  const levels = pack.course?.levels ?? [];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{progressText}</p>
          <h2 className="text-lg font-bold">{level.title}</h2>
          <p className="text-sm text-muted-foreground">{level.goal}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {brief && (
            <Badge
              variant="outline"
              className={WRAP_SAFE_BADGE_CLASS}
              data-smoke="pack-runner-course-header-badge"
            >
              预计剩余 {brief.estimatedMinutes} 分钟
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={WRAP_SAFE_BADGE_CLASS}
            data-smoke="pack-runner-course-header-badge"
          >
            {describeTrainingCriterion(level)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 md:grid-cols-8">
        {levels.map((courseLevel, index) => (
          <div
            key={courseLevel.id}
            className={cn(
              "h-2 rounded-full",
              index < levelIndex
                ? "bg-primary"
                : index === levelIndex
                  ? "bg-primary/60"
                  : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function passRuleText(level: TrainingLevel): string {
  return describeTrainingCriterion(level);
}

function CoachMissionCard({
  level,
  item,
  snapshot,
  failedAttempts,
  lastAttempt,
  isFocusedReview,
}: {
  level: TrainingLevel;
  item: TrainingCourseItem;
  snapshot: CourseAttemptSnapshot | null;
  failedAttempts: number;
  lastAttempt: AttemptResult | null;
  isFocusedReview: boolean;
}) {
  const nextCue = lastAttempt?.analysis.nextCue ?? item.successCue;
  const passText = passRuleText(level);
  const attempts = snapshot?.attempts ?? 0;
  const passedCount = snapshot?.passedCount ?? 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            这一题只练
          </p>
          <p className="mt-1 text-sm font-medium">{item.focusPoint}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            目标音：
            {item.targetPhonemes.map(formatTrainingTargetUnit).join(" – ")}
            {item.position ? ` · 位置：${item.position}` : ""}
          </p>
        </div>

        <div className="rounded-lg bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            下一次只改
          </p>
          <p className="mt-1 text-sm font-medium text-primary">{nextCue}</p>
          {failedAttempts > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              已尝试 {failedAttempts} 次，连续 2 次未过线会进入慢速拆解。
            </p>
          )}
        </div>

        <div className="rounded-lg bg-background p-3 ring-1 ring-border">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              通过条件
            </p>
            {isFocusedReview && (
              <Badge
                variant="destructive"
                className={WRAP_SAFE_BADGE_CLASS}
                data-smoke="pack-runner-focused-review-badge"
              >
                专项复练
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm font-medium">{passText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {attempts === 0
              ? "尚未作答"
              : `本关已过 ${passedCount}/${attempts} 题`}
            {snapshot && snapshot.scores.length > 0
              ? ` · 最佳 ${Math.max(...snapshot.scores)}`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function PerceptionStep({
  item,
  activeSlot,
  xIsA,
  answer,
  correct,
  total,
  extraRemaining,
  onPlaySlot,
  onAnswer,
  onNext,
  isPlaying,
  audioError,
}: {
  item: TrainingCourseItem;
  activeSlot: ActiveSlot;
  xIsA: boolean;
  answer: boolean | null;
  correct: number;
  total: number;
  extraRemaining: number;
  onPlaySlot: (slot: ActiveSlot) => void;
  onAnswer: (answeredA: boolean) => void;
  onNext: () => void;
  isPlaying: boolean;
  audioError: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="text-center">
        <Ear className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="text-lg font-bold">先听准，再说准</h2>
        <p className="mt-1 text-sm text-muted-foreground">{item.focusPoint}</p>
        {extraRemaining > 0 && (
          <Badge
            variant="destructive"
            className={`${WRAP_SAFE_BADGE_CLASS} mt-3`}
            data-smoke="pack-runner-perception-extra-badge"
          >
            听辨未过，专项复听还剩 {extraRemaining} 题
          </Badge>
        )}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {(["A", "B", "X"] as const).map((slot) => (
          <motion.button
            key={slot}
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlaySlot(slot)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer",
              activeSlot === slot && isPlaying
                ? "border-primary bg-primary/5"
                : "hover:border-primary/40",
            )}
          >
            <Volume2 className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">{slot}</span>
          </motion.button>
        ))}
      </div>
      {audioError && (
        <p
          role="alert"
          data-smoke="pack-runner-perception-audio-error"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {audioError}
        </p>
      )}
      {answer === null ? (
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => onAnswer(true)}
            variant="outline"
            className="min-h-11 flex-1 cursor-pointer"
          >
            X = A
          </Button>
          <Button
            onClick={() => onAnswer(false)}
            variant="outline"
            className="min-h-11 flex-1 cursor-pointer"
          >
            X = B
          </Button>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <div
            className={cn(
              "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
              answer ? "bg-primary/10" : "bg-red-100",
            )}
          >
            {answer ? (
              <Check className="h-6 w-6 text-primary" />
            ) : (
              <X className="h-6 w-6 text-red-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            X = {xIsA ? "A" : "B"} · 当前 {correct}/{Math.max(total, 1)}
          </p>
          <Button onClick={onNext} className="mt-3 cursor-pointer">
            下一题
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function ArticulationStep({
  level,
  item,
  audioBlob,
  stream,
  isRecording,
  recorderError,
  isReferencePlaying,
  onPlayReference,
  onStartRecording,
  onStopRecording,
  onResetRecording,
  onNext,
}: {
  level: TrainingLevel;
  item: TrainingCourseItem;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  isRecording: boolean;
  recorderError: string | null;
  isReferencePlaying: boolean;
  onPlayReference: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onResetRecording: () => void;
  onNext: (evidence: MotorFormationEvidence) => void;
}) {
  const itemText = item.displayText ?? item.text;
  const itemDensity = getPracticeTextDensity(itemText);

  const motorChecks = [
    "舌位与目标音提示一致",
    "双唇和下颌没有额外用力",
    "能感受到两个目标音的音质差异",
  ];
  const [completedChecks, setCompletedChecks] = useState<Set<number>>(
    new Set(),
  );
  const [recordedSampleCount, setRecordedSampleCount] = useState(0);
  const [referencePlayed, setReferencePlayed] = useState(false);
  const [learnerPlayed, setLearnerPlayed] = useState(false);
  const [learnerAudioUrl, setLearnerAudioUrl] = useState<string | null>(null);
  const countedBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!audioBlob) {
      setLearnerAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setLearnerAudioUrl(url);
    setLearnerPlayed(false);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const playbackComparisonCompleted = referencePlayed && learnerPlayed;
  const motorCriterion =
    level.criterion.kind === "motor-formation"
      ? level.criterion
      : {
          kind: "motor-formation" as const,
          minSelfChecks: 3,
          minRecordedSamples: 2,
          requirePlaybackComparison: true,
        };
  const motorEvidence: MotorFormationEvidence = {
    completedSelfChecks: completedChecks.size,
    recordedSampleCount,
    playbackComparisonCompleted,
  };
  const motorGate = evaluateTrainingCriterion(motorCriterion, motorEvidence);

  const countCurrentRecording = () => {
    if (!audioBlob || countedBlobRef.current === audioBlob) return;
    countedBlobRef.current = audioBlob;
    setRecordedSampleCount((current) => current + 1);
  };

  const toggleCheck = (index: number) => {
    setCompletedChecks((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <Badge
        variant="secondary"
        className={WRAP_SAFE_BADGE_CLASS}
        data-smoke="pack-runner-level-title-badge"
      >
        {level.title}
      </Badge>
      <h2
        className={`${getCenteredProminentTextClassName(
          itemDensity,
        )} mt-4 font-bold`}
      >
        {itemText}
      </h2>
      <p className="mx-auto mt-3 max-w-xl break-words text-center text-base leading-relaxed [overflow-wrap:anywhere]">
        {item.focusPoint}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-600">常见错误</p>
          <p className="mt-1 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {item.commonMistake}
          </p>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">通过感觉</p>
          <p className="mt-1 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {item.successCue}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <p className="font-semibold">动作自检</p>
          <div className="mt-3 space-y-2">
            {motorChecks.map((label, index) => {
              const checked = completedChecks.has(index);
              return (
                <label
                  key={label}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-left hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleCheck(index)}
                  />
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      checked &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-sm">{label}</span>
                </label>
              );
            })}
          </div>
        </section>
        <section className="rounded-lg border p-4">
          <p className="font-semibold">录音并交替比较</p>
          <p className="mt-1 text-sm text-muted-foreground">
            至少录制两段，并分别听过示范和自己的录音；这里只确认完成动作练习，不判断舌位一定正确。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setReferencePlayed(true);
                onPlayReference();
              }}
              disabled={isReferencePlaying}
            >
              <Volume2 className="mr-2 h-4 w-4" />
              {isReferencePlaying ? "播放中" : "听示范"}
            </Button>
            <RecordButton
              isRecording={isRecording}
              onStart={onStartRecording}
              onStop={onStopRecording}
            />
            <span className="text-sm text-muted-foreground">
              已记录 {recordedSampleCount}/2
            </span>
          </div>
          <WaveformDisplay audioBlob={audioBlob} stream={stream} />
          {learnerAudioUrl && (
            // biome-ignore lint/a11y/useMediaCaption: Learner recordings have no known transcript.
            <audio
              className="mt-3 w-full"
              controls
              src={learnerAudioUrl}
              onPlay={() => setLearnerPlayed(true)}
              aria-label="播放本人练习录音"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={!audioBlob || countedBlobRef.current === audioBlob}
              onClick={countCurrentRecording}
            >
              计入本段录音
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isRecording}
              onClick={onResetRecording}
            >
              重新录制
            </Button>
          </div>
          {recorderError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {recorderError}
            </p>
          )}
        </section>
      </div>
      {!motorGate.passed && (
        <p className="mt-4 text-sm text-muted-foreground">
          {motorGate.blockers[0]}
        </p>
      )}

      <Button
        onClick={() => onNext(motorEvidence)}
        disabled={!motorGate.passed}
        className="mt-5 min-h-11 cursor-pointer"
      >
        我能做出这个动作，下一步
      </Button>
    </motion.div>
  );
}

function OpenResponseStep({
  item,
  audioBlob,
  stream,
  isRecording,
  recorderError,
  qualityReport,
  isAnalyzingQuality,
  onStartRecording,
  onStopRecording,
  onResetRecording,
  onComplete,
}: {
  item: TrainingCourseItem;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  isRecording: boolean;
  recorderError: string | null;
  qualityReport: RecordingQualityReport | null;
  isAnalyzingQuality: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onResetRecording: () => void;
  onComplete: () => void;
}) {
  const [learnerAudioUrl, setLearnerAudioUrl] = useState<string | null>(null);
  const [learnerPlayed, setLearnerPlayed] = useState(false);

  useEffect(() => {
    if (!audioBlob) {
      setLearnerAudioUrl(null);
      setLearnerPlayed(false);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setLearnerAudioUrl(url);
    setLearnerPlayed(false);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const canComplete =
    !!audioBlob &&
    learnerPlayed &&
    qualityReport?.canSubmit === true &&
    !isAnalyzingQuality;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
      data-smoke="pack-runner-open-response"
    >
      <Badge variant="secondary" className={WRAP_SAFE_BADGE_CLASS}>
        引导表达
      </Badge>
      <h2 className="mt-4 text-xl font-bold">用自己的话完成表达</h2>
      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed">
        {item.displayText ?? item.text}
      </p>
      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">先独立表达，不播放标准答案</p>
        <p className="mt-1 text-muted-foreground">
          这段录音只保存为迁移观察，不做文本对齐，也不会凭单次表达生成“已掌握”结论。
        </p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <RecordButton
          isRecording={isRecording}
          onStart={onStartRecording}
          onStop={onStopRecording}
          disabled={isAnalyzingQuality}
        />
        <WaveformDisplay audioBlob={audioBlob} stream={stream} />
        {isAnalyzingQuality && (
          <p className="text-xs text-muted-foreground">正在检查录音质量...</p>
        )}
        <RecordingQualityPanel report={qualityReport} compact />
        {learnerAudioUrl && (
          // biome-ignore lint/a11y/useMediaCaption: Learner recordings have no known transcript.
          <audio
            className="w-full max-w-xl"
            controls
            src={learnerAudioUrl}
            onPlay={() => setLearnerPlayed(true)}
            aria-label="播放本人的引导表达录音"
          />
        )}
        {audioBlob && !learnerPlayed && (
          <p className="text-sm text-muted-foreground">
            请先完整听一次自己的录音，再确认完成。
          </p>
        )}
        {recorderError && (
          <p role="alert" className="text-sm text-destructive">
            {recorderError}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isRecording}
            onClick={() => {
              setLearnerPlayed(false);
              onResetRecording();
            }}
          >
            重新录制
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!canComplete}
            onClick={onComplete}
          >
            保存观察并完成本轮
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function RecordingStep({
  pack,
  level,
  scoringAvailable,
  allowReferencePlayback,
  item,
  threshold,
  failedAttempts,
  lastAttempt,
  remediation,
  remediationStepIndex,
  remediationAttempt,
  isRecording,
  isAssessing,
  isPlaying,
  isLoadingReference,
  audioBlob,
  stream,
  qualityReport,
  isAnalyzingQuality,
  referenceError,
  assessmentError,
  onPlayReference,
  onPlayRemediationText,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onStartRemediationRecording,
  onSubmitRemediationStep,
  onNextRemediationStep,
  onFinishRemediation,
  onRetry,
  onContinue,
  onContinueUnscored,
}: {
  pack: TrainingPack;
  level: TrainingLevel;
  scoringAvailable: boolean;
  allowReferencePlayback: boolean;
  item: TrainingCourseItem;
  threshold: number;
  failedAttempts: number;
  lastAttempt: AttemptResult | null;
  remediation: RemediationPath | null;
  remediationStepIndex: number;
  remediationAttempt: RemediationAttemptResult | null;
  isRecording: boolean;
  isAssessing: boolean;
  isPlaying: boolean;
  isLoadingReference: boolean;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  qualityReport: RecordingQualityReport | null;
  isAnalyzingQuality: boolean;
  referenceError: string | null;
  assessmentError: string | null;
  onPlayReference: () => void;
  onPlayRemediationText: (text: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmit: () => void;
  onStartRemediationRecording: () => void;
  onSubmitRemediationStep: (remediation: RemediationPath) => void;
  onNextRemediationStep: () => void;
  onFinishRemediation: () => void;
  onRetry: () => void;
  onContinue: () => void;
  onContinueUnscored: () => void;
}) {
  const showRemediation =
    lastAttempt &&
    !lastAttempt.passed &&
    shouldEnterRemediation(failedAttempts);
  const canContinue = lastAttempt?.passed || failedAttempts >= 3;
  const currentRemediationStep = remediation?.steps[remediationStepIndex];
  const remediationDone =
    !!remediation &&
    remediationAttempt?.passed &&
    remediationStepIndex >= remediation.steps.length - 1;
  const scoreDisabled =
    !!audioBlob && (isAnalyzingQuality || !qualityReport?.canSubmit);
  const deepCoach = lastAttempt
    ? buildDeepPracticeCoach({
        pack,
        item,
        analysis: lastAttempt.analysis,
        failedAttempts,
      })
    : null;
  const itemText = item.displayText ?? item.text;
  const itemDensity = getPracticeTextDensity(itemText);
  const ipaDensity = getPracticeTextDensity(item.ipa ?? "", "phrase");
  const scoreButtonLabel = assessmentError ? "重新评分" : "提交评分";
  const remediationScoreButtonLabel = assessmentError
    ? "重新评分这一步"
    : "给这一步评分";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 text-center shadow-sm"
    >
      <Badge
        variant="secondary"
        className={WRAP_SAFE_BADGE_CLASS}
        data-smoke="pack-runner-level-title-badge"
      >
        {level.title}
      </Badge>
      <h2
        className={`${getCenteredProminentTextClassName(
          itemDensity,
        )} mt-4 font-bold`}
      >
        {itemText}
      </h2>
      {item.ipa && (
        <p
          className={`${getCenteredMonoTextClassName(
            ipaDensity,
          )} mt-2 font-mono text-muted-foreground`}
        >
          {item.ipa}
        </p>
      )}
      <p className="mx-auto mt-3 max-w-xl break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {item.focusPoint}
      </p>

      {allowReferencePlayback ? (
        <>
          <motion.button
            type="button"
            aria-label="播放标准示范"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlayReference}
            disabled={isLoadingReference}
            className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer disabled:opacity-50"
          >
            {isLoadingReference ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </motion.button>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPlaying ? "正在播放..." : "听标准发音"}
          </p>
          {referenceError && (
            <p
              role="alert"
              data-smoke="pack-runner-reference-audio-error"
              className="mx-auto mt-3 max-w-md rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {referenceError}
            </p>
          )}
        </>
      ) : (
        <div
          role="note"
          data-smoke="pack-runner-transfer-no-reference"
          className="mx-auto mt-5 max-w-xl rounded-lg border border-primary/20 bg-primary/5 p-3 text-left text-sm"
        >
          <p className="font-semibold">本题先不播放示范</p>
          <p className="mt-1 text-muted-foreground">
            这是未训练材料迁移检查。先独立录音；完成本轮后再进入补练，不用答案提示污染第一次证据。
          </p>
        </div>
      )}
      {!scoringAvailable && (
        <div
          role="note"
          className="mx-auto mt-4 max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <p className="font-semibold">当前未连接 Azure 评分</p>
          <p className="mt-1">
            {allowReferencePlayback
              ? "你仍可听示范、录音并点击波形回放；这次练习不会写入正式学习阶段。"
              : "你仍可完成首次录音和回放；没有自动评分时只保存练习，不生成迁移结论。"}
          </p>
        </div>
      )}

      {!showRemediation && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <RecordButton
            isRecording={isRecording}
            onStart={onStartRecording}
            onStop={onStopRecording}
            disabled={isAssessing}
          />
          <WaveformDisplay audioBlob={audioBlob} stream={stream} />
          {isAnalyzingQuality && (
            <p className="text-xs text-muted-foreground">正在检查录音质量...</p>
          )}
          <RecordingQualityPanel report={qualityReport} compact />
          {audioBlob &&
            !isRecording &&
            !isAssessing &&
            !lastAttempt &&
            (scoringAvailable ? (
              <Button
                onClick={onSubmit}
                disabled={scoreDisabled}
                data-smoke="pack-runner-submit-score"
                className="gap-2 cursor-pointer"
              >
                {assessmentError ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {scoreButtonLabel}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onContinueUnscored}
                data-smoke="pack-runner-continue-unscored"
                className="min-h-11 cursor-pointer"
              >
                不评分，继续下一关
              </Button>
            ))}
          {isAssessing && (
            <p className="text-sm text-muted-foreground">
              正在按目标音素评分...
            </p>
          )}
          {assessmentError && (
            <p
              role="alert"
              data-smoke="pack-runner-assessment-error"
              className="mx-auto max-w-md break-words text-sm text-destructive [overflow-wrap:anywhere]"
            >
              {assessmentError}
            </p>
          )}
        </div>
      )}

      {lastAttempt && (
        <div className="mt-6 rounded-xl border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreTile
              label="目标音素分"
              value={lastAttempt.targetScore}
              passed={lastAttempt.passed}
            />
            <ScoreTile
              label="整词/整句分"
              value={lastAttempt.overallScore}
              passed={lastAttempt.overallScore >= threshold}
            />
          </div>
          {lastAttempt.passed ? (
            <p className="mt-3 text-sm font-medium text-primary">
              达标。目标音已经过线，可以进入下一层。
            </p>
          ) : (
            <div className="mt-3 text-sm font-medium text-red-500">
              未达标：目标音素需要 {threshold} 分。第 {failedAttempts}/3
              次尝试。
            </div>
          )}
          {lastAttempt.patterns.length > 0 && (
            <div className="mt-4 rounded-lg border bg-background p-3 text-center text-sm">
              <p className="font-semibold">识别到的错因</p>
              <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
                {lastAttempt.patterns[0].coachExplanation}
              </p>
              <p className="mt-2 break-words font-medium text-primary [overflow-wrap:anywhere]">
                下一次只改：{lastAttempt.analysis.nextCue}
              </p>
              {lastAttempt.analysis.scoreGap >= 12 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  整体分比目标音高 {lastAttempt.analysis.scoreGap}{" "}
                  分，说明句子能听懂， 但关键动作还没稳定。
                </p>
              )}
            </div>
          )}
          {!lastAttempt.passed && lastAttempt.patterns.length === 0 && (
            <div className="mt-4 rounded-lg border bg-background p-3 text-center text-sm">
              <p className="font-semibold">下一次只改一个动作</p>
              <p className="mt-1 break-words text-primary [overflow-wrap:anywhere]">
                {lastAttempt.analysis.nextCue}
              </p>
            </div>
          )}
          {deepCoach && <DeepPracticeCoachPanel coach={deepCoach} />}
          {showRemediation && remediation && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm dark:border-red-900 dark:bg-red-950/20">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <p className="break-words font-semibold text-red-700 dark:text-red-400 [overflow-wrap:anywhere]">
                  {remediation.title}
                </p>
                <Badge
                  variant="outline"
                  className={WRAP_SAFE_BADGE_CLASS}
                  data-smoke="pack-runner-remediation-step-badge"
                >
                  {remediationStepIndex + 1}/{remediation.steps.length}
                </Badge>
              </div>
              {currentRemediationStep && (
                <div className="mt-3 rounded-lg bg-background/85 p-3">
                  <p className="break-words font-medium [overflow-wrap:anywhere]">
                    {currentRemediationStep.prompt}
                  </p>
                  <p
                    className={`${getCenteredReadableTextClassName(
                      getPracticeTextDensity(
                        currentRemediationStep.text,
                        "phrase",
                      ),
                    )} mt-1 text-muted-foreground`}
                  >
                    {currentRemediationStep.text}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onPlayRemediationText(
                          currentRemediationStep.playbackText ??
                            currentRemediationStep.referenceText ??
                            currentRemediationStep.text,
                        )
                      }
                      className="h-8 gap-1 cursor-pointer"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      听这一步
                    </Button>
                    <RecordButton
                      isRecording={isRecording}
                      onStart={onStartRemediationRecording}
                      onStop={onStopRecording}
                      disabled={isAssessing}
                    />
                  </div>
                  <WaveformDisplay audioBlob={audioBlob} stream={stream} />
                  {isAnalyzingQuality && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      正在检查录音质量...
                    </p>
                  )}
                  <div className="mt-2">
                    <RecordingQualityPanel report={qualityReport} compact />
                  </div>
                  {audioBlob &&
                    !isRecording &&
                    !isAssessing &&
                    !remediationAttempt && (
                      <Button
                        onClick={() => onSubmitRemediationStep(remediation)}
                        disabled={scoreDisabled}
                        size="sm"
                        data-smoke="pack-runner-remediation-submit-score"
                        className="mt-2 gap-2 cursor-pointer"
                      >
                        {assessmentError ? (
                          <RotateCcw className="h-4 w-4" />
                        ) : (
                          <Mic className="h-4 w-4" />
                        )}
                        {remediationScoreButtonLabel}
                      </Button>
                    )}
                  {isAssessing && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      正在检查补救动作...
                    </p>
                  )}
                  {assessmentError && (
                    <p
                      role="alert"
                      data-smoke="pack-runner-assessment-error"
                      className="mx-auto mt-2 max-w-md break-words text-sm text-destructive [overflow-wrap:anywhere]"
                    >
                      {assessmentError}
                    </p>
                  )}
                  {remediationAttempt && (
                    <div className="mt-3 rounded-md border bg-background p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ScoreTile
                          label="补救目标音"
                          value={remediationAttempt.targetScore}
                          passed={remediationAttempt.passed}
                        />
                        <ScoreTile
                          label="整体分"
                          value={remediationAttempt.overallScore}
                          passed={remediationAttempt.overallScore >= threshold}
                        />
                      </div>
                      <p
                        className={cn(
                          "mt-2 break-words text-center text-sm font-medium [overflow-wrap:anywhere]",
                          remediationAttempt.passed
                            ? "text-primary"
                            : "text-red-500",
                        )}
                      >
                        {remediationAttempt.passed
                          ? "这一步过线了。"
                          : `这一步还没稳：${remediationAttempt.analysis.nextCue}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!remediationAttempt.passed && (
                          <Button
                            onClick={onStartRemediationRecording}
                            size="sm"
                            variant="outline"
                            className="gap-2 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            重练这一步
                          </Button>
                        )}
                        {remediationAttempt.passed && !remediationDone && (
                          <Button
                            onClick={onNextRemediationStep}
                            size="sm"
                            className="gap-2 cursor-pointer"
                          >
                            下一步补救
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {remediationDone && (
                          <Button
                            onClick={onFinishRemediation}
                            size="sm"
                            className="gap-2 cursor-pointer"
                          >
                            回到原题复测
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-center gap-3">
            {!lastAttempt.passed && failedAttempts < 3 && (
              <Button
                onClick={onRetry}
                variant="outline"
                className="gap-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                再试一次
              </Button>
            )}
            {canContinue && (
              <Button onClick={onContinue} className="cursor-pointer">
                {lastAttempt.passed ? "下一步" : "记录为 stuck，继续"}
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DeepPracticeCoachPanel({ coach }: { coach: DeepPracticeCoach }) {
  const tone =
    coach.status === "lock-in"
      ? "border-primary/25 bg-primary/5"
      : coach.status === "stuck-prep"
        ? "border-red-500/25 bg-red-500/5"
        : "border-amber-500/25 bg-amber-500/10";

  return (
    <div className={cn("mt-4 rounded-lg border p-4 text-center text-sm", tone)}>
      <div className="flex flex-wrap items-start justify-center gap-2">
        <div className="max-w-full">
          <p className="break-words font-semibold [overflow-wrap:anywhere]">
            {coach.title}
          </p>
          <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
            {coach.diagnosis}
          </p>
        </div>
        <Badge
          variant={coach.status === "stuck-prep" ? "destructive" : "secondary"}
          className={WRAP_SAFE_BADGE_CLASS}
          data-smoke="pack-runner-deep-practice-badge"
        >
          深度练习
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            身体检查
          </p>
          <p className="mt-1 break-words font-medium [overflow-wrap:anywhere]">
            {coach.bodyCheck}
          </p>
        </div>
        <div className="rounded-md bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            回听检查
          </p>
          <p className="mt-1 break-words font-medium [overflow-wrap:anywhere]">
            {coach.listeningCheck}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md bg-background/80 p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          30 秒微练习
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {coach.microDrill.map((step, index) => (
            <div
              key={`${step.label}-${step.text}`}
              className="rounded-md bg-muted/40 p-2"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="break-words font-medium [overflow-wrap:anywhere]">
                  {step.label}
                </p>
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {step.instruction}
              </p>
              <p
                className={`${getCenteredCompactTextClassName(
                  getPracticeTextDensity(step.text, "phrase"),
                )} mt-1 font-mono text-primary`}
              >
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-md bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            继续规则
          </p>
          <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
            {coach.moveOnRule}
          </p>
        </div>
        <div className="rounded-md bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            自检问题
          </p>
          <p className="mt-1 break-words text-muted-foreground [overflow-wrap:anywhere]">
            {coach.reflectionPrompt}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompletedStep({
  pack,
  summary,
  worstAttempt,
  llm,
  languageId,
  localSaveWarning,
  onRestart,
  onStartLevel,
}: {
  pack: TrainingPack;
  summary: TrainingSessionSummary;
  worstAttempt: AttemptResult | null;
  llm: ReturnType<typeof useLlmFeedback>;
  languageId: LanguageId;
  localSaveWarning: string | null;
  onRestart: () => void;
  onStartLevel: (levelId: string) => void;
}) {
  const nextLevel = summary.recommendedNextLevelId
    ? pack.course?.levels.find(
        (level) => level.id === summary.recommendedNextLevelId,
      )
    : null;
  const nextReview = loadMasteryProfile().packs[pack.id]?.nextReviewAt;
  const evidencePrompt = buildCoachSummaryPrompt(pack, summary, worstAttempt);
  const debrief = buildSessionDebrief(pack, summary);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">
          {summary.mastered ? "训练包已达标" : "训练完成，继续巩固"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          听辨 {summary.perceptionCorrect}/{summary.perceptionTotal}
          ，目标音素平均 {average(summary.targetScores)} 分，stuck{" "}
          {summary.stuckPatternIds?.length ?? 0} 个。
        </p>
        {localSaveWarning && (
          <p
            role="alert"
            data-smoke="pack-runner-local-save-warning"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          >
            {localSaveWarning}
          </p>
        )}
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">失败证据</p>
            <p className="text-lg font-bold">
              {summary.failedItems?.length ?? 0}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">补救步骤</p>
            <p className="text-lg font-bold">
              {summary.remediationResults?.filter((item) => item.passed)
                .length ?? 0}
              /{summary.remediationResults?.length ?? 0}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">复习任务</p>
            <p className="text-lg font-bold">
              {summary.reviewItems?.length ?? 0}
            </p>
          </div>
        </div>
        {(summary.remediationResults?.length ?? 0) > 0 && (
          <div className="mt-3 rounded-lg border bg-background p-3 text-center text-sm">
            <p className="font-semibold">补救效果</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {summary.remediationResults?.slice(-4).map((item) => (
                <div
                  key={`${item.pathId}-${item.stepIndex}-${item.text}-${item.targetScore}`}
                  className="rounded-md bg-muted/40 p-2"
                >
                  <p
                    className={`${getCenteredCompactTextClassName(
                      getPracticeTextDensity(item.text, "phrase"),
                    )} font-medium`}
                  >
                    {item.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.beforeTargetScore} → {item.targetScore} ·{" "}
                    {item.passed ? "有效" : "继续拆解"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 grid gap-2 md:grid-cols-4">
          {(summary.levelSummaries ?? []).map((level) => (
            <div
              key={level.levelId}
              className="rounded-lg border bg-background p-3"
            >
              <p className="text-xs text-muted-foreground">{level.kind}</p>
              <p
                className={cn(
                  "font-bold",
                  level.passed ? "text-primary" : "text-red-500",
                )}
              >
                {level.passed ? "通过" : "待加强"}
              </p>
              <p className="text-xs text-muted-foreground">
                best {level.bestScore} · {level.attempts} 次
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border bg-background p-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="max-w-full">
              <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                {debrief.headline}
              </p>
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {debrief.mainFinding}
              </p>
            </div>
            {debrief.nextLevelTitle && (
              <Badge
                variant="secondary"
                className={WRAP_SAFE_BADGE_CLASS}
                data-smoke="pack-runner-debrief-next-level-badge"
              >
                下一关：{debrief.nextLevelTitle}
              </Badge>
            )}
          </div>
          <p className="mt-3 break-words text-sm font-medium text-primary [overflow-wrap:anywhere]">
            {debrief.nextActionReason}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {debrief.reviewPlan.map((step, index) => (
              <div key={step} className="rounded-md bg-muted/40 p-2 text-sm">
                <span className="mr-2 font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="break-words text-muted-foreground [overflow-wrap:anywhere]">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {nextLevel && (
            <Button
              onClick={() => onStartLevel(nextLevel.id)}
              className="gap-2 cursor-pointer"
            >
              继续补：{nextLevel.title}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {summary.mastered && nextReview && (
            <Link href="/drill">
              <Button variant="default" className="gap-2 cursor-pointer">
                返回处方 · 下次复习 {new Date(nextReview).toLocaleDateString()}
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            onClick={onRestart}
            className="gap-2 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            再练一轮
          </Button>
          {worstAttempt && (
            <Button
              onClick={() =>
                llm.requestFeedback(
                  evidencePrompt,
                  worstAttempt.azureResult,
                  "phoneme",
                  languageId,
                )
              }
              disabled={llm.isStreaming}
              className="gap-2 cursor-pointer"
            >
              {llm.isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              生成 AI 教练总结
            </Button>
          )}
        </div>
      </div>
      <FeedbackDisplay
        feedback={llm.feedback}
        isStreaming={llm.isStreaming}
        error={llm.error}
      />
    </motion.div>
  );
}

function buildCoachSummaryPrompt(
  pack: TrainingPack,
  summary: TrainingSessionSummary,
  worstAttempt: AttemptResult | null,
): string {
  const failed = (summary.failedItems ?? [])
    .slice(-5)
    .map(
      (item) =>
        `${item.text}: target ${item.targetScore}, overall ${item.overallScore}, cue ${item.nextCue}`,
    )
    .join("\n");
  const remediation = (summary.remediationResults ?? [])
    .slice(-5)
    .map(
      (item) =>
        `${item.text}: before ${item.beforeTargetScore}, after ${item.targetScore}, passed ${item.passed}`,
    )
    .join("\n");
  const levels = (summary.levelSummaries ?? [])
    .map(
      (level) =>
        `${level.levelId}: ${level.passed ? "passed" : "needs work"}, best ${level.bestScore}, attempts ${level.attempts}`,
    )
    .join("\n");

  return [
    `${pack.title} 训练总结。请用中文给出本轮训练报告，重点说明最该改的一个动作、补救是否有效、下一轮从哪里开始。`,
    `目标：${pack.focus}`,
    `平均目标音分：${average(summary.targetScores)}，stuck：${summary.stuckPatternIds?.join(", ") || "none"}`,
    `最低分项目：${worstAttempt?.text ?? "none"} (${worstAttempt?.targetScore ?? 0})`,
    `关卡结果：\n${levels || "none"}`,
    `失败证据：\n${failed || "none"}`,
    `补救结果：\n${remediation || "none"}`,
    `下一关建议：${summary.recommendedNextLevelId ?? "review prescription"}`,
  ].join("\n\n");
}

function ScoreTile({
  label,
  value,
  passed,
}: {
  label: string;
  value: number;
  passed: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3 text-center",
        passed ? "bg-primary/10" : "bg-red-500/10",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-3xl font-bold",
          passed ? "text-primary" : "text-red-500",
        )}
      >
        {value}
      </p>
    </div>
  );
}
