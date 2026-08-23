"use client";

import { FlaskConical, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PhonemeGrid } from "@/components/phoneme/phoneme-grid";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getLanguagePhonemes } from "@/lib/language-phonemes";
import { getLanguageProfile } from "@/lib/language-profiles";
import { isVisibleInPhonemePractice } from "@/lib/language-sound-unit-groups";

export function PhonemeDirectoryClient() {
  const { languageId } = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageId);
  const [query, setQuery] = useState("");
  const phonemes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return getLanguagePhonemes(languageId)
      .filter((unit) => isVisibleInPhonemePractice(languageId, unit))
      .filter((unit) => {
        if (!normalized) return true;
        return [unit.ipa, unit.name, unit.example, unit.description]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized);
      });
  }, [languageId, query]);

  return (
    <div
      className="min-h-full overflow-y-auto px-4 py-5 scrollbar-thin sm:px-6"
      data-smoke="phoneme-directory"
      data-language-id={languageId}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              {languageProfile.shortLabel}发音单位
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              选择今天要练的音
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              先听示范、理解动作，再进入单词录音。选择一个音标即可开始。
            </p>
          </div>
          <label className="relative block w-full md:max-w-xs">
            <span className="sr-only">搜索音标、名称或示例词</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索 /ɪ/、短元音或 sit"
              className="min-h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        {languageId !== "en-US" && (
          <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Labs：当前语言提供可靠示范与练习反馈，但不生成与英语正式体系等价的音素诊断或掌握结论。
            </p>
          </div>
        )}

        {languageId === "en-US" && (
          <details className="mt-5 rounded-xl border bg-card">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-3 text-sm font-semibold">
              查看本站 IPA 记法说明
            </summary>
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              SpeakRight 使用便于学习者对照的美式记法。本站 /e/ 对应部分词典的
              /ɛ/，/iː/ 对应常见美式词典的 /i/，/ɜːr/ 对应部分美式词典的
              /ɝ/。这些是记法差异，不代表必须改变口音目标。
            </p>
          </details>
        )}

        <div className="mt-7">
          {phonemes.length > 0 ? (
            <PhonemeGrid phonemes={phonemes} />
          ) : (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              没有匹配的发音单位，请换一个音标、名称或示例词。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
