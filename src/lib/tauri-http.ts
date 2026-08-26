/**
 * Tauri-aware fetch wrapper.
 * In Tauri: uses @tauri-apps/plugin-http (bypasses CORS).
 * In browser: uses native fetch (for dev mode).
 */

import { isTauriEnvironment } from "@/lib/tauri-runtime";

export interface ApiFetchOptions extends RequestInit {
  /** Tauri plugin-http redirect cap; omitted before native browser fetch. */
  maxRedirections?: number;
}

export async function apiFetch(
  url: string,
  options?: ApiFetchOptions,
): Promise<Response> {
  if (isTauriEnvironment()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, options as Parameters<typeof tauriFetch>[1]);
  }
  const { maxRedirections: _maxRedirections, ...nativeOptions } = options ?? {};
  return fetch(url, nativeOptions);
}
