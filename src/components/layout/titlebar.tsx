"use client";

import { AudioLines, Maximize2, Minimize2, Minus, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

async function windowMinimize() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  getCurrentWindow().minimize();
}

async function windowToggleMaximize() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  getCurrentWindow().toggleMaximize();
}

async function windowClose() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  getCurrentWindow().close();
}

const btnClass =
  "inline-flex items-center justify-center h-8 w-11 transition-colors hover:bg-muted/80 select-none";

export function Titlebar() {
  const [showControls, setShowControls] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Detect Tauri + listen for maximize state changes
  useEffect(() => {
    const hasTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    setShowControls(hasTauri);
    if (!hasTauri) return;

    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      setIsMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        setIsMaximized(await win.isMaximized());
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 select-none items-center border-b bg-background/95 backdrop-blur"
    >
      {/* App icon + name (left) */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pl-4 pr-3 pointer-events-none"
      >
        <AudioLines className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold tracking-tight font-heading">
          SpeakRight
        </span>
      </div>

      {/* Spacer — draggable */}
      <div data-tauri-drag-region className="flex-1" />

      {/* Window controls (right) — only in Tauri */}
      {showControls && (
        <div className="flex items-center" data-tauri-drag-region="false">
          <motion.button
            type="button"
            className={btnClass}
            onClick={windowMinimize}
            whileTap={{ scale: 0.9 }}
            title="最小化"
          >
            <Minus className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            type="button"
            className={btnClass}
            onClick={windowToggleMaximize}
            whileTap={{ scale: 0.9 }}
            title={isMaximized ? "还原" : "最大化"}
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </motion.button>
          <motion.button
            type="button"
            className={`${btnClass} hover:bg-red-500 hover:text-white`}
            onClick={windowClose}
            whileTap={{ scale: 0.9 }}
            title="关闭"
          >
            <X className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
