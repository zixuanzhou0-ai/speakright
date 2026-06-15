"use client";

import { useCallback, useRef, useState } from "react";
import { convertToWav16kMono } from "@/lib/audio-utils";

const DEFAULT_MAX_DURATION_MS = 30_000;

const UNSUPPORTED_MIC_MESSAGE =
  "当前桌面运行环境无法访问麦克风，请确认使用 Release EXE 并重启应用。";

const UNSUPPORTED_RECORDER_MESSAGE =
  "当前桌面运行环境不支持录音编码，请更新系统 WebView 或重启 SpeakRight 后重试。";

function getRecorderEventError(event: Event): unknown {
  return "error" in event ? event.error : event;
}

export function getRecorderStartErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      return "麦克风权限被拒绝，请在 Windows 隐私设置中允许 SpeakRight 使用麦克风后重试。";
    }

    if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      return "未检测到可用麦克风，请连接或启用麦克风后重试。";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "麦克风正被其他应用占用或无法启动，请关闭占用麦克风的应用后重试。";
    }

    if (
      error.name === "OverconstrainedError" ||
      error.name === "ConstraintNotSatisfiedError"
    ) {
      return "当前麦克风不支持所需录音格式，请换一个输入设备后重试。";
    }

    if (error.name === "SecurityError") {
      return "系统安全策略阻止了麦克风访问，请检查 Windows 隐私权限后重试。";
    }

    if (error.name === "AbortError") {
      return "麦克风启动中断，请重新插拔设备或重启 SpeakRight 后重试。";
    }
  }

  if (error instanceof TypeError) {
    return UNSUPPORTED_MIC_MESSAGE;
  }

  return "录音启动失败，请检查麦克风、系统权限和是否被其他应用占用后重试。";
}

export function getRecorderRuntimeErrorMessage(error: unknown): string {
  const cause = error instanceof Event ? getRecorderEventError(error) : error;

  if (cause instanceof DOMException) {
    if (
      cause.name === "NotAllowedError" ||
      cause.name === "PermissionDeniedError" ||
      cause.name === "SecurityError"
    ) {
      return "录音过程中麦克风权限被系统撤销，请在 Windows 隐私设置中允许 SpeakRight 使用麦克风后重录。";
    }

    if (
      cause.name === "NotFoundError" ||
      cause.name === "DevicesNotFoundError"
    ) {
      return "录音过程中麦克风断开，请重新连接或启用麦克风后重录。";
    }

    if (cause.name === "NotReadableError" || cause.name === "TrackStartError") {
      return "录音过程中麦克风被其他应用占用或中断，请关闭占用麦克风的应用后重录。";
    }

    if (cause.name === "AbortError") {
      return "录音过程中麦克风中断，请重新插拔设备或重启 SpeakRight 后重录。";
    }
  }

  return "录音过程中断，请检查麦克风、系统权限和是否被其他应用占用后重录。";
}

interface UseRecorderOptions {
  /**
   * Maximum recording duration in milliseconds before auto-stop.
   * Defaults to 30s for word/short-phrase practice; pass a larger
   * value (e.g. 60_000) for long-paragraph diagnostics or free
   * sentence practice where users need time to read in full.
   */
  maxDurationMs?: number;
}

interface UseRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  audioBlob: Blob | null;
  rawBlob: Blob | null;
  error: string | null;
  stream: MediaStream | null;
  elapsedSeconds: number;
  autoStopped: boolean;
  maxDurationSeconds: number;
}

export function useRecorder(
  options: UseRecorderOptions = {},
): UseRecorderReturn {
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const maxDurationSeconds = Math.round(maxDurationMs / 1000);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [autoStopped, setAutoStopped] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const runtimeErrorRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    clearTimers();
  }, [clearTimers]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setRawBlob(null);
    setElapsedSeconds(0);
    setAutoStopped(false);
    chunksRef.current = [];
    runtimeErrorRef.current = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(UNSUPPORTED_MIC_MESSAGE);
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError(UNSUPPORTED_RECORDER_MESSAGE);
      return;
    }

    let mediaStream: MediaStream | null = null;

    try {
      const openedStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      mediaStream = openedStream;
      setStream(openedStream);

      const recorder = new MediaRecorder(openedStream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = (event) => {
        runtimeErrorRef.current = true;
        chunksRef.current = [];
        clearTimers();
        setRawBlob(null);
        setAudioBlob(null);
        setError(getRecorderRuntimeErrorMessage(event));

        if (recorder.state === "recording") {
          recorder.stop();
        } else {
          for (const t of openedStream.getTracks()) t.stop();
          setStream(null);
          setIsRecording(false);
        }
      };

      recorder.onstop = async () => {
        for (const t of openedStream.getTracks()) t.stop();
        setStream(null);
        setIsRecording(false);
        clearTimers();

        if (runtimeErrorRef.current) {
          chunksRef.current = [];
          setRawBlob(null);
          setAudioBlob(null);
          return;
        }

        const raw = new Blob(chunksRef.current, { type: recorder.mimeType });
        setRawBlob(raw);

        try {
          const wav = await convertToWav16kMono(raw);
          setAudioBlob(wav);
        } catch {
          setError("音频转换失败，请重试");
        }
      };

      recorder.start();
      setIsRecording(true);

      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Math.min(
          maxDurationSeconds,
          Math.floor((Date.now() - startTime) / 1000),
        );
        setElapsedSeconds(elapsed);
      }, 250);

      timerRef.current = setTimeout(() => {
        setAutoStopped(true);
        stopRecording();
      }, maxDurationMs);
    } catch (error) {
      for (const track of mediaStream?.getTracks() ?? []) {
        track.stop();
      }
      setStream(null);
      setIsRecording(false);
      clearTimers();
      setError(getRecorderStartErrorMessage(error));
    }
  }, [stopRecording, maxDurationMs, maxDurationSeconds, clearTimers]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setRawBlob(null);
    setError(null);
    setElapsedSeconds(0);
    setAutoStopped(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    reset,
    audioBlob,
    rawBlob,
    error,
    stream,
    elapsedSeconds,
    autoStopped,
    maxDurationSeconds,
  };
}
