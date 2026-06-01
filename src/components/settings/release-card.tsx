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

export function ReleaseCard() {
  const release = DESKTOP_RELEASE_INFO;

  return (
    <Card className="border-primary/15 bg-primary/[0.03]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackageCheck className="size-5 text-primary" />
          <CardTitle>桌面端版本与发布</CardTitle>
        </div>
        <CardDescription>
          查看当前已安装版本、更新通道和签名状态。
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant="secondary">v{release.currentVersion}</Badge>
          <Badge variant="outline">{release.channel}</Badge>
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
            label="发布日期"
            value={release.releasedAt}
          />
          <ReleaseFact
            icon={<PackageCheck className="size-4" />}
            label="技术栈"
            value={release.build.framework}
          />
          <ReleaseFact
            icon={<ShieldAlert className="size-4" />}
            label="签名状态"
            value={release.build.signatureStatus}
          />
        </div>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{release.notes.unsigned}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <DesktopExternalLink
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            copyMessage="源码仓库链接已复制，请在浏览器中打开"
            href={release.repositoryUrl}
          >
            <Code2 className="size-3.5" />
            源码仓库
          </DesktopExternalLink>
        </div>

        <p className="text-xs text-muted-foreground">
          {release.notes.artifacts} {release.notes.checksum}
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
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium leading-snug">{value}</div>
    </div>
  );
}
