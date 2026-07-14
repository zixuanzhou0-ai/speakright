import assert from "node:assert/strict";
import test from "node:test";
import { parseAzurePronunciationResponse } from "./lib/azure-pronunciation-client.mjs";
import {
  arpabetPronunciationToIpa,
  compareProjectIpaToCmu,
  parseCmuDict,
} from "./lib/cmudict-reference.mjs";
import {
  assertNonCDrivePath,
  buildPronunciationInventory,
  compareTranscript,
  EXPECTED_CANONICAL_ASSET_COUNT,
  normalizeAuditText,
  redactSecrets,
} from "./lib/pronunciation-audit-core.mjs";
import {
  assertRegenerationProviderAllowed,
  selectRegenerationProvider,
} from "./lib/tts-provider-policy.mjs";

test("Whisper model and cache paths reject C drive", () => {
  assert.throws(() => assertNonCDrivePath("C:\\models\\whisper"), /C drive/);
  assert.match(assertNonCDrivePath("D:\\AI\\models\\whisper"), /^D:\\/i);
});

test("multilingual transcript normalization is conservative", () => {
  assert.equal(normalizeAuditText("Hello, WORLD!", "en-US"), "hello world");
  assert.equal(normalizeAuditText("Ёлка", "ru-RU"), "елка");
  assert.equal(compareTranscript("bonjour", "Bonjour.", "fr-FR"), "exact");
  assert.equal(
    compareTranscript("À demain.", "A demain.", "fr-FR"),
    "orthographic-variant",
  );
  assert.equal(compareTranscript("cup", "coffee", "en-US"), "mismatch");
});

test("CMUdict mapping remains advisory and preserves variants", () => {
  const dictionary = parseCmuDict(
    "ship SH IH1 P\nread R IY1 D\nread(2) R EH1 D\n",
  );
  assert.deepEqual(dictionary.get("read"), ["R IY1 D", "R EH1 D"]);
  assert.equal(arpabetPronunciationToIpa("SH IH1 P"), "ʃɪp");
  assert.equal(
    compareProjectIpaToCmu("/ʃɪp/", dictionary.get("ship")).status,
    "cmudict-segment-match",
  );
  assert.equal(
    compareProjectIpaToCmu("/ʃiːp/", dictionary.get("ship")).status,
    "cmudict-conflict-needs-review",
  );
});
test("secret redaction removes credential fields and suspicious long values", () => {
  const result = redactSecrets({
    subscriptionKey: "secret",
    nested: { authorization: "Bearer token" },
    unknown: "A".repeat(64),
    safe: "short-value",
    sha256: "a".repeat(64),
  });
  assert.equal(result.subscriptionKey, "[REDACTED]");
  assert.equal(result.nested.authorization, "[REDACTED]");
  assert.equal(result.unknown, "[REDACTED-LONG-VALUE]");
  assert.equal(result.safe, "short-value");
  assert.equal(result.sha256, "a".repeat(64));
});

test("inventory covers every canonical desktop asset and browser copy", () => {
  const inventory = buildPronunciationInventory(process.cwd());
  assert.equal(inventory.assetCount, EXPECTED_CANONICAL_ASSET_COUNT);
  assert.equal(inventory.issues.length, 0);
  assert.deepEqual(inventory.untrackedAudio, []);
  assert.deepEqual(inventory.missingPhysical, []);
  assert.ok(
    inventory.assets.every(
      (asset) => !asset.issues.includes("platform-hash-mismatch"),
    ),
  );
});

const azureFixture = {
  RecognitionStatus: "Success",
  NBest: [
    {
      Display: "ship",
      PronunciationAssessment: {
        PronScore: 88,
        AccuracyScore: 87,
        CompletenessScore: 100,
        FluencyScore: 90,
        ProsodyScore: 75,
      },
      Words: [
        {
          Word: "ship",
          PronunciationAssessment: { AccuracyScore: 87, ErrorType: "None" },
          Phonemes: [
            {
              Phoneme: "ʃ",
              PronunciationAssessment: {
                AccuracyScore: 90,
                NBestPhonemes: [{ Phoneme: "ʃ", Score: 90 }],
              },
            },
          ],
        },
      ],
    },
  ],
};

test("Azure parser preserves en-US phonemes but never invents them for other locales", () => {
  const english = parseAzurePronunciationResponse(azureFixture, "en-US");
  const spanish = parseAzurePronunciationResponse(azureFixture, "es-ES");
  assert.equal(english.words[0].phonemes[0].phoneme, "ʃ");
  assert.equal(english.prosodyScore, 75);
  assert.equal(spanish.words[0].phonemes, undefined);
  assert.equal(spanish.prosodyScore, null);
});

test("Vortex Gemini fallback is explicit and English-only", () => {
  assert.equal(
    selectRegenerationProvider({
      languageId: "en-US",
      estimatedCharacters: 200,
      elevenLabsRemainingCharacters: 100,
      safetyReserveCharacters: 50,
      vortexConfigured: true,
    }).providerId,
    "vortex-gemini-3.1-tts",
  );
  assert.equal(
    selectRegenerationProvider({
      languageId: "fr-FR",
      estimatedCharacters: 200,
      elevenLabsRemainingCharacters: 100,
      safetyReserveCharacters: 50,
      vortexConfigured: true,
    }).status,
    "blocked-insufficient-elevenlabs-non-english",
  );
  assert.throws(
    () => assertRegenerationProviderAllowed("vortex-gemini-3.1-tts", "ru-RU"),
    /only for en-US/,
  );
});
