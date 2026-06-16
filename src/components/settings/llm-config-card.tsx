"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLlmConfig } from "@/hooks/use-api-keys";
import { testLlm } from "@/lib/api-client";
import { setLlmConfig } from "@/lib/api-keys";
import {
  DESKTOP_LLM_POLICY_MESSAGE,
  getDesktopLlmPolicyError,
  normalizeStoredProvider,
  PRESET_PROVIDERS,
  PROVIDER_NAMES,
} from "@/lib/llm-providers";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import { cn } from "@/lib/utils";
import type { ProviderName } from "@/types/llm";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { getSettingsUserFacingError } from "./user-facing-error";

const WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export function LlmConfigCard() {
  const [provider, setProvider] = useState<ProviderName>("claude");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRESET_PROVIDERS.claude.baseUrl);
  const [model, setModel] = useState(PRESET_PROVIDERS.claude.models[0] ?? "");
  const [isDesktop, setIsDesktop] = useState(false);
  const saved = useLlmConfig();

  useEffect(() => {
    setIsDesktop(isTauriEnvironment());
  }, []);

  useEffect(() => {
    if (saved) {
      const nextProvider = normalizeStoredProvider(saved.provider, isDesktop);
      const nextPreset = PRESET_PROVIDERS[nextProvider];
      const canUseSavedEndpoint =
        (nextProvider === "custom" && !isDesktop) ||
        nextPreset.baseUrlEditable === true;
      setProvider(nextProvider);
      setApiKey(saved.apiKey ?? "");
      setBaseUrl(
        canUseSavedEndpoint ? (saved.baseUrl ?? "") : nextPreset.baseUrl,
      );
      setModel(saved.model || nextPreset.models[0] || "");
    } else {
      const nextPreset = PRESET_PROVIDERS.claude;
      setProvider("claude");
      setApiKey("");
      setBaseUrl(nextPreset.baseUrl);
      setModel(nextPreset.models[0] ?? "");
    }
  }, [saved, isDesktop]);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const preset = PRESET_PROVIDERS[provider];
  const isCustom = provider === "custom";
  const desktopCustomBlocked = isDesktop && isCustom;
  const needsManualConfig = preset.status === "needsManualConfig";
  const canEditBaseUrl =
    (isCustom && !desktopCustomBlocked) || preset.baseUrlEditable === true;

  const handleProviderChange = (p: ProviderName) => {
    if (isDesktop && p === "custom") {
      toast.error(DESKTOP_LLM_POLICY_MESSAGE);
      return;
    }
    setProvider(p);
    const newPreset = PRESET_PROVIDERS[p];
    setBaseUrl(newPreset.baseUrl);
    setModel(newPreset.models[0] ?? "");
  };

  const handleSave = () => {
    if (desktopCustomBlocked) {
      toast.error(DESKTOP_LLM_POLICY_MESSAGE);
      setStatus("error");
      setStatusMsg(DESKTOP_LLM_POLICY_MESSAGE);
      return;
    }
    if (needsManualConfig && (!baseUrl.trim() || !model.trim())) {
      const message = "请填写官方 Base URL 和模型名称";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    const desktopPolicyError = isDesktop
      ? getDesktopLlmPolicyError(provider, baseUrl.trim())
      : null;
    if (desktopPolicyError) {
      toast.error(desktopPolicyError);
      setStatus("error");
      setStatusMsg(desktopPolicyError);
      return;
    }
    if (!apiKey.trim()) {
      const message = "请填写 API Key 后再保存配置";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    if (!baseUrl.trim()) {
      const message = "请填写 Base URL 后再保存配置";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    setLlmConfig({
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model,
    });
    toast.success("LLM 配置已保存");
    setStatus("success");
    setStatusMsg("AI 教练配置已保存，建议再测试连接。");
  };

  const handleTest = async () => {
    if (desktopCustomBlocked) {
      setStatus("error");
      setStatusMsg(DESKTOP_LLM_POLICY_MESSAGE);
      return;
    }
    if (needsManualConfig && (!baseUrl.trim() || !model.trim())) {
      const message = "请先填写官方 Base URL 和模型名称";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    const desktopPolicyError = isDesktop
      ? getDesktopLlmPolicyError(provider, baseUrl.trim())
      : null;
    if (desktopPolicyError) {
      setStatus("error");
      setStatusMsg(desktopPolicyError);
      return;
    }
    if (!apiKey.trim()) {
      const message = "请填写 API Key 后再测试连接";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    if (!baseUrl.trim()) {
      const message = "请填写 Base URL 后再测试连接";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    setStatus("testing");
    setStatusMsg("");

    try {
      const result = await testLlm({
        apiKey: apiKey.trim(),
        provider,
        baseUrl: baseUrl.trim(),
        model,
      });
      if (result.success) {
        setStatus("success");
        setStatusMsg(result.reply ? `回复：${result.reply}` : "连接成功");
      } else {
        setStatus("error");
        setStatusMsg(result.error ?? "连接失败");
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "AI 教练连接测试失败，请检查网络、代理或 provider 配置后重试。",
        ),
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 教练 LLM</CardTitle>
        <CardDescription>
          用于生成中文教练反馈；评分分数仍来自 Azure Speech。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!apiKey.trim() && (
          <div
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            data-smoke="llm-missing-key-guidance"
            role="status"
          >
            未配置 AI 教练 Key 时，Azure 数字评分仍可用；中文教练反馈会显示配置提示，不会卡住评分流程。
          </div>
        )}

        {/* Provider chips */}
        <div className="space-y-2">
          <Label>Provider</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_NAMES.map((p) => (
              <button
                key={p}
                type="button"
                data-provider={p}
                data-smoke="llm-provider-chip"
                onClick={() => handleProviderChange(p)}
                disabled={isDesktop && p === "custom"}
                title={
                  isDesktop && p === "custom"
                    ? DESKTOP_LLM_POLICY_MESSAGE
                    : undefined
                }
                className={cn(
                  "max-w-full rounded-full border px-3 py-1 text-center text-sm transition-colors break-words",
                  provider === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent",
                  isDesktop &&
                    p === "custom" &&
                    "cursor-not-allowed opacity-45 hover:bg-transparent",
                )}
              >
                {PRESET_PROVIDERS[p].label}
              </button>
            ))}
          </div>
        </div>

        {isDesktop && (
          <div
            className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            data-smoke="desktop-llm-policy"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{DESKTOP_LLM_POLICY_MESSAGE}</p>
          </div>
        )}

        {needsManualConfig && (
          <div
            className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground"
            data-provider={provider}
            data-smoke="llm-manual-provider-note"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">
                {preset.label} 需要以官方 API 文档填写 Base URL 和模型名称。
              </p>
              {isDesktop && (
                <p>
                  桌面版不会放开任意 LLM 域名；官方 endpoint 确认并加入
                  Tauri allowlist/CSP 后才能测试连接。
                </p>
              )}
              {preset.docsUrl && (
                <p className="break-all text-xs">{preset.docsUrl}</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="llm-key">API Key</Label>
          <Input
            id="llm-key"
            type="password"
            placeholder="输入 API 密钥"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="llm-base">Base URL</Label>
          <Input
            id="llm-base"
            placeholder="https://api.example.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={!canEditBaseUrl || desktopCustomBlocked}
            data-smoke="llm-base-url"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="llm-model">Model</Label>
          <Input
            id="llm-model"
            placeholder="输入模型名称"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          {!isCustom && preset.models.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {preset.models.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-model={m}
                  data-smoke="llm-model-chip"
                  onClick={() => setModel(m)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-center text-xs transition-colors break-all cursor-pointer",
                    model === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-3"
          data-smoke="llm-config-actions"
        >
          <Button
            onClick={handleSave}
            disabled={desktopCustomBlocked}
            className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
          >
            保存
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={desktopCustomBlocked}
            className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
          >
            测试连接
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
