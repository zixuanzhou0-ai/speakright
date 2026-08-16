"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
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
  useStandardTtsConfig,
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

const WRAP_SAFE_LANGUAGE_BADGE_CLASS =
  "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

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

function recommendation(
  rows: AvailabilityRow[],
  languageId: string,
): string {
  const missingScoring = rows.find(
    (row) => row.id === "azure" && row.statusKind === "warning",
  );
  if (missingScoring) return "下一步：配置 Azure Speech 评分密钥。";

  const pending = rows.find((row) => row.statusKind === "pending");
  if (pending) return "正在检查随应用提供的示范音频；不需要额外安装语言包。";

  const missing = rows.find((row) => !row.ready);
  if (!missing) {
    return languageId === "en-US"
      ? "可以直接开始今日训练。"
      : "可以直接开始音标/发音单位练习或自由练习；刻意练习和发音诊断仍在建设中。";
  }
  if (missing.id === "demo-audio") {
    return "当前构建缺少随应用提供的示范音频，请重新安装最新版桌面端。";
  }
  return "下一步：配置 AI 教练 LLM；没有它仍可评分训练。";
}

export function LanguageAvailabilityCard() {
  const languageConfig = useLanguageConfig();
  const azureConfig = useAzureConfig();
  const elevenLabsConfig = useElevenLabsConfig();
  const standardTtsConfig = useStandardTtsConfig();
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
    const usesHermes = standardTtsConfig.provider === "hermes-grok";
    const usesVertex = standardTtsConfig.provider === "vertex-gemini";
    const ttsConfigured =
      usesHermes || usesVertex || hasSecret(elevenLabsConfig?.apiKey);
    const localPackReady =
      languageConfig.languageId === "en-US" ||
      effectiveStaticPack.status === "ready";
    const packIsLoading = effectiveStaticPack.status === "loading";
    const llmReady = hasSecret(llmConfig?.apiKey);

    return [
      {
        id: "azure",
        label: "录音评分",
        status: azureReady ? "已配置" : "未配置",
        detail: "负责录音后的分数、单词反馈和发音问题提示。",
        ready: azureReady,
        statusKind: azureReady ? "ready" : "warning",
        icon: KeyRound,
      },
      {
        id: "demo-audio",
        label: "示范音频",
        status: ttsConfigured
          ? usesHermes
            ? "爱马仕 · Grok 已选择"
            : usesVertex
              ? "Vertex Gemini 已选择"
              : "ElevenLabs 已配置"
          : localPackReady
            ? "内置资源可用"
            : packIsLoading
              ? "检查中"
              : "未配置",
        detail: packIsLoading
          ? "正在确认随应用提供的单词和短语示范音频。"
          : ttsConfigured
            ? usesHermes
              ? "自定义长句将通过本机爱马仕桥接朗读；Browser Edition 本机启动器会自动启动桥接。"
              : usesVertex
                ? "自定义长句将通过本机 Vertex AI 项目朗读；需要 gcloud 项目和 ADC 授权。"
                : "可以播放随应用提供的示范音频；自定义长句也可使用在线 TTS。"
            : localPackReady
              ? languageConfig.languageId === "en-US"
                ? "常用示范音频随桌面端提供；自定义长句可能需要在线 TTS。"
                : "单词和短语示范已随桌面端提供；部分单个音标没有已核验短音频时，小喇叭会保持不可点击。"
              : "没有读到随应用提供的示范音频；请重新安装最新版桌面端或反馈 Release EXE 问题。",
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
        id: "llm",
        label: "AI 教练",
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
    standardTtsConfig,
    effectiveStaticPack,
    languageConfig.languageId,
    llmConfig,
  ]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <CardTitle className="break-words text-base [overflow-wrap:anywhere]">
                当前语言状态
              </CardTitle>
            </div>
            <CardDescription className="break-words [overflow-wrap:anywhere]">
              当前：{profile.displayName}。这里显示录音评分、示范音频和 AI
              教练三类能力。英语开放完整训练流；西语、法语、俄语公开版先聚焦核心练习。
            </CardDescription>
          </div>
          <Badge
            variant={profile.status === "stable" ? "default" : "secondary"}
            className={WRAP_SAFE_LANGUAGE_BADGE_CLASS}
            data-smoke="language-availability-status-badge"
          >
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
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium break-words [overflow-wrap:anywhere]">
                    {row.label}
                  </span>
                  <Badge
                    variant={row.ready ? "default" : "outline"}
                    className={`ml-auto ${WRAP_SAFE_LANGUAGE_BADGE_CLASS}`}
                    data-smoke={`language-availability-${row.id}-status-badge`}
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
                <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {row.detail}
                </p>
              </div>
            );
          })}
        </div>
        <div
          className="rounded-lg border bg-muted/35 px-3 py-2 text-sm text-muted-foreground"
          data-smoke="language-availability-public-scope"
        >
          <p className="break-words [overflow-wrap:anywhere]">
            {languageConfig.languageId === "en-US"
              ? "英语当前包含音标练习、自由练习、刻意练习、发音诊断和训练进度。"
              : `${profile.shortLabel}当前公开入口为音标/发音单位练习和自由练习；刻意练习和发音诊断仍在建设中。`}
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p
            className="break-words [overflow-wrap:anywhere]"
            data-smoke="language-availability-recommendation"
          >
            <span className="font-medium">推荐：</span>
            {recommendation(rows, languageConfig.languageId)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
