"use client";

import { Loader2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

interface AudioPlayerButtonProps {
  onClick: (e: React.MouseEvent) => void;
  isLoading?: boolean;
  isPlaying?: boolean;
  size?: "sm" | "default" | "icon" | "lg";
  color?: "default" | "blue" | "pink";
}

const COLOR_CLASSES = {
  default: { idle: "", active: "text-primary" },
  blue: { idle: "text-sky-400", active: "text-sky-500" },
  pink: { idle: "text-pink-400", active: "text-pink-500" },
};

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 10,
} as const;

export function AudioPlayerButton({
  onClick,
  isLoading,
  isPlaying,
  size = "icon",
  color = "default",
}: AudioPlayerButtonProps) {
  const colors = COLOR_CLASSES[color];
  return (
    <motion.div
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
      transition={springTransition}
      className="inline-flex cursor-pointer"
    >
      <Button
        variant="ghost"
        size={size}
        onClick={onClick}
        disabled={isLoading}
        className={`cursor-pointer ${isPlaying ? colors.active : colors.idle}`}
        aria-label={
          isLoading ? "加载发音中" : isPlaying ? "正在播放" : "播放发音"
        }
      >
        {isLoading ? (
          <Loader2
            className={`animate-spin ${size === "lg" ? "h-6 w-6" : size === "sm" ? "h-5 w-5" : "h-4 w-4"}`}
          />
        ) : (
          <Volume2
            className={
              size === "lg" ? "h-6 w-6" : size === "sm" ? "h-5 w-5" : "h-4 w-4"
            }
          />
        )}
      </Button>
    </motion.div>
  );
}
