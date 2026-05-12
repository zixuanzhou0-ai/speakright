"use client";

import { GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type CoachMode, getCoachMode, setCoachMode } from "@/lib/api-keys";
import { cn } from "@/lib/utils";

const MODES: { value: CoachMode; label: string; desc: string }[] = [
  { value: "easy", label: "简单", desc: "像外国朋友一样包容，只指出严重错误" },
  { value: "normal", label: "正常", desc: "专业教练，平和指导，适度分析" },
  { value: "hard", label: "略难", desc: "高标准要求，细微偏差也会指出" },
  { value: "strict", label: "严师", desc: "母语者标准，不留情面，事无巨细" },
];

export function CoachModeCard() {
  const [mode, setMode] = useState<CoachMode>("normal");

  useEffect(() => {
    setMode(getCoachMode());
  }, []);

  const handleChange = (value: CoachMode) => {
    setMode(value);
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
        <div className="grid grid-cols-4 gap-2">
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
