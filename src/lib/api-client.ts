/**
 * Direct API client for desktop mode.
 * Replaces all /api/* proxy routes — calls external APIs directly from the client.
 * API keys are read from api-keys.ts. In packaged Tauri builds, secrets are
 * kept in the OS credential store + in-memory cache rather than persisted in
 * localStorage or the general Tauri settings store.
 */

import { getCoachMode } from "@/lib/api-keys";
import {
  assertAzureRegion,
  getAzureRegionValidationError,
} from "@/lib/azure-config";
import { parseAzureResult } from "@/lib/azure-speech";
import { buildL1ErrorContext, matchL1Errors } from "@/lib/l1-error-patterns";
import { getDesktopLlmPolicyError } from "@/lib/llm-providers";
import { buildFeedbackPrompt } from "@/lib/llm-prompt";
import { apiFetch } from "@/lib/tauri-http";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";
import type { LanguageId } from "@/types/language";

// ─── Azure ──────────────────────────────────────────────

function truncateServiceDetail(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function buildAzureHttpErrorMessage(
  action: "auth" | "assessment" | "transcription",
  status: number,
  body = "",
): string {
  const detail = truncateServiceDetail(body);
  const suffix = detail ? `（${detail}）` : "";

  if (status === 400 && /No speech/i.test(body)) {
    return "没有检测到清晰语音，请靠近麦克风、读完目标内容后重新录音。";
  }

  if (status === 401 || status === 403) {
    return "Azure Speech 认证失败，请检查设置页里的 Subscription Key 和区域是否匹配。";
  }

  if (status === 404) {
    return "Azure Speech 区域或服务终结点不可用，请检查设置页里的 Azure 区域。";
  }

  if (status === 408 || status === 504) {
    return "Azure Speech 请求超时，请检查网络后重试。";
  }

  if (status === 429) {
    return "Azure Speech 请求过于频繁或额度已用尽，请稍后重试或检查 Azure 配额。";
  }

  if (status >= 500) {
    return `Azure Speech 服务暂时不可用，请稍后重试。${suffix}`;
  }

  if (action === "auth") {
    return `Azure Speech 连接测试失败（HTTP ${status}）。${suffix}`;
  }

  if (action === "transcription") {
    return `Azure Speech 转写失败（HTTP ${status}）。${suffix}`;
  }

  return `Azure Speech 评分失败（HTTP ${status}）。${suffix}`;
}

function buildAzureNetworkErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Azure Speech 请求已取消，请重试。";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (
    error instanceof TypeError ||
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。";
  }

  if (/[\u3400-\u9fff]/.test(message)) {
    return `Azure Speech 请求失败：${truncateServiceDetail(message)}`;
  }

  return "Azure Speech 请求失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。";
}

function assertAzureSpeechMatch(raw: Record<string, unknown>): void {
  if (
    raw.RecognitionStatus === "NoMatch" ||
    raw.RecognitionStatus === "InitialSilenceTimeout"
  ) {
    throw new Error(
      "没有检测到清晰语音，请靠近麦克风、读完目标内容后重新录音。",
    );
  }
}

/**
 * Test Azure credentials by fetching an auth token.
 */
export async function testAzure(
  key: string,
  region: string,
): Promise<{ success: boolean; error?: string }> {
  const regionError = getAzureRegionValidationError(region);
  if (regionError) {
    return { success: false, error: regionError };
  }
  const normalizedRegion = assertAzureRegion(region);
  const tokenUrl = `https://${normalizedRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
  let res: Response;
  try {
    res = await apiFetch(tokenUrl, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
  } catch (error) {
    return { success: false, error: buildAzureNetworkErrorMessage(error) };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      error: buildAzureHttpErrorMessage("auth", res.status, text),
    };
  }
  return { success: true };
}

/**
 * Run pronunciation assessment via Azure Speech REST API.
 * Uses the REST endpoint instead of the Node.js SDK.
 */
export async function assessPronunciation(
  audioBlob: Blob,
  referenceText: string,
  key: string,
  region: string,
  language = "en-US",
): Promise<AzureAssessmentResult> {
  const normalizedRegion = assertAzureRegion(region);
  const enableProsody = isSentence(referenceText);

  // Build pronunciation assessment config as JSON, then base64-encode it
  const pronConfig = {
    ReferenceText: referenceText,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
    ...(enableProsody ? { EnableProsodyAssessment: true } : {}),
  };
  const pronConfigBase64 = btoa(
    unescape(encodeURIComponent(JSON.stringify(pronConfig))),
  );

  const url = `https://${normalizedRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;

  // Route through apiFetch (Tauri plugin-http in desktop, native fetch in dev).
  // plugin-http bypasses CORS via Rust reqwest; Azure STT does not advertise
  // CORS for tauri://localhost origin, so native fetch from WebView would fail.
  // Convert Blob → Uint8Array so the body survives IPC serialization.
  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
  let res: Response;
  try {
    res = await apiFetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "audio/wav",
        "Pronunciation-Assessment": pronConfigBase64,
        Accept: "application/json",
      },
      body: audioBytes,
    });
  } catch (error) {
    throw new Error(buildAzureNetworkErrorMessage(error));
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(buildAzureHttpErrorMessage("assessment", res.status, text));
  }

  const raw = (await res.json()) as Record<string, unknown>;

  assertAzureSpeechMatch(raw);

  return parseAzureResult(raw);
}

