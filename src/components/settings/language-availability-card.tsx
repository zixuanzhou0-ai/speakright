"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Languages,
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
import { getLanguageAudioPackStatus } from "@/lib/language-audio-pack-cache";
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
  icon: typeof KeyRound;
}

function hasSecret(value?: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function recommendation(rows: AvailabilityRow[]): string {
  const missing = rows.find((row) => !row.ready);
  if (!missing) return "可以直接开始今日训练。";
  if (missing.id === "azure") return "下一步：配置 Azure Speech 评分密钥。";
  if (missing.id === "tts") {
    return "下一步：配置 ElevenLabs，或安装/确认当前语言的本地发音包。";
  }
  if (missing.id === "local-pack") {
    return "下一步：安装当前语言的本地发音包，单词复读会更稳定。";
  }
  return "下一步：配置 AI 教练 LLM；没有它仍可评分训练。";
}

export function LanguageAvailabilityCard() {
  const languageConfig = useLanguageConfig();
  const azureConfig = useAzureConfig();
  const elevenLabsConfig = useElevenLabsConfig();
  const llmConfig = useLlmConfig();
  const profile = getLanguageProfile(languageConfig.languageId);
  const [staticPack, setStaticPack] =
    useState<StaticLanguageAudioPackSummary | null>(null);
  const [installedPackCount, setInstalledPackCount] = useState<number | null>(
    null,
  );
  const packLanguageId = isElevenLabsPackLanguageId(languageConfig.languageId)
    ? (languageConfig.languageId as ElevenLabsPackLanguageId)
    : null;

  useEffect(() => {
    let cancelled = false;
    setStaticPack(null);
    setInstalledPackCount(null);

    if (!packLanguageId) return;

    void Promise.all([
      getStaticLanguageAudioPackSummary(packLanguageId),
      getLanguageAudioPackStatus(packLanguageId),
    ]).then(([staticSummary, installedStatus]) => {
      if (cancelled) return;
      setStaticPack(staticSummary);
      setInstalledPackCount(installedStatus?.installedCount ?? null);
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
      Boolean(staticPack || installedPackCount);
    const llmReady = hasSecret(llmConfig?.apiKey);

    return [
      {
        id: "azure",
        label: "录音评分 Azure",
        status: azureReady ? "已配置" : "未配置",
        detail: "负责录音评分、音素/词级反馈和诊断证据。",
        ready: azureReady,
        icon: KeyRound,
      },
      {
        id: "tts",
        label: "标准示范 TTS",
        status: ttsConfigured
          ? "ElevenLabs 已配置"
          : localPackReady
            ? "可用本地发音包"
            : "未配置",
        detail: "负责句子/短语示范朗读；不同于单词词典发音。",
        ready: ttsConfigured || localPackReady,
        icon: Cloud,
      },
      {
        id: "local-pack",
        label: "本地发音包",
        status:
          languageConfig.languageId === "en-US"
            ? "英语内置"
            : staticPack
              ? `内置 ${staticPack.itemCount} 条`
              : installedPackCount
                ? `已安装 ${installedPackCount} 条`
                : "缺失",
        detail: "负责单词/短语复读，减少反复调用 TTS 的成本。",
        ready: localPackReady,
        icon: Database,
      },
      {
        id: "llm",
        label: "AI 教练 LLM",
        status: llmReady ? "已配置" : "未配置",
        detail: "负责中文教练反馈；没有它也能完成录音评分。",
        ready: llmReady,
        icon: Bot,
      },
    ];
  }, [
    azureConfig,
    elevenLabsConfig,
    installedPackCount,
    languageConfig.languageId,
    llmConfig,
    staticPack,
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
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{row.label}</span>
                  <Badge
                    variant={row.ready ? "default" : "outline"}
                    className="ml-auto gap-1"
                  >
                    {row.ready ? (
                      <CheckCircle2 className="h-3 w-3" />
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
