"use client";

import { Check, Loader2, Play, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface RecordingActionsProps {
  hasRecording: boolean;
  isPlaying: boolean;
  isAssessing: boolean;
  onReplay: () => void;
  onClear: () => void;
  onAssess: () => void;
  assessDisabled?: boolean;
  assessDisabledReason?: string;
}

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 15,
} as const;

function ActionButton({
  disabled,
  onClick,
  variant,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  variant: "primary" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.08 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={springTransition}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
        disabled
          ? "bg-muted text-muted-foreground opacity-50"
          : variant === "destructive"
            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {children}
    </motion.button>
  );
}

export function RecordingActions({
  hasRecording,
  isPlaying,
  isAssessing,
  onReplay,
  onClear,
  onAssess,
  assessDisabled = false,
  assessDisabledReason = "当前录音暂时不能评分",
}: RecordingActionsProps) {
  const disabled = !hasRecording;
  const scoreDisabled = disabled || isAssessing || assessDisabled;

  const buttons = (
    <div className="flex items-center justify-center gap-4">
      <ActionButton
        disabled={disabled || isAssessing}
        onClick={onReplay}
        variant="primary"
      >
        <Play className={cn("h-5 w-5", isPlaying && "animate-pulse")} />
      </ActionButton>
      <ActionButton
        disabled={disabled || isAssessing}
        onClick={onClear}
        variant="destructive"
      >
        <Trash2 className="h-5 w-5" />
      </ActionButton>
      <ActionButton
        disabled={scoreDisabled}
        onClick={onAssess}
        variant="primary"
      >
        {isAssessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Check className="h-5 w-5" />
        )}
      </ActionButton>
    </div>
  );

  if (disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<div />}>{buttons}</TooltipTrigger>
          <TooltipContent>请先开始录音哦</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (assessDisabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<div />}>{buttons}</TooltipTrigger>
          <TooltipContent>{assessDisabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttons;
}