export async function transcribeSpeech(
  audioBlob: Blob,
  key: string,
  region: string,
  language = "en-US",
): Promise<string> {
  const normalizedRegion = assertAzureRegion(region);
  const url = `https://${normalizedRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(language)}&format=detailed`;
  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
  let res: Response;
  try {
    res = await apiFetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "audio/wav",
        Accept: "application/json",
      },
      body: audioBytes,
    });
  } catch (error) {
    throw new Error(buildAzureNetworkErrorMessage(error));
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      buildAzureHttpErrorMessage("transcription", res.status, text),
    );
  }

  const raw = (await res.json()) as Record<string, unknown>;
  assertAzureSpeechMatch(raw);
  const nbest = raw.NBest as Array<Record<string, unknown>> | undefined;
  const best = nbest?.[0];
  const transcript =
    (best?.Display as string | undefined) ??
    (best?.Lexical as string | undefined) ??
    (raw.DisplayText as string | undefined) ??
    "";
  if (!transcript.trim()) {
    throw new Error("Azure Speech 没有返回可用转写文本，请重新录音后再试。");
  }
  return transcript.trim();
}

// ─── ElevenLabs ─────────────────────────────────────────

export interface ElevenLabsVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface ElevenLabsTtsOptions {
  speed?: number;
  languageCode?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
}

export interface ElevenLabsVoiceSummary {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  preview_url?: string;
}

function assertElevenLabsVoiceId(voiceId: string): void {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(voiceId)) {
    throw new Error(
      "ElevenLabs Voice ID 格式无效，请在设置页重新选择或填写声音。",
    );
  }
}

function buildElevenLabsHttpErrorMessage(
  action: "auth" | "usage" | "voices" | "voiceSearch" | "tts",
  status: number,
  body = "",
): string {
  const detail = truncateServiceDetail(body);
  const suffix = detail ? `（${detail}）` : "";

  if (status === 400) {
    return `ElevenLabs 请求配置无效，请检查 Voice、Model 和文本长度。${suffix}`;
  }

  if (status === 401 || status === 403) {
    return "ElevenLabs 认证失败，请检查设置页里的 API Key 是否正确。";
  }

  if (status === 404) {
    return "ElevenLabs 声音或模型不可用，请检查 Voice ID 和 Model。";
  }

  if (status === 408 || status === 504) {
    return "ElevenLabs 请求超时，请检查网络后重试。";
  }

  if (status === 429) {
    return "ElevenLabs 请求过于频繁或额度不足，请稍后重试或检查 ElevenLabs 用量。";
  }

  if (status >= 500) {
    return `ElevenLabs 服务暂时不可用，请稍后重试。${suffix}`;
  }

  if (action === "usage") {
    return `ElevenLabs 用量查询失败（HTTP ${status}）。${suffix}`;
  }

  if (action === "voices" || action === "voiceSearch") {
    return `ElevenLabs 声音列表查询失败（HTTP ${status}）。${suffix}`;
  }

  if (action === "auth") {
    return `ElevenLabs 连接测试失败（HTTP ${status}）。${suffix}`;
  }

  return `ElevenLabs 标准示范生成失败（HTTP ${status}）。${suffix}`;
}

function buildElevenLabsNetworkErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "ElevenLabs 请求已取消，请重试。";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (
    error instanceof TypeError ||
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接 ElevenLabs，请检查网络、代理或 ElevenLabs 配置后重试。";
  }

  return `ElevenLabs 请求失败：${truncateServiceDetail(message) || "未知错误"}`;
}

