import { readFile } from "node:fs/promises";

export function buildAzureSttUrl(region, languageId) {
  const url = new URL(
    `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
  );
  url.searchParams.set("language", languageId);
  url.searchParams.set("format", "detailed");
  url.searchParams.set("profanity", "raw");
  return url;
}

export function parseAzureSttResponse(payload) {
  const best = Array.isArray(payload?.NBest) ? payload.NBest[0] : null;
  return {
    ok: payload?.RecognitionStatus === "Success",
    recognitionStatus: payload?.RecognitionStatus ?? "Unknown",
    recognizedText:
      best?.Display ?? best?.Lexical ?? payload?.DisplayText ?? "",
    lexicalText: best?.Lexical ?? "",
    confidence: typeof best?.Confidence === "number" ? best.Confidence : null,
    duration: payload?.Duration ?? null,
    offset: payload?.Offset ?? null,
  };
}

export async function recognizeAzureWordBlind({
  subscriptionKey,
  region,
  languageId,
  wavPath,
  timeoutMs = 30_000,
}) {
  if (!subscriptionKey) throw new Error("Azure subscription key is required");
  const response = await fetch(buildAzureSttUrl(region, languageId), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
    body: await readFile(wavPath),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { RecognitionStatus: "InvalidJson" };
  }
  if (!response.ok) {
    const error = new Error(
      `Azure blind STT failed (${response.status}): ${payload?.RecognitionStatus ?? "unknown"}`,
    );
    error.status = response.status;
    throw error;
  }
  return parseAzureSttResponse(payload);
}
