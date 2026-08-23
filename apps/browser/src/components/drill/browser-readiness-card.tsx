"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Loader2,
  Mic2,
  PlayCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAzureConfig, subscribeToStorage } from "@/lib/api-keys";
import { isAzureConfigReady } from "@/lib/azure-config";
import {
  buildBrowserReadinessSummary,
  BROWSER_MIC_SAMPLE_MS,
  evaluateBrowserMicSignal,
  getBrowserMicFailureMessage,
  readBrowserMicCheck,
  saveBrowserMicCheck,
  type BrowserMicCheck,
  type BrowserMicSignal,
  type BrowserReadinessStep,
} from "@/lib/browser-readiness";
import { cn } from "@/lib/utils";

type MicStatus =
  | "unknown"
  | "checking"
  | "ready"
  | "unsupported"
  | "denied"
  | "low-signal"
  | "too-short"
  | "error";

const STEP_ICONS = {
  azure: KeyRound,
  microphone: Mic2,
  diagnosis: ClipboardList,
  training: PlayCircle,
} satisfies Record<BrowserReadinessStep["id"], typeof KeyRound>;

function supportsMicrophoneCheck(): boolean {
  return (
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
}

function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")
  );
}

function formatSignalLevel(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return ` · 电平 ${Math.round(value * 100)}%`;
}

function micStatusText(
  status: MicStatus,
  check: BrowserMicCheck | null,
): string {
  if (status === "ready") {
    return check?.deviceLabel
      ? `${check.deviceLabel}${formatSignalLevel(check.rmsLevel)}`
      : `已通过${formatSignalLevel(check?.rmsLevel)}`;
  }
  if (status === "checking") return "检测中";
  if (status === "unsupported") return "不可用";
  if (status === "denied") return "未授权";
  if (status === "low-signal") return "输入太低";
  if (status === "too-short") return "样本太短";
  if (status === "error") return "检测失败";
  return "待检测";
}

function micStatusHint(status: MicStatus): string | null {
  if (status === "unsupported") {
    return "当前浏览器无法直接检测麦克风，请确认正在通过 localhost 或 HTTPS 访问，并检查浏览器麦克风权限。";
  }
  if (status === "denied") {
    return "浏览器拒绝了麦克风访问，请在地址栏权限设置中允许 SpeakRight 使用麦克风后重试。";
  }
  if (status === "low-signal") {
    return getBrowserMicFailureMessage("low-signal");
  }
  if (status === "too-short") {
    return getBrowserMicFailureMessage("too-short");
  }
  if (status === "error") {
    return "麦克风检测失败，请确认设备已连接、未被其他应用占用，然后重试。";
  }
  return null;
}

async function measureMicSignal(
  stream: MediaStream,
): Promise<BrowserMicSignal | null> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return null;

  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  let sumSquares = 0;
  let sampleCount = 0;
  let peakLevel = 0;
  const startedAt = performance.now();
  const deadline = startedAt + BROWSER_MIC_SAMPLE_MS;

  try {
    while (performance.now() < deadline) {
      analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) {
        const level = Math.abs(sample);
        peakLevel = Math.max(peakLevel, level);
        sumSquares += level * level;
        sampleCount += 1;
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
  } finally {
    source.disconnect();
    await audioContext.close().catch(() => {});
  }

  return {
    rmsLevel: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
    peakLevel,
    sampledMs: Math.round(performance.now() - startedAt),
  };
}

