import { readFile } from "node:fs/promises";
import path from "node:path";

function createHttpError(message, response, detail = "") {
  const error = new Error(
    `${message} (${response.status})${detail ? `: ${detail}` : ""}`,
  );
  error.status = response.status;
  return error;
}

export async function fetchElevenLabsSubscription(apiKey) {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/user/subscription",
    {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw createHttpError("ElevenLabs subscription query failed", response);
  const used = payload.character_count ?? null;
  const limit = payload.character_limit ?? null;
  return {
    tier: payload.tier ?? null,
    characterCount: used,
    characterLimit: limit,
    remaining:
      Number.isFinite(used) && Number.isFinite(limit) ? limit - used : null,
    nextResetUnix: payload.next_character_count_reset_unix ?? null,
  };
}

export async function fetchElevenLabsVoice(apiKey, voiceId) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`,
    {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw createHttpError("ElevenLabs voice query failed", response);
  return {
    voiceId: payload.voice_id ?? voiceId,
    name: payload.name ?? null,
    category: payload.category ?? null,
    labels: payload.labels ?? {},
    availableForTiers: payload.available_for_tiers ?? [],
    highQualityBaseModelIds: payload.high_quality_base_model_ids ?? [],
  };
}

export async function fetchElevenLabsModels(apiKey) {
  const response = await fetch("https://api.elevenlabs.io/v1/models", {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok)
    throw createHttpError("ElevenLabs model query failed", response);
  return (Array.isArray(payload) ? payload : []).map((model) => ({
    modelId: model.model_id,
    name: model.name ?? null,
    canDoTextToSpeech: model.can_do_text_to_speech === true,
    languages: (model.languages ?? []).map((language) => language.language_id),
  }));
}

export async function synthesizeElevenLabsCandidate({
  apiKey,
  candidate,
  pronunciationDictionaryLocators = [],
}) {
  const url = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(candidate.voiceId)}`,
  );
  url.searchParams.set("output_format", "mp3_44100_128");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: candidate.text,
      model_id: candidate.modelId,
      language_code: candidate.languageCode,
      seed: candidate.seed,
      voice_settings: candidate.voiceSettings,
      ...(pronunciationDictionaryLocators.length > 0
        ? { pronunciation_dictionary_locators: pronunciationDictionaryLocators }
        : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw createHttpError("ElevenLabs TTS failed", response, detail);
  }
  return {
    audio: Buffer.from(await response.arrayBuffer()),
    requestId:
      response.headers.get("request-id") ??
      response.headers.get("x-request-id"),
    characterCost: Number(response.headers.get("character-cost")) || null,
  };
}

export async function createElevenLabsPronunciationDictionary({
  apiKey,
  candidate,
}) {
  if (!candidate.pronunciationDictionary) {
    throw new Error(
      "Third-round candidate is missing a pronunciation dictionary rule",
    );
  }
  const response = await fetch(
    "https://api.elevenlabs.io/v1/pronunciation-dictionaries/add-from-rules",
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `SpeakRight-${candidate.candidateId}`,
        description: "Temporary audited candidate dictionary",
        rules: [
          {
            type: "phoneme",
            alphabet: candidate.pronunciationDictionary.alphabet,
            string_to_replace:
              candidate.pronunciationDictionary.stringToReplace,
            phoneme: candidate.pronunciationDictionary.phoneme,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      "ElevenLabs pronunciation dictionary creation failed",
      response,
      JSON.stringify(payload).slice(0, 300),
    );
  }
  return {
    id: payload.id,
    versionId: payload.version_id,
  };
}

export async function transcribeElevenLabsScribe({
  apiKey,
  audioPath,
  languageCode,
}) {
  const bytes = await readFile(audioPath);
  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("language_code", languageCode);
  form.set(
    "file",
    new Blob([bytes], { type: "audio/mpeg" }),
    path.basename(audioPath),
  );
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      "ElevenLabs Scribe failed",
      response,
      JSON.stringify(payload).slice(0, 300),
    );
  }
  return {
    text: payload.text ?? "",
    languageCode: payload.language_code ?? languageCode,
    languageProbability: payload.language_probability ?? null,
    requestId:
      response.headers.get("request-id") ??
      response.headers.get("x-request-id"),
  };
}
