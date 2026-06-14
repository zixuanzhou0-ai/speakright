"use client";

import { cn } from "@/lib/utils";

export type ConnectionState = "idle" | "testing" | "success" | "error";

interface ConnectionStatusProps {
  state: ConnectionState;
  message?: string;
}

export function ConnectionStatus({ state, message }: ConnectionStatusProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          state === "idle" && "bg-muted-foreground/40",
          state === "testing" && "animate-pulse bg-yellow-500",
          state === "success" && "bg-green-500",
          state === "error" && "bg-red-500",
        )}
      />
      <span
        className={cn(
          "min-w-0 break-words text-muted-foreground",
          state === "success" && "text-green-600 dark:text-green-400",
          state === "error" && "text-red-600 dark:text-red-400",
        )}
      >
        {state === "idle" && "未测试"}
        {state === "testing" && "测试中..."}
        {state === "success" && (message || "连接成功")}
        {state === "error" && (message || "连接失败")}
      </span>
    </div>
  );
}
