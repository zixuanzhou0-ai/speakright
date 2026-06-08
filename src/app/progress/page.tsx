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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type BenchmarkRecordingMeta,
  clearBenchmarkRecordings,
  deleteBenchmarkRecording,
  getBenchmarkAudioBlob,
  listBenchmarkRecordings,
  summarizeBenchmarkGroups,
  summarizeBenchmarkTrend,
} from "@/lib/benchmark-archive";
import { loadMasteryProfile } from "@/lib/mastery-profile";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { MasteryProfile } from "@/types/training";

export default function ProgressPage() {
  const [recordings, setRecordings] = useState<BenchmarkRecordingMeta[]>([]);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const benchmarkGroups = useMemo(
    () => summarizeBenchmarkGroups(recordings),
    [recordings],
  );
  const trend = useMemo(
    () => benchmarkGroups[0]?.trend ?? summarizeBenchmarkTrend([]),
    [benchmarkGroups],
  );

  useEffect(() => {
    setRecordings(listBenchmarkRecordings());
    setProfile(loadMasteryProfile());
  }, []);

  const refreshRecordings = () => {
    setRecordings(listBenchmarkRecordings());
  };

  const mastered = profile
    ? Object.values(profile.packs).filter((pack) => pack.status === "mastered")
        .length
    : 0;
  const transferred = profile
    ? Object.values(profile.packs).filter(
        (pack) => pack.masteryState === "transferred",
      ).length
    : 0;
  const recentSessions = profile?.sessions.slice(0, 6) ?? [];

  const playRecording = async (id: string) => {
    const blob = await getBenchmarkAudioBlob(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  };

  const handleDeleteRecording = async (id: string) => {
    if (!window.confirm("删除这条本机录音记录？")) return;
    await deleteBenchmarkRecording(id);
    refreshRecordings();
  };

  const handleClearRecordings = async () => {
    if (!window.confirm("清空全部本机 benchmark 录音？此操作不能撤销。")) {
      return;
    }
    await clearBenchmarkRecordings();
    refreshRecordings();
  };

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
          <h1 className="text-2xl font-bold">进步档案</h1>
          <p className="text-sm text-muted-foreground">
            保存可复听的 benchmark，按同类材料比较趋势，不跨任务乱比
          </p>
        </div>
      </div>

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
          label="已掌握包"
          value={mastered.toString()}
        />
        <Metric
          icon={CalendarClock}
          label="已迁移"
          value={transferred.toString()}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Before / After 录音</h2>
              <p className="text-sm text-muted-foreground">
                只按同一材料、同一目标比较趋势，不把不同任务混算。
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          {recordings.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无
              benchmark。去「韵律重音」完成一次评分后，这里会出现可回听记录。
            </div>
          ) : (
            <div className="space-y-3">
              {benchmarkGroups.map((group) => (
                <div key={group.key} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{group.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
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
                  <p className="mb-3 text-sm text-muted-foreground">
                    {group.text}
                  </p>
                  <div className="space-y-2">
                    {group.recordings.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.score}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => playRecording(item.id)}
                            className="cursor-pointer"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
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
          <h2 className="text-lg font-bold">最近训练状态</h2>
          <div className="mt-4 space-y-3">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                完成训练包或自由迁移后，这里会显示阶段变化。
              </p>
            ) : (
              recentSessions.map((session) => {
                const pack = TRAINING_PACKS.find(
                  (item) => item.id === session.packId,
                );
                return (
                  <div key={session.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {pack?.title ?? session.packId}
                      </p>
                      <Badge
                        variant={session.mastered ? "default" : "secondary"}
                      >
                        {session.masteryStateAfter ?? "learning"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      目标音平均{" "}
                      {session.targetScores.length > 0
                        ? Math.round(
                            session.targetScores.reduce(
                              (sum, score) => sum + score,
                              0,
                            ) / session.targetScores.length,
                          )
                        : 0}
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
