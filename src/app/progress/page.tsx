"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Play,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type BenchmarkRecordingMeta,
  getBenchmarkAudioBlob,
  listBenchmarkRecordings,
  summarizeBenchmarkTrend,
} from "@/lib/benchmark-archive";
import { loadMasteryProfile } from "@/lib/mastery-profile";
import { TRAINING_PACKS } from "@/lib/training-packs";
import type { MasteryProfile } from "@/types/training";

export default function ProgressPage() {
  const [recordings, setRecordings] = useState<BenchmarkRecordingMeta[]>([]);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const trend = useMemo(
    () => summarizeBenchmarkTrend(recordings),
    [recordings],
  );

  useEffect(() => {
    setRecordings(listBenchmarkRecordings());
    setProfile(loadMasteryProfile());
  }, []);

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
          value={trend.count.toString()}
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
                目前韵律专项会自动保存录音；后续阶段复测也会进入这里。
              </p>
            </div>
            <Badge
              variant={trend.deltaFromFirst >= 0 ? "default" : "secondary"}
            >
              {trend.deltaFromFirst >= 0 ? "+" : ""}
              {trend.deltaFromFirst}
            </Badge>
          </div>

          {recordings.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              暂无
              benchmark。去「韵律重音」完成一次评分后，这里会出现可回听记录。
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((item) => (
                <div key={item.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{item.title}</h3>
                        <Badge variant="outline">{item.targetLabel}</Badge>
                        <Badge variant="secondary">{item.score}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.text}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => playRecording(item.id)}
                      className="shrink-0 cursor-pointer"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
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
