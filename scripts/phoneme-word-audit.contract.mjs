import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildAzureSttUrl,
  parseAzureSttResponse,
} from "./lib/azure-stt-client.mjs";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import {
  applyGoldPronunciationDecisions,
  assertLoopbackUrl,
  buildBlindConsensus,
  buildBlindListenerPrompt,
  buildGeminiBlindRequest,
  buildGoldPronunciations,
  buildPhonemeWordAuditInventory,
  classifyBlindTranscript,
  createBlindReviewQueue,
  EXPECTED_ANCHOR_ASSET_COUNT,
  EXPECTED_PHONEME_PAGE_ASSET_COUNT,
  EXPECTED_WORD_BEARING_ASSET_COUNT,
  isWordBearingAuditAsset,
  levenshteinDistance,
} from "./lib/phoneme-word-audit-core.mjs";
import { buildPronunciationInventory } from "./lib/pronunciation-audit-core.mjs";

const root = process.cwd();
const baseInventory = buildPronunciationInventory(root);
const signalRows = baseInventory.assets.map((asset) => ({
  sha256: asset.sha256,
  signal: { durationSeconds: 1 },
}));
const inventory = buildPhonemeWordAuditInventory(root, {
  baseInventory,
  signalRows,
});

test("phoneme-page audit inventory is exact and preserves page relationships", () => {
  assert.equal(inventory.assetCount, EXPECTED_PHONEME_PAGE_ASSET_COUNT);
  assert.equal(inventory.wordBearingCount, EXPECTED_WORD_BEARING_ASSET_COUNT);
  assert.equal(inventory.anchorCount, EXPECTED_ANCHOR_ASSET_COUNT);
  assert.equal(inventory.hardIssues.length, 0);
  assert.equal(
    new Set(inventory.assets.map((asset) => asset.publicPath)).size,
    inventory.assetCount,
  );
  assert.ok(inventory.assets.every((asset) => asset.phonemePageIds.length > 0));
  assert.equal(
    inventory.assets.filter(isWordBearingAuditAsset).length,
    EXPECTED_WORD_BEARING_ASSET_COUNT,
  );
});

test("voice gender semantics are language-specific and Russian slots are reversed", () => {
  const russianBlue = inventory.assets.find(
    (asset) => asset.languageId === "ru-RU" && asset.voiceSlot === "blue",
  );
  const russianPink = inventory.assets.find(
    (asset) => asset.languageId === "ru-RU" && asset.voiceSlot === "pink",
  );
  assert.equal(russianBlue.voiceGender, "feminine");
  assert.equal(russianPink.voiceGender, "masculine");
});

test("gold reference queue separates CMU evidence from second-source confirmation", () => {
  const entries = buildGoldPronunciations(inventory, loadCmuDictReference());
  assert.equal(
    entries.filter((entry) => entry.languageId === "en-US").length,
    760,
  );
  assert.ok(
    entries
      .filter((entry) => entry.languageId === "en-US")
      .every((entry) => entry.status !== "two-source-confirmed"),
  );
  const dust = entries.find(
    (entry) => entry.languageId === "en-US" && entry.text === "dust",
  );
  assert.equal(dust.canonicalIpa, "dʌst");
  assert.equal(dust.referenceStatus, "cmudict-conflict-needs-review");
});

test("reference decisions require two independent sources before confirmation", () => {
  const entries = buildGoldPronunciations(inventory, loadCmuDictReference());
  const base = entries.find(
    (entry) => entry.languageId === "en-US" && entry.text === "ship",
  );
  assert.throws(
    () =>
      applyGoldPronunciationDecisions(entries, {
        version: 1,
        entries: [
          {
            languageId: "en-US",
            text: "ship",
            canonicalIpa: "ʃɪp",
            status: "two-source-confirmed",
            sources: [{ name: "CMUdict", value: "ʃɪp" }],
          },
        ],
      }),
    /two independent sources/,
  );
  assert.throws(
    () =>
      applyGoldPronunciationDecisions(entries, {
        version: 1,
        entries: [
          {
            languageId: "en-US",
            text: "ship",
            canonicalIpa: "ʃɪp",
            status: "two-source-confirmed",
            sources: [
              {
                name: "Wiktionary en-US",
                independenceGroup: "wiktionary",
                value: "ʃɪp",
              },
              { name: "Kaikki", independenceGroup: "wiktionary", value: "ʃɪp" },
            ],
          },
        ],
      }),
    /two independent sources/,
  );
  const merged = applyGoldPronunciationDecisions(entries, {
    version: 1,
    revision: "test",
    entries: [
      {
        languageId: "en-US",
        text: "ship",
        canonicalIpa: "ʃɪp",
        status: "two-source-confirmed",
        sources: [
          { name: "CMUdict", value: "ʃɪp" },
          { name: "Wiktionary en-US", value: "ʃɪp" },
        ],
      },
    ],
  });
  const decided = merged.find(
    (entry) => entry.languageId === "en-US" && entry.text === "ship",
  );
  assert.equal(base.status, "needs-native-review");
  assert.equal(decided.status, "two-source-confirmed");
  assert.equal(decided.decisionLedgerRevision, "test");
});