function buildElevenLabsBody(
  text: string,
  modelId: string,
  options: ElevenLabsTtsOptions = {},
) {
  return {
    text,
    model_id: modelId || "eleven_flash_v2_5",
    ...(options.languageCode ? { language_code: options.languageCode } : {}),
    speed: Math.min(1.2, Math.max(0.7, options.speed ?? 0.85)),
    voice_settings: options.voiceSettings ?? {
      stability: 0.65,
      similarity_boost: 0.85,
      style: 0.35,
      use_speaker_boost: true,
    },
  };
}

async function audioBlobFromResponse(res: Response): Promise<Blob> {
  return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
}

/** Test ElevenLabs API key */
export async function testElevenLabs(
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  let res: Response;
  try {
    res = await apiFetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
  } catch (error) {
    return { success: false, error: buildElevenLabsNetworkErrorMessage(error) };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      error: buildElevenLabsHttpErrorMessage("auth", res.status, text),
    };
  }
  return { success: true };
}

/** Fetch ElevenLabs usage/subscription info */
export async function fetchElevenLabsUsage(apiKey: string): Promise<{
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number;
}> {
  let res: Response;
  try {
    res = await apiFetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
  } catch (error) {
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      buildElevenLabsHttpErrorMessage("usage", res.status, errText),
    );
  }
  const data = await res.json();
  return {
    characterCount: data.character_count ?? 0,
    characterLimit: data.character_limit ?? 0,
    nextResetUnix: data.next_character_count_reset_unix ?? 0,
  };
}

/** Fetch ElevenLabs voices list */
export async function fetchElevenLabsVoices(
  apiKey: string,
): Promise<{ voices: { voice_id: string; name: string }[] }> {
  let res: Response;
  try {
    res = await apiFetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
  } catch (error) {
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      buildElevenLabsHttpErrorMessage("voices", res.status, errText),
    );
  }
  const data = await res.json();
  const voices = (data.voices ?? []).map(
    (v: { voice_id: string; name: string }) => ({
      voice_id: v.voice_id,
      name: v.name,
    }),
  );
  return { voices };
}

/** Search available ElevenLabs voices with labels and descriptions. */
export async function searchElevenLabsVoices(
  apiKey: string,
  search: string,
): Promise<{ voices: ElevenLabsVoiceSummary[] }> {
  const url = new URL("https://api.elevenlabs.io/v2/voices");
  url.searchParams.set("page_size", "100");
  url.searchParams.set("include_total_count", "false");
  if (search.trim()) {
    url.searchParams.set("search", search.trim());
  }

  let res: Response;
  try {
    res = await apiFetch(url.toString(), {
      headers: { "xi-api-key": apiKey },
    });
  } catch (error) {
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      buildElevenLabsHttpErrorMessage("voiceSearch", res.status, errText),
    );
  }

  const data = await res.json();
  const voices = (data.voices ?? []).map(
    (v: {
      voice_id: string;
      name: string;
      category?: string;
      description?: string;
      labels?: Record<string, string>;
      preview_url?: string;
    }) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.description,
      labels: v.labels,
      preview_url: v.preview_url,
    }),
  );
  return { voices };
}

/** TTS — returns audio blob */
export async function elevenLabsTts(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: string,
  speedOrOptions?: number | ElevenLabsTtsOptions,
): Promise<Blob> {
  assertElevenLabsVoiceId(voiceId);
  if (text.length > 500) {
    throw new Error("标准示范文本过长，请控制在 500 个字符以内。");
  }
  const options =
    typeof speedOrOptions === "number"
      ? { speed: speedOrOptions }
      : (speedOrOptions ?? {});

  let res: Response;
  try {
    res = await apiFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildElevenLabsBody(text, modelId, options)),
      },
    );
  } catch (error) {
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      buildElevenLabsHttpErrorMessage("tts", res.status, errText),
    );
  }
  return audioBlobFromResponse(res);
}

/** TTS with timestamps — returns JSON with audio_base64 and alignment */
export async function elevenLabsTtsAligned(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: string,
  speedOrOptions?: number | ElevenLabsTtsOptions,
): Promise<{ audio_base64: string; alignment: unknown }> {
  assertElevenLabsVoiceId(voiceId);
  if (text.length > 500) {
    throw new Error("标准示范文本过长，请控制在 500 个字符以内。");
  }
  const options =
    typeof speedOrOptions === "number"
      ? { speed: speedOrOptions }
      : (speedOrOptions ?? {});

  let res: Response;
  try {
    res = await apiFetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildElevenLabsBody(text, modelId, options)),
      },
    );
  } catch (error) {
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      buildElevenLabsHttpErrorMessage("tts", res.status, errText),
    );
  }
  return res.json();
}

