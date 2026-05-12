/**
 * Tauri-aware fetch wrapper.
 * In Tauri: uses @tauri-apps/plugin-http (bypasses CORS).
 * In browser: uses native fetch (for dev mode).
 */

const isTauri = () =>
  typeof window !== "undefined" &&
  ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

export async function apiFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, options as Parameters<typeof tauriFetch>[1]);
  }
  return fetch(url, options);
}
