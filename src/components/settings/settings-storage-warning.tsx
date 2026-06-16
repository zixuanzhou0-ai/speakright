"use client";

import { useEffect, useState } from "react";
import {
  API_KEY_STORAGE_ERROR_EVENT,
  API_KEY_STORAGE_KEYS,
  APP_PREFERENCE_STORAGE_KEYS,
  type ApiKeyStorageErrorDetail,
} from "@/lib/api-keys";

const apiKeySlots = new Set<string>(API_KEY_STORAGE_KEYS);
const appPreferenceSlots = new Set<string>(APP_PREFERENCE_STORAGE_KEYS);
const cjkTextPattern = /[\u3400-\u9fff]/;

function getStorageSubject(key: string): string {
  if (apiKeySlots.has(key)) return "API Key";
  if (appPreferenceSlots.has(key)) return "本机设置";
  return "本机数据";
}

function getStorageAction(
  operation: ApiKeyStorageErrorDetail["operation"],
): string {
  if (operation === "delete") return "删除";
  if (operation === "hydrate") return "读取";
  return "保存";
}

function getFallbackReason(subject: string): string {
  if (subject === "API Key") return "本机密钥存储暂时不可用";
  if (subject === "本机设置") return "本机设置存储暂时不可用";
  return "本机数据存储暂时不可用";
}

function getStorageReason(detail: ApiKeyStorageErrorDetail, subject: string) {
  return cjkTextPattern.test(detail.message)
    ? detail.message
    : getFallbackReason(subject);
}

export function formatSettingsStorageError(
  detail: ApiKeyStorageErrorDetail,
): string {
  const subject = getStorageSubject(detail.key);
  const action = getStorageAction(detail.operation);
  const reason = getStorageReason(detail, subject);
  const spacer = subject === "API Key" ? " " : "";
  const nextStep =
    detail.operation === "save"
      ? "刚才的配置可能没有保存成功，请重新保存；如果反复出现，请在数据与隐私中导出诊断包后重试或重置本机数据。"
      : "请在数据与隐私中导出诊断包后重试；如果问题持续，可以重置本机数据再重新配置。";

  return `${subject}${spacer}${action}失败：${reason}。${nextStep}`;
}

export function SettingsStorageWarning() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (
      event: WindowEventMap[typeof API_KEY_STORAGE_ERROR_EVENT],
    ) => {
      setMessage(formatSettingsStorageError(event.detail));
    };

    window.addEventListener(API_KEY_STORAGE_ERROR_EVENT, handler);
    return () => {
      window.removeEventListener(API_KEY_STORAGE_ERROR_EVENT, handler);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive [overflow-wrap:anywhere]"
      data-smoke="settings-storage-warning"
      role="alert"
    >
      {message}
    </div>
  );
}
