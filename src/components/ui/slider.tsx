"use client";

import { cn } from "@/lib/utils";

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

function Slider({
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
}: SliderProps) {
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? min;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  return (
    <div
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute h-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        disabled={disabled}
        onChange={(e) => onValueChange?.([Number(e.target.value)])}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="slider"
      />
      <div
        className="absolute size-3.5 rounded-full border border-ring bg-white shadow-sm ring-ring/50 transition-[left,box-shadow] hover:ring-3 focus:ring-3"
        style={{ left: `calc(${percentage}% - 7px)` }}
      />
    </div>
  );
}

export { Slider };
