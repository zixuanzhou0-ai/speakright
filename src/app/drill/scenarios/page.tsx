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
  analyzeFreePracticeTransfer,
  type FreePracticeTransferSummary,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import { getLanguageProfile } from "@/lib/language-profiles";
import { LOCAL_MASTERY_SAVE_WARNING } from "@/lib/local-save-warning";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";
import { loadMasteryProfile, saveMasteryProfile } from "@/lib/mastery-profile";
import {
  getCenteredReadableTextClassName,
  getPracticeTextDensity,
} from "@/lib/practice-text-presentation";
import { reliabilityFromRecordingQuality } from "@/lib/recording-quality";
import {
  buildTransferPromptPlan,
  TRANSFER_SCENARIOS,
} from "@/lib/transfer-scenarios";
import type { MasteryProfile } from "@/types/training";

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";
const WRAP_SAFE_BADGE_CLASS =
  "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export default function ScenariosPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [scenarioId, setScenarioId] = useState(TRANSFER_SCENARIOS[0].id);
  const [userText, setUserText] = useState("");
  const [summary, setSummary] = useState<FreePracticeTransferSummary | null>(
    null,
  );
  const [archiveWarning, setArchiveWarning] = useState<string | null>(null);
  const [localSaveWarning, setLocalSaveWarning] = useState<string | null>(null);
  const recorder = useRecorder({ maxDurationMs: 45_000 });
  const assessment = useAzureAssessment();
  const tts = useTtsAligned();
  const replayAudio = useAudioPlayer();
  const quality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: "sentence",
    minDurationMs: 1_000,
  });

  useEffect(() => {
    setProfile(loadMasteryProfile());
  }, []);

  const canUseMasteryTransfer = canRecordFormalMastery(languageId);
  const transferProfile = canUseMasteryTransfer ? profile : null;
  const plan = useMemo(
    () => buildTransferPromptPlan(scenarioId, transferProfile),
    [scenarioId, transferProfile],
  );

  const textToRead = userText.trim() || plan.scenario.sentenceFrame;
  const promptDensity = getPracticeTextDensity(plan.prompt, "sentence");

  const resetRecording = () => {
    replayAudio.stop();
    recorder.reset();
    assessment.reset();
    quality.reset();
    setSummary(null);
    setArchiveWarning(null);
    setLocalSaveWarning(null);
  };

  const startRecording = async () => {
    setSummary(null);
    setArchiveWarning(null);
    setLocalSaveWarning(null);
    assessment.reset();
    quality.reset();
    await recorder.startRecording();
  };

  const submit = async () => {
    if (!recorder.audioBlob || !quality.report?.canSubmit) return;
    const result = await assessment.assess(
      recorder.audioBlob,
      textToRead,
      languageProfile.azureLocale,
    );
    if (!result) return;
    const transferSummary = analyzeFreePracticeTransfer({
      profile: transferProfile,
      result,
      text: textToRead,
      mode: "sentence",
    });
    setSummary(transferSummary);
    if (
      canUseMasteryTransfer &&
      profile &&
      transferSummary.evidences.length > 0
    ) {
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
      const profileSaved = saveMasteryProfile(recorded.profile);
      setLocalSaveWarning(profileSaved ? null : LOCAL_MASTERY_SAVE_WARNING);
      setProfile(recorded.profile);
      setSummary(recorded.summary);
    } else {
      setLocalSaveWarning(null);
    }
    try {
      await saveBenchmarkRecording(recorder.audioBlob, {
        source: "scenario",
        title: plan.scenario.title,
        text: textToRead,
        score: result.pronunciationScore,
        targetLabel: plan.targetPackIds.join(", "),
      });
      setArchiveWarning(null);
    } catch (error) {
      console.warn("[Benchmark archive] failed to save scenario", error);
      setArchiveWarning(getBenchmarkArchiveSaveErrorMessage(error));
    }
  };

  const qualityDisabled =
    !!recorder.audioBlob && (quality.isAnalyzing || !quality.report?.canSubmit);

  return (
    <div
      data-smoke="scenario-page"
      className="h-full overflow-y-auto px-6 py-4 scrollbar-thin"
    >
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <Link
          href="/drill"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
            场景迁移训练
          </h1>
          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
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
              className={`w-full rounded-xl border bg-card p-4 text-center shadow-sm cursor-pointer ${
                scenarioId === scenario.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
                <p className="break-words font-semibold [overflow-wrap:anywhere]">
                  {scenario.title}
                </p>
                <Badge
                  variant="outline"
                  className={WRAP_SAFE_BADGE_CLASS}
                  data-smoke="scenario-kind-badge"
                >
                  {scenario.kind}
                </Badge>
              </div>
              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {scenario.goal}
              </p>
            </motion.button>
          ))}
        </aside>

        <main className="space-y-5">
          <section
            data-smoke="scenario-prompt-card"
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-primary" />
              <h2 className="break-words text-xl font-bold [overflow-wrap:anywhere]">
                {plan.scenario.title}
              </h2>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-center text-sm font-semibold">任务</p>
              <p
                className={`${getCenteredReadableTextClassName(
                  promptDensity,
                )} mt-1 whitespace-pre-line text-muted-foreground`}
              >
                {plan.prompt}
              </p>
              <p className="mt-4 break-words text-center text-sm font-medium text-primary [overflow-wrap:anywhere]">
                {plan.coachingFocus}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {plan.targetWords.slice(0, 8).map((word) => (
                  <Badge
                    key={word}
                    variant="secondary"
                    className="max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]"
                  >
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
                className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
              >
                使用句型框架
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  tts.speak(textToRead, { speed: 0.86, languageId })
                }
                disabled={tts.isLoading}
                className={`gap-2 cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
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
                data-smoke="scenario-demo-audio-error"
                className="mt-3 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 [overflow-wrap:anywhere] dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {tts.error}
              </p>
            )}
          </section>

          <section
            data-smoke="scenario-recording-card"
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
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
                  if (recorder.audioBlob)
                    replayAudio.playBlob(recorder.audioBlob);
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
                data-smoke="scenario-assessment-error"
                className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 [overflow-wrap:anywhere] dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
              >
                {recorder.error ?? assessment.error}
              </p>
            )}
            {archiveWarning && (
              <p
                role="alert"
                data-smoke="scenario-benchmark-archive-warning"
                className="mt-4 break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 [overflow-wrap:anywhere] dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {archiveWarning}
              </p>
            )}
            {localSaveWarning && (
              <p
                role="alert"
                data-smoke="scenario-local-save-warning"
                className="mt-4 break-words rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 [overflow-wrap:anywhere] dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                {localSaveWarning}
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
                      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                        <p className="break-words font-semibold [overflow-wrap:anywhere]">
                          {evidence.packTitle}
                        </p>
                        <Badge
                          variant={evidence.passed ? "default" : "secondary"}
                          className={WRAP_SAFE_BADGE_CLASS}
                          data-smoke="scenario-evidence-score-badge"
                        >
                          {evidence.targetScore}/{evidence.threshold}
                        </Badge>
                      </div>
                      <p className="mt-2 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {evidence.reason}
                      </p>
                      <p className="mt-2 break-words text-center text-sm font-medium text-primary [overflow-wrap:anywhere]">
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
  );
}
