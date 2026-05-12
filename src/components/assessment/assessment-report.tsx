"use client";

import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  RotateCcw,
  Target,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDiagnosisSummary } from "@/lib/diagnosis-engine";
import { getScoreBg } from "@/lib/score-utils";
import { getTrainingPack } from "@/lib/training-packs";
import { cn } from "@/lib/utils";
import type { DiagnosisIssue, DiagnosisReport } from "@/types/diagnosis";
import { PhonemeHealthMap } from "./phoneme-health-map";

interface AssessmentReportProps {
  result: DiagnosisReport;
  onRetake: () => void;
}

export function AssessmentReport({ result, onRetake }: AssessmentReportProps) {
  const dims = result.dimensions;
  const primaryPackId =
    result.issues[0]?.nextLesson?.packId ?? result.prescription.days[0]?.items[0]?.packId;
  const primaryLevelId =
    result.issues[0]?.nextLesson?.levelId ?? result.prescription.days[0]?.items[0]?.levelId;
  const primaryPack = primaryPackId ? getTrainingPack(primaryPackId) : null;
  const primaryHref = primaryPack
    ? `/drill/pack/${primaryPack.id}${
        primaryLevelId ? `?level=${encodeURIComponent(primaryLevelId)}` : ""
      }`
    : "/drill";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-[140px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              综合评分
            </h2>
            <div
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-2xl text-white",
                getScoreBg(result.overallScore),
              )}
            >
              <span className="text-4xl font-bold tabular-nums">
                {result.overallScore}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Badge variant="secondary" className="mb-2">
                诊断 + 训练处方
              </Badge>
              <h2 className="text-xl font-bold">
                {getDiagnosisSummary(result)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                报告基于基础筛查、短文朗读和必要的自适应补测生成。先处理最影响清晰度的问题，再按处方进入训练包。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.issues.slice(0, 3).map((issue) => (
                <Badge
                  key={issue.id}
                  variant={
                    issue.severity === "critical"
                      ? "destructive"
                      : issue.severity === "major"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {issue.title}
                </Badge>
              ))}
              {result.issues.length === 0 && (
                <Badge variant="outline">没有明显重灾区</Badge>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {result.issues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              Top 3 发音问题
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {result.issues.slice(0, 3).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-card p-6 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          六维评估
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: "元音", value: dims.vowels },
            { label: "辅音", value: dims.consonants },
            { label: "重音", value: dims.stress },
            { label: "节奏", value: dims.rhythm },
            { label: "流利度", value: dims.fluency },
            { label: "连读", value: dims.connectedSpeech },
          ].map((d) => (
            <div key={d.label} className="flex flex-col items-center gap-1">
              <div className="relative h-20 w-6 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${d.value}%` }}
                  transition={{
                    delay: 0.3,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className={cn(
                    "absolute bottom-0 w-full rounded-full",
                    getScoreBg(d.value),
                  )}
                />
              </div>
              <span className="text-xs font-medium tabular-nums">
                {d.value}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border bg-card p-6 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          音标健康图（含样本数）
        </h2>
        <PhonemeHealthMap scores={result.phonemeScores} />
      </motion.div>

      {result.rawEvidence.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            诊断证据
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            {result.rawEvidence.slice(0, 8).map((entry, index) => (
              <div
                key={`${entry.text}-${entry.detail}-${index}`}
                className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{entry.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.detail}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-xs font-bold tabular-nums text-white",
                    getScoreBg(entry.score),
                  )}
                >
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground">
            3 天 / 7 天训练处方
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {result.prescription.days.map((day) => (
            <div key={day.day} className="rounded-lg bg-muted/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{day.title}</span>
              </div>
              <div className="space-y-2">
                {day.items.map((item) => {
                  const pack = getTrainingPack(item.packId);
                  if (!pack) return null;
                  return (
                    <Link
                      key={`${day.day}-${item.packId}`}
                      href={`/drill/pack/${item.packId}${
                        item.levelId ? `?level=${encodeURIComponent(item.levelId)}` : ""
                      }`}
                      className="block rounded-md bg-background px-3 py-2 text-sm transition-colors hover:bg-primary/10"
                    >
                      <span className="font-medium">{pack.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.estimatedMinutes} 分钟 · {item.priority}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="flex justify-center gap-3 pb-6">
        <Button
          variant="outline"
          onClick={onRetake}
          className="gap-2 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          重新测试
        </Button>
        <Link href={primaryHref}>
          <Button className="gap-2 cursor-pointer">
            {primaryPack ? `开始：${primaryPack.title}` : "开始训练处方"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: DiagnosisIssue }) {
  const packId = issue.recommendedPackIds[0];
  const pack = packId ? getTrainingPack(packId) : null;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        issue.severity === "critical"
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
          : "bg-card",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{issue.title}</h3>
        <Badge
          variant={issue.severity === "critical" ? "destructive" : "secondary"}
        >
          {issue.severity}
        </Badge>
      </div>
      {issue.suspectedSubstitution && (
        <p className="mb-2 font-mono text-xs text-muted-foreground">
          {issue.suspectedSubstitution}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{issue.impact}</p>
      <p className="mt-3 text-sm font-medium">{issue.fixCue}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {issue.confidence && (
          <Badge variant="outline">置信度 {issue.confidence}</Badge>
        )}
        {issue.evidenceStrength && (
          <Badge variant="outline">证据 {issue.evidenceStrength}</Badge>
        )}
        {issue.errorPatternIds?.slice(0, 2).map((patternId) => (
          <Badge key={patternId} variant="secondary">
            {patternId}
          </Badge>
        ))}
      </div>
      {issue.nextLesson && (
        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
          <p className="font-semibold text-primary">
            下一关：{issue.nextLesson.levelId}
          </p>
          <p className="mt-1 text-muted-foreground">{issue.nextLesson.reason}</p>
        </div>
      )}
      {issue.evidence[0] && (
        <div className="mt-3 rounded-lg bg-background/70 p-2 text-xs">
          <span className="font-semibold">{issue.evidence[0].text}</span>
          <span className="text-muted-foreground">
            {" "}
            · {issue.evidence[0].score} 分 · {issue.evidence[0].detail}
          </span>
        </div>
      )}
      {pack && (
        <Link
          href={`/drill/pack/${pack.id}${
            issue.nextLesson?.levelId
              ? `?level=${encodeURIComponent(issue.nextLesson.levelId)}`
              : ""
          }`}
          className="mt-3 inline-flex"
        >
          <Button size="sm" variant="outline" className="gap-2 cursor-pointer">
            进入训练包
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}
