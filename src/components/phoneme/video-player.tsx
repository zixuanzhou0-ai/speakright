"use client";

import {
  BookOpen,
  ExternalLink,
  Film,
  Headphones,
  Languages,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DesktopExternalLink } from "@/components/common/desktop-external-link";
import { SpanishSoundsOfSpeechVideoPanel } from "@/components/phoneme/spanish-sounds-of-speech-video-panel";
import type { SoundUnitSourceAlignment } from "@/lib/language-source-alignment";
import type { LanguageTeachingVideoAsset } from "@/lib/language-teaching-videos";
import type { SpanishSoundVideoSet } from "@/lib/spanish-sounds-of-speech-videos";
import type { PhonemeTeachingResource } from "@/types/phoneme";

interface VideoPlayerProps {
  slug: string;
  available?: boolean;
  label?: string;
  localSrc?: string;
  // Kept for data compatibility; source metadata is shown in credits/about
  // surfaces, not inline under playable local practice videos.
  source?: string;
  sourceUrl?: string;
  license?: string;
  attribution?: string;
  notes?: string[];
  className?: string;
  resources?: PhonemeTeachingResource[];
  spanishVideoSet?: SpanishSoundVideoSet;
  teachingVideos?: LanguageTeachingVideoAsset[];
  sourceAlignment?: SoundUnitSourceAlignment;
}

const RESOURCE_ICON = {
  video: Film,
  ipa: Languages,
  dictionary: Languages,
  articulation: Headphones,
  audio: Headphones,
} as const;

function localLanguageVideoWidthClass(src: string): string | null {
  if (src.includes("/youtube-lessons/")) {
    return "w-full";
  }

  if (src.includes("/videos/language-assets/ru-RU/")) {
    return "w-[min(100%,220px)]";
  }

  if (src.includes("/videos/language-assets/fr-FR/")) {
    if (
      src.includes("fr-glide") ||
      src.includes("fr-r.mp4") ||
      src.includes("fr-sh.mp4") ||
      src.includes("fr-zh.mp4") ||
      src.includes("fr-ny.mp4")
    ) {
      return "w-[min(100%,420px)]";
    }
    return "w-[min(100%,360px)]";
  }

  if (src.includes("/videos/language-assets/es-ES/animation/")) {
    return "w-[min(100%,360px)]";
  }

  return null;
}

interface LocalVideoSource {
  id: string;
  label: string;
  description: string;
  localSrc: string;
  kind: "official" | "lesson";
}

