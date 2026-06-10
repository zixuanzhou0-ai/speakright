"use client";

import {
  Bug,
  Database,
  Download,
  KeyRound,
  RotateCcw,
  Trash2,
  VolumeX,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  deleteAllLocalData,
  deleteApiKeys,
  deleteBenchmarkAudioData,
  deleteLearningData,
  downloadLocalDataExport,
  getLocalDataSummary,
} from "@/lib/data-registry";
import { downloadDesktopSupportBundle } from "@/lib/desktop-diagnostics";
import { subscribeToStorage } from "@/lib/api-keys";

type ConfirmAction =
  | "learning"
  | "api-keys"
  | "benchmark-audio"
  | "all-data"
  | null;

const COPY: Record<
  Exclude<ConfirmAction, null>,
  { title: string; description: string; button: string }
> = {
  learning: {
    title: "删除本机学习数据？",
    description:
      "会删除诊断报告、训练记录、mastery profile、复习队列、用量统计、benchmark 记录和音频缓存；API keys 会保留。",
    button: "删除学习数据",
  },
  "api-keys": {
    title: "删除所有 API keys？",
    description:
      "会删除 Azure、ElevenLabs 和 LLM 的本机密钥。删除后需要重新配置才能继续调用服务。",
    button: "删除 API keys",
  },
  "benchmark-audio": {
    title: "清空 benchmark 音频？",
    description:
      "会删除本机 IndexedDB 中保存的 benchmark 录音和对应列表记录，不影响普通训练记录。",
    button: "清空音频",
  },
  "all-data": {
    title: "重置本机数据？",
    description:
      "会删除学习记录、缓存、数据迁移状态、麦克风检查和非密钥偏好设置。你可以选择是否同时删除 API keys。",
    button: "重置本机数据",
  },
};

export function DataControlCard() {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resetIncludesApiKeys, setResetIncludesApiKeys] = useState(false);
  const [summary, setSummary] = useState(() => getLocalDataSummary());
  const copy = confirmAction ? COPY[confirmAction] : null;

  useEffect(
    () => subscribeToStorage(() => setSummary(getLocalDataSummary())),
    [],
  );

  const refresh = () => {
    setSummary(getLocalDataSummary());
    setSummaryVersion((value) => value + 1);
  };
  const closeDialog = () => {
    setConfirmAction(null);
    setResetIncludesApiKeys(false);
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      await downloadLocalDataExport();
      toast.success("本地学习数据已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDiagnosticsExport = async () => {
    setBusy(true);
    try {
      await downloadDesktopSupportBundle();
      toast.success("桌面诊断包已导出");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "诊断包导出失败");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      if (confirmAction === "learning") {
        await deleteLearningData();
        toast.success("学习数据已删除");
      } else if (confirmAction === "api-keys") {
        await deleteApiKeys();
        toast.success("API keys 已删除");
      } else if (confirmAction === "all-data") {
        await deleteAllLocalData({ includeApiKeys: resetIncludesApiKeys });
        toast.success(
          resetIncludesApiKeys
            ? "本机数据和 API keys 已重置"
            : "本机数据已重置，API keys 已保留",
        );
      } else {
        await deleteBenchmarkAudioData();
        toast.success("Benchmark 音频已清空");
      }
      closeDialog();
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card data-smoke="data-privacy-center" key={summaryVersion}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">数据与隐私中心</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">学习数据项</p>
              <p className="mt-1 text-2xl font-semibold">
                {summary.learningKeys}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">缓存项</p>
              <p className="mt-1 text-2xl font-semibold">{summary.cacheKeys}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">已配置密钥</p>
              <p className="mt-1 text-2xl font-semibold">
                {summary.configuredApiKeys}/{summary.apiKeySlots}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">数据版本</p>
              <p className="mt-1 text-2xl font-semibold">
                v{summary.dataSchemaVersion}
              </p>
              {summary.corruptItems > 0 && (
                <p className="mt-1 text-xs text-destructive">
                  已隔离 {summary.corruptItems} 项损坏数据
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-muted/35 p-4 text-sm text-muted-foreground">
            录音评分会发送音频与参考文本到 Azure
            Speech；标准示范会把练习文本发送到 ElevenLabs；AI
            教练会把文本、分数和错误摘要发送到你配置的 LLM provider。
            原始训练录音默认不长期保存，benchmark 录音只保存在本机并会随学习数据导出。
            诊断包只包含版本信息、数据摘要和桌面运行日志尾部，不包含 API keys 或原始录音。
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              导出学习数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDiagnosticsExport}
              disabled={busy}
              className="gap-2"
            >
              <Bug className="h-4 w-4" />
              导出诊断包
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction("all-data")}
              disabled={busy}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              重置本机数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction("learning")}
              disabled={busy}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              删除学习数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction("benchmark-audio")}
              disabled={busy}
              className="gap-2"
            >
              <VolumeX className="h-4 w-4" />
              清空 benchmark 音频
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmAction("api-keys")}
              disabled={busy}
              className="gap-2"
            >
              <KeyRound className="h-4 w-4" />
              删除 API keys
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          {confirmAction === "all-data" && (
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/25 p-3">
              <div>
                <p className="text-sm font-medium">同时删除 API keys</p>
                <p className="text-xs text-muted-foreground">
                  关闭时会保留 Azure、ElevenLabs、LLM 和词典密钥，便于重置后继续使用。
                </p>
              </div>
              <Switch
                checked={resetIncludesApiKeys}
                onCheckedChange={setResetIncludesApiKeys}
                aria-label="同时删除 API keys"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={busy}
            >
              取消
            </Button>
            <Button
              type="button"
              variant={confirmAction === "api-keys" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={busy}
            >
              {copy?.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
