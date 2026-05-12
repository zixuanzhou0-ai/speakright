"use client";

import { useEffect } from "react";

/**
 * Development-only error overlay for Tauri WebView2 debugging.
 * Captures window.onerror and unhandledrejection events and renders
 * them in a red pinned pane so devs don't need DevTools to see crashes.
 *
 * Returns null entirely in production — the code is tree-shaken by
 * Next.js when NODE_ENV !== "development".
 */
export function DevErrorOverlay() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const errors: string[] = [];

    const render = () => {
      let pane = document.getElementById("__err");
      if (!pane) {
        pane = document.createElement("pre");
        pane.id = "__err";
        pane.style.cssText =
          "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:red;color:white;font-size:11px;padding:8px;max-height:200px;overflow:auto;";
        document.body.appendChild(pane);
      }
      pane.textContent = errors.join("\n---\n");
    };

    const onError = (
      msg: string | Event,
      src?: string,
      line?: number,
    ): void => {
      const text = typeof msg === "string" ? msg : "Unknown error";
      errors.push(`${text}\n${src ?? ""}:${line ?? 0}`);
      render();
    };

    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason;
      const text =
        reason && typeof reason === "object" && "message" in reason
          ? String((reason as { message: unknown }).message)
          : String(reason ?? "unknown");
      errors.push(`Unhandled: ${text}`);
      render();
    };

    window.addEventListener("error", (e) =>
      onError(e.message, e.filename, e.lineno),
    );
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
