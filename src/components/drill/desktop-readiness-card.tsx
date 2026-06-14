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
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAzureConfig, subscribeToStorage } from "@/lib/api-keys";
import { isAzureConfigReady } from "@/lib/azure-config";
import {
  buildDesktopReadinessSummary,
  DESKTOP_MIC_SAMPLE_MS,
  evaluateDesktopMicSignal,
  getDesktopMicFailureMessage,
  readDesktopMicCheck,
  saveDesktopMicCheck,
  type DesktopMicCheck,
  type DesktopMicSignal,
  type DesktopReadinessStep,
} from "@/lib/desktop-readiness";
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
} satisfies Record<DesktopReadinessStep["id"], typeof KeyRound>;

function supportsMicrophoneCheck(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError")
  );
}

function formatSignalLevel(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return ` · 电平 ${Math.round(value * 100)}%`;
}

function micStatusText(status: MicStatus, check: DesktopMicCheck | null): string {
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
    return "当前环境无法直接检测麦克风，请确认正在使用 Release EXE，并检查 Windows 麦克风权限。";
  }
  if (status === "denied") {
    return "系统拒绝了麦克风访问，请在 Windows 隐私设置中允许 SpeakRight 使用麦克风后重试。";
  }
  if (status === "low-signal") {
    return getDesktopMicFailureMessage("low-signal");
  }
  if (status === "too-short") {
    return getDesktopMicFailureMessage("too-short");
  }
  if (status === "error") {
    return "麦克风检测失败，请确认设备已连接、未被其他应用占用，然后重试。";
  }
  return null;
}

async function measureMicSignal(stream: MediaStream): Promise<DesktopMicSignal | null> {
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
  const deadline = startedAt + DESKTOP_MIC_SAMPLE_MS;

  try {
    while (performance.now() < deadline) {
      analyser.getFloatTimeDomainData(samples);
      for (const sample of samples) {
        const level = Math.abs(sample);
        peakLevel = Math.max(peakLevel, level);
        sumSquares += level * level;
        sampleCount += 1;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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

export function DesktopReadinessCard({
  hasDiagnosis,
}: {
  hasDiagnosis: boolean;
}) {
  const [azureReady, setAzureReady] = useState(false);
  const [micCheck, setMicCheck] = useState<DesktopMicCheck | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>("unknown");

  useEffect(() => {
    const refreshAzureState = () => {
      const config = getAzureConfig();
      setAzureReady(isAzureConfigReady(config));
    };
    const savedMicCheck = readDesktopMicCheck();
    setMicCheck(savedMicCheck);
    setMicStatus(
      savedMicCheck ? "ready" : supportsMicrophoneCheck() ? "unknown" : "unsupported",
    );
    refreshAzureState();
    return subscribeToStorage(refreshAzureState);
  }, []);

  const microphoneReady = micStatus === "ready" && !!micCheck;
  const summary = useMemo(
    () =>
      buildDesktopReadinessSummary({
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
      const evaluation = evaluateDesktopMicSignal(signal);
      if (!evaluation.passed) {
        setMicCheck(null);
        setMicStatus(
          evaluation.reason === "too-short" ? "too-short" : "low-signal",
        );
        return;
      }
      const saved = saveDesktopMicCheck({ deviceLabel, ...signal });
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
      className="mb-5 rounded-xl border bg-card p-4 shadow-sm"
      data-smoke="desktop-readiness-checklist"
    >
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
                    {isMic ? micStatusText(micStatus, micCheck) : step.ready ? "已就绪" : "待完成"}
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
          {!azureReady && (
            <Link data-smoke="configure-azure-scoring-key" href="/settings">
              <Button variant="outline" className="gap-2">
                <KeyRound className="h-4 w-4" />
                配置 Azure Speech 评分密钥
              </Button>
            </Link>
          )}
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
              disabled={micStatus === "checking" || micStatus === "unsupported"}
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
          {!hasDiagnosis && (
            <Link data-smoke="start-three-minute-diagnosis" href="/assessment">
              <Button className="gap-2">
                <ClipboardList className="h-4 w-4" />
                开始 3 分钟诊断
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
