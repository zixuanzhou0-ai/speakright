"use client";

import {
  AudioLines,
  ClipboardCheck,
  Menu,
  MessageSquareText,
  Settings,
  Target,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { getCapabilityNavigationLabel } from "@/lib/language-capability-policy";
import { cn } from "@/lib/utils";
import { ProjectFooter } from "./project-footer";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  {
    href: "/phonemes",
    label: "\u97f3\u6807\u7ec3\u4e60",
    icon: AudioLines,
    englishOnly: false,
  },
  {
    href: "/drill",
    label: "\u523b\u610f\u7ec3\u4e60",
    icon: Target,
    englishOnly: true,
  },
  {
    href: "/sentences",
    label: "\u81ea\u7531\u7ec3\u4e60",
    icon: MessageSquareText,
    englishOnly: false,
  },
  {
    href: "/assessment",
    label: "\u53d1\u97f3\u8bca\u65ad",
    icon: ClipboardCheck,
    englishOnly: true,
  },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const { languageId } = useLanguageConfig();
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void pathname;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const visibleItems = NAV_ITEMS;

  return (
    <>
      <div className="flex min-h-12 shrink-0 items-center justify-between border-b bg-sidebar px-3 text-sidebar-foreground lg:hidden">
        <button
          type="button"
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={"\u6253\u5f00\u5b66\u4e60\u5bfc\u822a"}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-accent"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">
          {"\u5b66\u4e60\u5bfc\u822a"}
        </span>
        <ThemeToggle />
      </div>

      {open && (
        <div className="fixed inset-x-0 bottom-0 top-9 z-50 lg:hidden">
          <button
            type="button"
            aria-label={"\u5173\u95ed\u5bfc\u822a"}
            className="absolute inset-0 cursor-default bg-black/45"
            onClick={() => setOpen(false)}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label={"\u5b66\u4e60\u5bfc\u822a"}
            className="relative flex h-full w-[min(86vw,320px)] flex-col border-r bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <div className="flex min-h-12 items-center justify-between border-b px-3">
              <span className="font-heading text-sm font-semibold">
                SpeakRight
              </span>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={"\u5173\u95ed\u5bfc\u822a"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 px-2 py-3">
              {visibleItems.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                const displayLabel =
                  href === "/drill"
                    ? getCapabilityNavigationLabel("guidedTraining", languageId)
                    : href === "/assessment"
                      ? getCapabilityNavigationLabel("diagnosis", languageId)
                      : label;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-accent/50",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {displayLabel}
                  </Link>
                );
              })}
              <Link
                href="/settings"
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/settings"
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-accent/50",
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {"\u8bbe\u7f6e"}
              </Link>
            </nav>
            <div className="flex-1" />
            <ProjectFooter />
          </aside>
        </div>
      )}
    </>
  );
}
