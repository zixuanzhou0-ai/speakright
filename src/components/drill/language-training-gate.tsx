"use client";

import type { ComponentType } from "react";
import { Globe2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getLanguageProfile } from "@/lib/language-profiles";

interface LanguageTrainingGateProps {
  featureName: string;
}

export function LanguageTrainingGate({
  featureName,
}: LanguageTrainingGateProps) {
  const config = useLanguageConfig();
  const profile = getLanguageProfile(config.targetLanguage);
  const capabilities = profile.azureCapabilities;

  return (
    <div className="h-full overflow-y-auto px-6 py-4 scrollbar-thin">
      <div className="mx-auto mt-10 max-w-2xl rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-muted p-3">
            <LockKeyhole className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">
                {profile.displayName}
                {featureName}准备中
              </h1>
              <Badge variant="outline">
                Azure locale {profile.azureLocale}
              </Badge>
              <Badge variant="secondary">{profile.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              这门语言还没有通过 Azure capability probe。为避免错误评分进入
              mastery，本轮只展示语言内容草案，不开放正式训练和证据升级。
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Globe2 className="h-4 w-4 text-primary" />
            Capability probe
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Capability
              label="Scripted assessment"
              ok={capabilities.scriptedAssessment}
            />
            <Capability
              label="Word-level alignment"
              ok={capabilities.wordLevel}
            />
            <Capability
              label="Phoneme/segment signal"
              ok={capabilities.phonemeLevel}
            />
            <Capability
              label="Evidence mastery"
              ok={capabilities.evidenceMasteryAllowed}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Last reviewed: {capabilities.lastReviewed}
          </p>
        </div>

        {profile.starterTrainingPlans.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold">已准备的内容草案</p>
            {profile.starterTrainingPlans.slice(0, 3).map((plan) => (
              <div
                key={plan.id}
                className="rounded-lg border bg-background p-3"
              >
                <p className="text-sm font-medium">{plan.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.focus}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/settings">
            <Button variant="outline" className="cursor-pointer">
              切换训练语言
            </Button>
          </Link>
          <Link href="/drill">
            <Button className="cursor-pointer">返回今日计划</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant={ok ? "default" : "outline"}>
        {ok ? "verified" : "locked"}
      </Badge>
    </div>
  );
}

export function withLanguageTrainingGate<P extends object>(
  Component: ComponentType<P>,
  featureName: string,
) {
  return function GatedLanguageTrainingPage(props: P) {
    const config = useLanguageConfig();
    const profile = getLanguageProfile(config.targetLanguage);
    if (!profile.readiness.training) {
      return <LanguageTrainingGate featureName={featureName} />;
    }
    return <Component {...props} />;
  };
}
