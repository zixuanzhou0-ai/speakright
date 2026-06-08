"use client";

import { CheckCircle2, FlaskConical, Languages } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { setLanguageConfig } from "@/lib/api-keys";
import { auditLanguageCoverage } from "@/lib/language-content-audit";
import {
  getEnabledLanguageProfiles,
  getLanguageProfile,
} from "@/lib/language-profiles";
import { cn } from "@/lib/utils";
import type { LanguageId } from "@/types/language";

function statusLabel(status: string) {
  if (status === "stable") return "基线";
  if (status === "experimental") return "实验";
  return "草案";
}

export function LanguageConfigCard() {
  const config = useLanguageConfig();
  const activeProfile = getLanguageProfile(config.languageId);
  const profiles = getEnabledLanguageProfiles();

  const handleSelect = (languageId: LanguageId) => {
    setLanguageConfig({ languageId });
    const profile = getLanguageProfile(languageId);
    toast.success(`已切换到${profile.displayName}学习板块`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">学习语言</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          当前：{activeProfile.displayName}。西语、法语、俄语已开放 beta；单词/短语音频请在下方安装 ElevenLabs 多语言发音包。
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {profiles.map((profile) => {
          const selected = profile.id === config.languageId;
          const audit = auditLanguageCoverage(profile.id);
          const missingPreview = audit.missingCapabilities.slice(0, 3).join("、");
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => handleSelect(profile.id)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{profile.displayName}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {statusLabel(profile.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {profile.nativeName} · Azure {profile.azureLocale}
                  </p>
                </div>
                {selected ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <FlaskConical className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border bg-background px-2 py-1.5">
                  <p className="text-muted-foreground">发音单位</p>
                  <p className="font-semibold">{audit.soundUnits}</p>
                </div>
                <div className="rounded border bg-background px-2 py-1.5">
                  <p className="text-muted-foreground">示例词</p>
                  <p className="font-semibold">{audit.keywordTotal}</p>
                </div>
                <div className="rounded border bg-background px-2 py-1.5">
                  <p className="text-muted-foreground">覆盖率</p>
                  <p className="font-semibold">{audit.coverageScore}%</p>
                </div>
              </div>

              {audit.missingCapabilities.length > 0 && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  待补：{missingPreview}
                  {audit.missingCapabilities.length > 3 ? "…" : ""}
                </p>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
