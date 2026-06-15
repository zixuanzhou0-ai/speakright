"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Languages,
  LoaderCircle,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useAzureConfig,
  useElevenLabsConfig,
  useLanguageConfig,
  useLlmConfig,
} from "@/hooks/use-api-keys";
import { isAzureConfigReady } from "@/lib/azure-config";
import {
  isElevenLabsPackLanguageId,
  type ElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";
import { getLanguageProfile } from "@/lib/language-profiles";
import {
  getStaticLanguageAudioPackSummary,
  type StaticLanguageAudioPackSummary,
} from "@/lib/static-language-audio-pack";

interface AvailabilityRow {
  id: string;
  label: string;
  status: string;
  detail: string;
  ready: boolean;
  statusKind: "ready" | "pending" | "warning";
  icon: typeof KeyRound;
}

type StaticPackState =
  | {
      languageId: ElevenLabsPackLanguageId | null;
      status: "idle" | "loading" | "missing";
      summary: null;
    }
  | {
      languageId: ElevenLabsPackLanguageId;
      status: "ready";
      summary: StaticLanguageAudioPackSummary;
    };

function hasSecret(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function recommendation(rows: AvailabilityRow[]): string {
  const missingScoring = rows.find(
    (row) => row.id === "azure" && row.statusKind === "warning",
  );
  if (missingScoring) return "下一步：配置 Azure Speech 评分密钥。";

  const pending = rows.find((row) => row.statusKind === "pending");
  if (pending) return "正在检查内置发音资源；检查完成前不需要安装额外语言包。";

  const missing = rows.find((row) => !row.ready);
  if (!missing) return "可以直接开始今日训练。";
  if (missing.id === "tts") {
    return "下一步：配置 ElevenLabs；内置资源之外的长句示范需要 TTS。";
  }
  if (missing.id === "local-pack") {
    return "当前构建缺少内置发音资源，请重新安装最新版桌面端。";
  }
  return "下一步：配置 AI 教练 LLM；没有它仍可评分训练。";
}

export function LanguageAvailabilityCard() {
  const languageConfig = useLanguageConfig();
  const azureConfig = useAzureConfig();
  const elevenLabsConfig = useElevenLabsConfig();
  const llmConfig = useLlmConfig();
  const profile = getLanguageProfile(languageConfig.languageId);
  const [staticPackState, setStaticPackState] = useState<StaticPackState>({
    languageId: null,
    status: "idle",
    summary: null,
  });
  const packLanguageId = isElevenLabsPackLanguageId(languageConfig.languageId)
    ? (languageConfig.languageId as ElevenLabsPackLanguageId)
    : null;
  const effectiveStaticPack =
    packLanguageId && staticPackState.languageId === packLanguageId
      ? staticPackState
      : packLanguageId
        ? ({
            languageId: packLanguageId,
            status: "loading",
            summary: null,
          } satisfies StaticPackState)
        : ({
            languageId: null,
            status: "idle",
            summary: null,
          } satisfies StaticPackState);

  useEffect(() => {
    let cancelled = false;

    if (!packLanguageId) {
      setStaticPackState({ languageId: null, status: "idle", summary: null });
      return;
    }

    setStaticPackState({
      languageId: packLanguageId,
      status: "loading",
      summary: null,
    });

    void getStaticLanguageAudioPackSummary(packLanguageId)
      .then((staticSummary) => {
        if (cancelled) return;
        setStaticPackState(
          staticSummary
            ? {
                languageId: packLanguageId,
                status: "ready",
                summary: staticSummary,
              }
            : { languageId: packLanguageId, status: "missing", summary: null },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setStaticPackState({
          languageId: packLanguageId,
          status: "missing",
          summary: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [packLanguageId]);

  const rows = useMemo<AvailabilityRow[]>(() => {
    const azureReady = isAzureConfigReady(azureConfig);
    const ttsConfigured = hasSecret(elevenLabsConfig?.apiKey);
    const localPackReady =
      languageConfig.languageId === "en-US" ||
      effectiveStaticPack.status === "ready";
    const packIsLoading = effectiveStaticPack.status === "loading";
    const llmReady = hasSecret(llmConfig?.apiKey);

    return [
      {
        id: "azure",
        label: "录音评分 Azure",
        status: azureReady ? "已配置" : "未配置",
        detail: "负责录音评分、音素/词级反馈和诊断证据。",
        ready: azureReady,
        statusKind: azureReady ? "ready" : "warning",
        icon: KeyRound,
      },
      {
        id: "tts",
        label: "标准示范 TTS",
        status: ttsConfigured
          ? "ElevenLabs 已配置"
          : localPackReady
            ? "内置资源可用"
            : packIsLoading
              ? "检查内置资源"
              : "未配置",
        detail: packIsLoading
          ? "正在确认短词/短语内置资源；长句示范仍需要 ElevenLabs。"
          : "负责长句示范；短词/短语优先使用桌面端内置资源。",
        ready: ttsConfigured || localPackReady,
        statusKind:
          ttsConfigured || localPackReady
            ? "ready"
            : packIsLoading
              ? "pending"
              : "warning",
        icon: Cloud,
      },
      {
        id: "local-pack",
        label: "内置发音资源",
        status:
          languageConfig.languageId === "en-US"
            ? "英语内置"
            : effectiveStaticPack.status === "ready"
              ? `内置 ${effectiveStaticPack.summary.itemCount} 条`
              : effectiveStaticPack.status === "loading"
                ? "检查中"
                : "缺失或不可读",
        detail:
          languageConfig.languageId === "en-US" ||
          effectiveStaticPack.status === "ready"
            ? "负责单词/短语复读，随桌面端发布，不需要用户安装。"
            : effectiveStaticPack.status === "loading"
              ? "正在读取随应用打包的本地发音资源清单。"
              : "没有读到本地发音资源清单，请重新安装最新版桌面端或反馈 Release EXE 问题。",
        ready: localPackReady,
        statusKind: localPackReady
          ? "ready"
          : packIsLoading
            ? "pending"
            : "warning",
        icon: Database,
      },
      {
        id: "llm",
        label: "AI 教练 LLM",
        status: llmReady ? "已配置" : "未配置",
        detail: "负责中文教练反馈；没有它也能完成录音评分。",
        ready: llmReady,
        statusKind: llmReady ? "ready" : "warning",
        icon: Bot,
      },
    ];
  }, [
    azureConfig,
    elevenLabsConfig,
    effectiveStaticPack,
    languageConfig.languageId,
    llmConfig,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">当前语言可用性</CardTitle>
            </div>
            <CardDescription>
              当前：{profile.displayName}。这里把评分、标准示范、单词词典发音和
              AI 教练分开显示，避免把不同服务混在一起。
            </CardDescription>
          </div>
          <Badge variant={profile.status === "stable" ? "default" : "secondary"}>
            {profile.status === "stable" ? "稳定基线" : "实验板块"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.id}
                className="rounded-lg border bg-background px-3 py-3"
                data-smoke={`language-availability-${row.id}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium break-words [overflow-wrap:anywhere]">
                    {row.label}
                  </span>
                  <Badge
                    variant={row.ready ? "default" : "outline"}
                    className="ml-auto h-auto min-h-5 shrink whitespace-normal text-center break-words [overflow-wrap:anywhere]"
                  >
                    {row.ready ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : row.statusKind === "pending" ? (
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {row.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.detail}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">推荐：</span>
            {recommendation(rows)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