// ─── LLM ────────────────────────────────────────────────

interface LlmConfig {
  apiKey: string;
  provider: string;
  baseUrl: string;
  model: string;
}

interface ChatMessage {
  role: "user";
  content: string;
}

function getBlockedDesktopLlmReason(config: LlmConfig): string | null {
  return isTauriEnvironment()
    ? getDesktopLlmPolicyError(config.provider, config.baseUrl)
    : null;
}

function isClaudeProvider(config: Pick<LlmConfig, "provider">): boolean {
  return config.provider === "claude";
}

function buildLlmHeaders(config: LlmConfig): Record<string, string> {
  if (isClaudeProvider(config)) {
    return {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
}

function buildLlmEndpoint(config: LlmConfig): string {
  return isClaudeProvider(config)
    ? `${config.baseUrl}/messages`
    : `${config.baseUrl}/chat/completions`;
}

function buildLlmServiceErrorMessage(status: number, body = ""): string {
  const detail = truncateServiceDetail(body);
  const suffix = detail ? `（${detail}）` : "";

  if (status === 400) {
    return `AI 教练请求配置无效，请检查 Provider、Base URL、Model 和提示长度。${suffix}`;
  }

  if (status === 401 || status === 403) {
    return "AI 教练认证失败，请检查设置页里的 LLM API Key、Provider 和模型是否匹配。";
  }

  if (status === 404) {
    return "AI 教练接口或模型不可用，请检查 Provider、Base URL 和 Model。";
  }

  if (status === 408 || status === 504) {
    return "AI 教练请求超时，请检查网络或稍后重试。";
  }

  if (status === 429) {
    return "AI 教练请求过于频繁或额度不足，请稍后重试或检查 provider 额度。";
  }

  if (status >= 500) {
    return `AI 教练服务暂时不可用，请稍后重试。${suffix}`;
  }

  return `AI 教练请求失败（HTTP ${status}）。${suffix}`;
}

function buildLlmNetworkErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "AI 教练请求已取消，请重试。";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (
    error instanceof TypeError ||
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接 AI 教练服务，请检查网络、代理或 LLM provider 配置后重试。";
  }

  return `AI 教练请求失败：${truncateServiceDetail(message) || "未知错误"}`;
}

function buildLlmBody({
  config,
  messages,
  maxTokens,
  stream = false,
}: {
  config: LlmConfig;
  messages: ChatMessage[];
  maxTokens?: number;
  stream?: boolean;
}): Record<string, unknown> {
  if (isClaudeProvider(config)) {
    return {
      model: config.model,
      max_tokens: maxTokens ?? 1024,
      messages,
      ...(stream ? { stream: true } : {}),
    };
  }
  return {
    model: config.model,
    messages,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(stream
      ? { stream: true, stream_options: { include_usage: true } }
      : {}),
  };
}

function extractClaudeText(data: unknown): string {
  const content =
    typeof data === "object" && data !== null && "content" in data
      ? (data as { content?: unknown }).content
      : undefined;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) =>
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      (block as { type?: unknown }).type === "text" &&
      "text" in block &&
      typeof (block as { text?: unknown }).text === "string"
        ? (block as { text: string }).text
        : "",
    )
    .join("");
}

/** Test LLM connection */
export async function testLlm(
  config: LlmConfig,
): Promise<{ success: boolean; reply?: string; error?: string }> {
  const blockedReason = getBlockedDesktopLlmReason(config);
  if (blockedReason) {
    return { success: false, error: blockedReason };
  }

  let res: Response;
  try {
    res = await apiFetch(buildLlmEndpoint(config), {
      method: "POST",
      headers: buildLlmHeaders(config),
      body: JSON.stringify(
        buildLlmBody({
          config,
          messages: [
            {
              role: "user",
              content: "Say hello in Chinese, one sentence only.",
            },
          ],
          maxTokens: 50,
        }),
      ),
    });
  } catch (error) {
    return { success: false, error: buildLlmNetworkErrorMessage(error) };
  }

  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      error: buildLlmServiceErrorMessage(res.status, text),
    };
  }

  const data = await res.json();
  const reply = isClaudeProvider(config)
    ? extractClaudeText(data)
    : (data.choices?.[0]?.message?.content ?? "");
  return { success: true, reply };
}

