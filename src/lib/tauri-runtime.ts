import { isTauri as isTauriRuntime } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }

  // Tauri v2 exposes this marker and @tauri-apps/api/core.isTauri()
  // reads it directly.
  var isTauri: boolean | undefined;
}

export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (isTauriRuntime()) return true;
  } catch {
    // Keep the fallback checks below available in tests and older shells.
  }

  return (
    window.__TAURI__ != null ||
    window.__TAURI_INTERNALS__ != null ||
    window.location.protocol === "tauri:" ||
    window.location.hostname === "tauri.localhost"
  );
}
