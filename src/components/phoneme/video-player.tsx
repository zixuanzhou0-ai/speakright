"use client";

/**
 * Rachel's English — "Sounds of American English" series.
 * All 40 phonemes have local mp4s under /public/videos/phonemes/{slug}.mp4.
 */

interface VideoPlayerProps {
  slug: string;
  className?: string;
}

export function VideoPlayer({ slug, className }: VideoPlayerProps) {
  const localSrc = `/videos/phonemes/${slug}.mp4`;

  // All 40 phonemes have local Rachel's English videos.
  // Use preload="metadata" for instant controls without downloading full file.
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
