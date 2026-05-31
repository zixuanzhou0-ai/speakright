"use client";

import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  GitCompareArrows,
  Headphones,
  MessageSquareText,
  Mic2,
  PanelsTopLeft,
  PlayCircle,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DesktopReadinessCard } from "@/components/drill/desktop-readiness-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAzureConfig, subscribeToStorage } from "@/lib/api-keys";
import { isAzureConfigReady } from "@/lib/azure-config";
import { isReviewDue, loadMasteryProfile } from "@/lib/mastery-profile";
import { buildReviewQueue } from "@/lib/review-queue";
import { buildTrainingMemory } from "@/lib/training-memory";
import { TRAINING_PACKS } from "@/lib/training-packs";
import {
  buildDefaultPrescription,
  buildTrainingPrescription,
} from "@/lib/training-prescription";
import { cn } from "@/lib/utils";
import type { DiagnosisReport } from "@/types/diagnosis";
import type {
  MasteryProfile,
  ReviewQueueItem,
  TrainingPack,
  TrainingPrescriptionItem,
} from "@/types/training";

const REPORT_STORAGE_KEY = "speakright_assessment_result_v2";

const STATE_LABELS = {
  unknown: "未建档",
  suspected: "疑似弱点",
  learning: "正在建立",
  controlled: "可控",
  integrated: "句中整合",
  retained: "已保持",
  transferred: "已迁移",
} satisfies Record<
  NonNullable<TrainingPrescriptionItem["currentMasteryState"]>,
  string
>;

const FREE_MODES = [
  {
    href: "/drill/word",
    icon: BookOpen,
    title: "单词训练",
    description: "选择音标，系统出词，逐个攻克",
  },
  {
    href: "/drill/sentence",
    icon: MessageSquareText,
    title: "句子训练",
    description: "绕口令、最小对立句、日常场景",
  },
  {
    href: "/drill/contrast",
    icon: GitCompareArrows,
    title: "对比训练",
    description: "最小对立对，精准纠偏",
  },
  {
    href: "/drill/perception",
    icon: Headphones,
    title: "高变异听辨",
    description: "多说话人 ABX，建立英语听觉边界",
  },
  {
    href: "/drill/prosody",
    icon: AudioLines,
    title: "韵律重音",
    description: "内容词突出、弱读、停顿和连读",
  },
  {
    href: "/drill/scenarios",
    icon: BriefcaseBusiness,
    title: "场景迁移",
    description: "把弱点迁移到面试、会议和表达",
  },
  {
    href: "/drill/spontaneous",
    icon: Mic2,
    title: "即兴迁移",
    description: "不写稿先说，转写后只看当前目标",
  },
  {
    href: "/progress",
    icon: PanelsTopLeft,
    title: "进步档案",
    description: "复测记录、before/after 和阶段变化",
  },
];

function loadReport(): DiagnosisReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DiagnosisReport) : null;
  } catch {
    return null;
  }
}

function levelTitle(pack: TrainingPack, levelId?: string): string {
  return (
    pack.course?.levels.find((level) => level.id === levelId)?.title ??
    "听辨 ABX"
  );
}

function packHref(packId: string, levelId?: string): string {
  return levelId
    ? `/drill/pack/${packId}?level=${encodeURIComponent(levelId)}`
    : `/drill/pack/${packId}`;
}

function packTitleFromId(packId: string): string {
  return TRAINING_PACKS.find((pack) => pack.id === packId)?.title ?? packId;
}

function prescriptionFromReviewTask(
  task: ReviewQueueItem,
): TrainingPrescriptionItem {
  const pack = TRAINING_PACKS.find((item) => item.id === task.packId);
  return {
    packId: task.packId,
    levelId: task.levelId,
    reason: task.reason,
    priority: task.priority,
    estimatedMinutes: pack?.estimatedMinutes ?? 12,
  };
}

function sourceLabel(source: ReviewQueueItem["source"]): string {
  const labels: Record<ReviewQueueItem["source"], string> = {
    "due-review": "到期",
    "stuck-pattern": "卡点",
    "weak-level": "关卡",
    "failed-item": "错题",
    "remediation-failed": "补救",
  };
  return labels[source];
}

