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

function requireDictionaryString(value, field, context) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} returned an invalid ${field}`);
  }
  return value;
}

function requireDictionaryRuleCount(value, field, context) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${context} returned an invalid ${field}`);
  }
  return value;
}

function normalizePronunciationDictionaryRule(rule, index) {
  if (!rule || typeof rule !== "object") {
    throw new Error(`Pronunciation dictionary rule ${index} is invalid`);
  }
  const stringToReplace = rule.stringToReplace ?? rule.string_to_replace;
  if (typeof stringToReplace !== "string" || stringToReplace.length === 0) {
    throw new Error(
      `Pronunciation dictionary rule ${index} has no stringToReplace`,
    );
  }
  const normalized = {
    type: rule.type,
    string_to_replace: stringToReplace,
  };
  const caseSensitive = rule.caseSensitive ?? rule.case_sensitive;
  const wordBoundaries = rule.wordBoundaries ?? rule.word_boundaries;
  if (caseSensitive !== undefined) {
    if (typeof caseSensitive !== "boolean") {
      throw new Error(
        `Pronunciation dictionary rule ${index} has invalid caseSensitive`,
      );
    }
    normalized.case_sensitive = caseSensitive;
  }
  if (wordBoundaries !== undefined) {
    if (typeof wordBoundaries !== "boolean") {
      throw new Error(
        `Pronunciation dictionary rule ${index} has invalid wordBoundaries`,
      );
    }
    normalized.word_boundaries = wordBoundaries;
  }
  if (rule.type === "phoneme") {
    normalized.phoneme = requireDictionaryString(
      rule.phoneme,
      "phoneme",
      `Pronunciation dictionary rule ${index}`,
    );
    normalized.alphabet = requireDictionaryString(
      rule.alphabet,
      "alphabet",
      `Pronunciation dictionary rule ${index}`,
    );
  } else if (rule.type === "alias") {
    normalized.alias = requireDictionaryString(
      rule.alias,
      "alias",
      `Pronunciation dictionary rule ${index}`,
    );
  } else {
    throw new Error(
      `Pronunciation dictionary rule ${index} has unsupported type`,
    );
  }
  return normalized;
}

function normalizeDictionaryMetadata(payload, context) {
  const archivedTime = payload.archived_time_unix;
  if (
    archivedTime !== null &&
    archivedTime !== undefined &&
    (!Number.isSafeInteger(archivedTime) || archivedTime <= 0)
  ) {
    throw new Error(`${context} returned an invalid archived_time_unix`);
  }
  return {
    id: requireDictionaryString(payload.id, "id", context),
    latestVersionId: requireDictionaryString(
      payload.latest_version_id,
      "latest_version_id",
      context,
    ),
    latestVersionRulesNum: requireDictionaryRuleCount(
      payload.latest_version_rules_num,
      "latest_version_rules_num",
      context,
    ),
    name: requireDictionaryString(payload.name, "name", context),
    permissionOnResource: payload.permission_on_resource ?? null,
    createdBy: payload.created_by ?? null,
    creationTimeUnix: payload.creation_time_unix ?? null,
    archivedTimeUnix: archivedTime ?? null,
    description: payload.description ?? null,
  };
}

export async function createElevenLabsPronunciationDictionary({
  apiKey,
  name,
  description = null,
  rules,
}) {
  requireDictionaryString(name, "name", "Pronunciation dictionary request");
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error("Pronunciation dictionary requires at least one rule");
  }
  const normalizedRules = rules.map(normalizePronunciationDictionaryRule);
  const seenStrings = new Set();
  for (const rule of normalizedRules) {
    if (seenStrings.has(rule.string_to_replace)) {
      throw new Error(
        `Duplicate pronunciation dictionary rule: ${rule.string_to_replace}`,
      );
    }
    seenStrings.add(rule.string_to_replace);
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
        name,
        ...(description === null ? {} : { description }),
        rules: normalizedRules,
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
  const result = {
    id: requireDictionaryString(
      payload.id,
      "id",
      "Pronunciation dictionary creation",
    ),
    versionId: requireDictionaryString(
      payload.version_id,
      "version_id",
      "Pronunciation dictionary creation",
    ),
    versionRulesNum: requireDictionaryRuleCount(
      payload.version_rules_num,
      "version_rules_num",
      "Pronunciation dictionary creation",
    ),
    name: requireDictionaryString(
      payload.name,
      "name",
      "Pronunciation dictionary creation",
    ),
    description: payload.description ?? null,
  };
  if (result.name !== name) {
    throw new Error("Pronunciation dictionary creation returned another name");
  }
  if (result.versionRulesNum !== normalizedRules.length) {
    throw new Error(
      "Pronunciation dictionary creation returned an unexpected rule count",
    );
  }
  return result;
}

