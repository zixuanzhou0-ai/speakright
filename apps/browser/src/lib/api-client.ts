/**
 * Direct Browser Edition API client.
 * Core calls run from the user's browser with BYOK provider credentials.
 */

import { getCoachMode } from "@/lib/api-keys";
import { getAzureRegionValidationError } from "@/lib/azure-config";
import { buildL1ErrorContext, matchL1Errors } from "@/lib/l1-error-patterns";
import {
  buildFeedbackPrompt,
  type FeedbackPromptOptions,
} from "@/lib/llm-prompt";
import { apiFetch } from "@/platform/browser-fetch";
import {
  assessPronunciationInBrowser,
  testAzureCredentialsInBrowser,
  transcribeSpeechInBrowser,
} from "@/platform/speech-assessment";
import type { AzureAssessmentResult } from "@/types/azure";
import type { LanguageId } from "@/types/language";

// ─── Azure ──────────────────────────────────────────────

function truncateServiceDetail(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function buildAzureConnectionTestErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Azure Speech 请求已取消，请重试。";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/[\u3400-\u9fff]/.test(message)) {
    return truncateServiceDetail(message);
  }

  if (
    error instanceof TypeError ||
    /fetch|network|dns|timeout|timed out|connection|offline|refused/i.test(
      message,
    )
  ) {
    return "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。";
  }

  return "Azure Speech 请求失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。";
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
  try {
    await testAzureCredentialsInBrowser(key, region);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: buildAzureConnectionTestErrorMessage(error),
    };
  }
}

/**
 * Run pronunciation assessment via the Azure Speech browser SDK.
 * Numeric scores are returned from Azure Pronunciation Assessment, not from LLM feedback.
 */
export async function assessPronunciation(
  audioBlob: Blob,
  referenceText: string,
  key: string,
  region: string,
  language = "en-US",
): Promise<AzureAssessmentResult> {
  return assessPronunciationInBrowser(
    audioBlob,
    referenceText,
    key,
    region,
    language,
  );
}

export async function transcribeSpeech(
  audioBlob: Blob,
  key: string,
  region: string,
  language = "en-US",
): Promise<string> {
  return transcribeSpeechInBrowser(audioBlob, key, region, language);
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
  signal?: AbortSignal,
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
        signal,
        body: JSON.stringify(buildElevenLabsBody(text, modelId, options)),
      },
    );
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(buildElevenLabsNetworkErrorMessage(error));
  }

  if (!res.ok) {
    const errText = await res.text();
    signal?.throwIfAborted();
    throw new Error(
      buildElevenLabsHttpErrorMessage("tts", res.status, errText),
    );
  }
  const responsePayload = (await res.json()) as {
    audio_base64: string;
    alignment: unknown;
  };
  signal?.throwIfAborted();
  return responsePayload;
}

// ─── Hermes Grok TTS ───────────────────────────────────

const HERMES_XAI_BRIDGE_URL = "http://127.0.0.1:17831";
const HERMES_XAI_BRIDGE_PROTOCOL_VERSION = 1;
const HERMES_XAI_STATUS_TIMEOUT_MS = 25_000;
const HERMES_XAI_TTS_TIMEOUT_MS = 80_000;

let hermesBridgeSessionToken: string | null = null;

export interface HermesXaiStatus {
  available: boolean;
  provider: "xai";
  voiceId?: string;
  detail?: string;
  message?: string;
}

export interface HermesXaiTtsOptions {
  languageId?: LanguageId;
  speed?: number;
  signal?: AbortSignal;
}

