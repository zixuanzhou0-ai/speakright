"use client";

export const DESKTOP_MIC_CHECK_KEY = "speakright_desktop_mic_check_v1";
export const DESKTOP_MIC_CHECK_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface DesktopMicCheck {
  version: 1;
  passedAt: number;
  deviceLabel?: string;
}

export type DesktopReadinessStepId = "azure" | "microphone" | "diagnosis";

export interface DesktopReadinessStep {
  id: DesktopReadinessStepId;
  label: string;
  ready: boolean;
  actionHref?: string;
}

export interface DesktopReadinessSummary {
  steps: DesktopReadinessStep[];
  readyCount: number;
  totalCount: number;
  complete: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseDesktopMicCheck(raw: string | null): DesktopMicCheck | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.passedAt !== "number" ||
      !Number.isFinite(parsed.passedAt)
    ) {
      return null;
    }

    return {
      version: 1,
      passedAt: parsed.passedAt,
      deviceLabel:
        typeof parsed.deviceLabel === "string" && parsed.deviceLabel.trim()
          ? parsed.deviceLabel
          : undefined,
    };
  } catch {
    return null;
  }
}

export function isDesktopMicCheckFresh(
  check: DesktopMicCheck | null,
  now = Date.now(),
): boolean {
  if (!check) return false;
  const ageMs = now - check.passedAt;
  return ageMs >= 0 && ageMs <= DESKTOP_MIC_CHECK_MAX_AGE_MS;
}

export function readDesktopMicCheck(now = Date.now()): DesktopMicCheck | null {
  if (typeof window === "undefined") return null;
  const check = parseDesktopMicCheck(
    localStorage.getItem(DESKTOP_MIC_CHECK_KEY),
  );
  return isDesktopMicCheckFresh(check, now) ? check : null;
}

export function saveDesktopMicCheck(
  check: Omit<DesktopMicCheck, "version" | "passedAt"> & {
    passedAt?: number;
  } = {},
): DesktopMicCheck {
  const item: DesktopMicCheck = {
    version: 1,
    passedAt: check.passedAt ?? Date.now(),
    deviceLabel: check.deviceLabel,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(DESKTOP_MIC_CHECK_KEY, JSON.stringify(item));
    window.dispatchEvent(new StorageEvent("storage", { key: DESKTOP_MIC_CHECK_KEY }));
  }
  return item;
}

export function buildDesktopReadinessSummary({
  azureReady,
  microphoneReady,
  hasDiagnosis,
}: {
  azureReady: boolean;
  microphoneReady: boolean;
  hasDiagnosis: boolean;
}): DesktopReadinessSummary {
  const steps: DesktopReadinessStep[] = [
    {
      id: "azure",
      label: "评分密钥",
      ready: azureReady,
      actionHref: azureReady ? undefined : "/settings",
    },
    {
      id: "microphone",
      label: "麦克风",
      ready: microphoneReady,
    },
    {
      id: "diagnosis",
      label: "诊断档案",
      ready: hasDiagnosis,
      actionHref: hasDiagnosis ? undefined : "/assessment",
    },
  ];
  const readyCount = steps.filter((step) => step.ready).length;
  return {
    steps,
    readyCount,
    totalCount: steps.length,
    complete: readyCount === steps.length,
  };
}
