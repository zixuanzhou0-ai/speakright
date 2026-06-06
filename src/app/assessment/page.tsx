"use client";

import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  Loader2,
  Mic,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssessmentReport } from "@/components/assessment/assessment-report";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { LanguageModuleGate } from "@/components/common/language-module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useMwPronunciation } from "@/hooks/use-mw-pronunciation";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import {
  ADAPTIVE_ASSESSMENT_WORDS,
  ASSESSMENT_PARAGRAPH,
  ASSESSMENT_WORDS,
} from "@/lib/assessment-texts";
import {
  buildDiagnosisReport,
  selectAdaptiveAssessmentWords,
} from "@/lib/diagnosis-engine";
import { buildTargetedRetestWords } from "@/lib/diagnosis-review-package";
import { getPhonemeBySlug } from "@/lib/phoneme-data";
import { buildTrainingPrescription } from "@/lib/training-prescription";
import type {
  AssessmentPhase,
  AssessmentWord,
  AssessmentResult as LegacyAssessmentResult,
} from "@/types/assessment";
import type { AzureAssessmentResult } from "@/types/azure";
import type {
  AssessmentRecording,
  DiagnosisReport,
  RecordingQualitySnapshot,
} from "@/types/diagnosis";

const STORAGE_KEY_V2 = "speakright_assessment_result_v2";
const LEGACY_STORAGE_KEY = "speakright_assessment_result";

function migrateLegacyResult(legacy: LegacyAssessmentResult): DiagnosisReport {
  const phonemeScores: DiagnosisReport["phonemeScores"] = {};
  for (const [slug, score] of Object.entries(legacy.phonemeScores)) {
    phonemeScores[slug] = { score, sampleCount: score > 0 ? 1 : 0 };
  }
  const issues = legacy.weakPhonemes.slice(0, 3).map((slug) => {
    const phoneme = getPhonemeBySlug(slug);
    return {
      id: `legacy-${slug}`,
      severity: "major" as const,
      type: "phoneme" as const,
      title: `${phoneme?.ipa ?? slug} 需要复测`,
      targetPhonemes: [slug],
      evidence: [
        {
          text: phoneme?.name ?? slug,
          score: legacy.phonemeScores[slug] ?? 0,
          detail: "来自旧版诊断结果，建议重新测试以生成证据和训练处方。",
        },
      ],
      impact: "旧版报告只有平均分，没有足够证据判断错因。",
      fixCue: phoneme?.description ?? "重新诊断后会生成更具体的发音动作。",
      recommendedPackIds: [],
    };
  });

  return {
    version: 2,
    timestamp: legacy.timestamp,
    overallScore: legacy.overallScore,
    dimensions: {
      ...legacy.dimensions,
      connectedSpeech: Math.round(
        (legacy.dimensions.rhythm + legacy.dimensions.fluency) / 2,
      ),
    },
    phonemeScores,
    issues,
    prescription: buildTrainingPrescription(issues, "diagnosis"),
    rawEvidence: [],
  };
}

function loadSavedReport(): DiagnosisReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) return JSON.parse(raw) as DiagnosisReport;

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      return migrateLegacyResult(
        JSON.parse(legacyRaw) as LegacyAssessmentResult,
      );
    }
  } catch {
    return null;
  }
  return null;
}

function saveReport(report: DiagnosisReport) {
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(report));
}

function targetLabels(word: AssessmentWord): string[] {
  return word.targetPhonemes.map((slug) => getPhonemeBySlug(slug)?.ipa ?? slug);
}

