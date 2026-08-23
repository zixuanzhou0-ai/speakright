import assert from "node:assert/strict";
import {
  buildDictionaryWordPrompt,
  buildVertexTtsRequest,
  VERTEX_GEMINI_TTS_LOCATION,
  VERTEX_GEMINI_TTS_MODEL,
} from "./vertex-gemini-tts-client.mjs";

assert.equal(VERTEX_GEMINI_TTS_MODEL, "gemini-3.1-flash-tts-preview");
assert.equal(VERTEX_GEMINI_TTS_LOCATION, "global");

const prompt = buildDictionaryWordPrompt({
  languageId: "fr-FR",
  text: "nez",
  variant: "A",
});
assert.match(prompt, /<word>nez<\/word>/u);
assert.match(prompt, /only the content/u);

const request = buildVertexTtsRequest({
  languageId: "ru-RU",
  text: "дом",
  voiceName: "Charon",
  variant: "B",
});
assert.equal(request.generation_config.speech_config.language_code, "ru-ru");
assert.equal(
  request.generation_config.speech_config.voice_config.prebuilt_voice_config
    .voice_name,
  "charon",
);
assert.equal(request.contents.role, "user");
assert.equal(JSON.stringify(request).includes("apiKey"), false);
assert.equal(JSON.stringify(request).includes("accessToken"), false);

console.log("Vertex Gemini TTS client contract passed");
