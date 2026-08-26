"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMimoTtsConfig, useMiniMaxTtsConfig } from "@/hooks/use-api-keys";
import { mimoTts, miniMaxTtsAligned } from "@/lib/api-client";
import { setMimoTtsConfig, setMiniMaxTtsConfig } from "@/lib/api-keys";
import type { StandardTtsProvider } from "@/types/api-keys";
import { type ConnectionState, ConnectionStatus } from "./connection-status";
import { getSettingsUserFacingError } from "./user-facing-error";

type DomesticProvider = Extract<StandardTtsProvider, "minimax" | "mimo">;

const MINIMAX_MODELS = [
  { id: "speech-2.8-turbo", label: "Speech 2.8 Turbo — 更省" },
  { id: "speech-2.8-hd", label: "Speech 2.8 HD — 更高质量" },
] as const;

const MINIMAX_VOICES = [
  { id: "English_expressive_narrator", label: "Expressive Narrator" },
  { id: "English_radiant_girl", label: "Radiant Girl" },
  { id: "English_magnetic_voiced_man", label: "Magnetic Man" },
  { id: "English_CalmWoman", label: "Calm Woman" },
  { id: "English_PatientMan", label: "Patient Man" },
] as const;

const MIMO_MODELS = [{ id: "mimo-v2.5-tts", label: "MiMo V2.5 TTS" }] as const;

const MIMO_VOICES = [
  { id: "Mia", label: "Mia · 女声" },
  { id: "Chloe", label: "Chloe · 女声" },
  { id: "Milo", label: "Milo · 男声" },
  { id: "Dean", label: "Dean · 男声" },
] as const;

const WRAP_SAFE_ACTION_CLASS =
  "h-auto min-h-8 max-w-full whitespace-normal break-words text-center [overflow-wrap:anywhere]";

