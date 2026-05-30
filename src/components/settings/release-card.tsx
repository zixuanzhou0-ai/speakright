"use client";

import type React from "react";
import {
  Calendar,
  Code2,
  Download,
  ExternalLink,
  MonitorCog,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

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
          查看当前桌面端版本、安装包通道和发布来源。
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant="secondary">v{release.currentVersion}</Badge>
          <Badge variant="outline">{release.channel}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
          <ReleaseFact
            icon={<PackageCheck className="size-4" />}
            label="发布报告"
            value={release.build.releaseReportFileName}
          />
        </div>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{release.notes.unsigned}</p>
          </div>
        </div>

        <div className="space-y-3">
          {release.installers.map((installer) => (
            <div
              className="grid gap-3 rounded-lg border bg-background/70 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
              key={installer.id}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{installer.name}</span>
                  <Badge variant="outline">{installer.kind}</Badge>
                  <Badge variant="secondary">{installer.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {installer.sizeLabel}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {installer.description}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {installer.fileName}
                </p>
              </div>

              <a
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "w-fit justify-self-start sm:justify-self-end",
                )}
                href={installer.downloadUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Download className="size-3.5" />
                下载
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={release.releaseUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="size-3.5" />
            当前 Release
          </a>
          <a
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={release.latestReleasesUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Download className="size-3.5" />
            所有版本
          </a>
          <a
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            href={release.repositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            <Code2 className="size-3.5" />
            源码仓库
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          {release.notes.privateRepository} {release.notes.checksum}
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
