"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  API_KEY_STORAGE_ERROR_EVENT,
  API_KEY_STORAGE_KEYS,
  APP_PREFERENCE_STORAGE_KEYS,
  hydrateKeys,
} from "@/lib/api-keys";
import { runLocalDataMigrations } from "@/lib/local-data-migrations";

/**
 * Runs once on client mount: pulls API key configs from the Tauri store
 * into localStorage so synchronous readers see persisted values, and
 * migrates any legacy localStorage values into the store on first run.
 */
export function KeyHydrator() {
  useEffect(() => {
    const apiKeySlots = new Set<string>(API_KEY_STORAGE_KEYS);
    const appPreferenceSlots = new Set<string>(APP_PREFERENCE_STORAGE_KEYS);
    const handler = (
      event: WindowEventMap[typeof API_KEY_STORAGE_ERROR_EVENT],
    ) => {
      const subject = apiKeySlots.has(event.detail.key)
        ? "API key"
        : appPreferenceSlots.has(event.detail.key)
          ? "本机设置"
          : "本机数据";
      const action =
        event.detail.operation === "delete"
          ? "删除"
          : event.detail.operation === "hydrate"
            ? "读取"
            : "保存";
      toast.error(`${subject}${action}失败：${event.detail.message}`);
    };
    window.addEventListener(API_KEY_STORAGE_ERROR_EVENT, handler);
    const migration = runLocalDataMigrations();
    if (migration.quarantinedKeys.length > 0) {
      toast.warning(
        `已隔离 ${migration.quarantinedKeys.length} 个损坏的本地数据项`,
      );
    }
    void hydrateKeys();
    return () => {
      window.removeEventListener(API_KEY_STORAGE_ERROR_EVENT, handler);
    };
  }, []);
  return null;
}
