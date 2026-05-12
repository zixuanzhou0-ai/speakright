"use client";

import {
  AudioLines,
  ClipboardCheck,
  MessageSquareText,
  Settings,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SidebarPhonemeList } from "./sidebar-phoneme-list";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/phonemes", label: "音标练习", icon: AudioLines },
  { href: "/drill", label: "刻意练习", icon: Target },
  { href: "/sentences", label: "自由练习", icon: MessageSquareText },
  { href: "/assessment", label: "发音诊断", icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const isPhonemes = pathname.startsWith("/phonemes");
  const isSettings = pathname === "/settings";

  // Extract current phoneme slug from path like /phonemes/ee
  const currentSlug = isPhonemes ? (pathname.split("/")[2] ?? null) : null;

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Navigation */}
      <div className="flex flex-col gap-0.5 px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-accent/50",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Phoneme list — only when on phoneme routes */}
      {isPhonemes && (
        <>
          <div className="mx-3 border-t" />
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-1 py-2">
            <SidebarPhonemeList currentSlug={currentSlug} />
          </div>
        </>
      )}

      {/* Spacer when not on phonemes */}
      {!isPhonemes && <div className="flex-1" />}

      {/* Bottom bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t px-3">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
            isSettings
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="h-3.5 w-3.5" />
          设置
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
