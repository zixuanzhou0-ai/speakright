"use client";

import { Cloud, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acknowledgeCloudProcessing,
  CLOUD_PROCESSING_REQUEST_EVENT,
  type CloudProcessingRequestDetail,
  hasAcknowledgedCloudProcessing,
} from "@/lib/cloud-processing-consent";

export function CloudProcessingDisclosure() {
  const pendingResolvers = useRef<Array<(accepted: boolean) => void>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleRequest = (
      event: CustomEvent<CloudProcessingRequestDetail>,
    ) => {
      event.detail.handled = true;
      if (hasAcknowledgedCloudProcessing()) {
        event.detail.resolve(true);
        return;
      }
      pendingResolvers.current.push(event.detail.resolve);
      setOpen(true);
    };

    window.addEventListener(CLOUD_PROCESSING_REQUEST_EVENT, handleRequest);
    return () => {
      window.removeEventListener(CLOUD_PROCESSING_REQUEST_EVENT, handleRequest);
      for (const resolve of pendingResolvers.current.splice(0)) resolve(false);
    };
  }, []);

  const finish = (accepted: boolean) => {
    if (accepted) acknowledgeCloudProcessing();
    for (const resolve of pendingResolvers.current.splice(0)) resolve(accepted);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) finish(false);
      }}
    >
      <DialogContent data-smoke="cloud-processing-disclosure">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cloud className="h-5 w-5" />
          </div>
          <DialogTitle>在云端评分前确认</DialogTitle>
          <DialogDescription className="space-y-2 text-left leading-6">
            <span className="block">
              发音评分会把本次录音和参考文本发送给你配置的 Azure Speech。
              SpeakRight 不运营第一方录音收集服务器，原始训练录音默认不长期保存。
            </span>
            <span className="flex items-start gap-2 rounded-lg bg-muted/45 p-3 text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              数字评分来自 Azure；AI 教练只解释评分证据，不会改写数字结果。
            </span>
          </DialogDescription>
        </DialogHeader>
        <Button
          type="button"
          variant="link"
          className="h-auto w-fit justify-start p-0"
          onClick={() => {
            finish(false);
            window.location.assign("/settings?section=data#privacy-details");
          }}
        >
          查看数据与隐私说明
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => finish(false)}>
            暂不发送
          </Button>
          <Button
            type="button"
            onClick={() => finish(true)}
            data-smoke="cloud-processing-accept"
          >
            同意并继续评分
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
