#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { transcribeElevenLabsScribe } from "./lib/elevenlabs-audio-clients.mjs";

const outputRoot = path.resolve(
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
  "contract-temp",
);
const wavPath = path.join(
  outputRoot,
  "97b2173f-7dbd-4eb7-8a58-ff78d0fe901a.wav",
);
mkdirSync(outputRoot, { recursive: true });
writeFileSync(wavPath, Buffer.from("RIFF-anonymous-contract-fixture"));

const originalFetch = globalThis.fetch;
let requestCapture = null;
globalThis.fetch = async (url, options) => {
  requestCapture = { url: String(url), options };
  return new Response(
    JSON.stringify({
      text: "robe",
      language_code: "fr",
      language_probability: 0.99,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "request-id": "test" },
    },
  );
};

try {
  const result = await transcribeElevenLabsScribe({
    apiKey: "contract-placeholder-key",
    audioPath: wavPath,
    languageCode: "fr",
  });
  assert.equal(result.text, "robe");
  assert.equal(
    requestCapture.url,
    "https://api.elevenlabs.io/v1/speech-to-text",
  );
  const form = requestCapture.options.body;
  assert.deepEqual([...form.keys()].sort(), [
    "file",
    "language_code",
    "model_id",
  ]);
  assert.equal(form.get("model_id"), "scribe_v2");
  assert.equal(form.get("language_code"), "fr");
  const file = form.get("file");
  assert.equal(file.name, path.basename(wavPath));
  assert.equal(file.type, "audio/wav");
  assert.equal([...form.keys()].includes("keyterms"), false);
  assert.equal(JSON.stringify([...form.entries()]).includes("robe"), false);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        assertions: 10,
        networkCallsPerformed: false,
        submittedFilename: file.name,
        submittedMimeType: file.type,
      },
      null,
      2,
    ),
  );
} finally {
  globalThis.fetch = originalFetch;
  rmSync(outputRoot, { recursive: true, force: true });
}
