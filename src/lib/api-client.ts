/**
 * Direct API client for desktop mode.
 * Replaces all /api/* proxy routes — calls external APIs directly from the client.
 * API keys are read from api-keys.ts. In packaged Tauri builds, secrets are
 * kept in the OS credential store + in-memory cache rather than persisted in
 * localStorage or the general Tauri settings store.
 */

import { getCoachMode } from "@/lib/api-keys";
import { assertAzureRegion, getAzureRegionValidationError } from "@/lib/azure-config";
import { parseAzureResult } from "@/lib/azure-speech";
import { buildL1ErrorContext, matchL1Errors } from "@/lib/l1-error-patterns";
import { getDesktopLlmPolicyError } from "@/lib/llm-providers";
import { buildFeedbackPrompt } from "@/lib/llm-prompt";
import { parseMwStress } from "@/lib/syllable-stress";
import { apiFetch } from "@/lib/tauri-http";
import { isTauriEnvironment } from "@/lib/tauri-runtime";
import { isSentence } from "@/lib/utils";
import type { AzureAssessmentResult } from "@/types/azure";

// ─── Azure ──────────────────────────────────────────────

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
  const res = await apiFetch(tokenUrl, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": key },
  });
  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      error: `Azure auth failed (${res.status}): ${text}`,
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
  const enableProsody = language === "en-US" && isSentence(referenceText);

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
  const res = await apiFetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/wav",
      "Pronunciation-Assessment": pronConfigBase64,
      Accept: "application/json",
    },
    body: audioBytes,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && text.includes("No speech")) {
      throw new Error("No speech detected. Please try again.");
    }
    throw new Error(`Azure assessment failed (${res.status}): ${text}`);
  }

  const raw = await res.json();

  // Check for no-match
  if (
    raw.RecognitionStatus === "NoMatch" ||
    raw.RecognitionStatus === "InitialSilenceTimeout"
  ) {
    throw new Error("No speech detected. Please try again.");
  }

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
  const res = await apiFetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "audio/wav",
      Accept: "application/json",
    },
    body: audioBytes,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure transcription failed (${res.status}): ${text}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  if (
    raw.RecognitionStatus === "NoMatch" ||
    raw.RecognitionStatus === "InitialSilenceTimeout"
  ) {
    throw new Error("No speech detected. Please try again.");
  }
  const nbest = raw.NBest as Array<Record<string, unknown>> | undefined;
  const best = nbest?.[0];
  const transcript =
    (best?.Display as string | undefined) ??
    (best?.Lexical as string | undefined) ??
    (raw.DisplayText as string | undefined) ??
    "";
  if (!transcript.trim()) {
    throw new Error("No transcript returned from Azure.");
  }
  return transcript.trim();
}

// ─── ElevenLabs ─────────────────────────────────────────

const ALLOWED_VOICE_IDS = new Set([
  "RaFzMbMIfqBcIurH6XF9",
  "cR39HTrtXbjvEP4CNYFx",
  "XfNU2rGpBa01ckF309OY",
  "wvk9Caj0nEx4l3I9LaR6",
  "G0yjIg3xY8gEJZkHpjVm",
  "ashjVK50jp28G73AUTnb",
  "Gfpl8Yo74Is0W6cPUWWT",
]);
const YOUDAO_PRONUNCIATION_TIMEOUT_MS = 5_000;

