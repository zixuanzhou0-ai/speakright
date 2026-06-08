"use client";

import {
  ArrowLeft,
  Loader2,
  MessageCircleQuestion,
  Mic,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RecordButton } from "@/components/audio/record-button";
import { RecordingActions } from "@/components/audio/recording-actions";
import { RecordingQualityPanel } from "@/components/audio/recording-quality-panel";
import { WaveformDisplay } from "@/components/audio/waveform-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRecorder } from "@/hooks/use-recorder";
import { useRecordingQuality } from "@/hooks/use-recording-quality";
import { assessPronunciation, transcribeSpeech } from "@/lib/api-client";
import { getAzureConfig } from "@/lib/api-keys";
import { saveBenchmarkRecording } from "@/lib/benchmark-archive";
import {
  analyzeFreePracticeTransfer,
  type FreePracticeTransferSummary,
  recordFreePracticeTransfer,
} from "@/lib/free-practice-transfer";
import { loadMasteryProfile, saveMasteryProfile } from "@/lib/mastery-profile";
import { reliabilityFromRecordingQuality } from "@/lib/recording-quality";
import { buildReviewQueue } from "@/lib/review-queue";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { MasteryProfile } from "@/types/training";

const PROMPTS = [
  {
    id: "work-update",
    title: "工作进展",
    prompt: "Give a 30-second update about something you worked on today.",
  },
  {
    id: "opinion",
    title: "观点表达",
    prompt: "Explain one thing you would improve in a product you use often.",
  },
  {
    id: "story",
    title: "短故事",
    prompt: "Tell a short story about a small problem you solved recently.",
  },
];

export default function SpontaneousPage() {
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [promptId, setPromptId] = useState(PROMPTS[0].id);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<FreePracticeTransferSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const recorder = useRecorder({ maxDurationMs: 60_000 });
  const quality = useRecordingQuality(recorder.audioBlob, {
    expectedMode: "paragraph",
    minDurationMs: 2_000,
  });

  useEffect(() => {
    setProfile(loadMasteryProfile());
  }, []);

  const prompt = useMemo(
    () => PROMPTS.find((item) => item.id === promptId) ?? PROMPTS[0],
    [promptId],
  );

  const targetPacks = useMemo(() => {
    if (!profile) return [];
    const reviewPackIds = buildReviewQueue(profile)
      .slice(0, 3)
      .map((item) => item.packId);
    const activePackIds = Object.values(profile.packs)
      .filter((pack) => pack.status !== "mastered")
      .sort((a, b) => (b.failureStreak ?? 0) - (a.failureStreak ?? 0))
      .map((pack) => pack.packId);
    return Array.from(new Set([...reviewPackIds, ...activePackIds]))
      .map((packId) => TRAINING_PACKS.find((pack) => pack.id === packId))
      .filter((pack): pack is (typeof TRAINING_PACKS)[number] => !!pack)
      .slice(0, 3);
  }, [profile]);

  const resetRecording = () => {
    recorder.reset();
    quality.reset();
    setTranscript("");
    setSummary(null);
    setError(null);
  };

  const startRecording = async () => {
    resetRecording();
    await recorder.startRecording();
  };

  const submit = async () => {
    const config = getAzureConfig();
    if (!config) {
      setError("请先在设置页面配置 Azure Speech API 密钥");
      return;
    }
    if (!recorder.audioBlob || !quality.report?.canSubmit) return;

    setError(null);
    setIsProcessing(true);
    try {
      const nextTranscript = await transcribeSpeech(
        recorder.audioBlob,
        config.subscriptionKey,
        config.region,
      );
      setTranscript(nextTranscript);
      const result = await assessPronunciation(
        recorder.audioBlob,
        nextTranscript,
        config.subscriptionKey,
        config.region,
      );
      const transferSummary = {
        ...analyzeFreePracticeTransfer({
          profile,
          result,
          text: nextTranscript,
          mode: "sentence",
        }),
        transferLayer: "spontaneous" as const,
      };
      const reliability = reliabilityFromRecordingQuality(quality.report, {
        evidenceStrength:
          transferSummary.evidences.length >= 2 ? "strong" : "fair",
        note:
          quality.report.issues.length === 0
            ? "即兴表达转写后命中当前目标，可作为 spontaneous 迁移证据。"
            : "即兴表达录音存在质量提示，本次只作为观察，不提升掌握度。",
      });
      if (profile && transferSummary.evidences.length > 0) {
        const recorded = recordFreePracticeTransfer(
          profile,
          transferSummary,
          reliability,
        );
        saveMasteryProfile(recorded.profile);
        setProfile(recorded.profile);
        setSummary(recorded.summary);
      } else {
        setSummary(transferSummary);
      }
      await saveBenchmarkRecording(recorder.audioBlob, {
        source: "spontaneous",
        title: prompt.title,
        text: nextTranscript,
        score: result.pronunciationScore,
        targetLabel:
          targetPacks.map((pack) => pack.id).join(", ") || "spontaneous",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "即兴表达分析失败");
    } finally {
      setIsProcessing(false);
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
          <h1 className="text-2xl font-bold">即兴迁移测试</h1>
          <p className="text-sm text-muted-foreground">
            不先写稿，先说，再转写和保守评分；只有这里会计入 spontaneous 证据
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-3">
          {PROMPTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setPromptId(item.id);
                resetRecording();
              }}
              className={`w-full rounded-xl border bg-card p-4 text-left shadow-sm cursor-pointer ${
                promptId === item.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40"
              }`}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.prompt}
              </p>
            </button>
          ))}
        </aside>

        <main className="space-y-5">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <MessageCircleQuestion className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{prompt.title}</h2>
            </div>
            <p className="rounded-xl border bg-background p-5 text-lg leading-relaxed">
              {prompt.prompt}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {targetPacks.length === 0 ? (
                <Badge variant="outline">没有当前弱点时只保存 benchmark</Badge>
              ) : (
                targetPacks.map((pack) => (
                  <Badge key={pack.id} variant="secondary">
                    观察 {pack.title}
                  </Badge>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">录一段 20-40 秒即兴回答</h2>
            </div>
            <div className="flex flex-col items-center gap-4">
              <RecordButton
                isRecording={recorder.isRecording}
                onStart={startRecording}
                onStop={recorder.stopRecording}
                disabled={isProcessing}
              />
              <WaveformDisplay
                audioBlob={recorder.audioBlob}
                stream={recorder.stream}
              />
              <RecordingQualityPanel report={quality.report} compact />
              <RecordingActions
                hasRecording={!!recorder.audioBlob}
                isPlaying={false}
                isAssessing={isProcessing}
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
              {isProcessing && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在转写并做保守评分...
                </p>
              )}
            </div>
            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}
          </section>

          {(transcript || summary) && (
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="text-lg font-bold">即兴迁移结果</h2>
              {transcript && (
                <div className="mt-3 rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">Azure 转写</p>
                  <p className="mt-1 text-sm">{transcript}</p>
                </div>
              )}
              {summary?.evidences.length ? (
                <div className="mt-4 space-y-3">
                  {summary.evidences.map((evidence) => (
                    <div
                      key={evidence.packId}
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
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  这次即兴内容没有命中当前弱点词；录音已作为 benchmark 保存。
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={resetRecording}
                className="mt-4 gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                换题再试
              </Button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
