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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useElevenLabsConfig } from "@/hooks/use-api-keys";
import { testElevenLabs } from "@/lib/api-client";
import { setElevenLabsConfig } from "@/lib/api-keys";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { getSettingsUserFacingError } from "./user-facing-error";

const WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

const ELEVENLABS_VOICES = [
  { voice_id: "RaFzMbMIfqBcIurH6XF9", name: "Eryn" },
  { voice_id: "cR39HTrtXbjvEP4CNYFx", name: "Daphne" },
  { voice_id: "XfNU2rGpBa01ckF309OY", name: "Nichalia" },
  { voice_id: "wvk9Caj0nEx4l3I9LaR6", name: "Liz" },
  { voice_id: "G0yjIg3xY8gEJZkHpjVm", name: "Brian" },
  { voice_id: "ashjVK50jp28G73AUTnb", name: "Micheal Scott" },
  { voice_id: "Gfpl8Yo74Is0W6cPUWWT", name: "Max" },
];

const ELEVENLABS_MODELS = [
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — 最快最省" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — 最高质量" },
  { id: "eleven_v3", label: "Eleven v3 — 最新但延迟较高" },
];

export function ElevenLabsConfigCard() {
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_flash_v2_5");
  const saved = useElevenLabsConfig();

  useEffect(() => {
    if (saved) {
      setApiKey(saved.apiKey);
      setVoiceId(saved.voiceId);
      if (saved.modelId) setModelId(saved.modelId);
    } else {
      setApiKey("");
      setVoiceId("");
      setModelId("eleven_flash_v2_5");
    }
  }, [saved]);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const handleSave = () => {
    if (!apiKey.trim()) {
      const message = "请填写 API Key 后再保存配置";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    const voice = ELEVENLABS_VOICES.find((v) => v.voice_id === voiceId);
    if (!voice) {
      const message = "请选择默认声音后再保存配置";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    setElevenLabsConfig({
      apiKey: apiKey.trim(),
      voiceId,
      voiceName: voice.name,
      modelId,
    });
    toast.success("ElevenLabs 配置已保存");
    setStatus("success");
    setStatusMsg("ElevenLabs 配置已保存，建议再测试连接。");
  };

  const handleTest = async () => {
    if (!apiKey.trim()) {
      const message = "请先填写 API Key 后再测试连接";
      toast.error(message);
      setStatus("error");
      setStatusMsg(message);
      return;
    }
    setStatus("testing");
    setStatusMsg("");

    try {
      const result = await testElevenLabs(apiKey.trim());
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
          "ElevenLabs 连接测试失败，请检查网络、代理或 API Key 后重试。",
        ),
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>标准示范 TTS</CardTitle>
        <CardDescription>
          ElevenLabs 用于句子/短语示范朗读和跟读高亮；单词词典发音在下方单独配置。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!apiKey.trim() && (
          <div
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            data-smoke="elevenlabs-missing-key-guidance"
            role="status"
          >
            未配置 ElevenLabs 时，已内置单词和语言包音频仍可播放；自由输入的句子/短语标准示范和逐词高亮需要
            Key。
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="el-key">API Key</Label>
          <Input
            id="el-key"
            type="password"
            placeholder="输入 ElevenLabs 密钥"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="el-voice">Default Voice</Label>
          <Select value={voiceId} onValueChange={(v) => v && setVoiceId(v)}>
            <SelectTrigger id="el-voice">
              <SelectValue placeholder="选择声音" />
            </SelectTrigger>
            <SelectContent>
              {ELEVENLABS_VOICES.map((v) => (
                <SelectItem key={v.voice_id} value={v.voice_id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="el-model">Model</Label>
          <Select value={modelId} onValueChange={(v) => v && setModelId(v)}>
            <SelectTrigger id="el-model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELEVENLABS_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className="flex flex-wrap items-center gap-3"
          data-smoke="tts-config-actions"
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
