"use client";

import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { LanguageModuleGate } from "@/components/common/language-module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAzureAssessment } from "@/hooks/use-azure-assessment";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { useTtsAligned } from "@/hooks/use-tts-aligned";
import { saveBenchmarkRecording } from "@/lib/benchmark-archive";
import {
  analyzeFreePracticeTransfer,
  type FreePracticeTransferSummary,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import { DEFAULT_LANGUAGE_ID } from "@/lib/language-profiles";
import { loadMasteryProfile, saveMasteryProfile } from "@/lib/mastery-profile";
import { reliabilityFromRecordingQuality } from "@/lib/recording-quality";
import {
  buildTransferPromptPlan,
  TRANSFER_SCENARIOS,
} from "@/lib/transfer-scenarios";
import type { MasteryProfile } from "@/types/training";

export default function ScenariosPage() {
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [scenarioId, setScenarioId] = useState(TRANSFER_SCENARIOS[0].id);
  const [userText, setUserText] = useState("");
  const [summary, setSummary] = useState<FreePracticeTransferSummary | null>(
    null,
  );
  const recorder = useRecorder({ maxDurationMs: 45_000 });
  const assessment = useAzureAssessment();
  const tts = useTtsAligned();
  const quality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: "sentence",
    minDurationMs: 1_000,
  });

  useEffect(() => {
    setProfile(loadMasteryProfile(DEFAULT_LANGUAGE_ID));
  }, []);

  const plan = useMemo(
    () => buildTransferPromptPlan(scenarioId, profile),
    [scenarioId, profile],
  );

  const textToRead = userText.trim() || plan.scenario.sentenceFrame;

  const resetRecording = () => {
    recorder.reset();
    assessment.reset();
    quality.reset();
    setSummary(null);
  };

  const startRecording = async () => {
    setSummary(null);
    assessment.reset();
    quality.reset();
    await recorder.startRecording();
  };

  const submit = async () => {
    if (!recorder.audioBlob || !quality.report?.canSubmit) return;
    const result = await assessment.assess(recorder.audioBlob, textToRead);
    if (!result) return;
    const transferSummary = analyzeFreePracticeTransfer({
      profile,
      result,
      text: textToRead,
      mode: "sentence",
    });
    setSummary(transferSummary);
    if (profile && transferSummary.evidences.length > 0) {
      const reliability = reliabilityFromRecordingQuality(quality.report, {
        evidenceStrength:
          transferSummary.evidences.length >= 2 ? "strong" : "fair",
        note:
          quality.report?.issues.length === 0
            ? "场景迁移命中当前目标且录音质量稳定，可计入迁移证据。"
            : "场景迁移录音存在质量提示，本次只作为观察，不提升掌握度。",
      });
      const recorded = recordFreePracticeTransfer(
        profile,
        transferSummary,
        reliability,
      );
      saveMasteryProfile(recorded.profile, DEFAULT_LANGUAGE_ID);
      setProfile(recorded.profile);
      setSummary(recorded.summary);
    }
    try {
      await saveBenchmarkRecording(recorder.audioBlob, {
        source: "scenario",
        title: plan.scenario.title,
        text: textToRead,
        score: result.pronunciationScore,
        targetLabel: plan.targetPackIds.join(", "),
      });
    } catch (error) {
      console.warn("[Benchmark archive] failed to save scenario", error);
    }
  };

  const qualityDisabled =
    !!recorder.audioBlob && (quality.isAnalyzing || !quality.report?.canSubmit);

  return (
    <LanguageModuleGate moduleName="场景迁移训练" readinessKey="evidenceMastery">
      <div className="h-full overflow-y-auto px-6 py-4 scrollbar-thin">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/drill"
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">场景迁移训练</h1>
          <p className="text-sm text-muted-foreground">
            不看固定材料，把当前弱点迁移到真实表达任务
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-3">
          {TRANSFER_SCENARIOS.map((scenario) => (
            <motion.button
              key={scenario.id}
              type="button"
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setScenarioId(scenario.id);
                setUserText("");
                resetRecording();
              }}
              className={`w-full rounded-xl border bg-card p-4 text-left shadow-sm cursor-pointer ${
                scenarioId === scenario.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{scenario.title}</p>
                <Badge variant="outline">{scenario.kind}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{scenario.goal}</p>
            </motion.button>
          ))}
        </aside>

        <main className="space-y-5">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{plan.scenario.title}</h2>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm font-semibold">任务</p>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                {plan.prompt}
              </p>
              <p className="mt-4 text-sm font-medium text-primary">
                {plan.coachingFocus}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.targetWords.slice(0, 8).map((word) => (
                  <Badge key={word} variant="secondary">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>

            <label
              htmlFor="scenario-answer"
              className="mt-5 block text-sm font-semibold"
            >
              你的回答
            </label>
            <textarea
              id="scenario-answer"
              value={userText}
              onChange={(event) => setUserText(event.target.value)}
              placeholder={plan.scenario.sentenceFrame}
              className="mt-2 min-h-28 w-full resize-none rounded-xl border bg-background p-4 text-sm outline-none focus:border-primary"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserText(plan.scenario.sentenceFrame)}
                className="cursor-pointer"
              >
                使用句型框架
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => tts.speak(textToRead, 0.86)}
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
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
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
                isPlaying={false}
                isAssessing={assessment.isLoading}
                onReplay={() => {
                  if (!recorder.audioBlob) return;
                  const url = URL.createObjectURL(recorder.audioBlob);
                  const audio = new Audio(url);
                  audio.onended = () => URL.revokeObjectURL(url);
                  audio.play();
                }}
                onClear={resetRecording}
                onAssess={submit}
                assessDisabled={qualityDisabled}
                assessDisabledReason="录音质量还没通过基础检查"
              />
            </div>
            {(recorder.error || assessment.error) && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {recorder.error ?? assessment.error}
              </p>
            )}
          </section>

          {summary && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                {summary.evidences.every((item) => item.passed) &&
                summary.evidences.length > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                )}
                <h2 className="text-lg font-bold">迁移证据</h2>
              </div>
              {summary.evidences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  这次文本没有命中当前复习目标。可以加入上方推荐词，再录一次。
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.evidences.map((evidence) => (
                    <div
                      key={`${evidence.packId}-${evidence.levelId}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{evidence.packTitle}</p>
                        <Badge
                          variant={evidence.passed ? "default" : "secondary"}
                        >
                          {evidence.targetScore}/{evidence.threshold}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {evidence.reason}
                      </p>
                      <p className="mt-2 text-sm font-medium text-primary">
                        下一次只改：{evidence.nextCue}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
      </div>
    </LanguageModuleGate>
  );
}
