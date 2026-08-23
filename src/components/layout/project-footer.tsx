const GITHUB_URL = "https://github.com/zixuanzhou0-ai/speakright";

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      viewBox="0 0 98 96"
      fill="currentColor"
    >
      <path d="M48.9 0C21.9 0 0 21.9 0 48.9c0 21.6 14 39.9 33.4 46.4 2.4.4 3.3-1 3.3-2.3v-8.6c-13.6 3-16.5-5.8-16.5-5.8-2.2-5.7-5.4-7.2-5.4-7.2-4.4-3 .3-3 .3-3 4.9.3 7.5 5 7.5 5 4.3 7.4 11.3 5.3 14.1 4 .4-3.1 1.7-5.3 3.1-6.5-10.9-1.2-22.3-5.4-22.3-24.2 0-5.4 1.9-9.7 5-13.2-.5-1.2-2.2-6.2.5-13 0 0 4.1-1.3 13.4 5 3.9-1.1 8-1.6 12.1-1.6s8.3.6 12.1 1.6c9.3-6.3 13.4-5 13.4-5 2.7 6.8 1 11.8.5 13 3.1 3.5 5 7.9 5 13.2 0 18.8-11.5 23-22.4 24.2 1.8 1.5 3.3 4.5 3.3 9.1v13.5c0 1.3.9 2.8 3.4 2.3C84 88.8 98 70.5 98 48.9 97.9 21.9 75.9 0 48.9 0Z" />
    </svg>
  );
}

export function ProjectFooter() {
  return (
    <div className="shrink-0 px-3 py-2">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="打开 Speak Right GitHub 开源页面"
        className="flex h-9 items-center justify-center gap-2 rounded-lg border bg-background text-xs font-medium text-foreground/80 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      >
        <GitHubMark />
        <span>GitHub 开源页面</span>
      </a>
      <div className="mt-2 space-y-0.5 text-center text-[10px] leading-snug text-muted-foreground">
        <p>版权所有 © 2026 Zixuan Zhou</p>
        <p>Speak Right 开源贡献者</p>
      </div>
    </div>
  );
}
