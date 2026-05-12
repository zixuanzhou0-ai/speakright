"use client";

import { useCallback, useRef, useState } from "react";
import { convertToWav16kMono } from "@/lib/audio-utils";

const DEFAULT_MAX_DURATION_MS = 30_000;

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
    try {
      setError(null);
      setAudioBlob(null);
      setRawBlob(null);
      setElapsedSeconds(0);
      setAutoStopped(false);
      chunksRef.current = [];

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      setStream(mediaStream);

      const recorder = new MediaRecorder(mediaStream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        for (const t of mediaStream.getTracks()) t.stop();
        setStream(null);
        setIsRecording(false);

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
    } catch {
      setError("请允许麦克风访问权限以进行录音");
    }
  }, [stopRecording, maxDurationMs, maxDurationSeconds]);

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
