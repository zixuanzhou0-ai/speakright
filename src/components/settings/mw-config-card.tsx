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
import { useMerriamWebsterConfig } from "@/hooks/use-api-keys";
import { testMw } from "@/lib/api-client";
import { setMerriamWebsterConfig } from "@/lib/api-keys";
import { type ConnectionState, ConnectionStatus } from "./connection-status";

export function MwConfigCard() {
  const [key, setKey] = useState("");
  const saved = useMerriamWebsterConfig();

  useEffect(() => {
    if (saved) {
      setKey(saved.apiKey);
    } else {
      setKey("");
    }
  }, [saved]);

  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSave = () => {
    if (!key.trim()) {
      toast.error("请输入 API Key");
      return;
    }
    setMerriamWebsterConfig({ apiKey: key.trim() });
    toast.success("Merriam-Webster 配置已保存");
  };

  const handleTest = async () => {
    if (!key.trim()) {
      toast.error("请先填写 API Key");
      return;
    }
    setStatus("testing");
    setStatusMsg("");

    try {
      const result = await testMw(key.trim());
      if (result.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setStatusMsg(result.error ?? "连接失败");
      }
    } catch {
      setStatus("error");
      setStatusMsg("网络错误");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merriam-Webster</CardTitle>
        <CardDescription>用于单词发音音频（可选，免费 API）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mw-key">API Key</Label>
          <Input
            id="mw-key"
            type="password"
            placeholder="输入 Merriam-Webster Collegiate API 密钥"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            前往{" "}
            <a
              href="https://dictionaryapi.com/register/index"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              dictionaryapi.com
            </a>{" "}
            免费注册获取 Collegiate Dictionary API Key
          </p>
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