export async function archiveElevenLabsPronunciationDictionary({
  apiKey,
  pronunciationDictionaryId,
}) {
  requireDictionaryString(
    pronunciationDictionaryId,
    "pronunciationDictionaryId",
    "Pronunciation dictionary archive request",
  );
  const response = await fetch(
    `https://api.elevenlabs.io/v1/pronunciation-dictionaries/${encodeURIComponent(pronunciationDictionaryId)}`,
    {
      method: "PATCH",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ archived: true }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      "ElevenLabs pronunciation dictionary archive failed",
      response,
      JSON.stringify(payload).slice(0, 300),
    );
  }
  const result = normalizeDictionaryMetadata(
    payload,
    "Pronunciation dictionary archive",
  );
  if (result.id !== pronunciationDictionaryId) {
    throw new Error("Pronunciation dictionary archive returned another id");
  }
  if (result.archivedTimeUnix === null) {
    throw new Error(
      "Pronunciation dictionary archive response has no archived_time_unix",
    );
  }
  return result;
}

export async function listElevenLabsPronunciationDictionaries({
  apiKey,
  exactName = null,
}) {
  if (exactName !== null) {
    requireDictionaryString(
      exactName,
      "exactName",
      "Pronunciation dictionary list request",
    );
  }
  const pronunciationDictionaries = [];
  const seenCursors = new Set();
  let cursor = null;
  let pageCount = 0;
  while (true) {
    const url = new URL(
      "https://api.elevenlabs.io/v1/pronunciation-dictionaries",
    );
    url.searchParams.set("page_size", "100");
    url.searchParams.set("sort", "name");
    url.searchParams.set("sort_direction", "ascending");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw createHttpError(
        "ElevenLabs pronunciation dictionary list failed",
        response,
        JSON.stringify(payload).slice(0, 300),
      );
    }
    if (!Array.isArray(payload.pronunciation_dictionaries)) {
      throw new Error(
        "Pronunciation dictionary list returned no pronunciation_dictionaries",
      );
    }
    if (typeof payload.has_more !== "boolean") {
      throw new Error(
        "Pronunciation dictionary list returned invalid has_more",
      );
    }
    pageCount += 1;
    for (const dictionary of payload.pronunciation_dictionaries) {
      const normalized = normalizeDictionaryMetadata(
        dictionary,
        "Pronunciation dictionary list",
      );
      if (exactName === null || normalized.name === exactName) {
        pronunciationDictionaries.push(normalized);
      }
    }
    if (!payload.has_more) break;
    const nextCursor = requireDictionaryString(
      payload.next_cursor,
      "next_cursor",
      "Pronunciation dictionary list",
    );
    if (seenCursors.has(nextCursor)) {
      throw new Error("Pronunciation dictionary list repeated its cursor");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  return { pronunciationDictionaries, pageCount };
}
export async function transcribeElevenLabsScribe({
  apiKey,
  audioPath,
  languageCode,
}) {
  const bytes = await readFile(audioPath);
  const extension = path.extname(audioPath).toLocaleLowerCase("en-US");
  const mimeType =
    extension === ".wav"
      ? "audio/wav"
      : extension === ".mp3"
        ? "audio/mpeg"
        : "application/octet-stream";
  const form = new FormData();
  form.set("model_id", "scribe_v2");
  form.set("language_code", languageCode);
  form.set(
    "file",
    new Blob([bytes], { type: mimeType }),
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