function priorityVariant(priority: ReviewQueueItem["priority"]) {
  return priority === "critical" ? "destructive" : "secondary";
}

export default function DrillPage() {
  const [report, setReport] = useState<DiagnosisReport | null>(null);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [azureReady, setAzureReady] = useState(false);

  useEffect(() => {
    setReport(loadReport());
    setProfile(loadMasteryProfile());
    const refreshAzureState = () => {
      const config = getAzureConfig();
      setAzureReady(isAzureConfigReady(config));
    };
    refreshAzureState();
    return subscribeToStorage(refreshAzureState);
  }, []);

  const prescription =
    report && profile
      ? buildTrainingPrescription(report.issues, "diagnosis", profile)
      : (report?.prescription ?? buildDefaultPrescription());
  const recommendedIds = useMemo(
    () =>
      Array.from(
        new Set(
          prescription.days.flatMap((day) =>
            day.items.map((item) => item.packId),
          ),
        ),
      ),
    [prescription],
  );
  const recommendedPacks = recommendedIds
    .map((id) => TRAINING_PACKS.find((pack) => pack.id === id))
    .filter((pack): pack is TrainingPack => !!pack);
  const otherPacks = TRAINING_PACKS.filter(
    (pack) => !recommendedIds.includes(pack.id),
  );
  const reviewQueue = useMemo(() => buildReviewQueue(profile), [profile]);
  const trainingMemory = useMemo(
    () => buildTrainingMemory(profile, reviewQueue),
    [profile, reviewQueue],
  );
  const reviewItems = reviewQueue.slice(0, 2).map(prescriptionFromReviewTask);
  const todayItems = Array.from(
    new Map(
      [...reviewItems, ...(prescription.days[0]?.items ?? [])].map((item) => [
        item.packId,
        item,
      ]),
    ).values(),
  ).slice(0, 2);
  const primaryItem = todayItems[0];
  const primaryPack = primaryItem
    ? TRAINING_PACKS.find((pack) => pack.id === primaryItem.packId)
    : null;
  const primaryHref =
    azureReady && primaryItem
      ? packHref(primaryItem.packId, primaryItem.levelId)
      : azureReady
        ? "/drill/word"
        : "/settings";
  const primaryLabel = azureReady ? "开始今天训练" : "配置评分密钥";

  return (
    <div className="h-full flex flex-col px-6 py-4 overflow-y-auto scrollbar-thin">
      <div className="mb-5 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">今日学习计划</h1>
          <p className="mt-1 text-muted-foreground">
            今天建议完成 2 个任务：先做到期复习，再做一个主训练
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/drill/evidence">
            <Button variant="outline" className="gap-2 cursor-pointer">
              <BookOpen className="h-4 w-4" />
              错题本
            </Button>
          </Link>
          <Link href="/assessment">
            <Button variant="outline" className="gap-2 cursor-pointer">
              <ClipboardList className="h-4 w-4" />
              {report ? "重新诊断" : "先做诊断"}
            </Button>
          </Link>
        </div>
      </div>

      <DesktopReadinessCard hasDiagnosis={!!report} />

      <section className="mb-5 rounded-xl border bg-primary/5 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={azureReady ? "default" : "destructive"}>
                {azureReady ? "评分已就绪" : "需要配置"}
              </Badge>
              <Badge variant="secondary">今日 10 分钟</Badge>
              {primaryItem?.priority === "critical" && (
                <Badge variant="destructive">优先</Badge>
              )}
            </div>
            <h2 className="text-xl font-bold">
              {primaryPack?.title ?? "从一个高影响发音开始"}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {azureReady
                ? (primaryItem?.learningObjective ??
                  primaryItem?.reason ??
                  primaryPack?.focus ??
                  "先完成一组目标音训练，再进入复习或自由专项。")
                : "Azure Speech 配置完成后，桌面端才能进行录音评分和训练证据记录。"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={primaryHref}>
              <Button size="lg" className="gap-2 cursor-pointer">
                {azureReady ? (
                  <PlayCircle className="h-5 w-5" />
                ) : (
                  <Settings className="h-5 w-5" />
                )}
                {primaryLabel}
              </Button>
            </Link>
            {!report && azureReady && (
              <Link href="/assessment">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 cursor-pointer"
                >
                  <ClipboardList className="h-5 w-5" />
                  先做诊断
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            今日训练处方
          </h2>
          <Badge variant={report ? "default" : "secondary"}>
            {reviewItems.length > 0
              ? "优先复习"
              : report
                ? "来自诊断"
                : "默认高频问题"}
          </Badge>
        </div>
        {!report && (
          <div className="mb-4 rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
            <p className="font-medium">还没有诊断报告</p>
            <p className="mt-1 text-muted-foreground">
              可以先做 3 分钟快速诊断；如果你想直接开始，系统会从 final
              consonants、核心元音和重音节奏这些高影响问题开始。
            </p>
          </div>
        )}
        {reviewQueue.length > 0 && (
          <div className="mb-4 grid gap-2 md:grid-cols-2">
            {reviewQueue.slice(0, 2).map((task) => {
              const pack = TRAINING_PACKS.find(
                (item) => item.id === task.packId,
              );
              if (!pack) return null;
              return (
                <Link key={task.id} href={packHref(task.packId, task.levelId)}>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 transition-colors hover:border-primary/50 cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{pack.title}</p>
                      <Badge variant={priorityVariant(task.priority)}>
                        {sourceLabel(task.source)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.reason}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {todayItems.map((item, index) => {
            const pack = TRAINING_PACKS.find((p) => p.id === item.packId);
            if (!pack) return null;
            return (
              <Link key={item.packId} href={packHref(pack.id, item.levelId)}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileHover={{ y: -2 }}
                  className="h-full rounded-xl border bg-background p-4 shadow-sm transition-colors hover:border-primary/50 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">{pack.title}</h3>
                    <Badge
                      variant={
                        item.priority === "critical" ? "destructive" : "outline"
                      }
                    >
                      {item.estimatedMinutes} 分钟
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.currentMasteryState && (
                      <Badge variant="secondary">
                        {STATE_LABELS[item.currentMasteryState]}
                      </Badge>
                    )}
                    {item.stageScore != null && item.stageCeiling != null && (
                      <Badge variant="outline">
                        阶段 {item.stageScore}/{item.stageCeiling}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.reason}
                  </p>
                  {item.learningObjective && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      今天只做：{item.learningObjective}
                    </p>
                  )}
                  <p className="mt-3 text-sm font-medium text-primary">
                    目标：{pack.focus}
                    {` · 从 ${levelTitle(pack, item.levelId)} 开始`}
                  </p>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-muted-foreground">
                训练记忆
              </h2>
            </div>
            <Badge
              variant={
                trainingMemory.activeWeaknesses.length > 0
                  ? "secondary"
                  : "outline"
              }
            >
              {trainingMemory.totalSessions} 轮记录
            </Badge>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">已练专项</p>
              <p className="text-lg font-bold">
                {trainingMemory.practicedPacks}
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">已掌握</p>
              <p className="text-lg font-bold">
                {trainingMemory.masteredPacks}
              </p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">待复习</p>
              <p className="text-lg font-bold">{reviewQueue.length}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">到期</p>
              <p className="text-lg font-bold">{trainingMemory.dueReviews}</p>
            </div>
          </div>

          <div className="space-y-2">
            {trainingMemory.activeWeaknesses.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                完成一次训练后，这里会显示最近最该处理的发音卡点。
              </div>
            ) : (
              trainingMemory.activeWeaknesses.slice(0, 3).map((weakness) => (
                <Link
                  key={weakness.id}
                  href={packHref(weakness.packId, weakness.levelId)}
                >
                  <div className="rounded-lg border bg-background p-3 transition-colors hover:border-primary/50 cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {weakness.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {weakness.packTitle} · {weakness.reason}
                        </p>
                      </div>
                      <Badge variant={priorityVariant(weakness.severity)}>
                        {weakness.severity === "critical" ? "优先" : "复练"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>证据 {weakness.evidenceCount}</span>
                      <span>卡住 {weakness.stuckCount}</span>
                      <span>错题 {weakness.failedItemCount}</span>
                      {weakness.bestTargetScore > 0 && (
                        <span>最近目标音 {weakness.bestTargetScore}</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-primary">
                      下一次只改：{weakness.cue}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              复习节奏
            </h2>
          </div>

          <div className="space-y-3">
            {trainingMemory.reviewWindows.map((window) => {
              const width = Math.min(100, Math.max(8, window.count * 22));
              return (
                <div key={window.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {window.label}
                    </span>
                    <span className="font-medium">
                      {window.count} 项
                      {window.priorityCount > 0
                        ? ` · ${window.priorityCount} 个重点`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        window.priorityCount > 0
                          ? "bg-primary"
                          : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="mb-3 flex items-center gap-2">
              {trainingMemory.recentTrend.some((point) => point.mastered) ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              )}
              <p className="text-sm font-semibold text-muted-foreground">
                最近目标音趋势
              </p>
            </div>
            {trainingMemory.recentTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无趋势数据</p>
            ) : (
              <div className="space-y-2">
                {trainingMemory.recentTrend.map((point) => (
                  <div key={point.sessionId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {packTitleFromId(point.packId)}
                      </span>
                      <span className="font-medium">
                        {point.averageTargetScore}
                        {point.stuckCount > 0
                          ? ` · 卡 ${point.stuckCount}`
                          : ""}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-1.5 rounded-full",
                          point.mastered ? "bg-primary" : "bg-amber-500",
                        )}
                        style={{
                          width: `${Math.max(8, Math.min(100, point.averageTargetScore))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            推荐专项训练包
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recommendedPacks.map((pack, index) => (
            <PackCard
              key={pack.id}
              pack={pack}
              profile={profile}
              index={index}
              recommended
            />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          全部训练包
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {otherPacks.map((pack, index) => (
            <PackCard
              key={pack.id}
              pack={pack}
              profile={profile}
              index={index}
            />
          ))}
        </div>
      </section>

      <section className="pb-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          自由专项
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {FREE_MODES.map((mode) => (
            <Link key={mode.href} href={mode.href}>
              <div className="h-full rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 cursor-pointer">
                <mode.icon className="mb-3 h-5 w-5 text-primary" />
                <h3 className="font-bold">{mode.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mode.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function PackCard({
  pack,
  profile,
  index,
  recommended = false,
}: {
  pack: TrainingPack;
  profile: MasteryProfile | null;
  index: number;
  recommended?: boolean;
}) {
  const mastery = profile?.packs[pack.id];
  const due = isReviewDue(mastery);
  const status = due
    ? "due"
    : (mastery?.status ?? (recommended ? "recommended" : "new"));
  const levels = pack.course?.levels ?? [];
  const passedLevels = levels.filter(
    (level) => mastery?.levelProgress[level.id]?.passed,
  ).length;
  const activePattern = pack.course?.errorPatterns.find(
    (pattern) => profile?.errorPatterns[pattern.id]?.status === "active",
  );

  return (
    <Link href={`/drill/pack/${pack.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className="group h-full rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold group-hover:text-primary transition-colors">
              {pack.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{pack.focus}</p>
          </div>
          <Badge
            variant={
              status === "mastered"
                ? "default"
                : status === "due"
                  ? "destructive"
                  : recommended
                    ? "secondary"
                    : "outline"
            }
          >
            {status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{pack.l1Problem}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pack.targetPhonemes.map((phoneme) => (
            <Badge key={phoneme} variant="outline">
              {phoneme}
            </Badge>
          ))}
          <Badge variant="secondary">{pack.estimatedMinutes} 分钟</Badge>
          <Badge variant="outline">{pack.course?.levels.length ?? 0} 关</Badge>
        </div>
        {levels.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>关卡进度</span>
              <span>
                {passedLevels}/{levels.length}
              </span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {levels.map((level) => (
                <div
                  key={level.id}
                  className={cn(
                    "h-1.5 rounded-full",
                    mastery?.levelProgress[level.id]?.passed
                      ? "bg-primary"
                      : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
        )}
        {mastery && (
          <p className="mt-3 text-xs text-muted-foreground">
            最佳目标音素分 {mastery.bestTargetScore} · 完成{" "}
            {mastery.completedSessions} 轮{due ? " · 到期复习" : ""}
          </p>
        )}
        {activePattern && (
          <p className="mt-2 text-xs font-medium text-red-500">
            当前易卡：{activePattern.title}
          </p>
        )}
      </motion.div>
    </Link>
  );
}
