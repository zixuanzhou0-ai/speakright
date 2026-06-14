"use client";

import { Howl } from "howler";
import { Volume2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguageConfig } from "@/hooks/use-api-keys";
import { fetchPronunciation } from "@/lib/api-client";
import { getLanguageProfile } from "@/lib/language-profiles";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { getSettingsUserFacingError } from "./user-facing-error";

export function PronunciationConfigCard() {
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const howlRef = useRef<Howl | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const languageConfig = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageConfig.languageId);

  const cleanup = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const handleTest = async () => {
    setStatus("testing");
    setStatusMsg("");
    setIsTesting(true);
    cleanup();

    try {
      const blob = await fetchPronunciation(languageProfile.pronunciationTestWord);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const howl = new Howl({
        src: [url],
        format: ["mp3"],
        onplay: () => {
          setStatus("success");
          setStatusMsg("播放中...");
        },
        onend: () => {
          setStatusMsg("有道在线兜底正常");
          setIsTesting(false);
        },
        onstop: () => setIsTesting(false),
        onloaderror: () => {
          setStatus("error");
          setStatusMsg(
            "有道测试音频加载失败，请稍后重试；已内置的本地练习音频不受影响。",
          );
          setIsTesting(false);
        },
      });
      howlRef.current = howl;
      howl.play();
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "无法连接有道在线发音，请检查网络后重试；已内置的本地练习音频不受影响。",
        ),
      );
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>单词词典发音</CardTitle>
        <CardDescription>
          练习词优先播放内置本地音频；本地缺失时使用有道词典在线兜底。当前测试{" "}
          {languageProfile.displayName} 单词“
          {languageProfile.pronunciationTestWord}”。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          有道在线兜底无需配置 API Key。发布包内置的英语、西语、法语、俄语练习词会优先走本地音频。
        </div>

        <div
          className="flex flex-wrap items-center gap-3"
          data-smoke="pronunciation-test-row"
        >
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            <Volume2 className="mr-1.5 h-4 w-4" />
            测试有道发音
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
