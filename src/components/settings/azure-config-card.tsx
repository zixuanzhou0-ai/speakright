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
      toast.error("请输入 Subscription Key");
      return;
    }
    const regionError = getAzureRegionValidationError(region);
    if (regionError) {
      toast.error(regionError);
      return;
    }
    setAzureConfig({
      subscriptionKey: key.trim(),
      region: normalizeAzureRegion(region),
    });
    toast.success("Azure 配置已保存");
  };

  const handleTest = async () => {
    if (!key.trim()) {
      toast.error("请先填写 Subscription Key");
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
        <div className="flex items-center gap-3">
          <Button onClick={handleSave}>保存</Button>
          <Button variant="outline" onClick={handleTest}>
            测试连接
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
