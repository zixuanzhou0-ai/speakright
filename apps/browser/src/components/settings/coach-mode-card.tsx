"use client";

import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCoachMode } from "@/hooks/use-api-keys";
import { type CoachMode, setCoachMode } from "@/lib/api-keys";
import { cn } from "@/lib/utils";

const MODES: { value: CoachMode; label: string; desc: string }[] = [
  { value: "easy", label: "关键一项", desc: "只指出一个最影响沟通的问题" },
  { value: "normal", label: "平衡反馈", desc: "给出 2–3 个优先问题和练习" },
  { value: "hard", label: "精细反馈", desc: "提供更细的证据与动作提示" },
  { value: "strict", label: "技术审阅", desc: "全面技术审阅，直接但不羞辱" },
];

export function CoachModeCard() {
  const mode = useCoachMode();

  const handleChange = (value: CoachMode) => {
    setCoachMode(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5" />
          AI 教练模式
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => handleChange(m.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-all cursor-pointer",
                mode === m.value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-[11px] leading-tight opacity-70">
                {m.desc}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
