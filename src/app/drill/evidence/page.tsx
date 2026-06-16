"use client";

import type React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getLanguageProfile } from "@/lib/language-profiles";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";
import {
  getMasteryProfileStorageWarning,
  loadMasteryProfile,
} from "@/lib/mastery-profile";
import {
  buildTrainingEvidenceBook,
  type EvidenceCard,
  type EvidenceSeverity,
  type PatternEvidence,
  type RemediationEvidence,
} from "@/lib/training-evidence";
import { cn } from "@/lib/utils";
import type { MasteryProfile } from "@/types/training";

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

function packHref(packId: string, levelId?: string): string {
  return levelId
    ? `/drill/pack/${packId}?level=${encodeURIComponent(levelId)}`
    : `/drill/pack/${packId}`;
}

function severityLabel(severity: EvidenceSeverity): string {
  if (severity === "critical") return "优先处理";
  if (severity === "major") return "需要复练";
  return "观察";
}

function severityVariant(severity: EvidenceSeverity) {
  return severity === "critical"
    ? "destructive"
    : severity === "major"
      ? "secondary"
      : "outline";
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "暂无";
  return new Date(timestamp).toLocaleDateString();
}

export default function TrainingEvidencePage() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const canShowFormalEvidence = canRecordFormalMastery(languageId);
  const [profile, setProfile] = useState<MasteryProfile | null>(null);
  const [profileStorageWarning, setProfileStorageWarning] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!canShowFormalEvidence) {
      setProfile(null);
      setProfileStorageWarning(null);
      return;
    }
    setProfileStorageWarning(getMasteryProfileStorageWarning());
    setProfile(loadMasteryProfile());
  }, [canShowFormalEvidence]);

  const evidenceBook = useMemo(
    () => buildTrainingEvidenceBook(canShowFormalEvidence ? profile : null),
    [canShowFormalEvidence, profile],
  );
  const topCards = evidenceBook.cards.slice(0, 8);
  const topPatterns = evidenceBook.patterns.slice(0, 6);
  const remediations = evidenceBook.remediations.slice(0, 6);

  if (!canShowFormalEvidence) {
    return (
      <div
        className="h-full overflow-y-auto px-6 py-4 scrollbar-thin"
        data-smoke="evidence-experimental-blocker"
      >
        <div className="mb-5 flex flex-wrap items-start gap-3">
          <Link
            href="/drill"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
              {languageProfile.shortLabel}训练证据库
            </h1>
            <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              当前语言仍为 experimental，不读取或显示正式英语 mastery
              证据库。
            </p>
          </div>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-2xl flex-col justify-center">
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-3 break-words text-2xl font-bold [overflow-wrap:anywhere]">
              {languageProfile.shortLabel}暂不生成正式错题证据库
            </h2>
            <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
              西语、法语、俄语目前只保留练习观察和复测建议；这里不会把英语训练包证据或正式
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
              <Link href="/settings" className="max-w-full">
                <Button
                  variant="outline"
                  className={`cursor-pointer ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
                >
                  切换语言
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin" data-smoke="evidence-page">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href="/drill"
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold [overflow-wrap:anywhere]">
                训练证据库
              </h1>
              <p className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                汇总训练中的错题、卡住错因和补救效果，让复练有证据可循。
              </p>
            </div>
          </div>
          <Link href="/drill">
            <Button variant="outline" className="gap-2 cursor-pointer">
              <Target className="h-4 w-4" />
              回到处方
            </Button>
          </Link>
        </div>

        {profileStorageWarning && (
          <div
            className="mb-5 break-words rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 [overflow-wrap:anywhere] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            data-smoke="evidence-mastery-storage-warning"
            role="alert"
          >
            {profileStorageWarning}
          </div>
        )}

        <section
          className="mb-5 grid gap-3 md:grid-cols-4"
          data-smoke="evidence-summary-stats"
        >
          <StatCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="错题证据"
            value={evidenceBook.totalEvidence}
            hint={`${evidenceBook.criticalCount} 个优先处理`}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="活跃错因"
            value={evidenceBook.activePatternCount}
            hint="反复出现或连续卡住"
          />
          <StatCard
            icon={<RotateCcw className="h-4 w-4" />}
            label="补救未过"
            value={evidenceBook.remediationFailedCount}
            hint="需要慢速拆解"
          />
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="待复习"
            value={evidenceBook.dueReviewCount}
            hint={`${evidenceBook.totalSessions} 轮训练记录`}
          />
        </section>

        {evidenceBook.totalEvidence === 0 ? (
          <EmptyEvidenceState />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-3">
              <SectionTitle
                icon={<BookOpen className="h-4 w-4 text-primary" />}
                title="最该复练的具体词"
                description="按严重程度、重复次数和最近出现时间排序。"
              />
              {topCards.map((card, index) => (
                <EvidenceCardRow card={card} index={index} key={card.id} />
              ))}
            </section>

            <div className="space-y-5">
              <section className="space-y-3">
                <SectionTitle
                  icon={<TrendingUp className="h-4 w-4 text-primary" />}
                  title="反复出现的错因"
                  description="这些不是单个词的问题，而是动作模式。"
                />
                {topPatterns.length === 0 ? (
                  <SmallEmpty text="还没有形成稳定错因。继续完成训练后会自动聚合。" />
                ) : (
                  topPatterns.map((pattern) => (
                    <PatternRow pattern={pattern} key={pattern.patternId} />
                  ))
                )}
              </section>

              <section className="space-y-3">
                <SectionTitle
                  icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                  title="补救步骤效果"
                  description="看哪些慢速拆解真的让目标音上涨。"
                />
                {remediations.length === 0 ? (
                  <SmallEmpty text="还没有补救步骤记录。连续失败后进入拆解会产生记录。" />
                ) : (
                  remediations.map((item) => (
                    <RemediationRow item={item} key={item.id} />
                  ))
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-sm">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function EvidenceCardRow({ card, index }: { card: EvidenceCard; index: number }) {
  return (
    <Link href={packHref(card.packId, card.levelId)}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        whileHover={{ y: -2 }}
        className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 cursor-pointer"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{card.text}</h3>
              <Badge variant={severityVariant(card.severity)}>
                {severityLabel(card.severity)}
              </Badge>
              {card.dueTask && <Badge variant="outline">已进复习队列</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {card.packTitle} · {card.levelTitle}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <ScorePill label="最低" value={card.worstTargetScore} danger />
            <ScorePill label="最近" value={card.latestTargetScore} />
            <ScorePill label="最好" value={card.bestTargetScore} />
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              证据
            </p>
            <p className="mt-1 text-sm">
              出现 {card.attempts} 次 · 目标音 {card.targetPhonemes.join(" / ")}
              {card.scoreGap >= 12
                ? ` · 整体分高出目标音 ${card.scoreGap} 分`
                : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              首次 {formatDate(card.firstSeenAt)} · 最近 {formatDate(card.lastSeenAt)}
            </p>
          </div>
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              下一次只改
            </p>
            <p className="mt-1 text-sm font-medium text-primary">{card.nextCue}</p>
            {card.patternTitles.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                错因：{card.patternTitles.join(" / ")}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function PatternRow({ pattern }: { pattern: PatternEvidence }) {
  return (
    <Link href={packHref(pattern.packId, pattern.levelId)}>
      <div className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{pattern.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pattern.packTitle} · 出现 {pattern.seenCount} 次 · 卡住 {pattern.stuckCount} 次
            </p>
          </div>
          <Badge variant={severityVariant(pattern.severity)}>
            {severityLabel(pattern.severity)}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{pattern.explanation}</p>
        <p className="mt-2 text-sm font-medium text-primary">
          下一次只改：{pattern.cue}
        </p>
      </div>
    </Link>
  );
}

function RemediationRow({ item }: { item: RemediationEvidence }) {
  const passRate = Math.round((item.passedCount / Math.max(1, item.attempts)) * 100);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{item.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.packTitle} · {item.pathId}
          </p>
        </div>
        <Badge variant={item.latestPassed ? "secondary" : "destructive"}>
          {item.latestPassed ? "最近有效" : "最近未过"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ScorePill label="通过率" value={passRate} />
        <ScorePill label="最好提升" value={item.bestImprovement} />
        <ScorePill
          label="最近目标"
          value={item.latestTargetScore}
          danger={!item.latestPassed}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        尝试 {item.attempts} 次 · 失败 {item.failedCount} 次 · 最近 {formatDate(item.lastSeenAt)}
      </p>
    </div>
  );
}

function ScorePill({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        danger ? "bg-red-500/10" : "bg-muted/50",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-base font-bold", danger && "text-red-500")}>
        {value}
      </p>
    </div>
  );
}

function SmallEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function EmptyEvidenceState() {
  return (
    <div
      className="rounded-xl border border-dashed bg-card p-8 text-center shadow-sm"
      data-smoke="evidence-empty-state"
    >
      <ClipboardList className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
      <h2 className="text-lg font-bold">还没有错题证据</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        完成一次训练包后，系统会把未过线的词、卡住错因、补救步骤自动收进这里。
      </p>
      <Link href="/drill" className="mt-5 inline-flex">
        <Button className="gap-2 cursor-pointer">
          <Target className="h-4 w-4" />
          去完成一轮训练
        </Button>
      </Link>
    </div>
  );
}
