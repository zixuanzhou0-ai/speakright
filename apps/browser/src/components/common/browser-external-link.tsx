"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";

interface BrowserExternalLinkProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "rel" | "target"
  > {
  href: string;
  children: ReactNode;
  copyMessage?: string;
}

export function BrowserExternalLink({
  href,
  children,
  className,
  copyMessage: _copyMessage,
  ...props
}: BrowserExternalLinkProps) {
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
