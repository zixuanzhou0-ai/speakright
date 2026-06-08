"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { openDesktopExternalUrl } from "@/lib/desktop-external-url";
import { isTauriEnvironment } from "@/lib/tauri-runtime";

interface DesktopExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "rel" | "target"> {
  href: string;
  children: ReactNode;
  copyMessage?: string;
}

export function DesktopExternalLink({
  href,
  children,
  className,
  copyMessage,
  onClick,
  ...props
}: DesktopExternalLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isTauriEnvironment()) return;

    event.preventDefault();
    void openDesktopExternalUrl(href, copyMessage);
  };

  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
