"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MicrophoneDeviceOption } from "@/lib/microphone-device";

function displayDeviceLabel(device: MicrophoneDeviceOption): string {
  return device.label.replace(/^(\u9ed8\u8ba4|\u901a\u8baf) - /, "");
}

interface MicrophoneDeviceSelectProps {
  devices: MicrophoneDeviceOption[];
  selectedDeviceId: string | null;
  isLoading?: boolean;
  disabled?: boolean;
  onDeviceChange: (deviceId: string | null) => void;
  onRefresh: () => void;
}

export function MicrophoneDeviceSelect({
  devices,
  selectedDeviceId,
  isLoading = false,
  disabled = false,
  onDeviceChange,
  onRefresh,
}: MicrophoneDeviceSelectProps) {
  return (
    <div className="w-full space-y-1" data-smoke="microphone-device-select">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="microphone-device"
          className="text-xs font-medium text-muted-foreground"
        >
          {"\u9ea6\u514b\u98ce"}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="刷新麦克风列表"
          className="min-h-11 min-w-11"
          onClick={onRefresh}
          disabled={disabled || isLoading}
        >
          <RefreshCw className={isLoading ? "animate-spin" : undefined} />
        </Button>
      </div>
      <select
        id="microphone-device"
        aria-label="麦克风"
        value={selectedDeviceId ?? ""}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onDeviceChange(event.target.value || null)}
        className="min-h-11 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {"\u6d4f\u89c8\u5668\u9ed8\u8ba4\u9ea6\u514b\u98ce"}
        </option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.isSystemDefault ? "\u7cfb\u7edf\u9ed8\u8ba4 - " : ""}
            {device.isCommunicationsDefault
              ? "\u901a\u8baf\u9ed8\u8ba4 - "
              : ""}
            {displayDeviceLabel(device)}
          </option>
        ))}
      </select>
    </div>
  );
}
