#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertFrenchReferenceProposalCommand,
  buildFrenchReferenceDecisionProposal,
} from "./lib/french-reference-decision-proposal-core.mjs";
import { buildKaikkiReferencePlan } from "./lib/kaikki-reference-enrichment-core.mjs";
import {
  assertSafeAuditInputPath,
  assertSafeReferenceOutputDir,
  buildLexiqueReferencePlan,
} from "./lib/lexique-reference-enrichment-core.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_ROOT = path.join(AUDIT_ROOT, "reference-sources");
const REGENERATION_ROOT = path.join(AUDIT_ROOT, "regenerated-candidates");

function defaultOptions() {
  return {
    command: "build",
    basePlan: path.join(REGENERATION_ROOT, "regeneration-plan.json"),
    thirdPlan: path.join(REGENERATION_ROOT, "third-round-plan.json"),
    inventory: path.join(AUDIT_ROOT, "inventory.json"),
    lexiquePlan: path.join(REFERENCE_ROOT, "lexique", "plan.json"),
    lexiqueObservations: path.join(
      REFERENCE_ROOT,
      "lexique",
      "observations.json",
    ),
    kaikkiPlan: path.join(REFERENCE_ROOT, "kaikki", "plan.json"),
    kaikkiObservations: path.join(
      REFERENCE_ROOT,
      "kaikki",
      "observations.json",
    ),
    outputDir: path.join(REFERENCE_ROOT, "french-decisions"),
  };
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return path.resolve(value);
}

function parseArgs(argv) {
  const options = defaultOptions();
  options.command = argv[0] ?? options.command;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base-plan") {
      options.basePlan = takeValue(argv, index, argument);
    } else if (argument === "--third-plan") {
      options.thirdPlan = takeValue(argv, index, argument);
    } else if (argument === "--inventory") {
      options.inventory = takeValue(argv, index, argument);
    } else if (argument === "--lexique-plan") {
      options.lexiquePlan = takeValue(argv, index, argument);
    } else if (argument === "--lexique-observations") {
      options.lexiqueObservations = takeValue(argv, index, argument);
    } else if (argument === "--kaikki-plan") {
      options.kaikkiPlan = takeValue(argv, index, argument);
    } else if (argument === "--kaikki-observations") {
      options.kaikkiObservations = takeValue(argv, index, argument);
    } else if (argument === "--output-dir") {
      options.outputDir = takeValue(argv, index, argument);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
    index += 1;
  }
  assertFrenchReferenceProposalCommand(options.command);
  for (const key of [
    "basePlan",
    "thirdPlan",
    "inventory",
    "lexiquePlan",
    "lexiqueObservations",
    "kaikkiPlan",
    "kaikkiObservations",
  ]) {
    options[key] = assertSafeAuditInputPath(options[key]);
  }
  options.outputDir = assertSafeReferenceOutputDir(options.outputDir);
  return options;
}

