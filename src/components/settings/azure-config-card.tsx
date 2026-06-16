"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAzureConfig } from "@/hooks/use-api-keys";
import { testAzure } from "@/lib/api-client";
import { setAzureConfig } from "@/lib/api-keys";
import {
  getAzureRegionValidationError,
  normalizeAzureRegion,
} from "@/lib/azure-config";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { getSettingsUserFacingError } from "./user-facing-error";

const WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export function AzureConfigCard() {
  const [key, setKey] = useState("");
  const [region, setRegion] = useState("eastus");
  const saved = useAzureConfig();

  useEffect(() => {
    if (saved) {
      setKey(saved.subscriptionKey);
      setRegion(saved.region);
    } else {
      setKey("");
      setRegion("eastus");
    }
  }, [saved]);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSave = () => {
    if (!key.trim()) {
      const message = "请填写 Subscription Key 后再保存配置";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    const regionError = getAzureRegionValidationError(region);
    if (regionError) {
      toast.error(regionError);
      setStatus("error");
      setStatusMsg(regionError);
      return;
    }
    setAzureConfig({
      subscriptionKey: key.trim(),
      region: normalizeAzureRegion(region),
    });
    toast.success("Azure 配置已保存");
    setStatus("success");
    setStatusMsg("Azure 配置已保存，建议再测试连接。");
  };

  const handleTest = async () => {
    if (!key.trim()) {
      const message = "请先填写 Subscription Key 后再测试连接";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    const regionError = getAzureRegionValidationError(region);
    if (regionError) {
      setStatus("error");
      setStatusMsg(regionError);
      return;
    }
    setStatus("testing");
    setStatusMsg("");

    try {
      const result = await testAzure(key.trim(), region);
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setStatusMsg(result.error ?? "连接失败");
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "Azure Speech 连接测试失败，请检查网络、代理或区域配置后重试。",
        ),
      );
    }
  };

  return (
    <Card data-smoke="azure-scoring-card">
      <CardHeader>
        <CardTitle>录音评分 Azure</CardTitle>
        <CardDescription>
          用于发音评估、音素/词级打分和诊断证据，不负责标准示范朗读。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!key.trim() && (
          <div
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            data-smoke="azure-missing-key-guidance"
            role="status"
          >
            未配置 Azure 时可以浏览课程和播放已内置音频，但录音评分、诊断和训练达标判定不可用。请先保存 Key 和
            Region。
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="azure-key">Subscription Key</Label>
          <Input
            id="azure-key"
            type="password"
            placeholder="输入 Azure Speech 密钥"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="azure-region">Region</Label>
          <Input
            id="azure-region"
            placeholder="eastus"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <div
          className="flex flex-wrap items-center gap-3"
          data-smoke="azure-config-actions"
        >
          <Button
            onClick={handleSave}
            className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
          >
            保存
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
          >
            测试连接
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
