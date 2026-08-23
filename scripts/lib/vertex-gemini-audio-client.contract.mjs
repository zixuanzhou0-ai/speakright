import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlindAudioPrompt,
  buildBlindAudioRequest,
  VERTEX_GEMINI_AUDIO_LOCATION,
  VERTEX_GEMINI_AUDIO_MODEL,
} from "./vertex-gemini-audio-client.mjs";

test("Vertex audio listener uses the locked global Gemini model", () => {
  assert.equal(VERTEX_GEMINI_AUDIO_MODEL, "gemini-3.1-pro-preview");
  assert.equal(VERTEX_GEMINI_AUDIO_LOCATION, "global");
});

test("blind audio request contains language and bytes but no expected answer", () => {
  const request = buildBlindAudioRequest({
    languageId: "en-US",
    audioBase64: "ZmFrZS1hdWRpbw==",
  });
  const serialized = JSON.stringify(request);
  assert.match(serialized, /en-US/u);
  assert.match(serialized, /ZmFrZS1hdWRpbw==/u);
  assert.doesNotMatch(serialized, /seven|expectedIpa|targetUnits/u);
  assert.match(buildBlindAudioPrompt("fr-FR"), /fr-FR/u);
});