export function DomesticTtsConfigPanel({
  provider,
}: {
  provider: DomesticProvider;
}) {
  const miniMaxSaved = useMiniMaxTtsConfig();
  const mimoSaved = useMimoTtsConfig();
  const saved = provider === "minimax" ? miniMaxSaved : mimoSaved;
  const isMiniMax = provider === "minimax";
  const providerName = isMiniMax ? "MiniMax" : "小米 MiMo";
  const models = isMiniMax ? MINIMAX_MODELS : MIMO_MODELS;
  const voices = isMiniMax ? MINIMAX_VOICES : MIMO_VOICES;
  const defaultModel = models[0].id;
  const defaultVoice = voices[0].id;
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState<string>(defaultModel);
  const [voiceId, setVoiceId] = useState<string>(defaultVoice);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const activeRequestRef = useRef<AbortController | null>(null);
  const requestGenerationRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);

  const stopPreviewAudio = useCallback(() => {
    const audio = previewAudioRef.current;
    previewAudioRef.current = null;
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute("src");
      } catch {
        // Best-effort cleanup for browsers that already released the element.
      }
    }
    if (previewAudioUrlRef.current) {
      URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = null;
    }
  }, []);

  const invalidatePreview = useCallback(() => {
    requestGenerationRef.current += 1;
    const controller = activeRequestRef.current;
    activeRequestRef.current = null;
    controller?.abort();
    stopPreviewAudio();
  }, [stopPreviewAudio]);

  const isCurrentRequest = useCallback(
    (generation: number, controller: AbortController) =>
      requestGenerationRef.current === generation &&
      activeRequestRef.current === controller &&
      !controller.signal.aborted,
    [],
  );

  const playPreviewAudio = useCallback(
    async (
      blob: Blob,
      generation: number,
      controller: AbortController,
    ): Promise<boolean | null> => {
      if (!isCurrentRequest(generation, controller)) return null;
      stopPreviewAudio();
      if (!isCurrentRequest(generation, controller)) return null;

      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      previewAudioUrlRef.current = audioUrl;
      const release = () => {
        if (previewAudioRef.current === audio) previewAudioRef.current = null;
        if (previewAudioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          previewAudioUrlRef.current = null;
        }
      };
      audio.addEventListener("ended", release, { once: true });
      audio.addEventListener("error", release, { once: true });

      try {
        await audio.play();
      } catch {
        release();
        return isCurrentRequest(generation, controller) ? false : null;
      }
      if (!isCurrentRequest(generation, controller)) {
        stopPreviewAudio();
        return null;
      }
      return true;
    },
    [isCurrentRequest, stopPreviewAudio],
  );

  useEffect(() => {
    invalidatePreview();
    setStatus("idle");
    setStatusMessage("");
    setApiKey(saved?.apiKey ?? "");
    setModelId(saved?.modelId || defaultModel);
    setVoiceId(saved?.voiceId || defaultVoice);
  }, [defaultModel, defaultVoice, invalidatePreview, saved]);

  useEffect(() => {
    const activeProvider = provider;
    setStatus("idle");
    setStatusMessage("");
    return () => {
      if (activeProvider === "minimax" || activeProvider === "mimo") {
        invalidatePreview();
      }
    };
  }, [invalidatePreview, provider]);

  const resetPreviewState = useCallback(() => {
    invalidatePreview();
    setStatus("idle");
    setStatusMessage("");
  }, [invalidatePreview]);

  const validate = () => {
    if (!apiKey.trim()) {
      const message = `请填写 ${providerName} API Key`;
      setStatus("error");
      setStatusMessage(message);
      toast.error(message);
      return false;
    }
    return true;
  };

  const save = () => {
    if (!validate()) return;
    const config = {
      apiKey: apiKey.trim(),
      modelId,
      voiceId,
    };
    if (isMiniMax) setMiniMaxTtsConfig(config);
    else setMimoTtsConfig(config);
    setStatus("success");
    setStatusMessage(`${providerName} 配置已保存，建议再试听短句。`);
    toast.success(`${providerName} 配置已保存`);
  };

  const test = async () => {
    if (!validate()) return;
    invalidatePreview();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const generation = requestGenerationRef.current;
    setStatus("testing");
    setStatusMessage("");
    try {
      let blob: Blob;
      let timelineMessage = "";
      if (isMiniMax) {
        const result = await miniMaxTtsAligned(
          apiKey.trim(),
          "Hello, this is SpeakRight.",
          {
            modelId,
            voiceId,
            languageId: "en-US",
            speed: 0.9,
            signal: controller.signal,
          },
        );
        if (!isCurrentRequest(generation, controller)) return;
        blob = result.audioBlob;
        timelineMessage =
          result.alignmentOutcome === "matched"
            ? "，已返回真实词级时间轴"
            : result.alignmentOutcome === "transient-unavailable"
              ? "；字幕服务暂时不可用，自由练习下次生成时会重试词时间轴"
              : "；字幕与原文不完全匹配，将使用整句播放反馈";
      } else {
        blob = await mimoTts(apiKey.trim(), "Hello, this is SpeakRight.", {
          modelId,
          voiceId,
          languageId: "en-US",
          speed: 0.9,
          signal: controller.signal,
        });
        if (!isCurrentRequest(generation, controller)) return;
      }
      if (blob.size === 0) throw new Error(`${providerName} 返回了空音频`);
      const started = await playPreviewAudio(blob, generation, controller);
      if (started === null || !isCurrentRequest(generation, controller)) return;
      setStatus("success");
      setStatusMessage(
        started
          ? `${providerName} 短句已生成并开始播放${timelineMessage}`
          : `${providerName} 短句已生成${timelineMessage}；浏览器阻止了自动播放，请在自由练习中再次点击`,
      );
    } catch (error) {
      if (!isCurrentRequest(generation, controller)) return;
      setStatus("error");
      setStatusMessage(
        getSettingsUserFacingError(
          error,
          `${providerName} 试听失败，请检查 API Key、模型、音色和账户用量。`,
        ),
      );
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
      }
    }
  };

  return (
    <div className="space-y-4" data-smoke={`tts-provider-panel-${provider}`}>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
        <p className="font-medium">使用你自己的 {providerName} API Key</p>
        <p className="mt-1 text-muted-foreground">
          Browser Edition 会从当前浏览器直接调用 {providerName}；SpeakRight
          不提供或硬编码共享密钥。密钥默认只保留到本次浏览器会话，只有你在上方明确开启本地保存后才会持久化。
        </p>
        <p className="mt-2 text-muted-foreground">
          {isMiniMax
            ? "MiniMax 会请求官方词级字幕；字幕下载失败时仍可播放，但会诚实降级为整句反馈。"
            : "MiMo 当前官方接口不提供词级时间轴，因此使用整句播放反馈，不估算或伪造逐词同步。"}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${provider}-key`}>API Key</Label>
        <Input
          autoComplete="off"
          aria-busy={status === "testing"}
          id={`${provider}-key`}
          onChange={(event) => {
            resetPreviewState();
            setApiKey(event.target.value);
          }}
          placeholder={`输入 ${providerName} API Key`}
          type="password"
          value={apiKey}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${provider}-model`}>Model</Label>
          <Select
            value={modelId}
            onValueChange={(value) => {
              if (!value) return;
              resetPreviewState();
              setModelId(value);
            }}
          >
            <SelectTrigger
              id={`${provider}-model`}
              data-smoke={`${provider}-model-select`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${provider}-voice`}>Voice</Label>
          <Select
            value={voiceId}
            onValueChange={(value) => {
              if (!value) return;
              resetPreviewState();
              setVoiceId(value);
            }}
          >
            <SelectTrigger
              id={`${provider}-voice`}
              data-smoke={`${provider}-voice-select`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {voice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div
        className="flex flex-wrap items-center gap-3"
        data-smoke={`${provider}-config-actions`}
      >
        <Button
          className={WRAP_SAFE_ACTION_CLASS}
          disabled={status === "testing"}
          onClick={save}
        >
          保存
        </Button>
        <Button
          className={WRAP_SAFE_ACTION_CLASS}
          disabled={status === "testing"}
          onClick={test}
          variant="outline"
        >
          试听短句（会产生用量）
        </Button>
        <ConnectionStatus state={status} message={statusMessage} />
      </div>
    </div>
  );
}
