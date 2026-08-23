"use client";

import { CheckCircle2, FlaskConical, Languages } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { setLanguageConfig } from "@/lib/api-keys";
import { getLanguageCapabilityPolicy } from "@/lib/language-capability-policy";
import { auditLanguageCoverage } from "@/lib/language-content-audit";
import { getVisibleLanguagePhonologyGaps } from "@/lib/language-phonology-inventory";
import {
  getEnabledLanguageProfiles,
  getLanguageProfile,
} from "@/lib/language-profiles";
import { cn } from "@/lib/utils";
import type { LanguageId } from "@/types/language";

function capabilityOverview(languageId: LanguageId): string {
  const policy = getLanguageCapabilityPolicy(languageId);
  if (policy.productStatus === "stable") {
    return "稳定：发音单位、自由练习、引导训练、诊断与正式证据";
  }
  return "核心公开：发音单位、自由练习；Labs：引导训练、探索性诊断；正式证据关闭";
}

export function LanguageConfigCard() {
  const config = useLanguageConfig();
  const activePolicy = getLanguageCapabilityPolicy(config.languageId);
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
          当前：{activeProfile.displayName} ·{" "}
          {activePolicy.productStatus === "stable" ? "稳定基线" : "Labs"}。
          {capabilityOverview(config.languageId)}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {profiles.map((profile) => {
          const selected = profile.id === config.languageId;
          const policy = getLanguageCapabilityPolicy(profile.id);
          const audit = auditLanguageCoverage(profile.id);
          const phonologyGaps = getVisibleLanguagePhonologyGaps(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              data-smoke="language-option"
              data-language-id={profile.id}
              data-selected={selected ? "true" : "false"}
              onClick={() => handleSelect(profile.id)}
              className={cn(
                "min-h-11 rounded-lg border p-4 text-center transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="break-words font-medium [overflow-wrap:anywhere]">
                      {profile.displayName}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {policy.productStatus === "stable" ? "稳定基线" : "Labs"}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">
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
              <p className="mt-3 text-xs text-muted-foreground">
                {capabilityOverview(profile.id)}
              </p>

              {audit.missingCapabilities.length > 0 && (
                <p
                  className="mt-2 break-words text-center text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]"
                  data-smoke="language-option-missing"
                >
                  建设中：训练进度和高级练习能力会逐步补齐。
                </p>
              )}

              {phonologyGaps.length > 0 && (
                <p
                  className="mt-2 break-words text-center text-xs leading-snug text-amber-700 [overflow-wrap:anywhere] dark:text-amber-300"
                  data-smoke="language-option-phonology-gaps"
                  data-phonology-gap-count={phonologyGaps.length}
                >
                  部分进阶发音规则或单个音标仍在核验中；没有已核验本地短音频时，不会播放替代音频。
                </p>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