/**
 * Stream LLM feedback via SSE.
 * Returns a ReadableStream that emits SSE lines identical to the old API route format.
 */
export function streamLlmFeedback(
  config: LlmConfig,
  target: string,
  azureResult: AzureAssessmentResult,
  mode: "phoneme" | "sentence" = "phoneme",
  signal?: AbortSignal,
  languageId: LanguageId = "en-US",
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const blockedReason = getBlockedDesktopLlmReason(config);
  if (blockedReason) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: blockedReason })}\n\n`,
          ),
        );
        controller.close();
      },
    });
  }

  // Collect all phoneme scores across words for L1 error detection
  const allPhonemes = azureResult.words.flatMap((w) =>
    w.phonemes.map((p) => ({
      phoneme: p.phoneme,
      accuracyScore: p.accuracyScore,
    })),
  );
  const l1Context = buildL1ErrorContext(matchL1Errors(allPhonemes));
  const prompt =
    buildFeedbackPrompt(target, azureResult, mode, getCoachMode(), languageId) +
    l1Context;
  return new ReadableStream({
    async start(controller) {
      try {
        const res = await apiFetch(buildLlmEndpoint(config), {
          method: "POST",
          headers: buildLlmHeaders(config),
          signal,
          body: JSON.stringify(
            buildLlmBody({
              config,
              messages: [{ role: "user", content: prompt }],
              stream: true,
            }),
          ),
        });

        if (!res.ok) {
          const text = await res.text();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: buildLlmServiceErrorMessage(res.status, text) })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = isClaudeProvider(config)
                ? parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta"
                  ? parsed.delta.text
                  : undefined
                : parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
                );
              }
              const usage = isClaudeProvider(config)
                ? parsed.type === "message_start" && parsed.message?.usage
                  ? {
                      prompt_tokens: parsed.message.usage.input_tokens ?? 0,
                      completion_tokens:
                        parsed.message.usage.output_tokens ?? 0,
                    }
                  : parsed.type === "message_delta" && parsed.usage
                    ? {
                        prompt_tokens: 0,
                        completion_tokens: parsed.usage.output_tokens ?? 0,
                      }
                    : null
                : parsed.usage;
              if (usage) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ usage: { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens } })}\n\n`,
                  ),
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = String(err);
        if (
          (err instanceof DOMException && err.name === "AbortError") ||
          msg.includes("cancelled") ||
          msg.includes("aborted")
        ) {
          // expected — user navigated away or started new recording
        } else {
          console.error("[LLM Stream]", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: buildLlmNetworkErrorMessage(err) })}\n\n`,
            ),
          );
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Pronunciation (Youdao online fallback) ───────────

function buildPronunciationNetworkErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    error instanceof TypeError ||
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接在线词典发音，请检查网络后重试；已内置的本地音频不受影响。";
  }

  return `在线词典发音失败：${truncateServiceDetail(message) || "未知错误"}`;
}

function buildPronunciationHttpErrorMessage(status: number): string {
  if (status === 404) {
    return "在线词典没有找到这个词的发音，请换一个词或使用内置练习词。";
  }

  if (status === 408 || status === 504) {
    return "在线词典发音请求超时，请检查网络后重试。";
  }

  if (status === 429) {
    return "在线词典发音请求过于频繁，请稍后重试。";
  }

  if (status >= 500) {
    return "在线词典发音服务暂时不可用，请稍后重试。";
  }

  return `在线词典发音失败（HTTP ${status}），请稍后重试。`;
}

/** Fetch pronunciation audio — returns blob */
export async function fetchPronunciation(word: string): Promise<Blob> {
  const w = word.trim().normalize("NFC").toLowerCase();
  if (!w) throw new Error("请输入要播放发音的单词。");
  if (w.length > 80) {
    throw new Error("单词发音文本过长，请控制在 80 个字符以内。");
  }

  return fetchYoudaoAudio(w);
}

async function fetchYoudaoAudio(word: string): Promise<Blob> {
  const url = `https://dict.youdao.com/dictvoice?type=0&audio=${encodeURIComponent(word)}`;
  let res: Response;
  try {
    res = await apiFetch(url);
  } catch (error) {
    throw new Error(buildPronunciationNetworkErrorMessage(error));
  }
  if (!res.ok) throw new Error(buildPronunciationHttpErrorMessage(res.status));
  return audioBlobFromResponse(res);
}
