"use client";

import {
  buildRetentionEvidence,
  ENGLISH_DEPTH_RETENTION_CRITERION,
} from "@speakright/core/evidence/progression";
import { buildTrainingAttemptEvidence } from "@speakright/core/evidence/training";
import {
  type DeepTrainingMaterial,
  EE_IH_GOLD_CURRICULUM,
  ENGLISH_DEPTH_PILOT_CALIBRATION_VERSION,
} from "@speakright/core/training/deep-curriculum";
import type { TrainingMaterialNovelty } from "@speakright/core/training/exposure";
import { ArrowLeft, CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { getAzureConfig } from "@/lib/api-keys";
import { analyzeAttempt } from "@/lib/attempt-analysis";
import { isAzureConfigReady } from "@/lib/azure-config";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  appendLearningEvidence,
  loadLearningEvidence,
} from "@/lib/learning-evidence";
import {
  dueRetentionReviews,
  recordRetentionAttempt,
} from "@/lib/retention-schedule";
import { presentCourseItem } from "@/lib/training-exposure";
import { getTrainingPack } from "@/lib/training-packs";
import type { TrainingCourseItem } from "@/types/training";

interface ScoredRetentionAttempt {
  materialId: string;
  targetScore?: number;
  overallScore?: number;
  passed: boolean;
  validSample: boolean;
  contextId: string;
  novelty: TrainingMaterialNovelty;
}

function materialToCourseItem(
  material: DeepTrainingMaterial,
): TrainingCourseItem {
  return {
    id: material.id,
    text: material.text,
    displayText: material.text,
    referenceText: material.text,
    targetPhonemes: material.targetUnits,
    focusPoint: "先独立完成，不播放示范；系统只判断目标音是否成功对齐。",
    commonMistake: "不要为了追求整体流利而掩盖目标音对立。",
    successCue: "目标音在新材料中仍能稳定区分。",
    isRecordable: true,
    difficulty: material.difficulty,
    materialRole: "retention",
    position: material.position,
    phoneticContext: material.phoneticContext,
    scheduledDelayHours: material.scheduledDelayHours,
    responseMode:
      material.kind === "guided-prompt" ? "open-response" : "reference",
  };
}

function mergeNovelty(
  attempts: readonly ScoredRetentionAttempt[],
): TrainingMaterialNovelty {
  if (attempts.some((attempt) => attempt.novelty === "exposed")) {
    return "exposed";
  }
  if (attempts.some((attempt) => attempt.novelty === "unknown")) {
    return "unknown";
  }
  return "confirmed-untrained";
}

function taskMaterial(id: string): DeepTrainingMaterial | undefined {
  return EE_IH_GOLD_CURRICULUM.materials.find((item) => item.id === id);
}

