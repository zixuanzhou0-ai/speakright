"use client";

import { Howl } from "howler";
import { Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DesktopExternalLink } from "@/components/common/desktop-external-link";
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
import {
  useLanguageConfig,
  useMerriamWebsterConfig,
  usePronunciationConfig,
} from "@/hooks/use-api-keys";
import { fetchPronunciation } from "@/lib/api-client";
import {
  setMerriamWebsterConfig,
  setPronunciationConfig,
} from "@/lib/api-keys";
import { getLanguageProfile } from "@/lib/language-profiles";
import type { PronunciationSource } from "@/types/api-keys";
import { type ConnectionState, ConnectionStatus } from "./connection-status";

const SOURCE_OPTIONS: {
  value: PronunciationSource;
  label: string;
  description: string;
}[] = [
  {
    value: "youdao",
    label: "有道词典",
    description: "国内访问最快，无需 API Key",
  },
  {
    value: "merriam-webster",
    label: "韦氏词典",
    description: "美国权威词典，需配置 API Key，海外访问更快",
  },
];

export function PronunciationConfigCard() {
  const [source, setSource] = useState<PronunciationSource>("youdao");
  const [mwKey, setMwKey] = useState("");
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const howlRef = useRef<Howl | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const pronunciationConfig = usePronunciationConfig();
  const mwConfig = useMerriamWebsterConfig();
  const languageConfig = useLanguageConfig();
  const languageProfile = getLanguageProfile(languageConfig.languageId);
  const isEnglish = languageConfig.languageId === "en-US";
  const effectiveSource = isEnglish ? source : "youdao";

  useEffect(() => {
    setSource(pronunciationConfig.source);
  }, [pronunciationConfig.source]);

  useEffect(() => {
    setMwKey(mwConfig?.apiKey ?? "");
  }, [mwConfig]);

  const handleSourceChange = (newSource: PronunciationSource) => {
    setSource(newSource);
    setPronunciationConfig({ source: newSource });
    setStatus("idle");
    setStatusMsg("");
    toast.success(
      `已切换到${SOURCE_OPTIONS.find((o) => o.value === newSource)?.label}`,
    );
  };

  const handleSaveMwKey = () => {
    if (!mwKey.trim()) {
      toast.error("请输入 API Key");
      return;
    }
    setMerriamWebsterConfig({ apiKey: mwKey.trim() });
    toast.success("Merriam-Webster API Key 已保存");
  };

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
    if (effectiveSource === "merriam-webster" && !mwKey.trim()) {
      toast.error("请先填写 API Key");
      return;
    }

    setStatus("testing");
    setStatusMsg("");
    setIsTesting(true);
    cleanup();

    try {
      const blob = await fetchPronunciation(
        languageProfile.pronunciationTestWord,
        effectiveSource,
        effectiveSource === "merriam-webster" ? mwKey.trim() : undefined,
      );
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
          setStatusMsg("发音正常");
          setIsTesting(false);
        },
        onstop: () => setIsTesting(false),
        onloaderror: () => {
          setStatus("error");
          setStatusMsg("音频加载失败");
          setIsTesting(false);
        },
      });
      howlRef.current = howl;
      howl.play();
    } catch {
      setStatus("error");
      setStatusMsg("网络错误");
      setIsTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>发音音源</CardTitle>
        <CardDescription>
          当前测试 {languageProfile.displayName} 单词“
          {languageProfile.pronunciationTestWord}”。韦氏词典仅用于美式英语。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source radio group */}
        <div className="space-y-3">
          {SOURCE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              aria-disabled={!isEnglish && opt.value === "merriam-webster"}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                source === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="pronunciation-source"
                value={opt.value}
                checked={effectiveSource === opt.value}
                onChange={() => handleSourceChange(opt.value)}
                disabled={!isEnglish && opt.value === "merriam-webster"}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <div>
                <span className="font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground">
                  {!isEnglish && opt.value === "merriam-webster"
                    ? "英语专用；当前语言会自动使用有道实验音源"
                    : opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* MW API Key (conditional) */}
        {isEnglish && source === "merriam-webster" && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <Label htmlFor="pron-mw-key">API Key</Label>
            <Input
              id="pron-mw-key"
              type="password"
              placeholder="输入 Merriam-Webster Collegiate API 密钥"
              value={mwKey}
              onChange={(e) => setMwKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              前往{" "}
              <DesktopExternalLink
                href="https://dictionaryapi.com/register/index"
                copyMessage="已复制韦氏词典注册链接，请在浏览器中打开"
                className="text-primary underline"
              >
                dictionaryapi.com
              </DesktopExternalLink>{" "}
              免费注册获取 Collegiate Dictionary API Key
            </p>
            <Button size="sm" onClick={handleSaveMwKey}>
              保存 Key
            </Button>
          </div>
        )}

        {/* Test button + status */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            <Volume2 className="mr-1.5 h-4 w-4" />
            测试发音
          </Button>
          <ConnectionStatus state={status} message={statusMsg} />
        </div>
      </CardContent>
    </Card>
  );
}
