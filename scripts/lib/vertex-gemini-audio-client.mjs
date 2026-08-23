import { readFile } from "node:fs/promises";
import { ProxyAgent } from "undici";
import {
  readVertexAccessToken,
  resolveVertexProjectId,
} from "./vertex-gemini-tts-client.mjs";

export const VERTEX_GEMINI_AUDIO_MODEL = "gemini-3.1-pro-preview";
export const VERTEX_GEMINI_AUDIO_LOCATION = "global";
let proxyDispatcher;

function resolveProxyDispatcher() {
  const proxyUrl =
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.ALL_PROXY?.trim();
  if (!proxyUrl) return undefined;
  proxyDispatcher ??= new ProxyAgent(proxyUrl);
  return proxyDispatcher;
}

export function buildBlindAudioPrompt(languageId) {
  return [
    `The audio contains one isolated word spoken in ${languageId}.`,
    "Transcribe only what is actually audible.",
    "Do not guess from a filename or any expected answer; neither is provided.",
    "Return the heard word in normal spelling and a best-effort IPA transcription.",
    "If the audio is unclear, set uncertain to true instead of inventing a word.",
  ].join(" ");
}

export function buildBlindAudioRequest({ languageId, audioBase64 }) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildBlindAudioPrompt(languageId) },
          {
            inlineData: {
              mimeType: "audio/mpeg",
              data: audioBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          heardText: { type: "STRING" },
          heardIpa: { type: "STRING" },
          uncertain: { type: "BOOLEAN" },
        },
        required: ["heardText", "heardIpa", "uncertain"],
      },
    },
  };
}

function extractText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.find((part) => typeof part?.text === "string")?.text;
  if (!text) {
    const reason = payload?.candidates?.[0]?.finishReason;
    throw new Error(
      `Vertex audio listener returned no text${reason ? `: ${reason}` : ""}`,
    );
  }
  return text;
}

export async function transcribeVertexGeminiAudio({
  languageId,
  audioPath,
  projectId = resolveVertexProjectId(),
  accessToken = readVertexAccessToken(),
  signal,
}) {
  const endpoint =
    `https://aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}` +
    `/locations/${VERTEX_GEMINI_AUDIO_LOCATION}/publishers/google/models/` +
    `${VERTEX_GEMINI_AUDIO_MODEL}:generateContent`;
  const audioBase64 = (await readFile(audioPath)).toString("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify(buildBlindAudioRequest({ languageId, audioBase64 })),
    dispatcher: resolveProxyDispatcher(),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      `Vertex audio request failed (${response.status}): ${payload?.error?.message ?? "unknown error"}`,
    );
    error.status = response.status;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(extractText(payload));
  } catch (error) {
    throw new Error(
      `Vertex audio listener returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    heardText: String(parsed.heardText ?? "").trim(),
    heardIpa: String(parsed.heardIpa ?? "").trim(),
    uncertain: Boolean(parsed.uncertain),
    modelId: VERTEX_GEMINI_AUDIO_MODEL,
    usageMetadata: payload?.usageMetadata ?? payload?.usage_metadata ?? null,
  };
}
