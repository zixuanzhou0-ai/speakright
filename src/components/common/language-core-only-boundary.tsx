"use client";

import { AudioLines, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import {
  getDefaultPhonemeSlug,
  getLanguageProfile,
} from "@/lib/language-profiles";
import {
  getLanguageCapabilityPolicy,
  getRouteCapability,
  type LanguageCapabilityRoute,
} from "@/lib/language-capability-policy";
import { canRecordFormalMastery } from "@/lib/mastery-language-policy";

interface LanguageCoreOnlyBoundaryProps {
  moduleName: string;
  capabilityRoute?: LanguageCapabilityRoute;
  children: ReactNode;
}

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "h-auto min-h-9 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export function LanguageCoreOnlyBoundary({
  moduleName,
  capabilityRoute,
  children,
}: LanguageCoreOnlyBoundaryProps) {
  const { languageId } = useLanguageConfig();

  const routeCapability = capabilityRoute
    ? getRouteCapability(
        getLanguageCapabilityPolicy(languageId),
        capabilityRoute,
      )
    : null;
  const isAvailable = routeCapability
    ? routeCapability !== "unavailable"
    : canRecordFormalMastery(languageId);

  if (isAvailable) return <>{children}</>;

  const profile = getLanguageProfile(languageId);
  const defaultPhonemeSlug = getDefaultPhonemeSlug(languageId);

  return (
    <div
      className="flex h-full items-center justify-center overflow-y-auto px-6 py-8 scrollbar-thin"
      data-language-id={languageId}
      data-smoke="non-english-core-only-boundary"
      role="status"
    >
      <section className="w-full max-w-2xl rounded-xl border bg-card p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 break-words text-2xl font-bold [overflow-wrap:anywhere]">
          {profile.shortLabel}公开版先聚焦核心练习
        </h1>
        <p className="mt-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          当前语言公开版只开放音标/发音单位练习和自由练习。{moduleName}
          仍在建设中，暂不展示未完成训练、诊断或 mastery 证据。
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/phonemes/${defaultPhonemeSlug}`} className="max-w-full">
            <Button className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}>
              <AudioLines className="h-4 w-4" />
              去音标练习
            </Button>
          </Link>
          <Link href="/sentences" className="max-w-full">
            <Button
              variant="outline"
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <MessageSquareText className="h-4 w-4" />
              去自由练习
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
