"use client";

import { useState } from "react";
import { ApiKeyPersistenceCard } from "@/components/settings/api-key-persistence-card";
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

type SettingsSection = "basic" | "services" | "data" | "labs";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: "basic", label: "基础设置", description: "语言、发音音源与教练反馈" },
  { id: "services", label: "服务连接", description: "评分、示范音和 AI 服务" },
  { id: "data", label: "数据与隐私", description: "本地记录、导出与清理" },
  { id: "labs", label: "高级 / Labs", description: "版本、实验能力与边界" },
];

export default function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("basic");
  return (
    <div
      className="min-h-full overflow-y-auto scrollbar-thin"
      data-smoke="settings-page"
    >
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <h1 className="mb-2 text-2xl font-bold">设置</h1>
        <p className="mb-6 text-muted-foreground">
          先完成基础设置；只有需要连接外部服务时再进入服务连接。密钥只保存在当前浏览器。
        </p>
        <SettingsStorageWarning />
        <ApiKeyPersistenceCard />
        <div
          className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4"
          role="tablist"
          aria-label="设置分类"
        >
          {SETTINGS_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              onClick={() => setSection(item.id)}
              className={
                section === item.id
                  ? "min-h-11 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-left text-primary"
                  : "min-h-11 rounded-xl border bg-card px-3 py-2 text-left text-muted-foreground hover:bg-accent"
              }
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 hidden text-xs leading-snug sm:block">
                {item.description}
              </span>
            </button>
          ))}
        </div>
        <div role="tabpanel" className="space-y-6">
          {section === "basic" && (
            <>
              <LanguageConfigCard />
              <PronunciationConfigCard />
              <CoachModeCard />
            </>
          )}
          {section === "services" && (
            <>
              <UsageMonitor />
              <AzureConfigCard />
              <ElevenLabsConfigCard />
              <LlmConfigCard />
            </>
          )}
          {section === "data" && <DataControlCard />}
          {section === "labs" && (
            <>
              <ReleaseCard />
              <LanguageAvailabilityCard />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