export default function RetentionReviewPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [now] = useState(() => Date.now());
  const [task, setTask] = useState(() => dueRetentionReviews(now)[0] ?? null);
  const [materialIndex, setMaterialIndex] = useState(0);
  const [attempts, setAttempts] = useState<ScoredRetentionAttempt[]>([]);
  const [noveltyByMaterial, setNoveltyByMaterial] = useState<
    Record<string, TrainingMaterialNovelty>
  >({});
  const [learnerPlayed, setLearnerPlayed] = useState(false);
  const [learnerAudioUrl, setLearnerAudioUrl] = useState<string | null>(null);
  const [completedStage, setCompletedStage] = useState<
    "retention_observed" | "introduced" | null
  >(null);
  const [warning, setWarning] = useState<string | null>(null);

  const recorder = useRecorder();
  const azure = useAzureAssessment();
  const materials = useMemo(
    () =>
      (task?.materialIds ?? [])
        .map(taskMaterial)
        .filter((item): item is DeepTrainingMaterial => item !== undefined),
    [task],
  );
  const currentMaterial = materials[materialIndex] ?? null;
  const currentNovelty = currentMaterial
    ? noveltyByMaterial[currentMaterial.id]
    : undefined;
  const quality = useRecordingQuality(recorder.audioBlob, {
    expectedMode:
      currentMaterial?.kind === "sentence" ||
      currentMaterial?.kind === "guided-prompt"
        ? "sentence"
        : "word",
    minDurationMs:
      currentMaterial?.kind === "sentence" ||
      currentMaterial?.kind === "guided-prompt"
        ? 800
        : 500,
  });
  const scoringAvailable = isAzureConfigReady(getAzureConfig());

  useEffect(() => {
    if (!currentMaterial || noveltyByMaterial[currentMaterial.id]) return;
    const presented = presentCourseItem({
      materialId: currentMaterial.id,
      packId: currentMaterial.packId,
      role: "retention",
      contentKey: currentMaterial.text,
      source: "retention-review",
    });
    setNoveltyByMaterial((current) => ({
      ...current,
      [currentMaterial.id]: presented.noveltyBeforeExposure,
    }));
    if (!presented.saved) {
      setWarning("材料暴露记录未能保存；本次只保留观察，不生成保持结论。");
    }
  }, [currentMaterial, noveltyByMaterial]);

  useEffect(() => {
    if (!recorder.audioBlob) {
      setLearnerAudioUrl(null);
      setLearnerPlayed(false);
      return;
    }
    const url = URL.createObjectURL(recorder.audioBlob);
    setLearnerAudioUrl(url);
    setLearnerPlayed(false);
    return () => URL.revokeObjectURL(url);
  }, [recorder.audioBlob]);

  const finishReview = (nextAttempts: ScoredRetentionAttempt[]) => {
    if (!task) return;
    const sourceEvidence = loadLearningEvidence().evidence.find(
      (item) => item.id === task.sourceTransferEvidenceId,
    );
    const scored = nextAttempts.filter(
      (attempt) => attempt.targetScore !== undefined,
    );
    const valid = scored.filter((attempt) => attempt.validSample);
    const validRetentionCount = loadLearningEvidence().evidence.filter(
      (item) =>
        item.languageId === "en-US" &&
        item.evidenceStage === "retention_observed" &&
        item.trace?.sessionId.startsWith(`${task.packId}-retention-`),
    ).length;
    const completedAt = Date.now();
    const delayHours = sourceEvidence
      ? Math.floor((completedAt - sourceEvidence.createdAt) / 3_600_000)
      : 0;
    const evidence = buildRetentionEvidence({
      id: `${task.id}-evidence-${completedAt}`,
      languageId: "en-US",
      taskType: "delayed-retention",
      targetUnits: ["ee", "ih"],
      observations: valid.map((attempt) => ({
        metric: "target-unit" as const,
        score: attempt.targetScore,
        source: "azure" as const,
      })),
      recordingQuality: {
        status: valid.length === scored.length ? "good" : "invalid",
        reasons:
          valid.length === scored.length
            ? []
            : ["One or more recordings failed the quality gate."],
      },
      alignmentQuality: {
        status: valid.length === scored.length ? "good" : "invalid",
        reasons:
          valid.length === scored.length
            ? []
            : ["One or more recordings did not align to the target unit."],
      },
      sampleCount: valid.length,
      contextCount: new Set(valid.map((attempt) => attempt.contextId)).size,
      calibrationVersion: ENGLISH_DEPTH_PILOT_CALIBRATION_VERSION,
      createdAt: completedAt,
      trace: {
        sessionId: task.id,
        materialIds: valid.map((attempt) => attempt.materialId),
        criterionKind: ENGLISH_DEPTH_RETENTION_CRITERION.kind,
        materialRole: "retention",
        novelty: mergeNovelty(valid),
        scheduledDelayHours: task.scheduledDelayHours,
      },
      passedCount: valid.filter((attempt) => attempt.passed).length,
      contextIds: valid.map((attempt) => attempt.contextId),
      novelty: mergeNovelty(valid),
      delayHours,
      priorValidRetentionCount: validRetentionCount,
    });
    const evidenceSaved = appendLearningEvidence(evidence);
    const scheduleSaved = recordRetentionAttempt(task.id, {
      attemptedAt: completedAt,
      passed: evidence.evidenceStage === "retention_observed",
      evidenceId: evidence.id,
    });
    if (!evidenceSaved || !scheduleSaved) {
      setWarning("复测结果未能完整写入本机存储；请勿关闭页面，并先导出数据。");
    }
    setCompletedStage(
      evidence.evidenceStage === "retention_observed"
        ? "retention_observed"
        : "introduced",
    );
  };

  const advance = (attempt: ScoredRetentionAttempt) => {
    const nextAttempts = [...attempts, attempt];
    setAttempts(nextAttempts);
    recorder.reset();
    quality.reset();
    azure.reset();
    setLearnerPlayed(false);
    if (materialIndex + 1 >= materials.length) {
      finishReview(nextAttempts);
      return;
    }
    setMaterialIndex((current) => current + 1);
  };

  const submitScoredMaterial = async () => {
    if (
      !task ||
      !currentMaterial ||
      currentMaterial.kind === "guided-prompt" ||
      !recorder.audioBlob ||
      !quality.report?.canSubmit ||
      !currentNovelty
    ) {
      return;
    }
    const pack = getTrainingPack(task.packId);
    if (!pack) return;
    const item = materialToCourseItem(currentMaterial);
    const result = await azure.assess(
      recorder.audioBlob,
      currentMaterial.text,
      languageProfile.azureLocale,
    );
    if (!result) return;
    const analysis = analyzeAttempt({
      pack,
      item,
      result,
      levelKind: "transfer",
      criterion: ENGLISH_DEPTH_RETENTION_CRITERION,
    });
    const evidenceSaved = appendLearningEvidence(
      buildTrainingAttemptEvidence({
        id: `${task.id}-${currentMaterial.id}-${Date.now()}`,
        languageId: "en-US",
        taskType: "delayed-retention",
        targetUnits: currentMaterial.targetUnits,
        observations: [
          {
            metric: "target-unit",
            score: analysis.targetScore,
            source: "azure",
          },
        ],
        recordingQuality: {
          status: quality.report.canSubmit ? "good" : "invalid",
          score: quality.report.score,
          reasons: quality.report.issues.map((issue) => issue.title),
        },
        alignmentQuality: {
          status: analysis.usedFallback ? "invalid" : "good",
          reasons: analysis.usedFallback
            ? [
                "Target unit was not aligned; overall score was not substituted.",
              ]
            : [],
        },
        calibrationVersion: ENGLISH_DEPTH_PILOT_CALIBRATION_VERSION,
        createdAt: Date.now(),
        trace: {
          sessionId: task.id,
          materialIds: [currentMaterial.id],
          criterionKind: "retention-attempt",
          materialRole: "retention",
          novelty: currentNovelty,
          position: currentMaterial.position,
          phoneticContext: currentMaterial.phoneticContext,
          scheduledDelayHours: task.scheduledDelayHours,
        },
      }),
    );
    if (!evidenceSaved) {
      setWarning("本题原始观察未能保存；当前页面仍保留本轮进度。");
    }
    advance({
      materialId: currentMaterial.id,
      targetScore: analysis.targetScore,
      overallScore: analysis.overallScore,
      passed: analysis.passed,
      validSample: !analysis.usedFallback && quality.report.canSubmit,
      contextId: currentMaterial.kind,
      novelty: currentNovelty,
    });
  };

  const completeOpenResponse = () => {
    if (
      !task ||
      !currentMaterial ||
      currentMaterial.kind !== "guided-prompt" ||
      !recorder.audioBlob ||
      !quality.report?.canSubmit ||
      !learnerPlayed ||
      !currentNovelty
    ) {
      return;
    }
    const evidenceSaved = appendLearningEvidence(
      buildTrainingAttemptEvidence({
        id: `${task.id}-${currentMaterial.id}-open-${Date.now()}`,
        languageId: "en-US",
        taskType: "delayed-retention",
        targetUnits: currentMaterial.targetUnits,
        observations: [
          {
            metric: "task-completion",
            text: "Learner completed and reviewed an unscored retention prompt.",
            source: "task",
          },
        ],
        recordingQuality: {
          status: "good",
          score: quality.report.score,
          reasons: quality.report.issues.map((issue) => issue.title),
        },
        alignmentQuality: {
          status: "unknown",
          reasons: ["Open responses are not reference-text aligned."],
        },
        calibrationVersion: ENGLISH_DEPTH_PILOT_CALIBRATION_VERSION,
        createdAt: Date.now(),
        trace: {
          sessionId: task.id,
          materialIds: [currentMaterial.id],
          criterionKind: "retention-open-response",
          materialRole: "retention",
          novelty: currentNovelty,
          scheduledDelayHours: task.scheduledDelayHours,
        },
      }),
    );
    if (!evidenceSaved) {
      setWarning("开放表达观察未能保存；当前页面仍保留本轮进度。");
    }
    advance({
      materialId: currentMaterial.id,
      passed: false,
      validSample: false,
      contextId: "guided-prompt",
      novelty: currentNovelty,
    });
  };

  if (languageId !== "en-US") {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">英语保持复测</h1>
        <p className="mt-2 text-muted-foreground">
          正式保持证据目前只对英语 en-US 开放；实验语言不会生成等价结论。
        </p>
        <Link href="/drill">
          <Button className="mt-5 min-h-11">返回训练首页</Button>
        </Link>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-3xl p-6" data-smoke="retention-not-due">
        <CalendarClock className="h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">目前没有到期复测</h1>
        <p className="mt-2 text-muted-foreground">
          完成未训练材料迁移后，系统会在 1、7、21 天安排新的保留材料。
        </p>
        <Link href="/drill">
          <Button className="mt-5 min-h-11">返回今日训练</Button>
        </Link>
      </div>
    );
  }

  if (completedStage) {
    const passed = completedStage === "retention_observed";
    return (
      <div className="mx-auto max-w-3xl p-6" data-smoke="retention-completed">
        <CheckCircle2
          className={
            passed ? "h-10 w-10 text-primary" : "h-10 w-10 text-amber-600"
          }
        />
        <h1 className="mt-4 text-2xl font-bold">
          {passed ? "本次保持证据成立" : "本次只保存为观察"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {passed
            ? "结果来自到期的新材料、多样本和目标音对齐；它不会覆盖此前失败记录。"
            : "样本、目标音对齐、材料新颖性或分数尚未同时满足标准，系统没有生成保持结论。"}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {!passed && (
            <Link href={`/drill/pack/${task.packId}?level=word-production`}>
              <Button className="min-h-11">进入针对性补练</Button>
            </Link>
          )}
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setTask(dueRetentionReviews(Date.now())[0] ?? null);
              setCompletedStage(null);
              setMaterialIndex(0);
              setAttempts([]);
              setNoveltyByMaterial({});
              setLearnerPlayed(false);
              recorder.reset();
              quality.reset();
              azure.reset();
            }}
          >
            查看下一项
          </Button>
        </div>
        {warning && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {warning}
          </p>
        )}
      </div>
    );
  }

  if (!currentMaterial) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">复测材料不可用</h1>
        <p className="mt-2 text-muted-foreground">
          任务没有找到对应的本地保留材料，本次不会生成任何证据。
        </p>
        <Link href="/drill">
          <Button className="mt-5 min-h-11">返回训练首页</Button>
        </Link>
      </div>
    );
  }

  const isOpenResponse = currentMaterial.kind === "guided-prompt";
  const canSubmit =
    !!recorder.audioBlob &&
    quality.report?.canSubmit === true &&
    !quality.isAnalyzing &&
    !!currentNovelty &&
    (isOpenResponse ? learnerPlayed : scoringAvailable);

  return (
    <div
      className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6"
      data-smoke="retention-review"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/drill"
          aria-label="返回训练首页"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">到期保持复测</h1>
          <p className="text-sm text-muted-foreground">
            第 {materialIndex + 1}/{materials.length} 题 · 计划间隔{" "}
            {task.scheduledDelayHours} 小时
          </p>
        </div>
        <Badge variant="secondary">不预播答案</Badge>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold text-primary">
          {isOpenResponse ? "引导表达观察" : "未训练材料"}
        </p>
        <h2 className="mt-3 whitespace-pre-wrap break-words text-xl font-bold">
          {currentMaterial.text}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          先独立录音。评分只使用成功对齐的目标音；整体高分不能代替目标音证据。
        </p>

        {!scoringAvailable && !isOpenResponse && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="font-semibold">正式复测需要 Azure 目标音证据</p>
            <p className="mt-1">
              你仍可录音和回放，但在服务连接前不会生成分数或保持阶段。
            </p>
            <Link href="/settings" className="mt-2 inline-block underline">
              前往服务连接
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <RecordButton
            isRecording={recorder.isRecording}
            onStart={() => {
              azure.reset();
              quality.reset();
              recorder.reset();
              recorder.startRecording();
            }}
            onStop={recorder.stopRecording}
            disabled={azure.isLoading || quality.isAnalyzing}
          />
          <WaveformDisplay
            audioBlob={recorder.audioBlob}
            stream={recorder.stream}
          />
          {quality.isAnalyzing && (
            <p className="text-xs text-muted-foreground">正在检查录音质量...</p>
          )}
          <RecordingQualityPanel report={quality.report} compact />
          {learnerAudioUrl && (
            // biome-ignore lint/a11y/useMediaCaption: Learner recordings have no known transcript.
            <audio
              className="w-full"
              controls
              src={learnerAudioUrl}
              onPlay={() => setLearnerPlayed(true)}
              aria-label="播放本次保持复测录音"
            />
          )}
          {azure.isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在检查目标音证据...
            </p>
          )}
          {(recorder.error || azure.error) && (
            <p role="alert" className="text-sm text-destructive">
              {recorder.error ?? azure.error}
            </p>
          )}
          {warning && (
            <p role="alert" className="text-sm text-destructive">
              {warning}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={recorder.isRecording}
              onClick={() => {
                recorder.reset();
                quality.reset();
                azure.reset();
              }}
            >
              重新录制
            </Button>
            <Button
              className="min-h-11"
              disabled={!canSubmit || azure.isLoading}
              onClick={
                isOpenResponse ? completeOpenResponse : submitScoredMaterial
              }
            >
              {isOpenResponse ? "保存观察并继续" : "提交目标音证据"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
