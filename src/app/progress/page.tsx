"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Play,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LanguageCoreOnlyBoundary } from "@/components/common/language-core-only-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
  type BenchmarkRecordingMeta,
  clearBenchmarkRecordings,
  deleteBenchmarkRecording,
  getBenchmarkAudioBlob,
  listBenchmarkRecordings,
  summarizeBenchmarkGroups,
  summarizeBenchmarkTrend,
} from "@/lib/benchmark-archive";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  loadLearningEvidence,
  summarizeLearningEvidence,
} from "@/lib/learning-evidence";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";
import {
  getMasteryProfileStorageWarning,
  loadMasteryProfile,
} from "@/lib/mastery-profile";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { MasteryProfile } from "@/types/training";

type ProgressArchiveStatus = {
  tone: "success" | "warning" | "error";
  message: string;
};

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

const EVIDENCE_LADDER = [
  { stage: "discriminated", label: "能听出", href: "/drill/perception" },
  { stage: "controlled", label: "受控表达", href: "/drill" },
  { stage: "varied", label: "多词境稳定", href: "/drill" },
  { stage: "transfer_observed", label: "句子迁移", href: "/sentences" },
  { stage: "retention_observed", label: "延迟保持", href: "/drill" },
] as const;
function getProgressArchiveErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (message && /[\u4e00-\u9fff]/.test(message)) return message;
  const lowerMessage = message.toLowerCase();

  if (/indexeddb|database|\bidb\b/.test(lowerMessage)) {
    return `${fallback}：本机 IndexedDB 数据库不可用，请关闭其它 SpeakRight 窗口后重试，必要时重启应用。`;
  }

  if (/quota|space|full|storage/.test(lowerMessage)) {
    return `${fallback}：本机存储空间可能不足，请清理磁盘空间或应用缓存后重试。`;
  }

  if (/permission|denied|blocked|access/.test(lowerMessage)) {
    return `${fallback}：系统阻止了本机录音数据访问，请检查应用权限或安全软件设置后重试。`;
  }

  return `${fallback}：本机 benchmark 归档操作没有完成，请重启应用后重试。`;
}

