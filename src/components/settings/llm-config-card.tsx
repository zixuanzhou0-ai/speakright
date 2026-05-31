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
import { testLlm } from "@/lib/api-client";
import { getLlmConfig, setLlmConfig } from "@/lib/api-keys";
import {
  DESKTOP_LLM_POLICY_MESSAGE,
  PRESET_PROVIDERS,
  PROVIDER_NAMES,
} from "@/lib/llm-providers";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import { cn } from "@/lib/utils";
import type { ProviderName } from "@/types/llm";
import { type ConnectionState, ConnectionStatus } from "./connection-status";

export function LlmConfigCard() {
  const [provider, setProvider] = useState<ProviderName>("claude");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRESET_PROVIDERS.claude.baseUrl);
  const [model, setModel] = useState(PRESET_PROVIDERS.claude.models[0] ?? "");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauriEnvironment());
    const saved = getLlmConfig();
    if (saved) {
      setProvider((saved.provider as ProviderName) ?? "claude");
      setApiKey(saved.apiKey);
      setBaseUrl(saved.baseUrl);
      setModel(saved.model);
    }
  }, []);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const preset = PRESET_PROVIDERS[provider];
  const isCustom = provider === "custom";
  const desktopCustomBlocked = isDesktop && isCustom;

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
      return;
    }
    if (!apiKey.trim()) {
      toast.error("请输入 API Key");
      return;
    }
    setLlmConfig({
      provider,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model,
    });
    toast.success("LLM 配置已保存");
  };

  const handleTest = async () => {
    if (desktopCustomBlocked) {
      setStatus("error");
      setStatusMsg(DESKTOP_LLM_POLICY_MESSAGE);
      return;
    }
    if (!apiKey.trim() || !baseUrl.trim()) {
      toast.error("请填写完整配置");
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
    } catch {
      setStatus("error");
      setStatusMsg("网络错误");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>LLM Provider</CardTitle>
        <CardDescription>用于生成中文发音反馈</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider chips */}
        <div className="space-y-2">
          <Label>Provider</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDER_NAMES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderChange(p)}
                disabled={isDesktop && p === "custom"}
                title={
                  isDesktop && p === "custom"
                    ? DESKTOP_LLM_POLICY_MESSAGE
                    : undefined
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
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
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{DESKTOP_LLM_POLICY_MESSAGE}</p>
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
            disabled={!isCustom || desktopCustomBlocked}
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
                  onClick={() => setModel(m)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors cursor-pointer",
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

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={desktopCustomBlocked}>
            保存
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={desktopCustomBlocked}
          >
            测试连接
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