function buildElevenLabsBody(text: string, modelId: string, speed?: number) {
  return {
    text,
    model_id: modelId || "eleven_flash_v2_5",
    speed: Math.min(1.2, Math.max(0.7, speed ?? 0.85)),
    voice_settings: {
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

function normalizeAudioMime(contentType: string | null): string {
  return contentType?.split(";")[0]?.trim() || "audio/mpeg";
}

function hasMp3Header(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

async function pronunciationAudioBlobFromResponse(
  res: Response,
  sourceName: string,
): Promise<Blob> {
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentType = normalizeAudioMime(res.headers.get("content-type"));
  const contentLooksAudio = contentType.startsWith("audio/");

  if (bytes.byteLength < 512) {
    throw new Error(
      `${sourceName} returned invalid audio (${bytes.byteLength} bytes)`,
    );
  }
  if (!(contentLooksAudio || hasMp3Header(bytes))) {
    throw new Error(`${sourceName} returned non-audio content`);
  }
  if (!hasMp3Header(bytes)) {
    throw new Error(`${sourceName} returned audio without a valid MP3 header`);
  }

  return new Blob([buffer], { type: contentType });
}

function normalizePronunciationWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

/** Test ElevenLabs API key */
export async function testElevenLabs(
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await apiFetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    return { success: false, error: `ElevenLabs auth failed (${res.status})` };
  }
  return { success: true };
}

/** Fetch ElevenLabs usage/subscription info */
export async function fetchElevenLabsUsage(apiKey: string): Promise<{
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number;
}> {
  const res = await apiFetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs usage error (${res.status}): ${errText}`);
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
  const res = await apiFetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs voices error (${res.status}): ${errText}`);
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

/** TTS — returns audio blob */
export async function elevenLabsTts(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: string,
  speed?: number,
): Promise<Blob> {
  if (!ALLOWED_VOICE_IDS.has(voiceId)) throw new Error("Invalid voice ID");
  if (text.length > 500) throw new Error("Text too long (max 500 chars)");

  const res = await apiFetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildElevenLabsBody(text, modelId, speed)),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS error (${res.status}): ${errText}`);
  }
  return audioBlobFromResponse(res);
}

/** TTS with timestamps — returns JSON with audio_base64 and alignment */
export async function elevenLabsTtsAligned(
  apiKey: string,
  voiceId: string,
  text: string,
  modelId: string,
  speed?: number,
): Promise<{ audio_base64: string; alignment: unknown }> {
  if (!ALLOWED_VOICE_IDS.has(voiceId)) throw new Error("Invalid voice ID");
  if (text.length > 500) throw new Error("Text too long (max 500 chars)");

  const res = await apiFetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildElevenLabsBody(text, modelId, speed)),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS aligned error (${res.status}): ${errText}`);
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

  const res = await apiFetch(buildLlmEndpoint(config), {
    method: "POST",
    headers: buildLlmHeaders(config),
    body: JSON.stringify(
      buildLlmBody({
        config,
        messages: [
          { role: "user", content: "Say hello in Chinese, one sentence only." },
        ],
        maxTokens: 50,
      }),
    ),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      success: false,
      error: `LLM test failed (${res.status}): ${text}`,
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
    buildFeedbackPrompt(target, azureResult, mode, getCoachMode()) + l1Context;
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
            encoder.encode(`data: ${JSON.stringify({ error: text })}\n\n`),
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
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          );
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Pronunciation (Youdao / Merriam-Webster) ───────────

function getAudioSubdir(filename: string): string {
  if (filename.startsWith("bix")) return "bix";
  if (filename.startsWith("gg")) return "gg";
  if (/^[0-9]/.test(filename) || /^[^a-zA-Z]/.test(filename)) return "number";
  return filename.charAt(0);
}

function buildMwDictionaryUrl(word: string, mwKey: string): string {
  return `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(mwKey)}`;
}

/** Fetch pronunciation audio — returns blob */
export async function fetchPronunciation(
  word: string,
  source: "youdao" | "merriam-webster",
  mwKey?: string,
): Promise<Blob> {
  const w = normalizePronunciationWord(word);
  if (!w) throw new Error("Missing word");
  if (w.length > 50) throw new Error("Word too long (max 50 chars)");
  if (/\s/.test(w)) throw new Error("Only single words allowed");

  if (source === "merriam-webster") {
    if (!mwKey) throw new Error("Missing MW API key");
    return fetchMwAudio(w, mwKey);
  }
  return fetchYoudaoAudio(w);
}

async function fetchYoudaoAudio(word: string): Promise<Blob> {
  const url = `https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(word)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    YOUDAO_PRONUNCIATION_TIMEOUT_MS,
  );

  try {
    const res = await apiFetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Youdao returned ${res.status}`);
    return await pronunciationAudioBlobFromResponse(res, "Youdao");
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Youdao request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMwAudio(word: string, mwKey: string): Promise<Blob> {
  const apiUrl = buildMwDictionaryUrl(word, mwKey);
  const dictRes = await apiFetch(apiUrl);
  if (!dictRes.ok) throw new Error(`MW API error: ${dictRes.status}`);

  const data = await dictRes.json();
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    typeof data[0] === "string"
  ) {
    throw new Error("Word not found in dictionary");
  }

  const audioFilename = data[0]?.hwi?.prs?.[0]?.sound?.audio;
  if (!audioFilename) throw new Error("No pronunciation audio available");

  const subdir = getAudioSubdir(audioFilename);
  const audioUrl = `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdir}/${audioFilename}.mp3`;
  const audioRes = await apiFetch(audioUrl);
  if (!audioRes.ok) throw new Error("Failed to fetch audio from MW");
  return pronunciationAudioBlobFromResponse(audioRes, "Merriam-Webster");
}

// ─── Merriam-Webster Stress ─────────────────────────────

/** Fetch stress pattern from MW dictionary */
export async function fetchMwStress(
  word: string,
  mwKey: string,
): Promise<{
  stress: ReturnType<typeof parseMwStress> | null;
  mw: string | null;
}> {
  const w = word.trim().toLowerCase();
  if (!w || w.length > 50 || /\s/.test(w)) return { stress: null, mw: null };

  const apiUrl = buildMwDictionaryUrl(w, mwKey);
  const res = await apiFetch(apiUrl);
  if (!res.ok) return { stress: null, mw: null };

  const data = await res.json();
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    typeof data[0] === "string"
  ) {
    return { stress: null, mw: null };
  }

  const mw = data[0]?.hwi?.prs?.[0]?.mw as string | undefined;
  if (!mw) return { stress: null, mw: null };

  const hasStress = mw.includes("ˈ") || mw.includes("ˌ");
  return { stress: hasStress ? parseMwStress(mw) : null, mw };
}

/** Test MW API key */
export async function testMw(mwKey: string): Promise<{
  success: boolean;
  word?: string;
  hasAudio?: boolean;
  error?: string;
}> {
  const apiUrl = buildMwDictionaryUrl("hello", mwKey);
  const res = await apiFetch(apiUrl);
  if (!res.ok)
    return { success: false, error: `MW API returned ${res.status}` };

  const data = await res.json();
  if (
    !Array.isArray(data) ||
    data.length === 0 ||
    typeof data[0] === "string"
  ) {
    return { success: false, error: "Invalid API key or unexpected response" };
  }

  const entry = data[0];
  if (entry?.meta?.id) {
    return {
      success: true,
      word: entry.meta.id,
      hasAudio: !!entry?.hwi?.prs?.[0]?.sound?.audio,
    };
  }
  return { success: false, error: "Unexpected API response format" };
}