async function readWithDigest(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    json: JSON.parse(buffer.toString("utf8")),
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function uniqueSorted(values, locale = "en") {
  return [
    ...new Set(
      values.filter(
        (value) => value !== undefined && value !== null && value !== "",
      ),
    ),
  ].sort((left, right) => String(left).localeCompare(String(right), locale));
}

function validateStrictQueue(basePlan, thirdPlan) {
  if ((basePlan.sourceAssets ?? []).length !== basePlan.sourceAssetCount) {
    throw new Error("Base plan source asset count does not match its entries");
  }
  if (thirdPlan.basePlanSha256 !== basePlan.planSha256) {
    throw new Error(
      "Third-round plan does not reference the current base plan",
    );
  }
  if ((thirdPlan.blocked ?? []).length !== thirdPlan.blockedCount) {
    throw new Error("Third-round blocked count does not match its entries");
  }
  if ((thirdPlan.candidates ?? []).length !== thirdPlan.candidateCount) {
    throw new Error("Third-round candidate count does not match its entries");
  }
  const sourceAssetIds = (thirdPlan.blocked ?? []).map(
    (entry) => entry.sourceAssetId,
  );
  if (new Set(sourceAssetIds).size !== sourceAssetIds.length) {
    throw new Error("Third-round blocked source asset IDs must be unique");
  }
  const baseIds = new Set(
    (basePlan.sourceAssets ?? []).map((asset) => asset.sourceAssetId),
  );
  const missing = sourceAssetIds.filter(
    (sourceAssetId) => !baseIds.has(sourceAssetId),
  );
  if (missing.length > 0) {
    throw new Error(
      `Third-round assets are missing from the base plan: ${missing.join(", ")}`,
    );
  }
  return sourceAssetIds;
}

function validateObservationInputs({
  currentLexiquePlan,
  lexiquePlan,
  lexiqueObservations,
  currentKaikkiPlan,
  kaikkiPlan,
  kaikkiObservations,
}) {
  if (lexiquePlan.planSha256 !== currentLexiquePlan.planSha256) {
    throw new Error(
      "Lexique plan is stale. Rebuild and reparse it from the current strict queue.",
    );
  }
  if (lexiqueObservations.planSha256 !== currentLexiquePlan.planSha256) {
    throw new Error(
      "Lexique observations are stale. Reparse them from the current plan.",
    );
  }
  if (
    lexiqueObservations.publisherId !== "lexique" ||
    lexiqueObservations.independenceGroup !== "lexique"
  ) {
    throw new Error("Lexique observation document provenance is invalid");
  }
  if (kaikkiPlan.planSha256 !== currentKaikkiPlan.planSha256) {
    throw new Error(
      "Kaikki plan is stale. Rebuild and reparse it from the current strict queue.",
    );
  }
  if (kaikkiObservations.planSha256 !== currentKaikkiPlan.planSha256) {
    throw new Error(
      "Kaikki observations are stale. Reparse them from the current plan.",
    );
  }
}

function enrichStrictItems(items, sourceAssets, inventoryAssets) {
  const assetById = new Map(
    sourceAssets.map((asset) => [asset.sourceAssetId, asset]),
  );
  const inventoryById = new Map(
    inventoryAssets.map((asset) => [asset.assetId, asset]),
  );
  return items.map((item) => {
    const scopedAssets = item.sourceAssetIds.map((sourceAssetId) => {
      const source = assetById.get(sourceAssetId);
      const inventory = inventoryById.get(sourceAssetId);
      if (!source || !inventory) {
        throw new Error(`Strict source asset is missing: ${sourceAssetId}`);
      }
      if (source.sourceSha256 !== inventory.sha256) {
        throw new Error(`Strict source asset SHA is stale: ${sourceAssetId}`);
      }
      return { source, inventory };
    });
    return {
      ...item,
      referenceStatuses: uniqueSorted(
        scopedAssets.map(({ source }) => source.referenceStatus),
      ),
      relationshipKinds: uniqueSorted(
        scopedAssets.flatMap(({ inventory }) =>
          (inventory.pageRelations ?? []).map(
            (relationship) => relationship.relationshipKind,
          ),
        ),
      ),
    };
  });
}

function singleLexiqueDatasetSha(observations) {
  const values = uniqueSorted(
    (observations.entries ?? []).map((entry) => entry.source?.datasetSha256),
  );
  if (values.length > 1) {
    throw new Error("Lexique observations contain multiple dataset hashes");
  }
  return values[0] ?? null;
}

function markdownCell(value) {
  const text = Array.isArray(value) ? value.join(" / ") : String(value ?? "");
  return text.replace(/\|/gu, "\\|").replace(/[\r\n]+/gu, " ");
}

function buildMarkdownReport(result) {
  const reasonRows = Object.entries(result.summary.byBlockedReason).map(
    ([reason, counts]) =>
      `| ${markdownCell(reason)} | ${counts.wordCount} | ${counts.assetCount} |`,
  );
  const wordRows = result.wordSummary.entries.map(
    (entry) =>
      `| ${markdownCell(entry.text)} | ${entry.assetCount} | ${markdownCell(entry.outcome)} | ${markdownCell(entry.normalizedProjectIpas)} | ${markdownCell(entry.lexiqueNormalizedIpas)} | ${markdownCell(entry.kaikkiNormalizedIpas)} | ${markdownCell(entry.reasons)} |`,
  );
  return `${[
    "# French reference decision proposals",
    "",
    "> Review artifact only. This report does not mutate the formal reference ledger, generate audio, or authorize promotion.",
    "",
    `- Proposal SHA-256: \`${result.summary.proposalSha256}\``,
    `- Strict queue assets: ${result.summary.strictQueueSourceAssetCount}`,
    `- French words/assets: ${result.summary.frenchWordCount} / ${result.summary.frenchSourceAssetCount}`,
    `- Proposed words/assets: ${result.summary.proposedWordCount} / ${result.summary.proposedAssetCount}`,
    `- Blocked words/assets: ${result.summary.blockedWordCount} / ${result.summary.blockedAssetCount}`,
    "- Network requests / paid calls / formal ledger writes / formal audio writes: 0 / 0 / 0 / 0",
    "",
    "## Blocked reasons",
    "",
    "| Reason | Words | Assets |",
    "| --- | ---: | ---: |",
    ...reasonRows,
    "",
    "## Per-word summary",
    "",
    "| Word | Assets | Outcome | Project IPA | Lexique IPA | Kaikki IPA | Blocked reasons |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...wordRows,
    "",
  ].join("\n")}\n`;
}

async function atomicWrite(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, filePath);
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [
    base,
    third,
    inventory,
    lexiquePlan,
    lexiqueObservations,
    kaikkiPlan,
    kaikkiObservations,
  ] = await Promise.all([
    readWithDigest(options.basePlan),
    readWithDigest(options.thirdPlan),
    readWithDigest(options.inventory),
    readWithDigest(options.lexiquePlan),
    readWithDigest(options.lexiqueObservations),
    readWithDigest(options.kaikkiPlan),
    readWithDigest(options.kaikkiObservations),
  ]);

  const unresolvedSourceAssetIds = validateStrictQueue(base.json, third.json);
  const currentLexiquePlan = buildLexiqueReferencePlan({
    sourceAssets: base.json.sourceAssets,
    unresolvedSourceAssetIds,
  });
  const currentKaikkiPlan = buildKaikkiReferencePlan({
    sourceAssets: base.json.sourceAssets,
    unresolvedSourceAssetIds,
  });
  validateObservationInputs({
    currentLexiquePlan,
    lexiquePlan: lexiquePlan.json,
    lexiqueObservations: lexiqueObservations.json,
    currentKaikkiPlan,
    kaikkiPlan: kaikkiPlan.json,
    kaikkiObservations: kaikkiObservations.json,
  });

  const result = buildFrenchReferenceDecisionProposal({
    strictQueueSourceAssetCount: currentLexiquePlan.strictQueueSourceAssetCount,
    strictItems: enrichStrictItems(
      currentLexiquePlan.items,
      base.json.sourceAssets,
      inventory.json.assets ?? [],
    ),
    lexiqueObservations: lexiqueObservations.json,
    kaikkiObservations: kaikkiObservations.json,
    inputDigests: {
      basePlanSha256: base.json.planSha256,
      basePlanFileSha256: base.sha256,
      thirdPlanSha256: third.json.thirdPlanSha256,
      thirdPlanFileSha256: third.sha256,
      inventoryFileSha256: inventory.sha256,
      lexiquePlanSha256: currentLexiquePlan.planSha256,
      lexiquePlanFileSha256: lexiquePlan.sha256,
      lexiqueObservationsFileSha256: lexiqueObservations.sha256,
      lexiqueDatasetSha256: singleLexiqueDatasetSha(lexiqueObservations.json),
      kaikkiPlanSha256: currentKaikkiPlan.planSha256,
      kaikkiPlanFileSha256: kaikkiPlan.sha256,
      kaikkiObservationsFileSha256: kaikkiObservations.sha256,
    },
  });
  if (!result.summary.invariant) {
    throw new Error("Proposal partition invariant failed");
  }

  await Promise.all([
    atomicWriteJson(
      path.join(options.outputDir, "summary.json"),
      result.summary,
    ),
    atomicWriteJson(
      path.join(options.outputDir, "decision-proposals.json"),
      result.proposals,
    ),
    atomicWriteJson(
      path.join(options.outputDir, "blocked.json"),
      result.blocked,
    ),
    atomicWriteJson(
      path.join(options.outputDir, "word-summary.json"),
      result.wordSummary,
    ),
    atomicWrite(
      path.join(options.outputDir, "report.md"),
      buildMarkdownReport(result),
    ),
  ]);

  console.log(
    JSON.stringify(
      {
        outputDir: options.outputDir,
        strictQueueSourceAssetCount: result.summary.strictQueueSourceAssetCount,
        frenchWordCount: result.summary.frenchWordCount,
        frenchSourceAssetCount: result.summary.frenchSourceAssetCount,
        proposedWordCount: result.summary.proposedWordCount,
        proposedAssetCount: result.summary.proposedAssetCount,
        blockedWordCount: result.summary.blockedWordCount,
        blockedAssetCount: result.summary.blockedAssetCount,
        proposalSha256: result.summary.proposalSha256,
        networkRequestsMade: 0,
        paidCallsMade: 0,
        formalLedgerWrites: 0,
        formalAudioWrites: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
