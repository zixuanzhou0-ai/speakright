import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildPromotedReviewBundle,
  EXPECTED_PROMOTED_REVIEW_ASSET_COUNT,
  EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE,
  promotedBlindPayload,
  resolvePromotedHumanStatus,
} from "./lib/promoted-audio-review-core.mjs";

const root = process.cwd();
const output = path.resolve(
  root,
  "outputs/phoneme-word-auditory-audit-2026-07-14/regenerated-candidates",
);
const readJson = (name) =>
  JSON.parse(readFileSync(path.join(output, name), "utf8"));
const plan = readJson("regeneration-plan.json");
const ledger = readJson("promotion-ledger.json");
const selection = readJson("candidate-selection.json");
const bundle = buildPromotedReviewBundle({ plan, ledger, selection });

test("promoted review scope contains exactly 64 replacements and hidden repeats", () => {
  assert.equal(bundle.assetCount, EXPECTED_PROMOTED_REVIEW_ASSET_COUNT);
  assert.equal(bundle.duplicateCount, 3);
  assert.equal(bundle.totalReviewItems, 67);
  assert.match(bundle.digest, /^[a-f0-9]{64}$/u);
  assert.equal(new Set(bundle.assets.map((asset) => asset.sha256)).size, 64);
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE).map((languageId) => [
        languageId,
        bundle.assets.filter((asset) => asset.languageId === languageId).length,
      ]),
    ),
    EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE,
  );
});

test("hidden repeats occur only after their originals with a safe gap", () => {
  const repeatedIndexes = [];
  for (const repeated of bundle.queue.filter((item) => item.duplicateOf)) {
    const originalIndex = bundle.queue.findIndex(
      (item) => item.reviewId === repeated.duplicateOf,
    );
    const repeatedIndex = bundle.queue.findIndex(
      (item) => item.reviewId === repeated.reviewId,
    );
    assert.ok(originalIndex >= 0);
    assert.ok(repeatedIndex - originalIndex >= 12);
    repeatedIndexes.push(repeatedIndex);
  }
  assert.deepEqual(repeatedIndexes, [16, 33, 50]);
  assert.ok(repeatedIndexes.every((index) => index < bundle.assetCount));
});

test("bundle rejects count drift and unknown languages", () => {
  const missingReplacement = structuredClone(ledger);
  missingReplacement.replacements.pop();
  assert.throws(
    () =>
      buildPromotedReviewBundle({
        plan,
        ledger: missingReplacement,
        selection,
      }),
    /replacement rows/iu,
  );

  const unknownLanguagePlan = structuredClone(plan);
  const firstAssetId = ledger.replacements[0].sourceAssetId;
  unknownLanguagePlan.sourceAssets.find(
    (asset) => asset.sourceAssetId === firstAssetId,
  ).languageId = "de-DE";
  assert.throws(
    () =>
      buildPromotedReviewBundle({
        plan: unknownLanguagePlan,
        ledger,
        selection,
      }),
    /unexpected promoted review language/iu,
  );
});

test("blind payload contains no answer, IPA, target, path, or candidate identity", () => {
  const asset = bundle.assets[0];
  const queueItem = bundle.queue.find((item) => item.assetId === asset.assetId);
  const payload = promotedBlindPayload({ asset, queueItem });
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, new RegExp(asset.text, "iu"));
  assert.doesNotMatch(
    serialized,
    /ipa|target|path|candidate|sha256|gender|role|voice/iu,
  );
  assert.equal(payload.duplicate, false);
});

test("hidden duplicate identity is revealed only after blind submission", () => {
  const queueItem = bundle.queue.find((item) => item.duplicateOf);
  const asset = bundle.assets.find(
    (item) => item.assetId === queueItem.assetId,
  );
  assert.equal(promotedBlindPayload({ asset, queueItem }).duplicate, false);
  assert.equal(
    promotedBlindPayload({
      asset,
      queueItem,
      blindDecision: { heardText: "x" },
    }).duplicate,
    true,
  );
});

test("unresolved references cannot become verified-auditory", () => {
  for (const asset of bundle.assets) {
    assert.equal(asset.referenceStatus, "needs-native-review");
    assert.equal(
      resolvePromotedHumanStatus({
        humanOutcome: "heard-target",
        referenceStatus: asset.referenceStatus,
        languageId: asset.languageId,
      }),
      "needs-native-review",
    );
  }
});

test("confirmed English mismatch and audio quality have bounded statuses", () => {
  assert.equal(
    resolvePromotedHumanStatus({
      humanOutcome: "heard-different-word",
      referenceStatus: "two-source-confirmed",
      languageId: "en-US",
    }),
    "confirmed-audio-error",
  );
  assert.equal(
    resolvePromotedHumanStatus({
      humanOutcome: "audio-quality-issue",
      referenceStatus: "needs-native-review",
      languageId: "fr-FR",
    }),
    "audio-quality-fix",
  );
});
