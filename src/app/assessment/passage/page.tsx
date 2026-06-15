"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  Loader2,
  RotateCcw,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssessmentReport } from "@/components/assessment/assessment-report";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import {
  type CoverageBenchmarkComparison,
  compareCoverageReportToHistory,
  saveCoverageBenchmark,
} from "@/lib/coverage-benchmark";
import {
  COVERAGE_PASSAGE,
  COVERAGE_TARGET_PACKS,
  type CoverageAdaptiveProbe,
  type CoverageFeature,
  type CoveragePassageItem,
  getCoveragePassageText,
  selectCoverageAdaptiveProbes,
} from "@/lib/coverage-passage";
import { buildCoveragePassageDiagnosisReport } from "@/lib/diagnosis-engine";
import { getLanguageProfile } from "@/lib/language-profiles";
import { getTrainingPack } from "@/lib/training-packs";
import type {
  CoveragePassageRecording,
  DiagnosisReport,
} from "@/types/diagnosis";

const STORAGE_KEY_V2 = "speakright_assessment_result_v2";

function storageKeyFor(languageId: string): string {
  return `${STORAGE_KEY_V2}:coverage:${languageId}`;
}

const FEATURE_LABELS: Record<CoverageFeature, string> = {
  "ee-ih": "/iː/ vs /ɪ/",
  "eh-ae": "/e/ vs /æ/",
  "s-th": "/s/ vs /θ/",
  "z-dh": "/z/ vs /ð/",
  "v-w": "/v/ vs /w/",
  "l-r": "/l/ vs /r/",
  "oo-uh": "/uː/ vs /ʊ/",
  "n-ng": "/n/ vs /ŋ/",
  "final-consonants": "词尾辅音",
  "stress-rhythm": "重音节奏",
  "weak-forms": "弱读",
  linking: "连读",
};

type ReadablePassagePhase =
  | { type: "segment"; index: number }
  | { type: "probe"; index: number; probes: CoverageAdaptiveProbe[] };

type PassagePhase =
  | { type: "intro" }
  | ReadablePassagePhase
  | { type: "analyzing"; message: string }
  | { type: "report"; result: DiagnosisReport }
  | { type: "error"; message: string; recoverTo?: ReadablePassagePhase };

function saveReport(report: DiagnosisReport, languageId: string) {
  localStorage.setItem(storageKeyFor(languageId), JSON.stringify(report));
}

function loadSavedCoverageReport(languageId: string): DiagnosisReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKeyFor(languageId));
    if (!raw) return null;
    const report = JSON.parse(raw) as DiagnosisReport;
    return report.source === "coverage-passage" ? report : null;
  } catch {
    return null;
  }
}

function phaseProgress(phase: PassagePhase) {
  if (phase.type === "segment") {
    return {
      label: `朗读 ${phase.index + 1} / ${COVERAGE_PASSAGE.segments.length}`,
      percent: (phase.index / COVERAGE_PASSAGE.segments.length) * 100,
    };
  }
  if (phase.type === "probe") {
    return {
      label: `补测 ${phase.index + 1} / ${phase.probes.length}`,
      percent: 88 + ((phase.index + 1) / phase.probes.length) * 10,
    };
  }
  return { label: "准备开始", percent: 0 };
}

function getPromptForPhase(
  phase: PassagePhase,
): CoveragePassageItem | CoverageAdaptiveProbe | null {
  if (phase.type === "segment") return COVERAGE_PASSAGE.segments[phase.index];
  if (phase.type === "probe") return phase.probes[phase.index];
  return null;
}

export default function CoveragePassageAssessmentPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [savedReport, setSavedReport] = useState<DiagnosisReport | null>(() =>
    loadSavedCoverageReport(languageId),
  );
  const [phase, setPhase] = useState<PassagePhase>({ type: "intro" });
  const [benchmarkComparison, setBenchmarkComparison] =
    useState<CoverageBenchmarkComparison | null>(null);

  const recorder = useRecorder({ maxDurationMs: 90_000 });
  const recordingQuality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: phase.type === "segment" ? "paragraph" : "sentence",
    minDurationMs: phase.type === "segment" ? 1_200 : 800,
  });
  const azure = useAzureAssessment();
  const recordingsRef = useRef<CoveragePassageRecording[]>([]);
  const usedProbeIdsRef = useRef<string[]>([]);

  useEffect(() => {
    setSavedReport(loadSavedCoverageReport(languageId));
    setPhase({ type: "intro" });
  }, [languageId]);

  const finalizeReport = useCallback(() => {
    const report = buildCoveragePassageDiagnosisReport({
      recordings: recordingsRef.current,
    });
    saveReport(report, languageId);
    setBenchmarkComparison(saveCoverageBenchmark(report));
    setSavedReport(report);
    setPhase({ type: "report", result: report });
  }, [languageId]);

  const handleStart = () => {
    recordingsRef.current = [];
    usedProbeIdsRef.current = [];
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setPhase({ type: "segment", index: 0 });
  };

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleRecorded = useCallback(async () => {
    if (!recorder.audioBlob) return;
    if (recordingQuality.isAnalyzing || !recordingQuality.report?.canSubmit) {
      return;
    }
    const prompt = getPromptForPhase(phase);
    if (!prompt) return;
    const currentPhase =
      phase.type === "segment" || phase.type === "probe" ? phase : undefined;

    const result = await azure.assess(
      recorder.audioBlob,
      prompt.text,
      languageProfile.azureLocale,
    );
    if (!result) {
      const assessmentError =
        azure.getLastError() ??
        azure.error ??
        "评估失败：请检查 Azure Speech API 密钥、区域、网络或代理后重试。";
      setPhase({
        type: "error",
        message: assessmentError,
        recoverTo: currentPhase,
      });
      return;
    }

    recordingsRef.current.push({
      text: prompt.text,
      result,
      source: phase.type === "probe" ? "coverage-probe" : "coverage-segment",
      label: prompt.title,
      recordingQuality: recordingQuality.report,
    });
    recorder.reset();
    recordingQuality.reset();
    azure.reset();

    if (phase.type === "segment") {
      const nextIndex = phase.index + 1;
      if (nextIndex < COVERAGE_PASSAGE.segments.length) {
        setPhase({ type: "segment", index: nextIndex });
        return;
      }

      setPhase({
        type: "analyzing",
        message: "正在判断是否需要补测某些薄弱音...",
      });
      const preliminaryReport = buildCoveragePassageDiagnosisReport({
        recordings: recordingsRef.current,
      });
      const probes = selectCoverageAdaptiveProbes(
        preliminaryReport,
        usedProbeIdsRef.current,
      );
      if (probes.length > 0) {
        usedProbeIdsRef.current.push(...probes.map((probe) => probe.id));
        setPhase({ type: "probe", index: 0, probes });
      } else {
        finalizeReport();
      }
      return;
    }

    if (phase.type === "probe") {
      const nextIndex = phase.index + 1;
      if (nextIndex < phase.probes.length) {
        setPhase({ type: "probe", index: nextIndex, probes: phase.probes });
      } else {
        setPhase({ type: "analyzing", message: "正在生成全音覆盖诊断报告..." });
        finalizeReport();
      }
    }
  }, [
    recorder,
    recordingQuality,
    phase,
    azure,
    finalizeReport,
    languageProfile.azureLocale,
  ]);

  const handleRetake = () => {
    localStorage.removeItem(storageKeyFor(languageId));
    setSavedReport(null);
    recordingsRef.current = [];
    usedProbeIdsRef.current = [];
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setPhase({ type: "intro" });
  };

  const handleRetryCurrent = () => {
    if (phase.type !== "error" || !phase.recoverTo) return;
    azure.reset();
    recordingQuality.reset();
    setPhase(phase.recoverTo);
  };

  const prompt = getPromptForPhase(phase);
  const progress = phaseProgress(phase);
  const passageText = getCoveragePassageText();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-4 scrollbar-thin">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Link
              href="/assessment"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="返回快速诊断"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold">全音覆盖朗读诊断</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            用一篇自然短文覆盖核心音素、词尾、弱读、连读和句子重音，适合做更深的阶段性体检。
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {COVERAGE_PASSAGE.estimatedMinutes} 分钟
        </Badge>
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {phase.type === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_1.35fr]"
            >
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-5 flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BookOpenCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      {COVERAGE_PASSAGE.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {COVERAGE_PASSAGE.subtitle}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      覆盖训练包
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {COVERAGE_TARGET_PACKS.map((packId) => {
                        const pack = getTrainingPack(packId);
                        return (
                          <Badge key={packId} variant="outline">
                            {pack?.title ?? packId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p className="font-medium">这不是绕口令，而是诊断文章。</p>
                    <p className="mt-1 text-muted-foreground">
                      它不会追求难读，而是让每类发音问题在自然语流里至少出现一次；系统会根据低分和证据强度决定是否追加补测。
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleStart} size="lg" className="gap-2">
                      开始全音诊断
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    {savedReport && (
                      <Button
                        onClick={() => {
                          setBenchmarkComparison(
                            compareCoverageReportToHistory(savedReport),
                          );
                          setPhase({ type: "report", result: savedReport });
                        }}
                        variant="outline"
                        size="lg"
                        className="gap-2"
                      >
                        <ClipboardList className="h-4 w-4" />
                        查看上次全音报告
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                  完整朗读稿
                </h2>
                <p className="whitespace-pre-line text-sm leading-7">
                  {passageText}
                </p>
              </div>
            </motion.div>
          )}

          {(phase.type === "segment" || phase.type === "probe") && prompt && (
            <motion.div
              key={`${phase.type}-${prompt.id}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[280px_1fr]"
            >
              <aside className="space-y-3">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>{progress.label}</span>
                    <span>
                      {phase.type === "probe" ? "自适应补测" : "覆盖短文"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, progress.percent)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">这一段只看什么</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {prompt.focus}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {prompt.targetFeatures.map((feature) => (
                      <Badge key={feature} variant="secondary">
                        {FEATURE_LABELS[feature]}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-semibold">读前动作</h2>
                  <p className="text-sm text-muted-foreground">
                    {prompt.coachCue}
                  </p>
                </div>
              </aside>

              <section className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="mb-4">
                  <Badge
                    variant={phase.type === "probe" ? "destructive" : "outline"}
                  >
                    {phase.type === "probe" ? "补测" : "朗读"}
                  </Badge>
                  <h2 className="mt-2 text-xl font-bold">{prompt.title}</h2>
                </div>

                <p className="rounded-xl bg-muted/35 p-5 text-xl leading-9">
                  {prompt.text}
                </p>

                <div className="mt-4">
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                    重点证据词
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {prompt.evidenceWords.map((word) => (
                      <Badge key={word} variant="outline">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <RecordButton
                    isRecording={recorder.isRecording}
                    onStart={() => {
                      recorder.reset();
                      azure.reset();
                      recordingQuality.reset();
                      recorder.startRecording();
                    }}
                    onStop={handleRecordStop}
                    disabled={azure.isLoading}
                  />
                  <div className="text-xs text-muted-foreground">
                    {recorder.isRecording
                      ? `${recorder.elapsedSeconds}s / ${recorder.maxDurationSeconds}s`
                      : "读完整段后停止录音"}
                  </div>
                  <WaveformDisplay
                    audioBlob={recorder.audioBlob}
                    stream={recorder.stream}
                  />
                  {recordingQuality.isAnalyzing && (
                    <p className="text-xs text-muted-foreground">
                      正在检查录音质量...
                    </p>
                  )}
                  <RecordingQualityPanel
                    report={recordingQuality.report}
                    compact
                  />
                  {recorder.error && (
                    <p
                      className="max-w-md text-center text-sm text-destructive break-words [overflow-wrap:anywhere]"
                      data-smoke="assessment-passage-recorder-error"
                      role="alert"
                    >
                      {recorder.error}
                    </p>
                  )}
                  {recorder.autoStopped && (
                    <p className="text-xs text-muted-foreground">
                      已到最长录音时间，系统自动停止。
                    </p>
                  )}
                  {recorder.audioBlob &&
                    !recorder.isRecording &&
                    !azure.isLoading && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button
                          onClick={() => {
                            recorder.reset();
                            azure.reset();
                            recordingQuality.reset();
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          重录本段
                        </Button>
                        <Button
                          onClick={handleRecorded}
                          disabled={
                            recordingQuality.isAnalyzing ||
                            !recordingQuality.report?.canSubmit
                          }
                          className="gap-2"
                        >
                          提交这一段
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  {azure.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在评分这段朗读...
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {phase.type === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 py-16"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
                className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
              />
              <p className="text-muted-foreground">{phase.message}</p>
            </motion.div>
          )}

          {phase.type === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CoverageBenchmarkCard comparison={benchmarkComparison} />
              <AssessmentReport result={phase.result} onRetake={handleRetake} />
            </motion.div>
          )}

          {phase.type === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30"
              data-smoke="assessment-passage-error"
              role="alert"
            >
              <p className="text-red-700 break-words [overflow-wrap:anywhere] dark:text-red-400">
                {phase.message}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                {phase.recoverTo && (
                  <Button
                    onClick={handleRetryCurrent}
                    variant="outline"
                    className="gap-2"
                  >
                    回到当前段
                  </Button>
                )}
                <Button
                  onClick={handleStart}
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  重新开始
                </Button>
                <Link href="/settings">
                  <Button variant="outline">检查设置</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const DIMENSION_LABELS: Record<keyof DiagnosisReport["dimensions"], string> = {
  vowels: "元音",
  consonants: "辅音",
  stress: "词重音",
  rhythm: "节奏",
  fluency: "流利度",
  connectedSpeech: "语流",
};

function formatBenchmarkDate(timestamp?: number): string {
  if (!timestamp) return "暂无上一轮";
  return new Date(timestamp).toLocaleDateString();
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function CoverageBenchmarkCard({
  comparison,
}: {
  comparison: CoverageBenchmarkComparison | null;
}) {
  if (!comparison) return null;

  const topDimensionDeltas = Object.entries(comparison.dimensionDeltas)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3) as Array<[keyof DiagnosisReport["dimensions"], number]>;

  return (
    <div className="mb-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            阶段复测对比
          </h2>
          <p className="mt-1 text-sm">{comparison.summary}</p>
        </div>
        <div className="text-right">
          <Badge
            variant={
              comparison.overallDelta >= 5
                ? "default"
                : comparison.overallDelta <= -5
                  ? "destructive"
                  : "secondary"
            }
          >
            总分 {comparison.current.overallScore}
            {comparison.previous ? ` (${signed(comparison.overallDelta)})` : ""}
          </Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            上次：{formatBenchmarkDate(comparison.previous?.timestamp)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">已解决</p>
          <p className="mt-1 text-2xl font-bold">
            {comparison.resolvedIssueIds.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            上次出现、这次没有进入 Top 问题
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            反复出现
          </p>
          <p className="mt-1 text-2xl font-bold">
            {comparison.repeatedIssueIds.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            稳定弱点，优先进入复练
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground">新增</p>
          <p className="mt-1 text-2xl font-bold">
            {comparison.newIssueIds.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            新出现或证据变强的问题
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            变化最大的维度
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topDimensionDeltas.map(([key, delta]) => (
              <Badge key={key} variant={delta < 0 ? "destructive" : "outline"}>
                {DIMENSION_LABELS[key]} {signed(delta)}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-primary/5 p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            下一步建议
          </p>
          <p className="mt-1 text-sm font-medium text-primary">
            {comparison.nextAction}
          </p>
        </div>
      </div>
    </div>
  );
}
