"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  choosePreferredMicrophoneDeviceId,
  type MicrophoneDeviceOption,
  setStoredMicrophoneDeviceId,
  toMicrophoneDeviceOptions,
} from "@/lib/microphone-device";

export function useMicrophoneDevice() {
  const [devices, setDevices] = useState<MicrophoneDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      setDevices([]);
      return;
    }

    setIsLoading(true);
    try {
      const nextDevices = toMicrophoneDeviceOptions(
        await navigator.mediaDevices.enumerateDevices(),
      );
      setDevices(nextDevices);
      setSelectedDeviceIdState((current) => {
        const next = choosePreferredMicrophoneDeviceId(nextDevices, current);
        if (next) setStoredMicrophoneDeviceId(next);
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener?.("devicechange", refresh);
    return () =>
      navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const setSelectedDeviceId = useCallback((deviceId: string | null) => {
    setSelectedDeviceIdState(deviceId);
    setStoredMicrophoneDeviceId(deviceId);
  }, []);

  const selectedDevice = useMemo(
    () =>
      devices.find((device) => device.deviceId === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  return {
    devices,
    selectedDevice,
    selectedDeviceId,
    setSelectedDeviceId,
    refresh,
    isLoading,
  };
}
