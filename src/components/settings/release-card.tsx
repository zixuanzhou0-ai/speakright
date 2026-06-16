"use client";

import type React from "react";
import {
  Calendar,
  Code2,
  MonitorCog,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";

import { DesktopExternalLink } from "@/components/common/desktop-external-link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DESKTOP_RELEASE_INFO } from "@/lib/release-info";

const WRAP_SAFE_RELEASE_BADGE_CLASS =
  "h-auto min-h-5 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";
const WRAP_SAFE_RELEASE_LINK_CLASS =
  "h-auto min-h-7 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export function ReleaseCard() {
  const release = DESKTOP_RELEASE_INFO;

  return (
    <Card
      className="border-primary/15 bg-primary/[0.03]"
      data-release-channel={release.channel}
      data-signature-status={release.build.signatureStatus}
      data-smoke="release-status"
    >
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PackageCheck className="size-5 text-primary" />
          <CardTitle className="break-words [overflow-wrap:anywhere]">
            桌面端版本与发布
          </CardTitle>
        </div>
        <CardDescription className="break-words [overflow-wrap:anywhere]">
          查看当前已安装版本、更新通道和签名状态。
        </CardDescription>
        <CardAction className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={WRAP_SAFE_RELEASE_BADGE_CLASS}
            data-smoke="release-version-badge"
          >
            v{release.currentVersion}
          </Badge>
          <Badge
            variant="outline"
            className={WRAP_SAFE_RELEASE_BADGE_CLASS}
            data-smoke="release-channel-badge"
          >
            {release.channelLabel}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReleaseFact
            icon={<MonitorCog className="size-4" />}
            label="构建目标"
            value={release.build.target}
          />
          <ReleaseFact
            icon={<Calendar className="size-4" />}
            label="最近验证"
            value={release.lastValidatedAt}
          />
          <ReleaseFact
            icon={<PackageCheck className="size-4" />}
            label="技术栈"
            value={release.build.framework}
          />
          <ReleaseFact
            icon={<ShieldAlert className="size-4" />}
            label="签名状态"
            value={release.build.signatureLabel}
          />
        </div>

        <div
          className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
          data-smoke="release-unsigned-warning"
        >
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p className="break-words [overflow-wrap:anywhere]">
              {release.notes.unsigned}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <DesktopExternalLink
            className={buttonVariants({
              size: "sm",
              variant: "ghost",
              className: WRAP_SAFE_RELEASE_LINK_CLASS,
            })}
            copyMessage="源码仓库链接已复制，请在浏览器中打开"
            data-smoke="release-repository-link"
            href={release.repositoryUrl}
          >
            <Code2 className="size-3.5" />
            源码仓库
          </DesktopExternalLink>
          <DesktopExternalLink
            className={buttonVariants({
              size: "sm",
              variant: "ghost",
              className: WRAP_SAFE_RELEASE_LINK_CLASS,
            })}
            copyMessage="Release 说明链接已复制，请在浏览器中打开"
            data-smoke="release-notes-link"
            href={release.releaseUrl}
          >
            <PackageCheck className="size-3.5" />
            Release 说明
          </DesktopExternalLink>
        </div>

        <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {release.notes.artifacts} {release.notes.releasePage}{" "}
          {release.notes.checksum}
        </p>
      </CardContent>
    </Card>
  );
}

function ReleaseFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="break-words [overflow-wrap:anywhere]">{label}</span>
      </div>
      <div className="break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  );
}
