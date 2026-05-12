"use client";

import { useEffect, useRef } from "react";

interface WaveformDisplayProps {
  audioBlob?: Blob | null;
  stream?: MediaStream | null;
}

function clearContainer(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function WaveformDisplay({ audioBlob, stream }: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);

  // Load recorded audio for playback visualization
  useEffect(() => {
    if (!audioBlob || !containerRef.current) return;

    let cancelled = false;

    // Clear any leftover live-recording canvas
    clearContainer(containerRef.current);

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;

      if (cancelled) return;

      wsRef.current?.destroy();

      const ws = WaveSurfer.create({
        container: containerRef.current!,
        waveColor: "hsl(var(--muted-foreground) / 0.4)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "hsl(var(--primary))",
        height: 40,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
      });

      ws.loadBlob(audioBlob);
      ws.on("click", () => ws.playPause());
      wsRef.current = ws;
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

    const canvas = document.createElement("canvas");
    canvas.className = "w-full";
    canvas.height = 40;
    containerRef.current.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

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

    draw();

    return () => {
      cancelAnimationFrame(animId);
      audioCtx.close();
    };
  }, [stream]);

  return (
    <div
      ref={containerRef}
      className="min-h-[40px] w-full rounded-md border bg-muted/30"
    />
  );
}
