import { execFileSync } from "node:child_process";
import { ProxyAgent } from "undici";

export const VERTEX_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
export const VERTEX_GEMINI_TTS_LOCATION = "global";
export const VERTEX_GEMINI_TTS_SAMPLE_RATE = 24_000;

const GCLOUD_COMMAND =
  process.platform === "win32"
    ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    : "gcloud";
const GCLOUD_WINDOWS_SCRIPT =
  "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.ps1";
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

function readGcloudValue(args) {
  const commandArgs =
    process.platform === "win32"
      ? [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          GCLOUD_WINDOWS_SCRIPT,
          ...args,
        ]
      : args;
  return execFileSync(GCLOUD_COMMAND, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  }).trim();
}

export function resolveVertexProjectId() {
  const configured = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const projectId =
    configured || readGcloudValue(["config", "get-value", "project"]);
  if (!projectId || projectId === "(unset)") {
    throw new Error("Vertex project is not configured");
  }
  return projectId;
}

export function readVertexAccessToken() {
  const provided = process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
  if (provided) return provided;
  const token = readGcloudValue([
    "auth",
    "application-default",
    "print-access-token",
  ]);
  if (!token)
    throw new Error("Vertex application-default credentials are unavailable");
  return token;
}

export function buildDictionaryWordPrompt({
  languageId,
  text,
  expectedIpa,
  variant = "A",
}) {
  const directions =
    variant === "B"
      ? "Use a clear dictionary pronunciation at a slightly slower natural pace."
      : "Use a clear neutral dictionary pronunciation at a natural deliberate pace.";
  return [
    `Speak one standalone dictionary word in ${languageId}.`,
    directions,
    expectedIpa
      ? `The intended pronunciation is ${expectedIpa}. Use this only as silent guidance; do not speak the IPA hint.`
      : "",
    "Read only the content inside <word> and </word>.",
    "Do not speak the tags, instructions, labels, spelling, or any extra sound.",
    `<word>${text}</word>`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildVertexTtsRequest({
  languageId,
  text,
  voiceName,
  expectedIpa,
  variant,
}) {
  return {
    contents: {
      role: "user",
      parts: {
        text: buildDictionaryWordPrompt({
          languageId,
          text,
          expectedIpa,
          variant,
        }),
      },
    },
    generation_config: {
      speech_config: {
        language_code: languageId.toLowerCase(),
        voice_config: {
          prebuilt_voice_config: {
            voice_name: voiceName.toLowerCase(),
          },
        },
      },
    },
  };
}

function extractAudioPart(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  );
  const inline = audioPart?.inlineData ?? audioPart?.inline_data;
  if (!inline?.data) {
    const reason =
      payload?.candidates?.[0]?.finishReason ?? payload?.error?.message;
    throw new Error(
      `Vertex TTS returned no audio${reason ? `: ${reason}` : ""}`,
    );
  }
  return {
    bytes: Buffer.from(inline.data, "base64"),
    mimeType: inline.mimeType ?? inline.mime_type ?? "audio/L16;rate=24000",
  };
}

export async function synthesizeVertexGeminiTts({
  languageId,
  text,
  voiceName,
  expectedIpa,
  variant = "A",
  projectId = resolveVertexProjectId(),
  accessToken = readVertexAccessToken(),
  signal,
}) {
  const endpoint =
    `https://aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}` +
    `/locations/${VERTEX_GEMINI_TTS_LOCATION}/publishers/google/models/` +
    `${VERTEX_GEMINI_TTS_MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify(
      buildVertexTtsRequest({
        languageId,
        text,
        voiceName,
        expectedIpa,
        variant,
      }),
    ),
    dispatcher: resolveProxyDispatcher(),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      `Vertex TTS request failed (${response.status}): ${payload?.error?.message ?? "unknown error"}`,
    );
    error.status = response.status;
    throw error;
  }
  const audio = extractAudioPart(payload);
  return {
    ...audio,
    modelId: VERTEX_GEMINI_TTS_MODEL,
    location: VERTEX_GEMINI_TTS_LOCATION,
    voiceName,
    languageId,
    usageMetadata: payload?.usageMetadata ?? payload?.usage_metadata ?? null,
  };
}
