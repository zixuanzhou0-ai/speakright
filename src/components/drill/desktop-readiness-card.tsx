"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Loader2,
  Mic2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAzureConfig, subscribeToStorage } from "@/lib/api-keys";
import {
  buildDesktopReadinessSummary,
  readDesktopMicCheck,
  saveDesktopMicCheck,
  type DesktopMicCheck,
  type DesktopReadinessStep,
} from "@/lib/desktop-readiness";
import { cn } from "@/lib/utils";

type MicStatus = "unknown" | "checking" | "ready" | "unsupported" | "denied" | "error";

const STEP_ICONS = {
  azure: KeyRound,
  microphone: Mic2,
  diagnosis: ClipboardList,
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

function micStatusText(status: MicStatus, check: DesktopMicCheck | null): string {
  if (status === "ready") {
    return check?.deviceLabel ? check.deviceLabel : "已通过";
  }
  if (status === "checking") return "检测中";
  if (status === "unsupported") return "不可用";
  if (status === "denied") return "未授权";
  if (status === "error") return "检测失败";
  return "待检测";
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
      setAzureReady(!!config?.subscriptionKey && !!config.region);
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

  const handleMicCheck = async () => {
    if (!supportsMicrophoneCheck()) {
      setMicStatus("unsupported");
      return;
    }

    setMicStatus("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      const deviceLabel = stream.getAudioTracks()[0]?.label;
      for (const track of stream.getTracks()) {
        track.stop();
      }
      const saved = saveDesktopMicCheck({ deviceLabel });
      setMicCheck(saved);
      setMicStatus("ready");
    } catch (error) {
      setMicStatus(isPermissionDenied(error) ? "denied" : "error");
    }
  };

  return (
    <section className="mb-5 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">
              {summary.readyCount}/{summary.totalCount}
            </Badge>
            <h2 className="text-base font-bold">桌面端准备状态</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
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
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!azureReady && (
            <Link href="/settings">
              <Button variant="outline" className="gap-2">
                <KeyRound className="h-4 w-4" />
                配置密钥
              </Button>
            </Link>
          )}
          {!microphoneReady && (
            <Button
              type="button"
              variant={micStatus === "denied" ? "destructive" : "outline"}
              onClick={handleMicCheck}
              disabled={micStatus === "checking" || micStatus === "unsupported"}
              className="gap-2"
            >
              {micStatus === "checking" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : micStatus === "denied" || micStatus === "error" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Mic2 className="h-4 w-4" />
              )}
              检测麦克风
            </Button>
          )}
          {!hasDiagnosis && (
            <Link href="/assessment">
              <Button className="gap-2">
                <ClipboardList className="h-4 w-4" />
                建立诊断
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
