"use client";

import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { auditLanguageCoverage } from "@/lib/language-content-audit";
import { getLanguageProfile } from "@/lib/language-profiles";
import type { LanguageReadiness } from "@/types/language";

interface LanguageModuleGateProps {
  moduleName: string;
  readinessKey: keyof LanguageReadiness;
  children: ReactNode;
}

export function LanguageModuleGate({
  moduleName,
  readinessKey,
  children,
}: LanguageModuleGateProps) {
  const { languageId } = useLanguageConfig();
  const profile = getLanguageProfile(languageId);
  const audit = auditLanguageCoverage(languageId);
  const ready = profile.readiness[readinessKey];

  if (ready) return <>{children}</>;

  return (
    <div className="flex h-full items-center justify-center px-6 py-8">
      <div className="w-full max-w-2xl rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-600">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {profile.displayName}{moduleName}准备中
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              当前语言已有 {audit.soundUnits} 个{profile.soundUnitLabel}和{" "}
              {audit.keywordTotal} 个示例词，但还缺{" "}
              {audit.missingCapabilities.slice(0, 3).join("、")}。
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/35 p-4 text-sm text-muted-foreground">
          {profile.knownGaps.slice(0, 3).map((gap) => (
            <p key={gap} className="mb-1 last:mb-0">
              {gap}
            </p>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/phonemes">
            <Button className="gap-2">
              先查看发音单位
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline">配置语言/音频包</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
