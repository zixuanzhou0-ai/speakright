"use client";

import { BookOpen, ChevronLeft, ChevronRight, Film, Video } from "lucide-react";
import { useMemo, useState } from "react";
import type { LanguageTeachingVideoAsset } from "@/lib/language-teaching-videos";
import type {
  SpanishSoundVideoClip,
  SpanishSoundVideoSet,
} from "@/lib/spanish-sounds-of-speech-videos";

interface SpanishSoundsOfSpeechVideoPanelProps {
  videoSet: SpanishSoundVideoSet;
  className?: string;
  teachingVideos?: LanguageTeachingVideoAsset[];
}

interface SpanishPanelClip {
  id: string;
  kind: SpanishSoundVideoClip["kind"] | "animation" | "lesson";
  label: string;
  word?: string;
  localSrc: string;
  title?: string;
}

function chipClassName(isSelected: boolean): string {
  const base =
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors";
  if (isSelected) {
    return `${base} border-primary/40 bg-primary/10 text-primary shadow-sm`;
  }
  return `${base} border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground`;
}

function clipLabel(clip: SpanishPanelClip): string {
  if (clip.kind === "animation") return "Animation";
  if (clip.kind === "target") return "Video";
  if (clip.kind === "lesson") return "教学讲解";
  return clip.word ?? clip.label;
}

function videoWidthClassForClip(clip: SpanishPanelClip): string {
  if (clip.kind === "lesson") return "w-full";
  return clip.kind === "animation"
    ? "w-[min(100%,360px)]"
    : "w-[min(100%,370px)]";
}

export function SpanishSoundsOfSpeechVideoPanel({
  videoSet,
  className,
  teachingVideos = [],
}: SpanishSoundsOfSpeechVideoPanelProps) {
  const [selection, setSelection] = useState({
    slug: videoSet.slug,
    index: 0,
  });

  const clips = useMemo<SpanishPanelClip[]>(
    () => [
      {
        id: videoSet.targetClip.id,
        kind: "target",
        label: "目标音",
        localSrc: videoSet.targetClip.localSrc,
      },
      ...videoSet.exampleClips.map((clip) => ({
        id: clip.id,
        kind: clip.kind,
        label: clip.label,
        word: clip.word,
        localSrc: clip.localSrc,
      })),
      ...teachingVideos.map((lesson) => ({
        id: `lesson-${lesson.id}`,
        kind: "lesson" as const,
        label: "教学讲解",
        localSrc: lesson.videoSrc,
        title: lesson.title,
      })),
      {
        id: `${videoSet.slug}-animation`,
        kind: "animation",
        label: "动画",
        localSrc: videoSet.animationSrc,
      },
    ],
    [videoSet, teachingVideos],
  );

  const selectedIndex = selection.slug === videoSet.slug ? selection.index : 0;
  const selectedClip = clips[selectedIndex] ?? clips[0];

  function moveSelection(delta: number) {
    setSelection((current) => {
      const currentIndex = current.slug === videoSet.slug ? current.index : 0;
      return {
        slug: videoSet.slug,
        index: (currentIndex + delta + clips.length) % clips.length,
      };
    });
  }

  function selectClip(index: number) {
    setSelection({
      slug: videoSet.slug,
      index,
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Video de pronunciación
          </p>
          <p className="truncate text-xs text-muted-foreground/80">
            {selectedClip.kind === "animation"
              ? "舌位动画"
              : selectedClip.kind === "lesson"
                ? `教学讲解 · ${selectedClip.title ?? selectedClip.label}`
              : selectedClip.kind === "target"
                ? "目标音真人示范"
                : `例词视频 · ${selectedClip.word ?? selectedClip.label}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2 bg-muted/15 px-2 py-2">
        <button
          type="button"
          aria-label="上一个西语视频"
          onClick={() => moveSelection(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 justify-center">
          <video
            key={selectedClip.localSrc}
            src={selectedClip.localSrc}
            controls
            preload="metadata"
            className={`block h-auto max-h-[285px] max-w-full rounded-md border bg-black shadow-sm ${videoWidthClassForClip(selectedClip)}`}
          >
            <track kind="captions" />
          </video>
        </div>

        <button
          type="button"
          aria-label="下一个西语视频"
          onClick={() => moveSelection(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-background/95 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t bg-gradient-to-b from-muted/20 to-background px-3 py-2 sm:flex-wrap sm:overflow-visible">
        {clips.map((clip) => {
          const isSelected = clip.id === selectedClip.id;
          const Icon =
            clip.kind === "lesson" ? BookOpen : clip.kind === "animation" ? Film : Video;

          return (
            <button
              key={clip.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectClip(clips.findIndex((item) => item.id === clip.id))}
              className={chipClassName(isSelected)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{clipLabel(clip)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