export function BrowserReadinessCard({
  hasDiagnosis,
}: {
  hasDiagnosis: boolean;
}) {
  const [azureReady, setAzureReady] = useState(false);
  const [micCheck, setMicCheck] = useState<BrowserMicCheck | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("unknown");

  useEffect(() => {
    const refreshAzureState = () => {
      const config = getAzureConfig();
      setAzureReady(isAzureConfigReady(config));
    };
    const savedMicCheck = readBrowserMicCheck();
    setMicCheck(savedMicCheck);
    setMicStatus(
      savedMicCheck
        ? "ready"
        : supportsMicrophoneCheck()
          ? "unknown"
          : "unsupported",
    );
    refreshAzureState();
    return subscribeToStorage(refreshAzureState);
  }, []);

  const microphoneReady = micStatus === "ready" && !!micCheck;
  const summary = useMemo(
    () =>
      buildBrowserReadinessSummary({
        azureReady,
        microphoneReady,
        hasDiagnosis,
      }),
    [azureReady, microphoneReady, hasDiagnosis],
  );

  if (summary.complete) return null;

  const micHint = micStatusHint(micStatus);

  const handleMicCheck = async () => {
    if (!supportsMicrophoneCheck()) {
      setMicStatus("unsupported");
      return;
    }

    setMicStatus("checking");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      const deviceLabel = stream.getAudioTracks()[0]?.label;
      const signal = await measureMicSignal(stream);
      if (!signal) {
        setMicCheck(null);
        setMicStatus("unsupported");
        return;
      }
      const evaluation = evaluateBrowserMicSignal(signal);
      if (!evaluation.passed) {
        setMicCheck(null);
        setMicStatus(
          evaluation.reason === "too-short" ? "too-short" : "low-signal",
        );
        return;
      }
      const saved = saveBrowserMicCheck({ deviceLabel, ...signal });
      setMicCheck(saved);
      setMicStatus("ready");
    } catch (error) {
      setMicStatus(isPermissionDenied(error) ? "denied" : "error");
    } finally {
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
    }
  };

  return (
    <section
      className="mb-5 overflow-hidden rounded-xl border bg-card shadow-sm"
      data-smoke="browser-readiness-checklist"
    >
      <details>
        <summary
          className="flex min-h-11 cursor-pointer list-none flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          data-smoke="browser-service-status"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">离线学习可用</Badge>
            {summary.steps
              .filter((step) => step.id === "azure" || step.id === "microphone")
              .map((step) => (
                <span
                  key={step.id}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs",
                    step.ready
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label} ·{" "}
                  {step.ready
                    ? "已就绪"
                    : step.id === "azure"
                      ? "可选"
                      : "训练时检测"}
                </span>
              ))}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            展开检查
          </span>
        </summary>
        <div className="border-t p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">
                  {summary.readyCount}/{summary.totalCount}
                </Badge>
                <h2 className="text-base font-bold">开始前设置清单</h2>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">
                没有诊断前，今日训练会使用默认高频处方；完成诊断后才会变成你的个性化训练计划。
              </p>
              <div className="grid gap-2 md:grid-cols-4">
                {summary.steps.map((step) => {
                  const Icon = STEP_ICONS[step.id];
                  const isMic = step.id === "microphone";
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                        step.ready
                          ? "border-primary/30 bg-primary/5"
                          : "bg-background",
                      )}
                    >
                      {step.ready ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{step.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {isMic
                          ? micStatusText(micStatus, micCheck)
                          : step.ready
                            ? "已就绪"
                            : "待完成"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {micHint && (
                <div
                  className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  data-smoke="microphone-readiness-error"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{micHint}</span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {!microphoneReady && (
                <Button
                  type="button"
                  variant={
                    micStatus === "denied" ||
                    micStatus === "low-signal" ||
                    micStatus === "too-short" ||
                    micStatus === "error"
                      ? "destructive"
                      : "outline"
                  }
                  onClick={handleMicCheck}
                  disabled={
                    micStatus === "checking" || micStatus === "unsupported"
                  }
                  className="gap-2"
                  data-smoke="check-microphone"
                >
                  {micStatus === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : micStatus === "denied" ||
                    micStatus === "low-signal" ||
                    micStatus === "too-short" ||
                    micStatus === "error" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Mic2 className="h-4 w-4" />
                  )}
                  检测麦克风
                </Button>
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
