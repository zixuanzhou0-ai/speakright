"use client";

import { useEffect } from "react";
import { hydrateKeys } from "@/lib/api-keys";

/**
 * Runs once on client mount: pulls API key configs from the Tauri store
 * into localStorage so synchronous readers see persisted values, and
 * migrates any legacy localStorage values into the store on first run.
 */
export function KeyHydrator() {
  useEffect(() => {
    void hydrateKeys();
  }, []);
  return null;
}
