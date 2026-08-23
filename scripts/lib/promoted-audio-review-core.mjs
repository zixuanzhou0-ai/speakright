import { createHash } from "node:crypto";

export const EXPECTED_PROMOTED_REVIEW_ASSET_COUNT = 64;
export const PROMOTED_REVIEW_DUPLICATE_RATE = 0.05;
export const EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE = {
  "en-US": 4,
  "es-ES": 20,
  "fr-FR": 32,
  "ru-RU": 8,
};
export const PROMOTED_HUMAN_OUTCOMES = [
  "heard-target",
  "heard-variant",
  "heard-different-word",
  "audio-quality-issue",
  "uncertain",
];

const CONFIRMED_REFERENCE_STATUSES = new Set([
  "two-source-confirmed",
  "variant-confirmed",
]);
const ALLOWED_LANGUAGES = new Set(
  Object.keys(EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE),
);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createPromotedReviewQueue(
  assets,
  duplicateRate = PROMOTED_REVIEW_DUPLICATE_RATE,
) {
  const primary = assets
    .map((asset) => ({
      reviewId: digest(`primary:${asset.assetId}`).slice(0, 24),
      assetId: asset.assetId,
      duplicateOf: null,
    }))
    .sort((left, right) =>
      digest(`order:${left.reviewId}`).localeCompare(
        digest(`order:${right.reviewId}`),
      ),
    );
  const duplicateCount = Math.round(assets.length * duplicateRate);
  const minimumGap = Math.min(12, Math.max(1, Math.floor(assets.length / 4)));
  const totalReviewItems = primary.length + duplicateCount;
  const selectedAssetIds = new Set();
  const selected = Array.from({ length: duplicateCount }, (_, index) => {
    const insertionIndex = Math.floor(
      ((index + 1) * totalReviewItems) / (duplicateCount + 1),
    );
    const earlierInsertions = index;
    const maximumPrimaryIndex = Math.max(
      0,
      insertionIndex - minimumGap - earlierInsertions,
    );
    const item = primary
      .slice(0, maximumPrimaryIndex + 1)
      .filter((candidate) => !selectedAssetIds.has(candidate.assetId))
      .sort((left, right) =>
        digest(`duplicate:${index}:${left.assetId}`).localeCompare(
          digest(`duplicate:${index}:${right.assetId}`),
        ),
      )[0];
    if (!item) throw new Error("Unable to place hidden repeat safely");
    selectedAssetIds.add(item.assetId);
    return {
      insertionIndex,
      item: {
        reviewId: digest(`repeat:${item.assetId}`).slice(0, 24),
        assetId: item.assetId,
        duplicateOf: item.reviewId,
      },
    };
  });
  const queue = [...primary];
  for (const repeated of selected) {
    queue.splice(repeated.insertionIndex, 0, repeated.item);
  }
  for (const { item: repeated } of selected) {
    const originalIndex = queue.findIndex(
      (item) => item.reviewId === repeated.duplicateOf,
    );
    const repeatedIndex = queue.findIndex(
      (item) => item.reviewId === repeated.reviewId,
    );
    if (repeatedIndex - originalIndex < minimumGap) {
      throw new Error(`Hidden repeat gap is too small: ${repeated.assetId}`);
    }
  }
  return queue;
}

export function promotedReviewBundleDigest(bundle) {
  return digest(
    JSON.stringify({
      version: bundle.version,
      assets: bundle.assets.map((asset) => ({
        assetId: asset.assetId,
        candidateId: asset.candidateId,
        sha256: asset.sha256,
      })),
      queue: bundle.queue,
    }),
  );
}