export default function AssessmentPage() {
  const [retestIssueId, setRetestIssueId] = useState<string | null>(null);
  const [savedReport, setSavedReport] = useState<DiagnosisReport | null>(() =>
    loadSavedReport(),
  );
  const [phase, setPhase] = useState<AssessmentPhase>({ type: "intro" });

  const recorder = useRecorder({ maxDurationMs: 60_000 });
  const azure = useAzureAssessment();
  const mw = useMwPronunciation();
  const recordingQuality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: phase.type === "paragraph" ? "paragraph" : "word",
    minDurationMs: phase.type === "paragraph" ? 1200 : 500,
  });

  const wordRecordingsRef = useRef<AssessmentRecording[]>([]);
  const paragraphResultRef = useRef<AzureAssessmentResult | null>(null);
  const paragraphQualityRef = useRef<RecordingQualitySnapshot | undefined>(
    undefined,
  );
  const targetedRetestRef = useRef(false);
  const didAutostartRetestRef = useRef(false);

  useEffect(() => {
    setRetestIssueId(new URLSearchParams(window.location.search).get("retest"));
  }, []);

  const finalizeReport = useCallback(
    (paragraphResult: AzureAssessmentResult) => {
      const report = buildDiagnosisReport({
        wordRecordings: wordRecordingsRef.current,
        paragraphResult,
        paragraphText: ASSESSMENT_PARAGRAPH,
        paragraphRecordingQuality: paragraphQualityRef.current,
      });
      saveReport(report);
      setSavedReport(report);
      setPhase({ type: "report", result: report });
    },
    [],
  );

  const handleStart = useCallback(() => {
    targetedRetestRef.current = false;
    wordRecordingsRef.current = [];
    paragraphResultRef.current = null;
    paragraphQualityRef.current = undefined;
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setPhase({ type: "words", index: 0 });
  }, [azure, recorder, recordingQuality]);

  const handleTargetedRetest = useCallback(
    (issueId: string) => {
      const report = loadSavedReport();
      const issue = report?.issues.find((item) => item.id === issueId);
      const words = issue ? buildTargetedRetestWords(issue) : [];
      if (words.length === 0) {
        handleStart();
        return;
      }
      targetedRetestRef.current = true;
      wordRecordingsRef.current = [];
      paragraphResultRef.current = null;
      paragraphQualityRef.current = undefined;
      recorder.reset();
      recordingQuality.reset();
      azure.reset();
      setPhase({ type: "adaptive", index: 0, words });
    },
    [azure, handleStart, recorder, recordingQuality],
  );

  useEffect(() => {
    if (!retestIssueId || didAutostartRetestRef.current) return;
    didAutostartRetestRef.current = true;
    handleTargetedRetest(retestIssueId);
  }, [handleTargetedRetest, retestIssueId]);

  const handleWordRecorded = useCallback(async () => {
    if (!recorder.audioBlob) return;
    if (phase.type !== "words" && phase.type !== "adaptive") return;
    const qualityReport = recordingQuality.report;
    if (recordingQuality.isAnalyzing || !qualityReport?.canSubmit) {
      return;
    }

    const word =
      phase.type === "words"
        ? ASSESSMENT_WORDS[phase.index]
        : phase.words[phase.index];
    const result = await azure.assess(recorder.audioBlob, word.word);

    if (!result) return;
    wordRecordingsRef.current.push({
      prompt: word,
      result,
      source: phase.type === "words" ? "word" : "adaptive",
      recordingQuality: qualityReport,
    });

    recorder.reset();
    recordingQuality.reset();
    azure.reset();

    if (phase.type === "words") {
      const nextIndex = phase.index + 1;
      if (nextIndex < ASSESSMENT_WORDS.length) {
        setPhase({ type: "words", index: nextIndex });
      } else {
        setPhase({ type: "paragraph" });
      }
      return;
    }

    const nextIndex = phase.index + 1;
    if (nextIndex < phase.words.length) {
      setPhase({ type: "adaptive", index: nextIndex, words: phase.words });
    } else if (paragraphResultRef.current) {
      setPhase({ type: "analyzing" });
      finalizeReport(paragraphResultRef.current);
    } else {
      setPhase({ type: "paragraph" });
    }
  }, [
    recorder.audioBlob,
    phase,
    azure,
    recorder,
    recordingQuality,
    finalizeReport,
  ]);

  const handleParagraphRecorded = useCallback(async () => {
    if (!recorder.audioBlob) return;
    const qualityReport = recordingQuality.report;
    if (recordingQuality.isAnalyzing || !qualityReport?.canSubmit) {
      return;
    }

    const result = await azure.assess(recorder.audioBlob, ASSESSMENT_PARAGRAPH);
    if (!result) {
      setPhase({ type: "error", message: azure.error || "评估失败" });
      return;
    }

    paragraphResultRef.current = result;
    paragraphQualityRef.current = qualityReport;
    setPhase({ type: "analyzing" });

    const preliminaryReport = buildDiagnosisReport({
      wordRecordings: wordRecordingsRef.current,
      paragraphResult: result,
      paragraphText: ASSESSMENT_PARAGRAPH,
      paragraphRecordingQuality: qualityReport,
    });
    const adaptiveWords = selectAdaptiveAssessmentWords(
      preliminaryReport,
      ADAPTIVE_ASSESSMENT_WORDS,
      wordRecordingsRef.current.map((recording) => recording.prompt.word),
    );

    recorder.reset();
    recordingQuality.reset();
    azure.reset();

    if (targetedRetestRef.current) {
      targetedRetestRef.current = false;
      finalizeReport(result);
      return;
    }

    if (adaptiveWords.length > 0) {
      setPhase({ type: "adaptive", index: 0, words: adaptiveWords });
    } else {
      finalizeReport(result);
    }
  }, [recorder.audioBlob, azure, recorder, recordingQuality, finalizeReport]);

  const handleRecordStop = useCallback(() => {
    recorder.stopRecording();
  }, [recorder]);

  const handleRetake = () => {
    localStorage.removeItem(STORAGE_KEY_V2);
    setSavedReport(null);
    recorder.reset();
    recordingQuality.reset();
    azure.reset();
    setPhase({ type: "intro" });
  };

  const currentWord =
    phase.type === "words"
      ? ASSESSMENT_WORDS[phase.index]
      : phase.type === "adaptive"
        ? phase.words[phase.index]
        : null;

  return (
    <LanguageModuleGate moduleName="发音诊断" readinessKey="diagnosis">
      <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <h1 className="mb-2 text-2xl font-bold shrink-0">发音诊断</h1>
      <p className="mb-4 text-muted-foreground shrink-0">
        {phase.type === "report"
          ? "你的发音诊断报告和训练处方"
          : "快速诊断 3-4 分钟，找出最该训练的英语发音问题"}
      </p>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          {phase.type === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Mic className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">快速诊断</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    先读 10
                    个筛查词，再读一段短文；如果证据不足，系统会自动补测最多 4
                    个词。完成后直接给训练处方。
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={handleStart}
                    size="lg"
                    className="gap-2 cursor-pointer"
                  >
                    开始快速诊断
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Link href="/assessment/passage">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 cursor-pointer"
                    >
                      <BookOpenCheck className="h-4 w-4" />
                      全音覆盖朗读
                    </Button>
                  </Link>
                  {savedReport && (
                    <Button
                      onClick={() =>
                        setPhase({ type: "report", result: savedReport })
                      }
                      variant="outline"
                      size="lg"
                      className="gap-2 cursor-pointer"
                    >
                      <ClipboardList className="h-4 w-4" />
                      查看上次报告
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {(phase.type === "words" || phase.type === "adaptive") &&
            currentWord && (
              <motion.div
                key={`${phase.type}-${currentWord.word}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="max-w-lg mx-auto space-y-4"
              >
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {phase.type === "words"
                      ? `筛查 ${phase.index + 1} / ${ASSESSMENT_WORDS.length}`
                      : `补测 ${phase.index + 1} / ${phase.words.length}`}
                  </span>
                  <span>
                    {phase.type === "words" ? "第一部分" : "自适应补测"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width:
                        phase.type === "words"
                          ? `${(phase.index / (ASSESSMENT_WORDS.length + 1)) * 100}%`
                          : `${((phase.index + 1) / phase.words.length) * 100}%`,
                    }}
                  />
                </div>

                <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {targetLabels(currentWord).map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-4xl font-bold">{currentWord.word}</span>
                  <span className="block font-mono text-lg text-muted-foreground">
                    {currentWord.ipa}
                  </span>
                  {currentWord.purpose && (
                    <p className="text-xs text-muted-foreground">
                      {currentWord.purpose}
                    </p>
                  )}

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => mw.playWord(currentWord.word)}
                    disabled={mw.isLoading}
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary cursor-pointer disabled:opacity-50"
                  >
                    {mw.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </motion.button>

                  <RecordButton
                    isRecording={recorder.isRecording}
                    onStart={() => {
                      recorder.reset();
                      azure.reset();
                      recorder.startRecording();
                    }}
                    onStop={handleRecordStop}
                    disabled={azure.isLoading}
                  />

                  <WaveformDisplay
                    audioBlob={recorder.audioBlob}
                    stream={recorder.stream}
                  />
                  <RecordingQualityPanel
                    report={recordingQuality.report}
                    compact
                  />

                  {recorder.audioBlob &&
                    !recorder.isRecording &&
                    !azure.isLoading && (
                      <Button
                        onClick={handleWordRecorded}
                        disabled={
                          recordingQuality.isAnalyzing ||
                          !recordingQuality.report?.canSubmit
                        }
                        className="cursor-pointer"
                      >
                        确认，继续
                      </Button>
                    )}
                  {azure.isLoading && (
                    <p className="text-sm text-muted-foreground">评分中...</p>
                  )}
                </div>
              </motion.div>
            )}

          {phase.type === "paragraph" && (
            <motion.div
              key="paragraph"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-4"
            >
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>短文朗读</span>
                <span>第二部分：节奏、弱读、连读</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(ASSESSMENT_WORDS.length / (ASSESSMENT_WORDS.length + 1)) * 100}%`,
                  }}
                />
              </div>

              <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                <p className="text-sm text-muted-foreground">
                  请按自然语速朗读以下短文。这里主要检测重音、弱读、连读、停顿和流利度。
                </p>
                <p className="text-base leading-relaxed">
                  {ASSESSMENT_PARAGRAPH}
                </p>

                <div className="flex flex-col items-center gap-3">
                  <RecordButton
                    isRecording={recorder.isRecording}
                    onStart={() => {
                      recorder.reset();
                      azure.reset();
                      recorder.startRecording();
                    }}
                    onStop={handleRecordStop}
                    disabled={azure.isLoading}
                  />
                  <WaveformDisplay
                    audioBlob={recorder.audioBlob}
                    stream={recorder.stream}
                  />
                  <RecordingQualityPanel
                    report={recordingQuality.report}
                    compact
                  />

                  {recorder.audioBlob &&
                    !recorder.isRecording &&
                    !azure.isLoading && (
                      <Button
                        onClick={handleParagraphRecorded}
                        disabled={
                          recordingQuality.isAnalyzing ||
                          !recordingQuality.report?.canSubmit
                        }
                        className="cursor-pointer"
                      >
                        提交，生成报告
                      </Button>
                    )}
                  {azure.isLoading && (
                    <p className="text-sm text-muted-foreground">
                      正在分析你的句子韵律...
                    </p>
                  )}
                </div>
              </div>
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
              <p className="text-muted-foreground">正在生成诊断和训练处方...</p>
            </motion.div>
          )}

          {phase.type === "report" && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AssessmentReport result={phase.result} onRetake={handleRetake} />
            </motion.div>
          )}

          {phase.type === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-lg mx-auto rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30"
            >
              <p className="text-red-700 dark:text-red-400">{phase.message}</p>
              <Button
                onClick={handleStart}
                variant="outline"
                className="mt-3 gap-2 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                重试
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </LanguageModuleGate>
  );
}
