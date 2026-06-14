"use client";

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
import { useMemo, useRef, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { FeedbackDisplay } from "@/components/feedback/feedback-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useLlmFeedback } from "@/hooks/use-llm-feedback";
import { useWordPronunciation } from "@/hooks/use-word-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import { analyzeAttempt } from "@/lib/attempt-analysis";
import {
  buildCourseMap,
  type CourseLevelMapItem,
  type CourseLevelMapStatus,
  type CourseMapSummary,
} from "@/lib/course-map";
import {
  buildFocusedReviewItems,
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
  buildLessonBrief,
  buildSessionDebrief,
  type LessonBrief,
} from "@/lib/lesson-brief";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  canRecordFormalMastery,
  getExperimentalMasteryBlocker,
} from "@/lib/mastery-language-policy";
import {
  evaluateSessionMastery,
  loadMasteryProfile,
  recordTrainingSession,
  saveMasteryProfile,
} from "@/lib/mastery-profile";
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
import { buildReviewQueue, buildSessionReviewItems } from "@/lib/review-queue";
import {
  type CourseAttemptSnapshot,
  type CoursePosition,
  nextCoursePosition,
  shouldAppendPerceptionReview,
  shouldEnterRemediation,
  shouldMarkStuck,
  toLevelSummary,
} from "@/lib/training-course-session";
import {
  getRemediationPath,
  TRAINING_ERROR_PATTERNS,
} from "@/lib/training-error-patterns";
import { getTrainingPack } from "@/lib/training-packs";
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

type RunnerPhase =
  | { type: "intro" }
  | { type: "course"; position: CoursePosition }
  | { type: "completed"; summary: TrainingSessionSummary };

