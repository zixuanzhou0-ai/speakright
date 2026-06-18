"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getDefaultPhonemePracticeSlug } from "@/lib/language-sound-unit-groups";

export function PhonemesRedirectClient() {
  const router = useRouter();
  const { languageId } = useLanguageConfig();

  useEffect(() => {
    router.replace(`/phonemes/${getDefaultPhonemePracticeSlug(languageId)}`);
  }, [languageId, router]);

  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      正在进入当前语言的发音单位...
    </div>
  );
}