export function buildPromotedReviewBundle({ plan, ledger, selection }) {
  if (ledger.replacementCount !== EXPECTED_PROMOTED_REVIEW_ASSET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PROMOTED_REVIEW_ASSET_COUNT} promoted assets, received ${ledger.replacementCount}`,
    );
  }
  if (
    !Array.isArray(ledger.replacements) ||
    ledger.replacements.length !== EXPECTED_PROMOTED_REVIEW_ASSET_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_PROMOTED_REVIEW_ASSET_COUNT} replacement rows`,
    );
  }
  const sourceById = new Map(
    plan.sourceAssets.map((source) => [source.sourceAssetId, source]),
  );
  const selectedById = new Map(
    selection.selected.map((candidate) => [candidate.candidateId, candidate]),
  );
  const assets = ledger.replacements
    .map((replacement) => {
      const source = sourceById.get(replacement.sourceAssetId);
      const candidate = selectedById.get(replacement.candidateId);
      if (!source) {
        throw new Error(`Missing source ${replacement.sourceAssetId}`);
      }
      if (!candidate || candidate.sourceAssetId !== source.sourceAssetId) {
        throw new Error(
          `Missing selected candidate ${replacement.candidateId}`,
        );
      }
      if (candidate.status !== "machine-passed") {
        throw new Error(`Candidate ${candidate.candidateId} did not pass`);
      }
      if (candidate.candidateSha256 !== replacement.newSha256) {
        throw new Error(`Candidate SHA mismatch for ${candidate.candidateId}`);
      }
      if (replacement.status !== "machine-replaced-pending-human") {
        throw new Error(
          `Unexpected replacement status for ${source.sourceAssetId}`,
        );
      }
      return {
        assetId: source.sourceAssetId,
        candidateId: candidate.candidateId,
        candidateLabel: candidate.label,
        sha256: replacement.newSha256,
        oldSha256: replacement.oldSha256,
        languageId: source.languageId,
        role: source.role,
        text: source.text,
        canonicalIpa: source.canonicalIpa,
        targetUnits: source.targetUnits,
        phonemePageIds: source.phonemePageIds,
        referenceStatus: source.referenceStatus,
        referenceSourceCount: source.referenceSourceCount,
        voiceId: source.voiceId,
        voiceName: source.voiceName,
        voiceGender: source.voiceGender,
        desktopPath: source.desktopPath,
        browserPath: source.browserPath,
        candidatePath: candidate.relativePath,
        machineStatus: replacement.status,
      };
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));

  if (new Set(assets.map((asset) => asset.assetId)).size !== assets.length) {
    throw new Error("Promoted review assets contain duplicate asset IDs");
  }
  if (assets.length !== EXPECTED_PROMOTED_REVIEW_ASSET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PROMOTED_REVIEW_ASSET_COUNT} promoted assets, received ${assets.length}`,
    );
  }
  const unexpectedLanguage = assets.find(
    (asset) => !ALLOWED_LANGUAGES.has(asset.languageId),
  );
  if (unexpectedLanguage) {
    throw new Error(
      `Unexpected promoted review language: ${unexpectedLanguage.languageId}`,
    );
  }
  const actualByLanguage = Object.fromEntries(
    Object.keys(EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE).map((languageId) => [
      languageId,
      assets.filter((asset) => asset.languageId === languageId).length,
    ]),
  );
  for (const [languageId, count] of Object.entries(
    EXPECTED_PROMOTED_REVIEW_BY_LANGUAGE,
  )) {
    if (actualByLanguage[languageId] !== count) {
      throw new Error(
        `Promoted review ${languageId}: expected ${count}, received ${actualByLanguage[languageId]}`,
      );
    }
  }
  const queue = createPromotedReviewQueue(
    assets,
    PROMOTED_REVIEW_DUPLICATE_RATE,
  );
  const bundle = {
    version: 1,
    assetCount: assets.length,
    duplicateCount: queue.filter((item) => item.duplicateOf).length,
    totalReviewItems: queue.length,
    assets,
    queue,
  };
  return { ...bundle, digest: promotedReviewBundleDigest(bundle) };
}

export function promotedBlindPayload({ asset, queueItem, blindDecision }) {
  return {
    reviewId: queueItem.reviewId,
    languageId: asset.languageId,
    duplicate: blindDecision ? Boolean(queueItem.duplicateOf) : false,
    phase: blindDecision ? "reveal" : "blind",
    blindDecision: blindDecision ?? null,
  };
}

export function resolvePromotedHumanStatus({
  humanOutcome,
  referenceStatus,
  languageId,
}) {
  if (!PROMOTED_HUMAN_OUTCOMES.includes(humanOutcome)) {
    throw new Error(`Invalid promoted human outcome: ${humanOutcome}`);
  }
  const referenceConfirmed = CONFIRMED_REFERENCE_STATUSES.has(referenceStatus);
  if (humanOutcome === "audio-quality-issue") return "audio-quality-fix";
  if (humanOutcome === "heard-target") {
    return referenceConfirmed ? "verified-auditory" : "needs-native-review";
  }
  if (humanOutcome === "heard-variant") {
    return referenceConfirmed ? "verified-variant" : "needs-native-review";
  }
  if (humanOutcome === "heard-different-word") {
    return languageId === "en-US" && referenceConfirmed
      ? "confirmed-audio-error"
      : "needs-native-review";
  }
  return "needs-native-review";
}