test("blind transcript classification accepts homophones without verifying spelling", () => {
  const groups = JSON.parse(
    readFileSync("scripts/data/phoneme-word-audit-homophones.json", "utf8"),
  ).groups;
  const cmu = loadCmuDictReference();
  assert.equal(
    classifyBlindTranscript({
      expected: "meet",
      actual: "meat",
      languageId: "en-US",
      homophoneGroups: groups,
      cmuReference: cmu,
    }),
    "accepted-homophone",
  );
  assert.equal(
    classifyBlindTranscript({
      expected: "ship",
      actual: "sheep",
      languageId: "en-US",
      homophoneGroups: groups,
      cmuReference: cmu,
    }),
    "different-word",
  );
});

test("machine consensus prioritizes agreement on the same wrong word", () => {
  const asset = {
    assetId: "asset",
    sha256: "sha",
    languageId: "en-US",
    text: "ship",
    role: "example-word",
    voiceGender: "feminine",
  };
  const consensus = buildBlindConsensus({
    asset,
    observations: {
      whisper: {
        heardText: "sheep",
        outcome: "different-word",
      },
      azureStt: {
        heardText: "sheep",
        outcome: "different-word",
      },
    },
  });
  assert.equal(consensus.category, "all-risk");
  assert.equal(consensus.sameAlternative, true);
  assert.equal(consensus.priority, "P0-human");
});

test("blind prompts and Azure URLs contain no expected answer or reference text", () => {
  const prompt = buildBlindListenerPrompt("en-US");
  assert.doesNotMatch(prompt, /ship|\/ʃɪp\//iu);
  const url = buildAzureSttUrl("switzerlandnorth", "en-US");
  assert.equal(url.searchParams.get("language"), "en-US");
  assert.equal(url.searchParams.has("referenceText"), false);
  const geminiRequest = buildGeminiBlindRequest({
    languageId: "en-US",
    model: "gemini-test",
    mimeType: "audio/mpeg",
    audioBase64: "AAECAw==",
  });
  assert.doesNotMatch(JSON.stringify(geminiRequest), /ship|\/ʃɪp\//iu);
  assert.match(
    geminiRequest.messages[0].content[1].image_url.url,
    /^data:audio\/mpeg;base64,/u,
  );
});

test("Gemini proxy policy rejects non-loopback listeners", () => {
  assert.equal(
    assertLoopbackUrl("http://127.0.0.1:8888").hostname,
    "127.0.0.1",
  );
  assert.throws(() => assertLoopbackUrl("http://0.0.0.0:8888"), /loopback/);
  assert.throws(
    () => assertLoopbackUrl("http://192.168.1.20:8888"),
    /loopback/,
  );
  assert.throws(() => assertLoopbackUrl("https://127.0.0.1:8888"), /loopback/);
});

test("review queue includes all assets plus deterministic five-percent repeats", () => {
  const queue = createBlindReviewQueue(inventory.assets);
  const repeats = queue.filter((item) => item.duplicateOf);
  assert.equal(queue.length, 4770);
  assert.equal(repeats.length, 227);
  assert.equal(new Set(queue.map((item) => item.reviewId)).size, queue.length);
  assert.deepEqual(queue, createBlindReviewQueue(inventory.assets));
});

test("Azure blind STT parser preserves transcript but has no pronunciation score", () => {
  const parsed = parseAzureSttResponse({
    RecognitionStatus: "Success",
    NBest: [{ Display: "Ship.", Lexical: "ship", Confidence: 0.98 }],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.recognizedText, "Ship.");
  assert.equal("pronScore" in parsed, false);
});

test("IPA edit distance is deterministic", () => {
  assert.equal(levenshteinDistance("ʃɪp", "ʃi p".replace(" ", "")), 1);
  assert.equal(levenshteinDistance("dʌst", "dʌst"), 0);
});