type ActiveSlot = "A" | "B" | "X" | null;

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
  const [xIsA, setXIsA] = useState(() => Math.random() > 0.5);
  const [perceptionCorrect, setPerceptionCorrect] = useState(0);
  const [perceptionTotal, setPerceptionTotal] = useState(0);
  const [perceptionExtraRemaining, setPerceptionExtraRemaining] = useState(0);
  const [perceptionAnswer, setPerceptionAnswer] = useState<boolean | null>(
    null,
  );
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

  const startedAtRef = useRef(Date.now());
  const qualityReportsRef = useRef<RecordingQualityReport[]>([]);
  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const wordAudio = useWordPronunciation();
  const tts = useTtsAligned();
  const llm = useLlmFeedback();

  const course = pack?.course;
  const currentLevel =
    phase.type === "course" && course
      ? course.levels[phase.position.levelIndex]
      : null;
  const currentItems =
    currentLevel && focusedReviewItems.length > 0
      ? focusedReviewItems
      : (currentLevel?.items ?? []);
  const currentItem =
    currentLevel && phase.type === "course"
      ? currentItems[phase.position.itemIndex % currentItems.length]
      : null;
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

  const defaultStartLevelId =
    lessonBrief?.startLevelId ?? courseMap?.startLevelId ?? requestedLevelId;

  const resetSession = (levelId = defaultStartLevelId) => {
    startedAtRef.current = Date.now();
    setActiveSlot(null);
    setXIsA(Math.random() > 0.5);
    setPerceptionCorrect(0);
    setPerceptionTotal(0);
    setPerceptionExtraRemaining(0);
    setPerceptionAnswer(null);
    setFailedAttempts(0);
    setLastAttempt(null);
    setResults([]);
    setWorstAttempt(null);
    setLevelStats({});
    setStuckPatternIds([]);
    setFocusedReviewItems([]);
    setGateBlockedReason(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    setFailedItems([]);
    setRemediationResults([]);
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
    score: number,
    passed: boolean,
    stuck = false,
  ) => {
    setLevelStats((current) => {
      const snapshot = current[level.id] ?? emptySnapshot(level);
      return {
        ...current,
        [level.id]: {
          ...snapshot,
          scores: [...snapshot.scores, score],
          attempts: snapshot.attempts + 1,
          passedCount: snapshot.passedCount + (passed ? 1 : 0),
          stuckCount: snapshot.stuckCount + (stuck ? 1 : 0),
        },
      };
    });
  };

  const advance = () => {
    if (phase.type !== "course" || !currentLevel) return;
    const nextItem = phase.position.itemIndex + 1;
    const next = nextCoursePosition(course, phase.position);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setLastAttempt(null);
    setFailedAttempts(0);
    setPerceptionAnswer(null);
    setActiveSlot(null);
    setXIsA(Math.random() > 0.5);
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
        ? "目标音素未成功对齐，本轮整体分只作反馈，不提升掌握度。"
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
      id: `${pack.id}-${Date.now()}`,
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
                evidenceStrength: targetScores.length >= 3 ? "strong" : "fair",
                note:
                  uniqueQualityIssues.length > 0
                    ? "本轮存在录音质量提示，结果只作为观察，不提升掌握度。"
                    : "本轮录音质量稳定，可计入掌握度。",
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
    const mastered = canPromoteMastery && evaluateSessionMastery(summary);
    const completedSummary = { ...summary, mastered };
    if (canPromoteMastery) {
      const profile = recordTrainingSession(
        loadMasteryProfile(),
        completedSummary,
      );
      saveMasteryProfile(profile);
    }
    setPhase({ type: "completed", summary: completedSummary });
  };

  const playReference = () => {
    if (!currentItem) return;
    const reference = getCourseItemPlaybackText(currentItem);
    if (reference.split(/\s+/).length > 1) {
      tts.speak(reference, { speed: 0.85, languageId });
    } else {
      wordAudio.playWord(reference.toLowerCase(), "blue", languageId);
    }
  };

  const playRemediationText = (text: string) => {
    if (text.split(/\s+/).length > 1) {
      tts.speak(text, { speed: 0.75, languageId });
    } else {
      wordAudio.playWord(text.toLowerCase(), "blue", languageId);
    }
  };

  const playSlot = (slot: ActiveSlot) => {
    if (!currentItem || !slot) return;
    const wordA = currentItem.text;
    const wordB = currentItem.contrastText ?? currentItem.text;
    const word =
      slot === "A" ? wordA : slot === "B" ? wordB : xIsA ? wordA : wordB;
    setActiveSlot(slot);
    wordAudio.playWord(
      word.toLowerCase(),
      slot === "B" || (slot === "X" && !xIsA) ? "pink" : "blue",
      languageId,
    );
  };

  const answerPerception = (answeredA: boolean) => {
    if (!currentLevel || !currentItem || phase.type !== "course") return;
    const correct = answeredA === xIsA;
    const nextCorrect = perceptionCorrect + (correct ? 1 : 0);
    const nextTotal = perceptionTotal + 1;
    setPerceptionCorrect(nextCorrect);
    setPerceptionTotal(nextTotal);
    setPerceptionAnswer(correct);
    setLevelStats((current) => {
      const snapshot = current[currentLevel.id] ?? emptySnapshot(currentLevel);
      return {
        ...current,
        [currentLevel.id]: {
          ...snapshot,
          attempts: snapshot.attempts + 1,
          passedCount: snapshot.passedCount + (correct ? 1 : 0),
        },
      };
    });
  };

  const nextPerception = () => {
    if (phase.type !== "course" || !currentLevel) return;
    const nextIndex = phase.position.itemIndex + 1;
    setPerceptionAnswer(null);
    setActiveSlot(null);
    setXIsA(Math.random() > 0.5);
    if (nextIndex < currentItems.length) {
      if (focusedReviewItems.length > 0) {
        setPerceptionExtraRemaining(currentItems.length - nextIndex);
      }
      setPhase({
        type: "course",
        position: { ...phase.position, itemIndex: nextIndex },
      });
      return;
    }
    if (focusedReviewItems.length > 0) {
      setFocusedReviewItems([]);
      setPerceptionExtraRemaining(0);
      advance();
      return;
    }
    if (
      perceptionExtraRemaining === 0 &&
      shouldAppendPerceptionReview(
        perceptionCorrect,
        perceptionTotal,
        currentLevel.passRule.minCorrectRate,
      )
    ) {
      const reviewItems = buildFocusedReviewItems(currentLevel, currentItem, 4);
      setFocusedReviewItems(reviewItems);
      setPerceptionExtraRemaining(reviewItems.length);
      setPhase({
        type: "course",
        position: { ...phase.position, itemIndex: 0 },
      });
      return;
    }
    setPerceptionExtraRemaining(0);
    advance();
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
    });
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

    updateLevelStats(currentLevel, analysis.targetScore, passed, stuck);
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
          assessmentReliability: reliabilityFromRecordingQuality(qualityReport),
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
    setLastAttempt(null);
    setRemediationStepIndex(0);
    setRemediationAttempt(null);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
  };

  const startRemediationRecording = () => {
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

  const completeNonRecordingItem = () => {
    if (currentLevel) {
      updateLevelStats(currentLevel, 100, true);
    }
    advance();
  };

  const shouldShowRecording =
    currentLevel &&
    currentItem &&
    !["perception", "articulation"].includes(currentLevel.kind);

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <div className="mb-4 flex items-center gap-3 shrink-0">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{pack.title}</h1>
          <p className="text-sm text-muted-foreground">{pack.focus}</p>
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

            <CourseMapPanel
              map={courseMap}
              compact
              onStartLevel={(levelId) => resetSession(levelId)}
            />

            <CoachMissionCard
              level={currentLevel}
              item={currentItem}
              snapshot={currentSnapshot}
              threshold={pack.masteryRule.targetPassScore}
              failedAttempts={failedAttempts}
              lastAttempt={lastAttempt}
              isFocusedReview={focusedReviewItems.length > 0}
            />

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
                    暂时跳过，不计入掌握
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
              />
            )}

            {currentLevel.kind === "articulation" && (
              <ArticulationStep
                level={currentLevel}
                item={currentItem}
                onNext={completeNonRecordingItem}
              />
            )}

            {shouldShowRecording && currentSnapshot && (
              <RecordingStep
                pack={pack}
                level={currentLevel}
                item={currentItem}
                threshold={pack.masteryRule.targetPassScore}
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
                onPlayReference={playReference}
                onPlayRemediationText={playRemediationText}
                onStartRecording={() => {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-wrap gap-2">
        {pack.targetPhonemes.map((phoneme) => (
          <Badge key={phoneme} variant="secondary">
            {phoneme}
          </Badge>
        ))}
        <Badge variant="outline">{pack.estimatedMinutes} 分钟</Badge>
        <Badge variant="outline">
          {pack.course?.levels.length ?? 0} 个关卡
        </Badge>
        {requestedLevel && !redirected && (
          <Badge variant="default">从 {requestedLevel.title} 开始</Badge>
        )}
        {redirected && (
          <Badge variant="secondary">先补 {courseMap.startLevelTitle}</Badge>
        )}
      </div>
      <h2 className="mt-4 text-xl font-bold">
        {brief?.headline ?? "教练式微课程"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {brief?.reason ??
          "听辨 → 动作 → 音节 → 单词 → 对比 → 句子 → 影子跟读 → 混合复测。失败会进入慢速拆解，训练总结会记录 stuck 错因。"}
      </p>
      {courseMap?.redirectedByGate && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">已自动回到前置关卡</p>
          <p className="mt-1">{courseMap.gateReason}</p>
        </div>
      )}
      {brief && (
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
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
                  {risk.active && <Badge variant="destructive">近期出现</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{risk.cue}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <CourseMapPanel map={courseMap} onStartLevel={onStartLevel} />
      <Button onClick={onStart} size="lg" className="mt-5 cursor-pointer">
        {brief?.nextActionLabel ??
          (requestedLevel ? `开始：${requestedLevel.title}` : "开始训练")}
      </Button>
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
            <Badge variant="outline">
              预计剩余 {brief.estimatedMinutes} 分钟
            </Badge>
          )}
          <Badge variant="secondary">
            {pack.masteryRule.targetPassScore}+ 目标音素
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

function passRuleText(level: TrainingLevel, threshold: number): string {
  const rule = level.passRule;
  if (level.kind === "perception") {
    return `听辨正确率达到 ${Math.round((rule.minCorrectRate ?? 0.8) * 100)}%`;
  }
  if (rule.minAverageScore != null) {
    return `平均目标音达到 ${rule.minAverageScore} 分`;
  }
  if (rule.requiredPasses != null) {
    return `${rule.requiredPasses} 题目标音过线`;
  }
  return `目标音达到 ${rule.minTargetScore ?? threshold} 分`;
}

function CoachMissionCard({
  level,
  item,
  snapshot,
  threshold,
  failedAttempts,
  lastAttempt,
  isFocusedReview,
}: {
  level: TrainingLevel;
  item: TrainingCourseItem;
  snapshot: CourseAttemptSnapshot | null;
  threshold: number;
  failedAttempts: number;
  lastAttempt: AttemptResult | null;
  isFocusedReview: boolean;
}) {
  const nextCue = lastAttempt?.analysis.nextCue ?? item.successCue;
  const passText = passRuleText(level, threshold);
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
            目标音：{item.targetPhonemes.join(" / ")}
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
            {isFocusedReview && <Badge variant="destructive">专项复练</Badge>}
          </div>
          <p className="mt-1 text-sm font-medium">{passText}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            本关已过 {passedCount}/{attempts || 0} 题
            {snapshot ? ` · best ${Math.max(0, ...snapshot.scores)}` : ""}
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
          <Badge variant="destructive" className="mt-3">
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
      {answer === null ? (
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => onAnswer(true)}
            variant="outline"
            className="flex-1 cursor-pointer"
          >
            X = A
          </Button>
          <Button
            onClick={() => onAnswer(false)}
            variant="outline"
            className="flex-1 cursor-pointer"
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
  onNext,
}: {
  level: TrainingLevel;
  item: TrainingCourseItem;
  onNext: () => void;
}) {
  const itemText = item.displayText ?? item.text;
  const itemDensity = getPracticeTextDensity(itemText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 shadow-sm"
    >
      <Badge variant="secondary">{level.title}</Badge>
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
      <Button onClick={onNext} className="mt-5 cursor-pointer">
        我能做出这个动作，下一步
      </Button>
    </motion.div>
  );
}

function RecordingStep({
  pack,
  level,
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
}: {
  pack: TrainingPack;
  level: TrainingLevel;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-card p-6 text-center shadow-sm"
    >
      <Badge variant="secondary">{level.title}</Badge>
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

      <motion.button
        type="button"
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
        {isPlaying ? "正在播放..." : "先听标准发音"}
      </p>

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
          {audioBlob && !isRecording && !isAssessing && !lastAttempt && (
            <Button
              onClick={onSubmit}
              disabled={scoreDisabled}
              className="gap-2 cursor-pointer"
            >
              <Mic className="h-4 w-4" />
              提交评分
            </Button>
          )}
          {isAssessing && (
            <p className="text-sm text-muted-foreground">
              正在按目标音素评分...
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
                <Badge variant="outline">
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
                        className="mt-2 gap-2 cursor-pointer"
                      >
                        <Mic className="h-4 w-4" />
                        给这一步评分
                      </Button>
                    )}
                  {isAssessing && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      正在检查补救动作...
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
  onRestart,
  onStartLevel,
}: {
  pack: TrainingPack;
  summary: TrainingSessionSummary;
  worstAttempt: AttemptResult | null;
  llm: ReturnType<typeof useLlmFeedback>;
  languageId: LanguageId;
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
              <Badge variant="secondary">
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