export default function ProgressPage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const canShowFormalProgress = canRecordFormalMastery(languageId);
  const [recordings, setRecordings] = useState<BenchmarkRecordingMeta[]>([]);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [learningEvidence, setLearningEvidence] = useState<
    ReturnType<typeof loadLearningEvidence>["evidence"]
  >([]);
  const [archiveStatus, setArchiveStatus] =
    useState<ProgressArchiveStatus | null>(null);
  const [profileStorageWarning, setProfileStorageWarning] = useState<
    string | null
  >(null);
  const playback = useAudioPlayer();
  const benchmarkGroups = useMemo(
    () => (canShowFormalProgress ? summarizeBenchmarkGroups(recordings) : []),
    [canShowFormalProgress, recordings],
  );
  const trend = useMemo(
    () =>
      canShowFormalProgress
        ? (benchmarkGroups[0]?.trend ?? summarizeBenchmarkTrend([]))
        : summarizeBenchmarkTrend([]),
    [benchmarkGroups, canShowFormalProgress],
  );

  const evidenceSummary = useMemo(
    () => summarizeLearningEvidence(learningEvidence, languageId),
    [languageId, learningEvidence],
  );
  useEffect(() => {
    if (!canShowFormalProgress) {
      setRecordings([]);
      setProfile(null);
      setProfileStorageWarning(null);
      setLearningEvidence([]);
      return;
    }
    setRecordings(listBenchmarkRecordings());
    setProfileStorageWarning(getMasteryProfileStorageWarning());
    setProfile(loadMasteryProfile());
    setLearningEvidence(loadLearningEvidence().evidence);
  }, [canShowFormalProgress]);

  if (!canShowFormalProgress) {
    return (
      <LanguageCoreOnlyBoundary moduleName="进步档案">
        <div />
      </LanguageCoreOnlyBoundary>
    );
  }

  const refreshRecordings = () => {
    if (!canShowFormalProgress) return;
    setRecordings(listBenchmarkRecordings());
  };

  const currentLanguageEvidence = learningEvidence.filter(
    (item) => item.languageId === languageId,
  );
  const trainingSessions = profile?.sessions ?? [];

  const evidenceSteps = EVIDENCE_LADDER.map((item) => ({
    ...item,
    count: evidenceSummary.stageCounts[item.stage],
  }));
  const highestEvidenceStep = [...evidenceSteps]
    .reverse()
    .find((step) => step.count > 0);
  const latestEvidenceAt = currentLanguageEvidence.reduce(
    (latest, item) => Math.max(latest, item.createdAt),
    0,
  );
  const nextEvidenceStep =
    evidenceSummary.totalTargets === 0
      ? EVIDENCE_LADDER[0]
      : (evidenceSteps.find(
          (step) => step.count < evidenceSummary.totalTargets,
        ) ?? EVIDENCE_LADDER[EVIDENCE_LADDER.length - 1]);
  const nextEvidenceAction =
    evidenceSummary.totalTargets === 0
      ? "开始第一轮有效辨音"
      : `下一步：补齐「${nextEvidenceStep.label}」证据`;

  const playRecording = async (item: BenchmarkRecordingMeta) => {
    setArchiveStatus(null);
    try {
      const blob = await getBenchmarkAudioBlob(item.id);
      if (!blob) {
        setArchiveStatus({
          tone: "warning",
          message:
            "无法播放这条 benchmark 录音：本机音频数据缺失或已被系统清理，列表记录仍保留。可以删除该记录后重新录制。",
        });
        return;
      }
      playback.playBlob(blob);
    } catch (error) {
      setArchiveStatus({
        tone: "error",
        message: getProgressArchiveErrorMessage(
          error,
          "无法播放这条 benchmark 录音",
        ),
      });
    }
  };

  if (!canShowFormalProgress) {
    return (
      <div
        className="min-h-full overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6"
        data-smoke="progress-experimental-blocker"
      >
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/drill"
            aria-label="返回训练首页"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer sm:h-8 sm:w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {languageProfile.shortLabel}进步档案
            </h1>
            <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              当前语言仍为 experimental，不显示正式英语 mastery 档案。
            </p>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-2xl flex-col justify-center">
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 break-words text-2xl font-bold [overflow-wrap:anywhere]">
              {languageProfile.shortLabel}暂不生成正式进步档案
            </h2>
            <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              西语、法语、俄语目前只保留练习反馈和复测建议；这里不会把英语阶段记录或正式
              mastery 结果混入当前语言。
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/drill" className="max-w-full">
                <Button
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  返回当前语言训练
                </Button>
              </Link>
              <Link href="/assessment" className="max-w-full">
                <Button
                  variant="outline"
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  做当前语言诊断
                </Button>
              </Link>
              <Link href="/settings" className="max-w-full">
                <Button
                  variant="outline"
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  检查语言设置
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleDeleteRecording = async (id: string) => {
    if (!window.confirm("删除这条本机录音记录？")) return;
    setArchiveStatus(null);
    try {
      await deleteBenchmarkRecording(id);
      refreshRecordings();
      setArchiveStatus({
        tone: "success",
        message: "已删除这条本机 benchmark 录音记录。",
      });
    } catch (error) {
      setArchiveStatus({
        tone: "error",
        message: getProgressArchiveErrorMessage(
          error,
          "删除这条 benchmark 录音失败",
        ),
      });
    }
  };

  const handleClearRecordings = async () => {
    if (!window.confirm("清空全部本机 benchmark 录音？此操作不能撤销。")) {
      return;
    }
    setArchiveStatus(null);
    try {
      await clearBenchmarkRecordings();
      refreshRecordings();
      setArchiveStatus({
        tone: "success",
        message: "已清空全部本机 benchmark 录音记录。",
      });
    } catch (error) {
      setArchiveStatus({
        tone: "error",
        message: getProgressArchiveErrorMessage(
          error,
          "清空 benchmark 录音失败",
        ),
      });
    }
  };

  return (
    <div
      className="min-h-full overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6"
      data-smoke="progress-page"
    >
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/drill"
          aria-label="返回训练首页"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted transition-colors cursor-pointer sm:h-8 sm:w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">进步档案</h1>
          <p className="text-sm text-muted-foreground">
            保存可复听的 benchmark，按同类材料比较趋势，不跨任务乱比
          </p>
        </div>
      </div>

      {profileStorageWarning && (
        <div
          className="mb-5 break-words rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 [overflow-wrap:anywhere] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          data-smoke="progress-mastery-storage-warning"
          role="alert"
        >
          {profileStorageWarning}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          icon={BarChart3}
          label="Benchmark"
          value={recordings.length.toString()}
        />
        <Metric
          icon={TrendingUp}
          label="最新分"
          value={trend.latestScore.toString()}
        />
        <Metric
          icon={CheckCircle2}
          label="V3 证据记录"
          value={currentLanguageEvidence.length.toString()}
        />
        <Metric
          icon={CalendarClock}
          label="延迟保持"
          value={evidenceSummary.stageCounts.retention_observed.toString()}
        />
      </div>

      <section
        className="mt-5 rounded-xl border bg-card p-5 shadow-sm"
        data-smoke="learning-evidence-ladder"
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold">学习证据阶梯</h2>
          <p className="text-sm text-muted-foreground">
            这里只显示可追溯的学习证据，不把单次高分当作已经掌握。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">
              当前最高：{highestEvidenceStep?.label ?? "尚未形成阶段证据"}
            </Badge>
            <Badge variant="outline">
              最近验证：
              {latestEvidenceAt > 0
                ? new Date(latestEvidenceAt).toLocaleDateString()
                : "暂无"}
            </Badge>
          </div>
        </div>
        {evidenceSummary.totalTargets === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            <p>还没有可用证据。先完成 2 分钟基线，或从第一轮辨音开始。</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/assessment"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
              >
                完成 2 分钟基线
              </Link>
              <Link
                href="/drill/perception"
                className="inline-flex min-h-11 items-center rounded-lg border px-4 font-medium text-foreground"
              >
                开始第一轮辨音
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {evidenceSteps.map((step) => (
              <div
                key={step.stage}
                className="rounded-xl border bg-muted/20 p-4"
              >
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {step.count}
                </p>
                <p className="text-xs text-muted-foreground">
                  个目标具备此层或更高证据
                </p>
              </div>
            ))}
          </div>
        )}
        {evidenceSummary.totalTargets > 0 && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{nextEvidenceAction}</p>
              <p className="text-xs text-muted-foreground">
                系统按当前最薄弱的证据层推荐任务，不用自己猜该练哪个模块。
              </p>
            </div>
            <Link
              href={nextEvidenceStep.href}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
            >
              继续训练
            </Link>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <h2 className="break-words text-lg font-bold [overflow-wrap:anywhere]">
                Before / After 录音
              </h2>
              <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                只按同一材料、同一目标比较趋势，不把不同任务混算。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              {recordings.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearRecordings}
                  className="gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空
                </Button>
              )}
              <Badge
                variant={trend.deltaFromFirst >= 0 ? "default" : "secondary"}
              >
                {trend.deltaFromFirst >= 0 ? "+" : ""}
                {trend.deltaFromFirst}
              </Badge>
            </div>
          </div>
          <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Benchmark
              音频只保存在本机浏览器数据中；你可以删除单条录音或清空全部记录。
            </p>
          </div>

          {archiveStatus && (
            <p
              className={
                archiveStatus.tone === "success"
                  ? "mb-4 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm text-foreground break-words [overflow-wrap:anywhere]"
                  : archiveStatus.tone === "warning"
                    ? "mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 break-words [overflow-wrap:anywhere] dark:text-amber-200"
                    : "mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive break-words [overflow-wrap:anywhere]"
              }
              data-smoke="progress-benchmark-archive-status"
              role={archiveStatus.tone === "success" ? "status" : "alert"}
            >
              {archiveStatus.message}
            </p>
          )}

          {recordings.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无
              benchmark。去「韵律重音」完成一次评分后，这里会出现可回听记录。
            </div>
          ) : (
            <div className="space-y-3">
              {benchmarkGroups.map((group) => (
                <div key={group.key} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-between">
                    <div className="min-w-0 text-center sm:text-left">
                      <h3
                        className="break-words font-semibold [overflow-wrap:anywhere]"
                        data-smoke="progress-benchmark-title"
                      >
                        {group.title}
                      </h3>
                      <p
                        className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]"
                        data-smoke="progress-benchmark-meta"
                      >
                        {group.source} · {group.targetLabel} ·{" "}
                        {group.trend.count} 次同材料
                      </p>
                    </div>
                    <Badge
                      variant={
                        group.trend.deltaFromFirst >= 0
                          ? "default"
                          : "secondary"
                      }
                    >
                      {group.trend.deltaFromFirst >= 0 ? "+" : ""}
                      {group.trend.deltaFromFirst}
                    </Badge>
                  </div>
                  <p
                    className="mb-3 break-words text-center text-sm text-muted-foreground [overflow-wrap:anywhere] sm:text-left"
                    data-smoke="progress-benchmark-text"
                  >
                    {group.text}
                  </p>
                  <div className="space-y-2">
                    {group.recordings.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-lg bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        data-smoke="progress-benchmark-row"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <Badge variant="secondary">{item.score}</Badge>
                            <span
                              className="inline-block max-w-full break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere] sm:text-left"
                              data-smoke="progress-benchmark-date"
                            >
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`播放 benchmark 录音：${group.title}`}
                            onClick={() => playRecording(item)}
                            className="cursor-pointer"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`删除 benchmark 录音：${group.title}`}
                            onClick={() => handleDeleteRecording(item.id)}
                            className="cursor-pointer text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">历史兼容记录（未校准）</h2>
            <Badge
              variant="secondary"
              className="w-fit max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]"
              data-smoke="progress-session-count"
            >
              {trainingSessions.length > 0
                ? `仅用于复习调度 · ${trainingSessions.length} 轮`
                : "暂无旧版训练记录"}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {trainingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                新训练结论只显示在上方 V3 证据阶梯；这里不会生成“已掌握”结论。
              </p>
            ) : (
              trainingSessions.map((session) => {
                const pack = TRAINING_PACKS.find(
                  (item) => item.id === session.packId,
                );
                return (
                  <div
                    key={session.id}
                    className="rounded-lg border p-3"
                    data-smoke="progress-recent-session-row"
                  >
                    <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p
                        className="min-w-0 break-words text-center text-sm font-semibold [overflow-wrap:anywhere] sm:text-left"
                        data-smoke="progress-recent-session-title"
                      >
                        {pack?.title ?? session.packId}
                      </p>
                      <Badge
                        variant="outline"
                        className="max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]"
                      >
                        旧记录 · 不作掌握结论
                      </Badge>
                    </div>
                    <p
                      className="mt-2 break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere] sm:text-left"
                      data-smoke="progress-recent-session-meta"
                    >
                      {session.targetScores.length > 0 ? (
                        <>
                          历史目标音均分{" "}
                          {Math.round(
                            session.targetScores.reduce(
                              (sum, score) => sum + score,
                              0,
                            ) / session.targetScores.length,
                          )}
                        </>
                      ) : (
                        "未保存正式目标音证据"
                      )}
                      · {new Date(session.completedAt).toLocaleString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <Icon className="mb-3 h-5 w-5 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
