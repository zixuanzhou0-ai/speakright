"use client";

import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import {
  getBenchmarkArchiveSaveErrorMessage,
  saveBenchmarkRecording,
} from "@/lib/benchmark-archive";
import {
  loadMasteryProfile,
  recordTrainingSession,
  saveMasteryProfile,
} from "@/lib/mastery-profile";
import {
  analyzeProsodyAttempt,
  buildProsodyTrainingSession,
  PROSODY_EXERCISES,
  type ProsodyAnalysis,
} from "@/lib/prosody-training";
import { getLanguageProfile } from "@/lib/language-profiles";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";
import {
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";

export default function ProsodyPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [selectedId, setSelectedId] = useState(PROSODY_EXERCISES[0].id);
  const [analysis, setAnalysis] = useState<ProsodyAnalysis | null>(null);
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);
  const recorder = useRecorder({ maxDurationMs: 35_000 });
  const assessment = useAzureAssessment();
  const tts = useTtsAligned();
  const replayAudio = useAudioPlayer();
  const quality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: "sentence",
    minDurationMs: 1_200,
  });

  const exercise = useMemo(
    () =>
      PROSODY_EXERCISES.find((item) => item.id === selectedId) ??
      PROSODY_EXERCISES[0],
    [selectedId],
  );
  const exerciseDensity = getPracticeTextDensity(exercise.displayText, "sentence");

  const resetRecording = () => {
    replayAudio.stop();
    recorder.reset();
    assessment.reset();
    quality.reset();
    setAnalysis(null);
    setArchiveWarning(null);
  };

  const startRecording = async () => {
    setAnalysis(null);
    setArchiveWarning(null);
    assessment.reset();
    quality.reset();
    await recorder.startRecording();
  };

  const submit = async () => {
    if (!recorder.audioBlob || !quality.report?.canSubmit) return;
    const result = await assessment.assess(
      recorder.audioBlob,
      exercise.text,
      languageProfile.azureLocale,
    );
    if (!result) return;
    const nextAnalysis = analyzeProsodyAttempt(exercise, result);
    setAnalysis(nextAnalysis);
    if (canRecordFormalMastery(languageId)) {
      const profile = recordTrainingSession(
        loadMasteryProfile(),
        buildProsodyTrainingSession(exercise, nextAnalysis),
      );
      saveMasteryProfile(profile);
    }
    try {
      await saveBenchmarkRecording(recorder.audioBlob, {
        source: "prosody",
        title: exercise.title,
        text: exercise.text,
        score: Math.round(nextAnalysis.prosodyScore),
        targetLabel: exercise.kind,
      });
      setArchiveWarning(null);
    } catch (error) {
      console.warn("[Benchmark archive] failed to save audio", error);
      setArchiveWarning(getBenchmarkArchiveSaveErrorMessage(error));
    }
  };

  const qualityDisabled =
    !!recorder.audioBlob && (quality.isAnalyzing || !quality.report?.canSubmit);

  return (
    <div className="h-full overflow-y-auto px-6 py-4 scrollbar-thin">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">韵律与重音训练</h1>
          <p className="text-sm text-muted-foreground">
            练内容词突出、弱读、停顿分组、连读和短块 shadowing
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          {PROSODY_EXERCISES.map((item) => (
            <motion.button
              key={item.id}
              type="button"
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedId(item.id);
                resetRecording();
              }}
              className={`w-full rounded-xl border bg-card p-4 text-center shadow-sm transition-colors cursor-pointer ${
                selectedId === item.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <p className="break-words font-semibold [overflow-wrap:anywhere]">
                  {item.title}
                </p>
                <Badge variant="outline">{item.kind}</Badge>
              </div>
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {item.coachCue}
              </p>
            </motion.button>
          ))}
        </aside>

        <main className="space-y-5">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{exercise.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  通过线：韵律 {exercise.pass.minProsody} · 流利度{" "}
                  {exercise.pass.minFluency} · 准确度{" "}
                  {exercise.pass.minAccuracy}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  tts.speak(exercise.text, { speed: 0.82, languageId })
                }
                disabled={tts.isLoading}
                className="gap-2 cursor-pointer"
              >
                {tts.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                听示范
              </Button>
            </div>
            {tts.error && (
              <p
                role="alert"
                data-smoke="prosody-demo-audio-error"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {tts.error}
              </p>
            )}

            <div className="rounded-xl border bg-background p-5">
              <p
                className={`${getCenteredReadableTextClassName(
                  exerciseDensity,
                )} font-mono`}
              >
                {exercise.displayText}
              </p>
              <p className="mt-4 break-words text-center text-sm font-medium text-primary [overflow-wrap:anywhere]">
                这一题只练：{exercise.coachCue}
              </p>
              <p className="mt-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                模式：{exercise.targetPattern}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {exercise.focusWords.map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]"
                  >
                    重读 {word}
                  </Badge>
                ))}
                {exercise.weakWords.slice(0, 4).map((word) => (
                  <Badge
                    key={word}
                    variant="outline"
                    className="max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]"
                  >
                    弱读 {word}
                  </Badge>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">录音与评分</h2>
            </div>
            <div className="flex flex-col items-center gap-4">
              <RecordButton
                isRecording={recorder.isRecording}
                onStart={startRecording}
                onStop={recorder.stopRecording}
                disabled={assessment.isLoading}
              />
              <WaveformDisplay
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
              />
              {quality.isAnalyzing && (
                <p className="text-xs text-muted-foreground">
                  正在检查录音质量...
                </p>
              )}
              <RecordingQualityPanel report={quality.report} compact />
              <RecordingActions
                hasRecording={!!recorder.audioBlob}
                isPlaying={replayAudio.isPlaying}
                isAssessing={assessment.isLoading}
                onReplay={() => {
                  if (recorder.audioBlob) replayAudio.playBlob(recorder.audioBlob);
                }}
                onClear={resetRecording}
                onAssess={submit}
                assessDisabled={qualityDisabled}
                assessDisabledReason="录音质量还没通过基础检查"
              />
            </div>
            {(recorder.error || assessment.error) && (
              <p
                role="alert"
                data-smoke="prosody-assessment-error"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {recorder.error ?? assessment.error}
              </p>
            )}
            {archiveWarning && (
              <p
                role="alert"
                data-smoke="prosody-benchmark-archive-warning"
                className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {archiveWarning}
              </p>
            )}
          </section>

          {analysis && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {analysis.passed ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <RotateCcw className="h-5 w-5 text-amber-500" />
                  )}
                  <h2 className="text-lg font-bold">
                    {analysis.passed ? "这一层通过" : "先做一次慢速复练"}
                  </h2>
                </div>
                <Badge variant={analysis.passed ? "default" : "secondary"}>
                  {analysis.likelyIssue}
                </Badge>
                <Badge variant="outline">
                  证据 {analysis.evidenceConfidence}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Metric label="韵律" value={analysis.prosodyScore} />
                <Metric label="流利度" value={analysis.fluencyScore} />
                <Metric label="准确度" value={analysis.accuracyScore} />
                <Metric label="完整度" value={analysis.completenessScore} />
              </div>
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold">下一次只改一个动作</p>
                <p className="mt-1 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {analysis.nextCue}
                </p>
              </div>
              {analysis.missingFocusWords.length > 0 && (
                <p className="mt-3 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  漏读/识别不足的重点词：
                  {analysis.missingFocusWords.join(", ")}
                </p>
              )}
              {analysis.overHeavyFunctionWords.length > 0 && (
                <p className="mt-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  可能过重的功能词：
                  {analysis.overHeavyFunctionWords.join(", ")}
                </p>
              )}
              {analysis.missingExpectedPauses.length > 0 && (
                <p className="mt-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  缺少停顿的位置：
                  {analysis.missingExpectedPauses.join(", ")}
                </p>
              )}
              {analysis.unexpectedPauses.length > 0 && (
                <p className="mt-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  不该断开的地方：
                  {analysis.unexpectedPauses.join(", ")}
                </p>
              )}
              {analysis.evidenceConfidence === "low" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  本次没有拿到词级 break
                  feedback，韵律判断主要参考总分，只作为低置信度提示。
                </p>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{Math.round(value)}</p>
    </div>
  );
}
