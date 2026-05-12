"use client";

import { AzureConfigCard } from "@/components/settings/azure-config-card";
import { CoachModeCard } from "@/components/settings/coach-mode-card";
import { ElevenLabsConfigCard } from "@/components/settings/elevenlabs-config-card";
import { LlmConfigCard } from "@/components/settings/llm-config-card";
import { PronunciationConfigCard } from "@/components/settings/pronunciation-config-card";
import { UsageMonitor } from "@/components/settings/usage-monitor";

export default function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto px-6 py-4">
        <h1 className="mb-2 text-2xl font-bold">API 设置</h1>
        <p className="mb-6 text-muted-foreground">
          配置以下三个 API
          的密钥。所有密钥仅保存在浏览器本地，不会上传到服务器。
        </p>

        <div className="mb-10">
          <UsageMonitor />
        </div>

        <div className="space-y-6">
          <AzureConfigCard />
          <ElevenLabsConfigCard />
          <PronunciationConfigCard />
          <CoachModeCard />
          <LlmConfigCard />
        </div>
      </div>
    </div>
  );
}
