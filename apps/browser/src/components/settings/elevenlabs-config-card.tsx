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
import {
  useElevenLabsConfig,
  useStandardTtsConfig,
  useVertexGeminiTtsConfig,
} from "@/hooks/use-api-keys";
import {
  hermesXaiStatus,
  hermesXaiTts,
  testElevenLabs,
  type VertexGeminiStatus,
  vertexGeminiStatus,
  vertexGeminiTts,
} from "@/lib/api-client";
import {
  setElevenLabsConfig,
  setStandardTtsConfig,
  setVertexGeminiTtsConfig,
} from "@/lib/api-keys";
import type { StandardTtsProvider } from "@/types/api-keys";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { DomesticTtsConfigPanel } from "./domestic-tts-config-panel";
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

const VERTEX_GEMINI_VOICES = ["Kore", "Charon", "Aoede", "Callirrhoe"];

export function ElevenLabsConfigCard() {
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState("eleven_flash_v2_5");
  const saved = useElevenLabsConfig();
  const standardTts = useStandardTtsConfig();
  const vertexConfig = useVertexGeminiTtsConfig();
  const [hermesVoiceId, setHermesVoiceId] = useState<string | null>(null);
  const [vertexStatusInfo, setVertexStatusInfo] =
    useState<VertexGeminiStatus | null>(null);

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

  const handleProviderChange = (provider: StandardTtsProvider) => {
    if (provider === standardTts.provider) return;
    setStandardTtsConfig({ provider });
    setStatus("idle");
    setStatusMsg("");
    const providerName =
      provider === "minimax"
        ? "MiniMax Speech 2.8"
        : provider === "mimo"
          ? "小米 MiMo V2.5 TTS"
          : provider === "hermes-grok"
            ? "爱马仕 Grok TTS"
            : provider === "vertex-gemini"
              ? "Vertex AI · Gemini 3.1 Flash TTS"
              : "ElevenLabs";
    toast.success(`标准示范已切换为${providerName}`);
  };

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

  const handleHermesStatus = async () => {
    setStatus("testing");
    setStatusMsg("");
    try {
      const result = await hermesXaiStatus();
      setHermesVoiceId(result.voiceId ?? null);
      if (result.available) {
        setStatus("success");
        setStatusMsg(
          result.detail ||
            `已连接爱马仕${result.voiceId ? `，当前音色 ${result.voiceId}` : ""}`,
        );
      } else {
        setStatus("error");
        setStatusMsg(result.detail || "未检测到可用的爱马仕 Grok TTS");
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "未能连接本机爱马仕，请确认爱马仕已安装并配置 Grok TTS 后重试。",
        ),
      );
    }
  };

  const handleHermesTest = async () => {
    setStatus("testing");
    setStatusMsg("");
    try {
      const audioBlob = await hermesXaiTts("Hello, this is SpeakRight.", {
        languageId: "en-US",
        speed: 1,
      });
      if (audioBlob.size === 0) {
        throw new Error("爱马仕返回了空音频");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const releaseAudioUrl = () => URL.revokeObjectURL(audioUrl);
      audio.addEventListener("ended", releaseAudioUrl, { once: true });
      audio.addEventListener("error", releaseAudioUrl, { once: true });

      try {
        await audio.play();
        setStatus("success");
        setStatusMsg("Grok TTS 短句已生成并开始播放");
      } catch {
        releaseAudioUrl();
        setStatus("success");
        setStatusMsg("短句已生成；浏览器阻止了自动播放，请再次点击试听");
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "Grok TTS 试听失败，请检查爱马仕状态与 Grok 授权。",
        ),
      );
    }
  };

  const handleVertexVoiceChange = (voiceName: string | null) => {
    if (!voiceName) return;
    setVertexGeminiTtsConfig({ voiceName });
    setStatus("idle");
    setStatusMsg("");
    toast.success(`Vertex Gemini 音色已切换为 ${voiceName}`);
  };

  const handleVertexStatus = async () => {
    setStatus("testing");
    setStatusMsg("");
    try {
      const result = await vertexGeminiStatus();
      setVertexStatusInfo(result);
      if (result.available) {
        setStatus("success");
        setStatusMsg(result.detail || "本机 Vertex AI 项目与 ADC 授权已就绪");
      } else {
        setStatus("error");
        setStatusMsg(
          result.detail ||
            "Vertex AI 尚未就绪，请检查本机 gcloud 项目与 ADC 授权。",
        );
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "未能连接本机 Vertex AI，请确认已安装 gcloud、已选择项目并完成 ADC 登录。",
        ),
      );
    }
  };

  const handleVertexTest = async () => {
    setStatus("testing");
    setStatusMsg("");
    try {
      const audioBlob = await vertexGeminiTts("Hello, this is SpeakRight.", {
        languageId: "en-US",
        speed: 1,
        voiceName: vertexConfig.voiceName,
      });
      if (audioBlob.size === 0) {
        throw new Error("Vertex Gemini 返回了空音频");
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      const releaseAudioUrl = () => URL.revokeObjectURL(audioUrl);
      audio.addEventListener("ended", releaseAudioUrl, { once: true });
      audio.addEventListener("error", releaseAudioUrl, { once: true });

      try {
        await audio.play();
        setStatus("success");
        setStatusMsg("Vertex Gemini TTS 短句已生成并开始播放");
      } catch {
        releaseAudioUrl();
        setStatus("success");
        setStatusMsg("短句已生成；浏览器阻止了自动播放，请再次点击试听");
      }
    } catch (error) {
      setStatus("error");
      setStatusMsg(
        getSettingsUserFacingError(
          error,
          "Vertex Gemini TTS 试听失败，请检查 gcloud 项目、ADC 授权和 Vertex AI 用量。",
        ),
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>标准示范 TTS</CardTitle>
        <CardDescription>
          在 ElevenLabs、MiniMax、小米 MiMo、爱马仕 Grok 与本机 Vertex Gemini
          TTS 间切换；单词词典发音在下方单独配置。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-smoke="tts-provider-selector"
        >
          <legend className="sr-only">选择标准示范 TTS</legend>
          <button
            aria-pressed={standardTts.provider === "elevenlabs"}
            className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
              standardTts.provider === "elevenlabs"
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
            }`}
            data-smoke="tts-provider-elevenlabs"
            onClick={() => handleProviderChange("elevenlabs")}
            type="button"
          >
            <span className="block font-semibold">ElevenLabs</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              云端高质量语音，支持精准逐词高亮
            </span>
          </button>
          <button
            aria-pressed={standardTts.provider === "minimax"}
            className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
              standardTts.provider === "minimax"
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
            }`}
            data-smoke="tts-provider-minimax"
            onClick={() => handleProviderChange("minimax")}
            type="button"
          >
            <span className="block font-semibold">MiniMax Speech 2.8</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              中国大陆 BYOK · 官方真实词级时间轴
            </span>
          </button>
          <button
            aria-pressed={standardTts.provider === "mimo"}
            className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
              standardTts.provider === "mimo"
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
            }`}
            data-smoke="tts-provider-mimo"
            onClick={() => handleProviderChange("mimo")}
            type="button"
          >
            <span className="block font-semibold">小米 MiMo V2.5</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              中国大陆 BYOK · 英文音色 · 整句播放反馈
            </span>
          </button>
          <button
            aria-pressed={standardTts.provider === "hermes-grok"}
            className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
              standardTts.provider === "hermes-grok"
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
            }`}
            data-smoke="tts-provider-hermes-grok"
            onClick={() => handleProviderChange("hermes-grok")}
            type="button"
          >
            <span className="block font-semibold">爱马仕 Grok</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              复用本机授权；支持朗读与重听，暂不提供逐词时间轴
            </span>
          </button>
          <button
            aria-pressed={standardTts.provider === "vertex-gemini"}
            className={`min-h-24 rounded-xl border p-4 text-left transition-colors ${
              standardTts.provider === "vertex-gemini"
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
            }`}
            data-smoke="tts-provider-vertex-gemini"
            onClick={() => handleProviderChange("vertex-gemini")}
            type="button"
          >
            <span className="block font-semibold">Vertex AI · Gemini 3.1</span>
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              Flash TTS（预览）· 复用本机 gcloud；暂不提供逐词时间轴
            </span>
          </button>
        </fieldset>

        {standardTts.provider === "elevenlabs" && !apiKey.trim() && (
          <div
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
            data-smoke="elevenlabs-missing-key-guidance"
            role="status"
          >
            未配置 ElevenLabs
            时，已内置单词和语言包音频仍可播放；自由输入的句子/短语标准示范和逐词高亮需要
            Key。
          </div>
        )}

        {standardTts.provider === "elevenlabs" ? (
          <div className="space-y-4" data-smoke="tts-provider-panel-elevenlabs">
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
                <SelectTrigger id="el-voice" data-smoke="tts-voice-select">
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
                <SelectTrigger id="el-model" data-smoke="tts-model-select">
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
          </div>
        ) : standardTts.provider === "minimax" ? (
          <DomesticTtsConfigPanel provider="minimax" />
        ) : standardTts.provider === "mimo" ? (
          <DomesticTtsConfigPanel provider="mimo" />
        ) : standardTts.provider === "hermes-grok" ? (
          <div
            className="space-y-4"
            data-smoke="tts-provider-panel-hermes-grok"
          >
            <div
              className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
              data-smoke="hermes-grok-local-guidance"
            >
              <div>
                <p className="font-medium">直接沿用爱马仕当前配置</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  无需在 SpeakRight 配置或持久化 Grok
                  密钥；调用由本机爱马仕子进程完成，授权和声音仍由爱马仕管理。
                  Browser Edition
                  通过本机启动器运行时会自动启动桥接，无需同时打开桌面端。
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border bg-background/70 px-3 py-2.5">
                  <span className="block text-xs text-muted-foreground">
                    授权来源
                  </span>
                  <span className="mt-1 block font-medium">爱马仕本机授权</span>
                </div>
                <div className="rounded-lg border bg-background/70 px-3 py-2.5">
                  <span className="block text-xs text-muted-foreground">
                    当前音色
                  </span>
                  <span className="mt-1 block font-medium">
                    {hermesVoiceId || "沿用爱马仕设置（检测后显示）"}
                  </span>
                </div>
              </div>
            </div>
            <div
              className="flex flex-wrap items-center gap-3"
              data-smoke="hermes-grok-config-actions"
            >
              <Button
                className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
                onClick={handleHermesStatus}
              >
                检测爱马仕状态
              </Button>
              <Button
                className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
                onClick={handleHermesTest}
                variant="outline"
              >
                试听短句（会产生用量）
              </Button>
              <ConnectionStatus state={status} message={statusMsg} />
            </div>
          </div>
        ) : (
          <div
            className="space-y-4"
            data-smoke="tts-provider-panel-vertex-gemini"
          >
            <div
              className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4"
              data-smoke="vertex-gemini-local-guidance"
            >
              <div>
                <p className="font-medium">直接沿用本机 Vertex AI 授权</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  SpeakRight 不保存 Google 密钥；需要本机 gcloud
                  已选择项目，并完成 Application Default
                  Credentials（ADC）登录。状态检测不会生成语音，试听才会产生
                  Vertex AI 用量。
                </p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border bg-background/70 px-3 py-2.5 sm:col-span-2">
                  <span className="block text-xs text-muted-foreground">
                    模型
                  </span>
                  <span className="mt-1 block break-all font-medium">
                    {vertexStatusInfo?.model || "gemini-3.1-flash-tts-preview"}
                  </span>
                </div>
                <div className="rounded-lg border bg-background/70 px-3 py-2.5">
                  <Label
                    className="text-xs font-normal text-muted-foreground"
                    htmlFor="vertex-gemini-voice"
                  >
                    音色
                  </Label>
                  <Select
                    value={vertexConfig.voiceName}
                    onValueChange={handleVertexVoiceChange}
                  >
                    <SelectTrigger
                      className="mt-1 h-8 border-0 bg-transparent px-0 shadow-none"
                      id="vertex-gemini-voice"
                      data-smoke="vertex-gemini-voice-select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERTEX_GEMINI_VOICES.map((voice) => (
                        <SelectItem key={voice} value={voice}>
                          {voice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {vertexStatusInfo && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border bg-background/70 px-2.5 py-1">
                    项目：
                    {vertexStatusInfo.projectConfigured ? "已配置" : "未配置"}
                  </span>
                  <span className="rounded-full border bg-background/70 px-2.5 py-1">
                    ADC：{vertexStatusInfo.authReady ? "已就绪" : "未就绪"}
                  </span>
                </div>
              )}
            </div>
            <div
              className="flex flex-wrap items-center gap-3"
              data-smoke="vertex-gemini-config-actions"
            >
              <Button
                className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
                onClick={handleVertexStatus}
              >
                检测 Vertex 状态
              </Button>
              <Button
                className={WRAP_SAFE_SETTINGS_ACTION_BUTTON_CLASS}
                onClick={handleVertexTest}
                variant="outline"
              >
                试听短句（会产生用量）
              </Button>
              <ConnectionStatus state={status} message={statusMsg} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