function LocalVideoPanel({
  slug,
  sources,
  className,
}: {
  slug: string;
  sources: LocalVideoSource[];
  className?: string;
}) {
  const [selection, setSelection] = useState({ slug, index: 0 });
  const selectedIndex = selection.slug === slug ? selection.index : 0;
  const selectedSource = sources[selectedIndex] ?? sources[0];
  const widthClass = localLanguageVideoWidthClass(selectedSource.localSrc);
  const videoClass = widthClass
    ? `block h-auto max-h-[285px] max-w-full rounded-lg border bg-black shadow-sm ${widthClass}`
    : "w-full rounded-lg border";

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
    >
      <div className="border-b bg-muted/10 px-3 py-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {selectedSource.kind === "lesson" ? "教学讲解" : "发音视频"}
          </p>
        </div>
      </div>

      <div className="flex justify-center bg-muted/15 px-2 py-1.5">
        <video
          key={selectedSource.localSrc}
          src={selectedSource.localSrc}
          controls
          preload="metadata"
          className={videoClass}
        >
          <track kind="captions" />
        </video>
      </div>

      {sources.length > 1 && (
        <div
          className="flex flex-wrap gap-1.5 border-t bg-gradient-to-b from-muted/20 to-background px-2 py-1.5"
          data-smoke="video-selector"
        >
          {sources.map((source, index) => {
            const isSelected = source.id === selectedSource.id;
            const Icon = source.kind === "lesson" ? BookOpen : Video;

            return (
              <button
                key={source.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelection({ slug, index })}
                className={`inline-flex min-h-7 min-w-0 max-w-full items-center justify-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium leading-tight transition-colors ${
                  isSelected
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-normal break-words text-center [overflow-wrap:anywhere]">
                  {source.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function lessonSourcesFromAssets(
  teachingVideos: LanguageTeachingVideoAsset[],
): LocalVideoSource[] {
  return teachingVideos.map((lesson) => ({
    id: `lesson-${lesson.id}`,
    label: "教学讲解",
    description: `${lesson.author} · ${lesson.title}`,
    localSrc: lesson.videoSrc,
    kind: "lesson",
  }));
}

export function VideoPlayer({
  slug,
  available = true,
  label,
  localSrc,
  className,
  resources = [],
  spanishVideoSet,
  teachingVideos = [],
  sourceAlignment,
}: VideoPlayerProps) {
  const videoSrc = localSrc ?? `/videos/phonemes/${slug}.mp4`;
  const lessonSources = useMemo(
    () => lessonSourcesFromAssets(teachingVideos),
    [teachingVideos],
  );

  if (!available) {
    if (lessonSources.length > 0) {
      return (
        <LocalVideoPanel
          slug={slug}
          sources={lessonSources}
          className={className}
        />
      );
    }

    return (
      <div
        className={`flex w-full flex-col justify-center rounded-lg border border-dashed bg-muted/25 p-3 ${className ?? ""}`}
      >
        <div className="mb-2 text-center">
          <p className="text-sm font-medium text-foreground">
            {sourceAlignment
              ? "暂无精准本地视频"
              : resources.length > 0
                ? "外部 IPA / 发音教学资源"
                : "教学视频素材准备中"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {sourceAlignment?.note ?? label ?? "待补充授权教学视频"}
          </p>
        </div>

        {sourceAlignment && (
          <div className="mb-2 rounded-lg border bg-background/75 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              规则重点
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground">
              {sourceAlignment.ruleSummary}
            </p>
          </div>
        )}

        {resources.length > 0 ? (
          <div className="grid gap-1.5">
            {sourceAlignment && (
              <p className="text-[11px] font-medium text-muted-foreground">
                参考资料
              </p>
            )}
            {resources.map((resource) => {
              const Icon = RESOURCE_ICON[resource.kind];

              return (
                <DesktopExternalLink
                  key={`${resource.kind}-${resource.url}`}
                  href={resource.url}
                  className="group flex items-start gap-3 rounded-lg border bg-background/70 px-3 py-2 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                  data-smoke="video-fallback-resource-card"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words text-center text-xs font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                      {resource.title}
                    </span>
                    {resource.description && (
                      <span className="mt-0.5 block whitespace-normal break-words text-center text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                        {resource.description}
                      </span>
                    )}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </DesktopExternalLink>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground/70">
            {label ?? "待补充授权教学视频"}
          </p>
        )}
      </div>
    );
  }

  if (spanishVideoSet) {
    return (
      <SpanishSoundsOfSpeechVideoPanel
        videoSet={spanishVideoSet}
        className={className}
        teachingVideos={teachingVideos}
      />
    );
  }

  if (lessonSources.length > 0) {
    return (
      <LocalVideoPanel
        slug={slug}
        sources={[
          {
            id: "official",
            label: "口型/舌位",
            description: label ?? "本地发音示范",
            localSrc: videoSrc,
            kind: "official",
          },
          ...lessonSources,
        ]}
        className={className}
      />
    );
  }

  const languageVideoWidthClass = localLanguageVideoWidthClass(videoSrc);

  if (languageVideoWidthClass) {
    return (
      <div
        className={`flex justify-center bg-muted/15 px-2 py-2 ${className ?? ""}`}
      >
        <video
          key={slug}
          src={videoSrc}
          controls
          preload="metadata"
          className={`block h-auto max-h-[285px] max-w-full rounded-lg border bg-black shadow-sm ${languageVideoWidthClass}`}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <video
      key={slug}
      src={videoSrc}
      controls
      preload="metadata"
      className={`w-full rounded-lg border ${className ?? ""}`}
    >
      <track kind="captions" />
    </video>
  );
}
