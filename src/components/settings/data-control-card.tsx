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
import { subscribeToStorage } from "@/lib/api-keys";
import {
  deleteAllLocalData,
  deleteApiKeys,
  deleteBenchmarkAudioData,
  deleteLearningData,
  downloadLocalDataExport,
  getLocalDataSummary,
  LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE,
} from "@/lib/data-registry";
import { downloadDesktopSupportBundle } from "@/lib/desktop-diagnostics";

type ConfirmAction =
  | "learning"
  | "api-keys"
  | "benchmark-audio"
  | "all-data"
  | null;
type DataControlStatus = {
  tone: "success" | "error";
  message: string;
};

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

const WRAP_SAFE_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

function containsChineseText(message: string): boolean {
  return /[\u4e00-\u9fff]/.test(message);
}

function getDataControlErrorMessage(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message.trim() : "";

  if (rawMessage && containsChineseText(rawMessage)) {
    return rawMessage;
  }

  const lowerMessage = rawMessage.toLowerCase();

  if (
    /keychain|secure|credential|settings store|tauri store/.test(lowerMessage)
  ) {
    return `${fallback}：本机安全存储或设置存储不可用，请重启应用后重试。`;
  }

  if (/indexeddb|database|\bidb\b/.test(lowerMessage)) {
    return `${fallback}：本机 IndexedDB 数据库不可用，请关闭其它 SpeakRight 窗口后重试，必要时重启应用。`;
  }

  if (/quota|space|full|storage/.test(lowerMessage)) {
    return `${fallback}：本机存储空间可能不足，请清理磁盘空间或应用缓存后重试。`;
  }

  if (/permission|denied|blocked|access/.test(lowerMessage)) {
    return `${fallback}：没有足够权限写入或删除本机数据，请检查文件下载权限或系统安全设置后重试。`;
  }

  return `${fallback}：本机操作没有完成，请重试；若仍失败，请查看桌面运行日志或截图反馈。`;
}

function getDataControlStatusClassName(
  tone: DataControlStatus["tone"],
): string {
  return tone === "error"
    ? "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive break-words [overflow-wrap:anywhere]"
    : "rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm text-foreground break-words [overflow-wrap:anywhere]";
}

export function DataControlCard() {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [summaryVersion, setSummaryVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resetIncludesApiKeys, setResetIncludesApiKeys] = useState(false);
  const [status, setStatus] = useState<DataControlStatus | null>(null);
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
  const openDialog = (action: Exclude<ConfirmAction, null>) => {
    setStatus(null);
    setConfirmAction(action);
  };

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await downloadLocalDataExport();
      const message = "本地学习数据已导出，导出文件不包含 API keys。";
      setStatus({ tone: "success", message });
      toast.success(message);
    } catch (error) {
      const message = getDataControlErrorMessage(error, "导出学习数据失败");
      setStatus({ tone: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDiagnosticsExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await downloadDesktopSupportBundle();
      const message = "桌面诊断包已导出，诊断包不包含 API keys 或原始录音。";
      setStatus({ tone: "success", message });
      toast.success(message);
    } catch (error) {
      const message = getDataControlErrorMessage(error, "诊断包导出失败");
      setStatus({ tone: "error", message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setBusy(true);
    setStatus(null);
    try {
      let message = "";
      if (confirmAction === "learning") {
        await deleteLearningData();
        message = "学习数据已删除，API keys 已保留。";
      } else if (confirmAction === "api-keys") {
        await deleteApiKeys();
        message = "API keys 已删除。";
      } else if (confirmAction === "all-data") {
        await deleteAllLocalData({ includeApiKeys: resetIncludesApiKeys });
        message = resetIncludesApiKeys
          ? "本机数据和 API keys 已重置。"
          : "本机数据已重置，API keys 已保留。";
      } else {
        await deleteBenchmarkAudioData();
        message = "Benchmark 音频已清空。";
      }
      setStatus({ tone: "success", message });
      toast.success(message);
      closeDialog();
      refresh();
    } catch (error) {
      const fallback =
        confirmAction === "learning"
          ? "删除学习数据失败"
          : confirmAction === "api-keys"
            ? "删除 API keys 失败"
            : confirmAction === "all-data"
              ? "重置本机数据失败"
              : "清空 benchmark 音频失败";
      const message = getDataControlErrorMessage(error, fallback);
      setStatus({ tone: "error", message });
      toast.error(message);
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

          {summary.corruptItems > 0 && (
            <div
              className="break-words rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 [overflow-wrap:anywhere] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              data-smoke="data-control-corrupt-data-warning"
              role="alert"
            >
              已隔离 {summary.corruptItems}{" "}
              项损坏的本机数据。建议先导出学习数据或诊断包留底；
              如果相关页面仍异常，请使用“重置本机数据”。默认不会删除 API keys。
            </div>
          )}

          {summary.storageUnavailable && (
            <div
              className="break-words rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 [overflow-wrap:anywhere] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              data-smoke="data-control-summary-warning"
              role="alert"
            >
              {LOCAL_DATA_SUMMARY_UNAVAILABLE_MESSAGE}
            </div>
          )}

          <div className="rounded-lg bg-muted/35 p-4 text-sm text-muted-foreground">
            录音评分会发送音频与参考文本到 Azure
            Speech；标准示范会把练习文本发送到 ElevenLabs；AI
            教练会把文本、分数和错误摘要发送到你配置的 LLM provider。
            原始训练录音默认不长期保存，benchmark
            录音只保存在本机并会随学习数据导出。
            诊断包只包含版本信息、数据摘要和桌面运行日志尾部，不包含 API keys
            或原始录音。
          </div>

          {status && (
            <div
              aria-live={status.tone === "error" ? "assertive" : "polite"}
              className={getDataControlStatusClassName(status.tone)}
              data-smoke="data-control-status"
              role={status.tone === "error" ? "alert" : "status"}
            >
              {status.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <Download className="h-4 w-4" />
              导出学习数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDiagnosticsExport}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <Bug className="h-4 w-4" />
              导出诊断包
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openDialog("all-data")}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <RotateCcw className="h-4 w-4" />
              重置本机数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openDialog("learning")}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <Trash2 className="h-4 w-4" />
              删除学习数据
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openDialog("benchmark-audio")}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
            >
              <VolumeX className="h-4 w-4" />
              清空 benchmark 音频
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => openDialog("api-keys")}
              disabled={busy}
              className={`gap-2 ${WRAP_SAFE_ACTION_BUTTON_CLASS}`}
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
          {status?.tone === "error" && (
            <div
              aria-live="assertive"
              className={getDataControlStatusClassName("error")}
              data-smoke="data-control-dialog-status"
              role="alert"
            >
              {status.message}
            </div>
          )}
          {confirmAction === "all-data" && (
            <div
              className="flex flex-col gap-3 rounded-lg border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between"
              data-smoke="data-control-api-key-toggle-row"
            >
              <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                <p className="text-sm font-medium">同时删除 API keys</p>
                <p className="text-xs text-muted-foreground">
                  关闭时会保留 Azure、ElevenLabs、LLM
                  和词典密钥，便于重置后继续使用。
                </p>
              </div>
              <Switch
                checked={resetIncludesApiKeys}
                onCheckedChange={setResetIncludesApiKeys}
                aria-label="同时删除 API keys"
                className="shrink-0"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={busy}
              className={WRAP_SAFE_ACTION_BUTTON_CLASS}
            >
              取消
            </Button>
            <Button
              type="button"
              variant={confirmAction === "api-keys" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={busy}
              className={WRAP_SAFE_ACTION_BUTTON_CLASS}
            >
              {copy?.button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
