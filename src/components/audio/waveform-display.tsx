"use client";

import { useEffect, useRef, useState } from "react";

interface WaveformDisplayProps {
  audioBlob?: Blob | null;
  stream?: MediaStream | null;
}

function clearContainer(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

type AudioContextConstructor = typeof AudioContext;

const LIVE_WAVEFORM_WARNING =
  "录音波形暂时不可用，但录音仍会继续；请根据录音按钮和计时器完成本次练习。";

const SAVED_WAVEFORM_WARNING =
  "录音波形暂时不可用，但录音已保留；可以直接回放、重录或提交评分。";

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;

  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext ??
    null
  );
}

export function WaveformDisplay({ audioBlob, stream }: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!audioBlob && !stream) setWarning(null);
  }, [audioBlob, stream]);

  // Load recorded audio for playback visualization
  useEffect(() => {
    if (!audioBlob || !containerRef.current) return;

    let cancelled = false;

    // Clear any leftover live-recording canvas
    const container = containerRef.current;
    clearContainer(container);

    (async () => {
      try {
        const WaveSurfer = (await import("wavesurfer.js")).default;

        if (cancelled) return;

        wsRef.current?.destroy();

        const ws = WaveSurfer.create({
          container,
          waveColor: "hsl(var(--muted-foreground) / 0.4)",
          progressColor: "hsl(var(--primary))",
          cursorColor: "hsl(var(--primary))",
          height: 40,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
        });

        wsRef.current = ws;
        ws.on("click", () => ws.playPause());
        ws.on("error", () => {
          setWarning(SAVED_WAVEFORM_WARNING);
        });

        await ws.loadBlob(audioBlob);

        if (cancelled) {
          ws.destroy();
          if (wsRef.current === ws) wsRef.current = null;
          return;
        }

        setWarning(null);
      } catch {
        if (cancelled) return;
        wsRef.current?.destroy();
        wsRef.current = null;
        clearContainer(container);
        setWarning(SAVED_WAVEFORM_WARNING);
      }
    })();

    return () => {
      cancelled = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  }, [audioBlob]);

  // Live visualization during recording
  useEffect(() => {
    if (!stream || !containerRef.current) return;

    // Clear any previous WaveSurfer content
    wsRef.current?.destroy();
    wsRef.current = null;
    clearContainer(containerRef.current);

    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
      setWarning(LIVE_WAVEFORM_WARNING);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      audioCtx = new AudioContextCtor();
      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
    } catch {
      void audioCtx?.close().catch(() => {});
      setWarning(LIVE_WAVEFORM_WARNING);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "w-full";
    canvas.height = 40;
    containerRef.current.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      source.disconnect();
      void audioCtx.close().catch(() => {});
      setWarning(LIVE_WAVEFORM_WARNING);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animId: number;

    const style = getComputedStyle(document.documentElement);
    const primaryColor = style.getPropertyValue("--primary")
      ? `oklch(${style.getPropertyValue("--primary")})`
      : "#888";

    const draw = () => {
      animId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvas.width = containerRef.current?.clientWidth ?? 300;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    setWarning(null);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      source.disconnect();
      void audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <div className="w-full space-y-1">
      <div
        ref={containerRef}
        className="min-h-[40px] w-full rounded-md border bg-muted/30"
      />
      {warning && (
        <p
          className="text-center text-xs text-amber-600 dark:text-amber-400"
          data-smoke="waveform-display-warning"
          role="status"
        >
          {warning}
        </p>
      )}
    </div>
  );
}
