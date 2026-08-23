"use client";

import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getLanguagePhonemePracticeGroups } from "@/lib/language-sound-unit-groups";
import type { LanguageId } from "@/types/language";

interface PhonemeMobileSelectorProps {
  languageId: LanguageId;
  currentSlug: string;
}

export function PhonemeMobileSelector({
  languageId,
  currentSlug,
}: PhonemeMobileSelectorProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return getLanguagePhonemePracticeGroups(languageId)
      .map((group) => ({
        ...group,
        units: group.units.filter((unit) => {
          if (!normalized) return true;
          return [unit.ipa, unit.name, unit.example]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized);
        }),
      }))
      .filter((group) => group.units.length > 0);
  }, [languageId, query]);
  const current = getLanguagePhonemePracticeGroups(languageId)
    .flatMap((group) => group.units)
    .find((unit) => unit.slug === currentSlug);

  return (
    <details
      className="mb-4 rounded-xl border bg-card shadow-sm lg:hidden"
      data-smoke="phoneme-mobile-selector"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0">
          切换发音单位
          <span className="ml-2 font-mono text-primary">
            {current?.ipa ?? currentSlug}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </summary>
      <div className="border-t p-3">
        <label className="relative block">
          <span className="sr-only">搜索音标、名称或示例词</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索音标或示例词"
            className="min-h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1 scrollbar-thin">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`mobile-${group.id}`}>
              <h2
                id={`mobile-${group.id}`}
                className="mb-2 text-xs font-semibold text-muted-foreground"
              >
                {group.label}
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {group.units.map((unit) => (
                  <Link
                    key={unit.slug}
                    href={`/phonemes/${unit.slug}`}
                    aria-current={
                      unit.slug === currentSlug ? "page" : undefined
                    }
                    className={`flex min-h-11 items-center justify-center rounded-lg border px-2 font-mono text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      unit.slug === currentSlug
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-background hover:border-primary/50"
                    }`}
                  >
                    {unit.ipa}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}
