"use client";

import {
  getLocalDataSummary,
  type LocalDataSummary,
} from "@/lib/data-registry";
import { readCorruptLocalData } from "@/lib/local-data-migrations";
import { BROWSER_RELEASE_INFO } from "@/lib/release-info";

export interface BrowserRuntimeDiagnostics {
  app_identifier: string;
  log: {
    path: string | null;
    bytes: number | null;
    tail: string[];
    error: string | null;
  };
}

export interface BrowserCorruptLocalDataSummary {
  key: string;
  reason: string;
  detectedAt: string;
  schemaVersion: number;
  rawCharacters: number;
}

export interface BrowserSupportBundle {
  schemaVersion: 2;
  exportedAt: string;
  product: "SpeakRight Browser Edition";
  release: typeof BROWSER_RELEASE_INFO;
  dataSummary: LocalDataSummary;
  corruptLocalData: BrowserCorruptLocalDataSummary[];
  runtime: BrowserRuntimeDiagnostics;
  excluded: string[];
}

function redactBrowserLogPath(path: string | null): string | null {
  if (!path) return null;
  const normalized = path.replaceAll("\\", "/");
  const marker = "/speakright-browser/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return `<local-app-data>${normalized.slice(markerIndex)}`;
  }
  const fileName = normalized.split("/").filter(Boolean).at(-1);
  return fileName ? `<redacted>/${fileName}` : "<redacted>";
}

function sanitizeBrowserRuntimeDiagnostics(
  diagnostics: BrowserRuntimeDiagnostics,
): BrowserRuntimeDiagnostics {
  return {
    ...diagnostics,
    log: {
      ...diagnostics.log,
      path: redactBrowserLogPath(diagnostics.log.path),
    },
  };
}

function summarizeCorruptLocalData(): BrowserCorruptLocalDataSummary[] {
  return readCorruptLocalData().map((item) => ({
    key: item.key,
    reason: item.reason,
    detectedAt: item.detectedAt,
    schemaVersion: item.schemaVersion,
    rawCharacters: item.raw.length,
  }));
}

export async function getBrowserRuntimeDiagnostics(): Promise<BrowserRuntimeDiagnostics> {
  return {
    app_identifier: "browser-edition",
    log: {
      path: null,
      bytes: null,
      tail: [],
      error: "浏览器版不读取本机日志；诊断包只包含本地浏览器数据摘要。",
    },
  };
}

export async function buildBrowserSupportBundle(): Promise<BrowserSupportBundle> {
  const runtime = await getBrowserRuntimeDiagnostics();
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    product: "SpeakRight Browser Edition",
    release: BROWSER_RELEASE_INFO,
    dataSummary: getLocalDataSummary(),
    corruptLocalData: summarizeCorruptLocalData(),
    runtime: sanitizeBrowserRuntimeDiagnostics(runtime),
    excluded: [
      "API keys",
      "Local user profile path",
      "Full learning history",
      "Raw quarantined local data values",
      "Benchmark audio blobs",
      "Standard demonstration TTS audio cache",
    ],
  };
}

export async function downloadBrowserSupportBundle(): Promise<void> {
  if (typeof document === "undefined") return;
  const bundle = await buildBrowserSupportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `speakright-diagnostics-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
