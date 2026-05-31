"use client";

import type { ReactNode } from "react";
import { DesktopExternalLink } from "@/components/common/desktop-external-link";

function isHttpsHref(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export const feedbackMarkdownComponents = {
  hr: () => <hr className="my-5 border-border/50" />,
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-6 mb-3 text-base font-bold border-l-2 border-primary pl-3">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-5 mb-2 text-sm font-bold border-l-2 border-primary pl-3">
      {children}
    </h3>
  ),
  a: ({
    href,
    children,
    title,
  }: {
    href?: string;
    children?: ReactNode;
    title?: string;
  }) => {
    if (!href || !isHttpsHref(href)) {
      return <span title={title}>{children}</span>;
    }

    return (
      <DesktopExternalLink
        className="font-medium text-primary underline underline-offset-2"
        copyMessage="已复制 AI 反馈链接，请在浏览器中打开"
        href={href}
        title={title}
      >
        {children}
      </DesktopExternalLink>
    );
  },
  img: ({ alt }: { alt?: string }) => {
    if (!alt) return null;
    return <span>{alt}</span>;
  },
};