function getRecordString(
  value: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

function normalizeHermesXaiStatus(value: unknown): HermesXaiStatus {
  if (typeof value === "boolean") {
    return { available: value, provider: "xai" };
  }
  if (!value || typeof value !== "object") {
    return {
      available: false,
      provider: "xai",
      detail: "本机爱马仕没有返回有效状态。",
      message: "本机爱马仕没有返回有效状态。",
    };
  }

  const record = value as Record<string, unknown>;
  const availableValue = record.available ?? record.ready ?? record.ok;
  const detail = getRecordString(record, "message", "detail", "error");
  return {
    available: availableValue === true,
    provider: "xai",
    voiceId: getRecordString(record, "voiceId", "voice_id", "voice"),
    detail,
    message: detail,
  };
}

function decodeBase64Audio(base64: string, mimeType = "audio/mpeg"): Blob {
  const normalized = base64.includes(",")
    ? (base64.split(",").pop() ?? "")
    : base64;
  try {
    const bytes = Uint8Array.from(atob(normalized), (character) =>
      character.charCodeAt(0),
    );
    return new Blob([bytes], { type: mimeType });
  } catch {
    throw new Error("爱马仕 Grok TTS 返回了无效的音频数据，请重试。");
  }
}

function hermesAudioBlobFromPayload(payload: unknown): Blob {
  if (payload instanceof Blob) return payload;

  if (typeof payload === "string") {
    return decodeBase64Audio(payload);
  }

  if (
    Array.isArray(payload) &&
    payload.every((value) => typeof value === "number")
  ) {
    return new Blob([Uint8Array.from(payload)], { type: "audio/mpeg" });
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const base64 = getRecordString(
      record,
      "audioBase64",
      "audio_base64",
      "audio",
      "data",
    );
    if (base64) {
      return decodeBase64Audio(
        base64,
        getRecordString(record, "mimeType", "mime_type", "contentType") ??
          "audio/mpeg",
      );
    }
    const bytes = record.bytes;
    if (
      Array.isArray(bytes) &&
      bytes.every((value) => typeof value === "number")
    ) {
      return new Blob([Uint8Array.from(bytes)], { type: "audio/mpeg" });
    }
  }

  throw new Error("爱马仕 Grok TTS 没有返回可播放音频，请重试。");
}

async function fetchHermesBridge(
  path: "/health" | "/tts" | "/vertex/health" | "/vertex/tts",
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const sourceSignal = externalSignal ?? init.signal ?? undefined;
  const abortFromSource = () => controller.abort(sourceSignal?.reason);
  if (sourceSignal?.aborted) {
    abortFromSource();
  } else {
    sourceSignal?.addEventListener("abort", abortFromSource, { once: true });
  }
  const timeout = setTimeout(
    () =>
      controller.abort(new DOMException("本机 TTS 请求超时。", "TimeoutError")),
    timeoutMs,
  );
  try {
    controller.signal.throwIfAborted();
    return await fetch(`${HERMES_XAI_BRIDGE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener("abort", abortFromSource);
  }
}

function rememberHermesBridgeSession(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const protocolVersion = record.protocolVersion ?? record.protocol_version;
  const sessionToken = getRecordString(record, "sessionToken", "session_token");
  if (protocolVersion !== HERMES_XAI_BRIDGE_PROTOCOL_VERSION || !sessionToken) {
    hermesBridgeSessionToken = null;
    return false;
  }
  hermesBridgeSessionToken = sessionToken;
  return true;
}

/** Check the local Hermes/xAI integration without exposing its OAuth token. */
export async function hermesXaiStatus(
  signal?: AbortSignal,
): Promise<HermesXaiStatus> {
  try {
    const response = await fetchHermesBridge(
      "/health",
      { headers: { Accept: "application/json" } },
      HERMES_XAI_STATUS_TIMEOUT_MS,
      signal,
    );
    signal?.throwIfAborted();
    const responsePayload = (await response.json()) as unknown;
    signal?.throwIfAborted();
    if (!rememberHermesBridgeSession(responsePayload)) {
      return {
        available: false,
        provider: "xai",
        detail:
          "检测到的本机服务不是兼容的 SpeakRight 爱马仕桥接，请重新启动当前版本。",
        message:
          "检测到的本机服务不是兼容的 SpeakRight 爱马仕桥接，请重新启动当前版本。",
      };
    }
    if (!response.ok) {
      const status = normalizeHermesXaiStatus(responsePayload);
      return {
        ...status,
        available: false,
        detail:
          status.detail ??
          `本机爱马仕桥接服务不可用（HTTP ${response.status}）。`,
        message:
          status.message ??
          `本机爱马仕桥接服务不可用（HTTP ${response.status}）。`,
      };
    }
    return normalizeHermesXaiStatus(responsePayload);
  } catch {
    signal?.throwIfAborted();
    return {
      available: false,
      provider: "xai",
      detail:
        "无法连接本机爱马仕 Grok TTS。请确认爱马仕已配置 xAI，并已启动 SpeakRight 本机桥接服务。",
      message:
        "无法连接本机爱马仕 Grok TTS。请确认爱马仕已配置 xAI，并已启动 SpeakRight 本机桥接服务。",
    };
  }
}

/** Generate audio through Hermes' existing xAI credentials. */
export async function hermesXaiTts(
  text: string,
  options: HermesXaiTtsOptions = {},
): Promise<Blob> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error("请输入需要朗读的文字。");
  }
  if (normalizedText.length > 500) {
    throw new Error("标准示范文本过长，请控制在 500 个字符以内。");
  }

  const speed = Math.min(1.5, Math.max(0.7, options.speed ?? 1));
  const payload = {
    text: normalizedText,
    languageId: options.languageId ?? "en-US",
    speed,
  };

  try {
    if (!hermesBridgeSessionToken) {
      const status = await hermesXaiStatus(options.signal);
      if (!status.available || !hermesBridgeSessionToken) {
        throw new Error(
          status.detail ||
            "本机爱马仕 Grok TTS 尚未就绪，请先在设置页检测状态。",
        );
      }
    }

    const response = await fetchHermesBridge(
      "/tts",
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg, application/json",
          "Content-Type": "application/json",
          "X-SpeakRight-Bridge-Token": hermesBridgeSessionToken,
        },
        body: JSON.stringify(payload),
      },
      HERMES_XAI_TTS_TIMEOUT_MS,
      options.signal,
    );
    options.signal?.throwIfAborted();
    if (response.status === 401 || response.status === 403) {
      hermesBridgeSessionToken = null;
    }
    if (!response.ok) {
      const responseText = await response.text();
      let detail = truncateServiceDetail(responseText);
      try {
        const parsed = JSON.parse(responseText) as Record<string, unknown>;
        detail =
          getRecordString(parsed, "error", "message", "detail") ?? detail;
      } catch {
        // Keep the plain response detail.
      }
      throw new Error(
        `爱马仕 Grok TTS 生成失败（HTTP ${response.status}）${
          detail ? `：${detail}` : "。"
        }`,
      );
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType.startsWith("audio/") ||
      contentType.includes("application/octet-stream")
    ) {
      const audioBuffer = await response.arrayBuffer();
      options.signal?.throwIfAborted();
      return new Blob([audioBuffer], {
        type: contentType.split(";")[0] || "audio/mpeg",
      });
    }
    const responsePayload = await response.json();
    options.signal?.throwIfAborted();
    return hermesAudioBlobFromPayload(responsePayload);
  } catch (error) {
    options.signal?.throwIfAborted();
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    if (/[\u3400-\u9fff]/.test(message)) {
      throw new Error(message);
    }
    throw new Error(
      "无法连接本机爱马仕 Grok TTS。请确认爱马仕已配置 xAI，并已启动 SpeakRight 本机桥接服务。",
    );
  }
}

// ─── Vertex AI Gemini 3.1 Flash TTS ────────────────────

const VERTEX_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const VERTEX_GEMINI_STATUS_TIMEOUT_MS = 25_000;
const VERTEX_GEMINI_TTS_TIMEOUT_MS = 120_000;

let vertexBridgeSessionToken: string | null = null;

export interface VertexGeminiStatus {
  available: boolean;
  model: string;
  authReady: boolean;
  projectConfigured: boolean;
  detail?: string;
}

export interface VertexGeminiTtsOptions {
  languageId?: LanguageId;
  speed?: number;
  voiceName?: string;
  signal?: AbortSignal;
}

function getRecordBoolean(
  value: Record<string, unknown>,
  ...keys: string[]
): boolean {
  for (const key of keys) {
    if (typeof value[key] === "boolean") return value[key] === true;
  }
  return false;
}

function normalizeVertexGeminiStatus(value: unknown): VertexGeminiStatus {
  if (!value || typeof value !== "object") {
    return {
      available: false,
      model: VERTEX_GEMINI_TTS_MODEL,
      authReady: false,
      projectConfigured: false,
      detail: "本机 Vertex AI 桥接没有返回有效状态。",
    };
  }

  const record = value as Record<string, unknown>;
  return {
    available: getRecordBoolean(record, "available", "ready", "ok"),
    model:
      getRecordString(record, "model", "modelId", "model_id") ??
      VERTEX_GEMINI_TTS_MODEL,
    authReady: getRecordBoolean(record, "authReady", "auth_ready"),
    projectConfigured: getRecordBoolean(
      record,
      "projectConfigured",
      "project_configured",
    ),
    detail: getRecordString(record, "detail", "message", "error"),
  };
}

function rememberVertexBridgeSession(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const protocolVersion = record.protocolVersion ?? record.protocol_version;
  const sessionToken = getRecordString(record, "sessionToken", "session_token");
  if (protocolVersion !== HERMES_XAI_BRIDGE_PROTOCOL_VERSION || !sessionToken) {
    vertexBridgeSessionToken = null;
    return false;
  }
  vertexBridgeSessionToken = sessionToken;
  return true;
}

function vertexAudioBlobFromPayload(payload: unknown): Blob {
  if (payload instanceof Blob) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const base64 = getRecordString(
      record,
      "audioBase64",
      "audio_base64",
      "audio",
      "data",
    );
    if (base64) {
      const normalized = base64.includes(",")
        ? (base64.split(",").pop() ?? "")
        : base64;
      try {
        const bytes = Uint8Array.from(atob(normalized), (character) =>
          character.charCodeAt(0),
        );
        return new Blob([bytes], {
          type:
            getRecordString(record, "mimeType", "mime_type", "contentType") ??
            "audio/wav",
        });
      } catch {
        throw new Error("Vertex Gemini TTS 返回了无效的音频数据，请重试。");
      }
    }
  }

  throw new Error("Vertex Gemini TTS 没有返回可播放音频，请重试。");
}

/** Check local gcloud project and Application Default Credentials only. */
export async function vertexGeminiStatus(
  signal?: AbortSignal,
): Promise<VertexGeminiStatus> {
  try {
    const response = await fetchHermesBridge(
      "/vertex/health",
      { headers: { Accept: "application/json" } },
      VERTEX_GEMINI_STATUS_TIMEOUT_MS,
      signal,
    );
    signal?.throwIfAborted();
    const responsePayload = (await response.json()) as unknown;
    signal?.throwIfAborted();
    if (!rememberVertexBridgeSession(responsePayload)) {
      return {
        available: false,
        model: VERTEX_GEMINI_TTS_MODEL,
        authReady: false,
        projectConfigured: false,
        detail:
          "检测到的本机服务不是兼容的 SpeakRight Vertex AI 桥接，请重新启动当前版本。",
      };
    }
    const status = normalizeVertexGeminiStatus(responsePayload);
    if (!response.ok) {
      return {
        ...status,
        available: false,
        detail:
          status.detail ??
          `本机 Vertex AI 桥接服务不可用（HTTP ${response.status}）。`,
      };
    }
    return status;
  } catch {
    signal?.throwIfAborted();
    return {
      available: false,
      model: VERTEX_GEMINI_TTS_MODEL,
      authReady: false,
      projectConfigured: false,
      detail:
        "无法连接本机 Vertex AI TTS。请确认已安装 gcloud、已选择项目并完成 ADC 登录。",
    };
  }
}

/** Generate audio with the locally authenticated Vertex AI project. */
export async function vertexGeminiTts(
  text: string,
  options: VertexGeminiTtsOptions = {},
): Promise<Blob> {
  const normalizedText = text.trim();
  if (!normalizedText) throw new Error("请输入需要朗读的文字。");
  if (normalizedText.length > 500) {
    throw new Error("标准示范文本过长，请控制在 500 个字符以内。");
  }

  const payload = {
    text: normalizedText,
    languageId: options.languageId ?? "en-US",
    speed: Math.min(1.5, Math.max(0.7, options.speed ?? 1)),
    voiceName: options.voiceName?.trim() || "Kore",
  };

  try {
    if (!vertexBridgeSessionToken) {
      const status = await vertexGeminiStatus(options.signal);
      if (!status.available || !vertexBridgeSessionToken) {
        throw new Error(
          status.detail ||
            "本机 Vertex AI TTS 尚未就绪，请先在设置页检测状态。",
        );
      }
    }

    const response = await fetchHermesBridge(
      "/vertex/tts",
      {
        method: "POST",
        headers: {
          Accept: "audio/wav, audio/mpeg, application/json",
          "Content-Type": "application/json",
          "X-SpeakRight-Bridge-Token": vertexBridgeSessionToken,
        },
        body: JSON.stringify(payload),
      },
      VERTEX_GEMINI_TTS_TIMEOUT_MS,
      options.signal,
    );
    options.signal?.throwIfAborted();
    if (response.status === 401 || response.status === 403) {
      vertexBridgeSessionToken = null;
    }
    if (!response.ok) {
      const responseText = await response.text();
      let detail = truncateServiceDetail(responseText);
      try {
        const parsed = JSON.parse(responseText) as Record<string, unknown>;
        detail =
          getRecordString(parsed, "error", "message", "detail") ?? detail;
      } catch {
        // Keep the plain response detail.
      }
      throw new Error(
        `Vertex Gemini TTS 生成失败（HTTP ${response.status}）${
          detail ? `：${detail}` : "。"
        }`,
      );
    }

    const contentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType.startsWith("audio/") ||
      contentType.includes("application/octet-stream")
    ) {
      const audioBuffer = await response.arrayBuffer();
      options.signal?.throwIfAborted();
      return new Blob([audioBuffer], {
        type: contentType.split(";")[0] || "audio/wav",
      });
    }
    const responsePayload = await response.json();
    options.signal?.throwIfAborted();
    return vertexAudioBlobFromPayload(responsePayload);
  } catch (error) {
    options.signal?.throwIfAborted();
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    if (/[㐀-鿿]/.test(message)) throw new Error(message);
    throw new Error(
      "无法连接本机 Vertex AI TTS。请确认已安装 gcloud、已选择项目并完成 ADC 登录。",
    );
  }
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

function getBlockedBrowserLlmReason(config: LlmConfig): string | null {
  void config;
  return null;
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
  const blockedReason = getBlockedBrowserLlmReason(config);
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
  options: FeedbackPromptOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const blockedReason = getBlockedBrowserLlmReason(config);
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

  // English L1 patterns are calibrated for en-US Azure SAPI phonemes only.
  const allPhonemes =
    languageId === "en-US"
      ? azureResult.words.flatMap((w) =>
          w.phonemes.map((p) => ({
            phoneme: p.phoneme,
            accuracyScore: p.accuracyScore,
          })),
        )
      : [];
  const l1Context =
    languageId === "en-US"
      ? buildL1ErrorContext(matchL1Errors(allPhonemes))
      : "";
  const prompt =
    buildFeedbackPrompt(
      target,
      azureResult,
      mode,
      getCoachMode(),
      languageId,
      options,
    ) + l1Context;
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
