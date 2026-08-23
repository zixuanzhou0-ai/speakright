"use client";

import { type KeyboardEvent, useEffect, useState } from "react";
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

function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.some((item) => item.id === value);
}

export default function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>("basic");

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get(
      "section",
    );
    if (isSettingsSection(requestedSection)) setSection(requestedSection);
  }, []);

  useEffect(() => {
    const targetId =
      section === "services" && window.location.hash === "#standard-tts"
        ? "standard-tts"
        : section === "data" && window.location.hash === "#privacy-details"
          ? "privacy-details"
          : null;
    if (!targetId) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(targetId)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [section]);

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % SETTINGS_SECTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (index - 1 + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SETTINGS_SECTIONS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextSection = SETTINGS_SECTIONS[nextIndex];
    setSection(nextSection.id);
    requestAnimationFrame(() =>
      document.getElementById(`settings-tab-${nextSection.id}`)?.focus(),
    );
  };

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
          {SETTINGS_SECTIONS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              aria-controls={`settings-panel-${item.id}`}
              id={`settings-tab-${item.id}`}
              tabIndex={section === item.id ? 0 : -1}
              onClick={() => setSection(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
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
        <section
          role="tabpanel"
          id="settings-panel-basic"
          aria-labelledby="settings-tab-basic"
          hidden={section !== "basic"}
          className="space-y-6"
        >
          <LanguageConfigCard />
          <PronunciationConfigCard />
          <CoachModeCard />
        </section>
        <section
          role="tabpanel"
          id="settings-panel-services"
          aria-labelledby="settings-tab-services"
          hidden={section !== "services"}
          className="space-y-6"
        >
          <div id="standard-tts" className="scroll-mt-4">
            <ElevenLabsConfigCard />
          </div>
          <AzureConfigCard />
          <UsageMonitor />
          <LlmConfigCard />
        </section>
        <section
          role="tabpanel"
          id="settings-panel-data"
          aria-labelledby="settings-tab-data"
          hidden={section !== "data"}
          className="space-y-6"
        >
          <DataControlCard />
        </section>
        <section
          role="tabpanel"
          id="settings-panel-labs"
          aria-labelledby="settings-tab-labs"
          hidden={section !== "labs"}
          className="space-y-6"
        >
          <ReleaseCard />
          <LanguageAvailabilityCard />
        </section>
      </div>
    </div>
  );
}
