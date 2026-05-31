"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useElevenLabsConfig } from "@/hooks/use-api-keys";
import { fetchElevenLabsUsage } from "@/lib/api-client";
import {
  AZURE_FREE_TIER_SECONDS,
  getAzureUsage,
  getLlmUsage,
  resetAzureUsage,
  resetLlmUsage,
} from "@/lib/usage-tracker";

// ===== Ring Progress =====

interface RingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

function getRingColor(pct: number): string {
  if (pct >= 80) return "stroke-red-500";
  if (pct >= 50) return "stroke-yellow-500";
  return "stroke-green-500";
}

function Ring({ percent, size = 96, strokeWidth = 6 }: RingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      role="img"
      aria-label={`用量 ${percent.toFixed(1)}%`}
    >
      <title>{`用量 ${percent.toFixed(1)}%`}</title>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={`transition-all duration-500 ${getRingColor(percent)}`}
      />
    </svg>
  );
}

// ===== ElevenLabs Card =====

interface ElevenLabsData {
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number;
}

function ElevenLabsUsageCard() {
  const [data, setData] = useState<ElevenLabsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = useElevenLabsConfig();

  const fetchUsage = useCallback(async () => {
    if (!config?.apiKey) {
      setError("未配置 API Key");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const json = await fetchElevenLabsUsage(config.apiKey);
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "查询失败";
      if (msg.includes("missing_permissions") || msg.includes("401")) {
        setError("API Key 缺少 user_read 权限，无法查询用量");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [config?.apiKey]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Auto-refresh when TTS calls happen (debounced)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchUsage(), 1000);
    };
    window.addEventListener("speakright:elevenlabs-usage-changed", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(
        "speakright:elevenlabs-usage-changed",
        handler,
      );
    };
  }, [fetchUsage]);

  const percent = data ? (data.characterCount / data.characterLimit) * 100 : 0;
  const resetDays = data?.nextResetUnix
    ? Math.max(
        0,
        Math.ceil((data.nextResetUnix * 1000 - Date.now()) / 86_400_000),
      )
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">ElevenLabs</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={fetchUsage}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : data ? (
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring percent={percent} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                {percent.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">
                  {data.characterCount.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  / {data.characterLimit.toLocaleString()} 字符
                </span>
              </p>
              {resetDays !== null && (
                <p className="text-muted-foreground">{resetDays} 天后重置</p>
              )}
              <p className="text-xs text-muted-foreground">实时（API 查询）</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ===== Azure Card =====

function AzureUsageCard() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const usage = getAzureUsage();
  const totalHours = usage.totalSeconds / 3600;
  const limitHours = AZURE_FREE_TIER_SECONDS / 3600;
  const percent = (usage.totalSeconds / AZURE_FREE_TIER_SECONDS) * 100;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleReset = () => {
    resetAzureUsage();
    setConfirmOpen(false);
    toast.success("Azure 用量已重置");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Azure Speech</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={refresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Ring percent={percent} />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
              {percent.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="font-medium">{totalHours.toFixed(1)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {limitHours.toFixed(0)} 小时
              </span>
            </p>
            <p className="text-muted-foreground">
              {usage.totalRequests} 次调用
            </p>
            <p className="text-xs text-muted-foreground">本地估算</p>
          </div>
        </div>

        {/* Recent history */}
        {usage.history.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              最近调用
            </p>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {usage.history.map((h) => (
                <div
                  key={`${h.timestamp}-${h.target}-${h.durationSeconds}`}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span className="truncate max-w-[140px]">{h.target}</span>
                  <span className="shrink-0 tabular-nums">
                    {h.durationSeconds}s
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            实际用量以 Azure 门户为准
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setConfirmOpen(true)}
          >
            重置计数
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认重置</DialogTitle>
                <DialogDescription>
                  确定要重置 Azure 本地用量记录吗？此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleReset}>
                  重置
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== LLM Card =====

function LlmUsageCard() {
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const usage = getLlmUsage();
  const _totalTokens = usage.totalInputTokens + usage.totalOutputTokens;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleReset = () => {
    resetLlmUsage();
    setConfirmOpen(false);
    toast.success("LLM 用量已重置");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">LLM Provider</CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={refresh}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">输入 tokens</p>
            <p className="font-medium tabular-nums">
              {usage.totalInputTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">输出 tokens</p>
            <p className="font-medium tabular-nums">
              {usage.totalOutputTokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">估算费用</p>
            <p className="font-medium">
              {usage.estimatedCostYuan < 0.01 && usage.totalRequests > 0
                ? "< ¥0.01"
                : `¥${usage.estimatedCostYuan.toFixed(2)}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">调用次数</p>
            <p className="font-medium tabular-nums">{usage.totalRequests}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setConfirmOpen(true)}
          >
            重置计数
          </Button>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认重置</DialogTitle>
                <DialogDescription>
                  确定要重置 LLM 本地用量记录吗？此操作不可撤销。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={handleReset}>
                  重置
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Main Component =====

export function UsageMonitor() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">用量监控</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ElevenLabsUsageCard />
        <AzureUsageCard />
        <LlmUsageCard />
      </div>
    </div>
  );
}
