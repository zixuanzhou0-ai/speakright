"use client";

/**
 * English uses local Rachel's English videos. Other languages intentionally
 * show a planned state until we add licensed teaching assets.
 */

interface VideoPlayerProps {
  slug: string;
  available?: boolean;
  label?: string;
  className?: string;
}

export function VideoPlayer({
  slug,
  available = true,
  label,
  className,
}: VideoPlayerProps) {
  const localSrc = `/videos/phonemes/${slug}.mp4`;

  if (!available) {
    return (
      <div
        className={`flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed bg-muted/25 px-4 text-center ${className ?? ""}`}
      >
        <p className="text-sm font-medium text-muted-foreground">
          教学视频素材准备中
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {label ?? "待补充授权教学视频"}
        </p>
      </div>
    );
  }

  return (
    <video
      key={slug}
      src={localSrc}
      controls
      preload="metadata"
      className={`w-full rounded-lg border ${className ?? ""}`}
    >
      <track kind="captions" />
    </video>
  );
}
