"use client";

import {
  CheckCircle2,
  DownloadCloud,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useElevenLabsConfig } from "@/hooks/use-api-keys";
import {
  ELEVENLABS_LANGUAGE_PACKS,
  getElevenLabsPackSummary,
  type ElevenLabsAudioPackMode,
  type ElevenLabsPackLanguageId,
} from "@/lib/elevenlabs-language-packs";
import {
  installElevenLabsLanguagePack,
  type ElevenLabsPackInstallProgress,
} from "@/lib/elevenlabs-language-pack-installer";
import {
  clearLanguageAudioPack,
  getLanguageAudioPackStatus,
  type LanguageAudioPackStatus,
} from "@/lib/language-audio-pack-cache";

const PACK_LANGUAGES: ElevenLabsPackLanguageId[] = ["es-ES", "fr-FR", "ru-RU"];

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function modeLabel(mode: ElevenLabsAudioPackMode): string {
  return mode === "core" ? "核心包" : "完整包";
}

function phaseLabel(progress: ElevenLabsPackInstallProgress | null): string {
  if (!progress) return "";
  if (progress.phase === "checking") return "检查余额";
  if (progress.phase === "voice") return "匹配声音";
  if (progress.phase === "generating") return `生成 ${progress.text ?? ""}`;
  if (progress.phase === "saving") return `保存 ${progress.text ?? ""}`;
  return "完成";
}

export function ElevenLabsVoicePackCard() {
  const config = useElevenLabsConfig();
  const [statuses, setStatuses] = useState<
    Partial<Record<ElevenLabsPackLanguageId, LanguageAudioPackStatus | null>>
  >({});
  const [running, setRunning] = useState<{
    languageId: ElevenLabsPackLanguageId;
    mode: ElevenLabsAudioPackMode;
  } | null>(null);
  const [progress, setProgress] =
    useState<ElevenLabsPackInstallProgress | null>(null);

  const summaries = useMemo(
    () =>
      PACK_LANGUAGES.reduce(
        (acc, languageId) => {
          acc[languageId] = {
            core: getElevenLabsPackSummary(languageId, "core"),
            full: getElevenLabsPackSummary(languageId, "full"),
          };
          return acc;
        },
        {} as Record<
          ElevenLabsPackLanguageId,
          ReturnType<typeof getElevenLabsPackSummary> extends infer Summary
            ? { core: Summary; full: Summary }
            : never
        >,
      ),
    [],
  );

  const refreshStatuses = useCallback(async () => {
    const next: Partial<
      Record<ElevenLabsPackLanguageId, LanguageAudioPackStatus | null>
    > = {};
    for (const languageId of PACK_LANGUAGES) {
      next[languageId] = await getLanguageAudioPackStatus(languageId);
    }
    setStatuses(next);
  }, []);

  useEffect(() => {
    void refreshStatuses();
  }, [refreshStatuses]);

  const handleInstall = async (
    languageId: ElevenLabsPackLanguageId,
    mode: ElevenLabsAudioPackMode,
  ) => {
    if (!config?.apiKey) {
      toast.error("请先保存 ElevenLabs API Key");
      return;
    }

    setRunning({ languageId, mode });
    setProgress(null);

    try {
      const result = await installElevenLabsLanguagePack({
        apiKey: config.apiKey,
        languageId,
        mode,
        fallbackVoice: config.voiceId
          ? { voiceId: config.voiceId, voiceName: config.voiceName }
          : undefined,
        onProgress: setProgress,
      });
      toast.success(
        `${ELEVENLABS_LANGUAGE_PACKS[languageId].title}已安装：新生成 ${result.generated} 条，跳过 ${result.skipped} 条`,
      );
      await refreshStatuses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "安装失败");
    } finally {
      setRunning(null);
      setProgress(null);
    }
  };

  const handleClear = async (languageId: ElevenLabsPackLanguageId) => {
    await clearLanguageAudioPack(languageId);
    await refreshStatuses();
    toast.success(`${ELEVENLABS_LANGUAGE_PACKS[languageId].title}已清空`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>ElevenLabs 多语言发音包</CardTitle>
            <CardDescription>
              西语、法语、俄语使用高质量多语言模型生成本地单词/短语音频。
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            余额保护
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          默认模型为 <span className="font-medium text-foreground">eleven_multilingual_v2</span>
          ，安装前会检查 ElevenLabs 剩余额度，并为账户保留 1,000 credits 缓冲。
        </div>

        <div className="space-y-3">
          {PACK_LANGUAGES.map((languageId) => {
            const pack = ELEVENLABS_LANGUAGE_PACKS[languageId];
            const status = statuses[languageId];
            const active = running?.languageId === languageId;
            const progressRatio =
              active && progress?.total
                ? Math.min(100, (progress.current / progress.total) * 100)
                : 0;

            return (
              <section
                key={languageId}
                className="rounded-lg border bg-background p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{pack.title}</h3>
                      <Badge variant="outline">{pack.nativeName}</Badge>
                      <Badge variant="secondary">{pack.languageCode}</Badge>
                      {status && (
                        <Badge className="gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          已安装 {formatNumber(status.installedCount)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pack.voiceDescription}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>模型：{pack.modelId}</span>
                      <span>核心：{formatNumber(summaries[languageId].core.itemCount)} 条 / 约 {formatNumber(summaries[languageId].core.estimatedCredits)} credits</span>
                      <span>完整：{formatNumber(summaries[languageId].full.itemCount)} 条 / 约 {formatNumber(summaries[languageId].full.estimatedCredits)} credits</span>
                    </div>
                    {status && (
                      <p className="text-xs text-muted-foreground">
                        声音：{status.voiceName} · {modeLabel(status.mode)} ·{" "}
                        {new Date(status.updatedAt).toLocaleString("zh-CN")}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleInstall(languageId, "core")}
                      disabled={Boolean(running)}
                    >
                      <DownloadCloud className="mr-1.5 h-4 w-4" />
                      安装核心包
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInstall(languageId, "full")}
                      disabled={Boolean(running)}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      安装完整包
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleClear(languageId)}
                      disabled={Boolean(running) || !status}
                      aria-label={`清空${pack.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {active && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{phaseLabel(progress)}</span>
                      <span>
                        {formatNumber(progress?.current ?? 0)} /{" "}
                        {formatNumber(progress?.total ?? 0)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressRatio}%` }}
                      />
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={refreshStatuses}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          刷新安装状态
        </Button>
      </CardContent>
    </Card>
  );
}
