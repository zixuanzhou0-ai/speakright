"use client";

import { Howl, Howler } from "howler";

export interface AudioMetadata {
  durationMs: number;
}

export interface PlaybackPosition {
  src: string | null;
  seekMs: number;
}

export interface GuidedRepeatAudioAdapter {
  preload(src: string): Promise<AudioMetadata>;
  play(
    src: string,
    seekMs?: number,
    onPlaybackStart?: () => void,
  ): Promise<void>;
  pause(): PlaybackPosition;
  resume(onPlaybackStart?: () => void): Promise<void>;
  stop(): void;
  unload(src?: string): void;
  getDuration(src: string): number | undefined;
}

interface ActivePlayback {
  src: string;
  howl: Howl;
  id: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

function audioError(src: string): Error {
  const file = decodeURIComponent(src.split("/").at(-1) ?? src);
  return new Error(`本地音频“${file}”无法播放。`);
}

export class HowlerGuidedRepeatAudioAdapter
  implements GuidedRepeatAudioAdapter
{
  private readonly cache = new Map<string, Howl>();
  private active: ActivePlayback | null = null;

  private getOrCreate(src: string): Howl {
    const cached = this.cache.get(src);
    if (cached) return cached;
    const howl = new Howl({ src: [src], html5: false, preload: true });
    this.cache.set(src, howl);
    return howl;
  }

  async preload(src: string): Promise<AudioMetadata> {
    const howl = this.getOrCreate(src);
    if (howl.state() === "loaded") {
      return { durationMs: Math.round(howl.duration() * 1000) };
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(audioError(src));
      }, 10_000);
      const onLoad = () => {
        cleanup();
        resolve({ durationMs: Math.round(howl.duration() * 1000) });
      };
      const onError = () => {
        cleanup();
        reject(audioError(src));
      };
      const cleanup = () => {
        clearTimeout(timeout);
        howl.off("load", onLoad);
        howl.off("loaderror", onError);
      };
      howl.once("load", onLoad);
      howl.once("loaderror", onError);
      if (howl.state() === "unloaded") howl.load();
    });
  }

  async play(
    src: string,
    seekMs = 0,
    onPlaybackStart?: () => void,
  ): Promise<void> {
    this.stop();
    await this.preload(src);
    const ctx = Howler.ctx;
    if (ctx?.state === "suspended") await ctx.resume();
    const howl = this.getOrCreate(src);
    return new Promise((resolve, reject) => {
      const id = howl.play();
      const active: ActivePlayback = { src, howl, id, resolve, reject };
      this.active = active;
      if (seekMs > 0) howl.seek(seekMs / 1000, id);
      if (onPlaybackStart) howl.once("play", onPlaybackStart, id);
      howl.once(
        "end",
        () => {
          if (this.active !== active) return;
          this.active = null;
          resolve();
        },
        id,
      );
      howl.once(
        "playerror",
        () => {
          if (this.active !== active) return;
          this.active = null;
          reject(audioError(src));
        },
        id,
      );
    });
  }

  pause(): PlaybackPosition {
    const active = this.active;
    if (!active) return { src: null, seekMs: 0 };
    const seek = active.howl.seek(active.id);
    active.howl.pause(active.id);
    return {
      src: active.src,
      seekMs: Math.round((typeof seek === "number" ? seek : 0) * 1000),
    };
  }

  async resume(onPlaybackStart?: () => void): Promise<void> {
    const active = this.active;
    if (!active) return;
    const ctx = Howler.ctx;
    if (ctx?.state === "suspended") await ctx.resume();
    if (onPlaybackStart) {
      active.howl.once("play", onPlaybackStart, active.id);
    }
    active.howl.play(active.id);
  }

  stop(): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.howl.off("end", undefined, active.id);
    active.howl.off("playerror", undefined, active.id);
    active.howl.off("play", undefined, active.id);
    active.howl.stop(active.id);
    active.resolve();
  }

  unload(src?: string): void {
    if (src) {
      if (this.active?.src === src) this.stop();
      this.cache.get(src)?.unload();
      this.cache.delete(src);
      return;
    }
    this.stop();
    for (const howl of this.cache.values()) howl.unload();
    this.cache.clear();
  }

  getDuration(src: string): number | undefined {
    const howl = this.cache.get(src);
    if (howl?.state() !== "loaded") return undefined;
    return Math.round(howl.duration() * 1000);
  }
}
