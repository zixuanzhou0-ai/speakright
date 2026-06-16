"use client";

import { AzureConfigCard } from "@/components/settings/azure-config-card";
import { CoachModeCard } from "@/components/settings/coach-mode-card";
import { DataControlCard } from "@/components/settings/data-control-card";
import { ElevenLabsConfigCard } from "@/components/settings/elevenlabs-config-card";
import { LanguageAvailabilityCard } from "@/components/settings/language-availability-card";
import { LanguageConfigCard } from "@/components/settings/language-config-card";
import { LlmConfigCard } from "@/components/settings/llm-config-card";
import { PronunciationConfigCard } from "@/components/settings/pronunciation-config-card";
import { ReleaseCard } from "@/components/settings/release-card";
import { SettingsStorageWarning } from "@/components/settings/settings-storage-warning";
import { UsageMonitor } from "@/components/settings/usage-monitor";

export default function SettingsPage() {
  return (
    <div
      className="h-full overflow-y-auto scrollbar-thin"
      data-smoke="settings-page"
    >
      <div className="max-w-5xl mx-auto px-6 py-4">
        <h1 className="mb-2 text-2xl font-bold">设置</h1>
        <p className="mb-6 text-muted-foreground">
          管理桌面端版本、用量监控和 API
          密钥。所有密钥仅保存在本机，不会上传到服务器。
        </p>

        <SettingsStorageWarning />

        <div className="mb-6">
          <ReleaseCard />
        </div>

        <div className="mb-6">
          <LanguageAvailabilityCard />
        </div>

        <div className="mb-10">
          <UsageMonitor />
        </div>

        <div className="space-y-6">
          <LanguageConfigCard />
          <DataControlCard />
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
