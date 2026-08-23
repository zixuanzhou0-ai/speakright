#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildFrenchReferenceLedgerPlan } from "./lib/french-reference-ledger-plan-core.mjs";
import { buildReferenceLedgerApplication } from "./lib/reference-decision-ledger-apply-core.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_ROOT = path.join(AUDIT_ROOT, "reference-sources");
const FORMAL_LEDGER_PATH = path.join(
  PROJECT_ROOT,
  "scripts",
  "data",
  "phoneme-word-reference-decisions.json",
);

function defaultOptions() {
  return {
    command: "plan",
    expectedProposalSha256: null,
    proposalDir: path.join(REFERENCE_ROOT, "french-decisions"),
    basePlan: path.join(
      AUDIT_ROOT,
      "regenerated-candidates",
      "regeneration-plan.json",
    ),
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
    outputDir: path.join(REFERENCE_ROOT, "french-ledger-plan"),
  };
}

function assertWithin(root, candidate, label) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(label + " must remain under " + root);
  }
  return resolved;
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(flag + " requires a value");
  }
  return value;
}

function parseArgs(argv) {
  const options = defaultOptions();
  options.command = argv[0] ?? options.command;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = takeValue(argv, index, argument);
    if (argument === "--proposal-sha") {
      options.expectedProposalSha256 = value.toLowerCase();
    } else if (argument === "--proposal-dir") {
      options.proposalDir = value;
    } else if (argument === "--base-plan") {
      options.basePlan = value;
    } else if (argument === "--inventory") {
      options.inventory = value;
    } else if (argument === "--lexique-plan") {
      options.lexiquePlan = value;
    } else if (argument === "--lexique-observations") {
      options.lexiqueObservations = value;
    } else if (argument === "--kaikki-plan") {
      options.kaikkiPlan = value;
    } else if (argument === "--kaikki-observations") {
      options.kaikkiObservations = value;
    } else if (argument === "--output-dir") {
      options.outputDir = value;
    } else {
      throw new Error("Unknown argument: " + argument);
    }
    index += 1;
  }
  if (options.command !== "plan") {
    throw new Error("Only the read-only plan command is supported");
  }
  if (!/^[0-9a-f]{64}$/u.test(options.expectedProposalSha256 ?? "")) {
    throw new Error(
      "--proposal-sha is required as 64 lowercase hex characters",
    );
  }
  options.proposalDir = assertWithin(
    REFERENCE_ROOT,
    options.proposalDir,
    "Reviewed proposal directory",
  );
  for (const key of [
    "basePlan",
    "inventory",
    "lexiquePlan",
    "lexiqueObservations",
    "kaikkiPlan",
    "kaikkiObservations",
  ]) {
    options[key] = assertWithin(AUDIT_ROOT, options[key], key);
  }
  options.outputDir = assertWithin(
    REFERENCE_ROOT,
    options.outputDir,
    "French ledger plan output",
  );
  return options;
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJsonWithDigest(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    json: JSON.parse(buffer.toString("utf8")),
    sha256: digest(buffer),
  };
}

async function atomicWrite(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = filePath + "." + process.pid + ".tmp";
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, filePath);
}

function projectRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [
    reviewedSummary,
    reviewedProposals,
    reviewedBlocked,
    currentBasePlan,
    currentInventory,
    currentLexiquePlan,
    currentLexiqueObservations,
    currentKaikkiPlan,
    currentKaikkiObservations,
    currentLedger,
  ] = await Promise.all([
    readJsonWithDigest(path.join(options.proposalDir, "summary.json")),
    readJsonWithDigest(
      path.join(options.proposalDir, "decision-proposals.json"),
    ),
    readJsonWithDigest(path.join(options.proposalDir, "blocked.json")),
    readJsonWithDigest(options.basePlan),
    readJsonWithDigest(options.inventory),
    readJsonWithDigest(options.lexiquePlan),
    readJsonWithDigest(options.lexiqueObservations),
    readJsonWithDigest(options.kaikkiPlan),
    readJsonWithDigest(options.kaikkiObservations),
    readJsonWithDigest(FORMAL_LEDGER_PATH),
  ]);

  const result = buildFrenchReferenceLedgerPlan({
    reviewedSummary: reviewedSummary.json,
    reviewedProposals: reviewedProposals.json,
    reviewedBlocked: reviewedBlocked.json,
    expectedProposalSha256: options.expectedProposalSha256,
    currentBasePlan: currentBasePlan.json,
    currentInventory: currentInventory.json,
    currentLedger: currentLedger.json,
    fileDigests: {
      reviewedSummaryFileSha256: reviewedSummary.sha256,
      reviewedProposalsFileSha256: reviewedProposals.sha256,
      reviewedBlockedFileSha256: reviewedBlocked.sha256,
      currentBasePlanFileSha256: currentBasePlan.sha256,
      currentInputManifestSha256: currentInventory.sha256,
      currentLexiquePlanFileSha256: currentLexiquePlan.sha256,
      currentLexiqueObservationsFileSha256: currentLexiqueObservations.sha256,
      currentKaikkiPlanFileSha256: currentKaikkiPlan.sha256,
      currentKaikkiObservationsFileSha256: currentKaikkiObservations.sha256,
      currentLedgerFileSha256: currentLedger.sha256,
    },
  });
  const planPath = path.join(options.outputDir, "plan.json");
  const patchPath = path.join(options.outputDir, "decision-ledger-patch.json");
  const planContent = JSON.stringify(result.plan, null, 2) + "\n";
  const patchContent = JSON.stringify(result.patch, null, 2) + "\n";
  const planFileSha256 = digest(Buffer.from(planContent, "utf8"));
  const patchSha256 = digest(Buffer.from(patchContent, "utf8"));
  const application = buildReferenceLedgerApplication({
    ledger: currentLedger.json,
    patch: result.patch,
    plan: result.plan,
    fileDigests: {
      planFileSha256,
      patchFileSha256: patchSha256,
      ledgerFileSha256: currentLedger.sha256,
      inputManifestFileSha256: currentInventory.sha256,
    },
  });
  if (
    application.existingEntryCount !== currentLedger.json.entries.length ||
    application.addedEntryCount !== result.addedWordCount ||
    application.mergedEntryCount !== result.plan.expectedMergedEntryCount
  ) {
    throw new Error("Generic ledger application preview is inconsistent");
  }

  await Promise.all([
    atomicWrite(planPath, planContent),
    atomicWrite(patchPath, patchContent),
  ]);
  const applyCommand = [
    "node scripts/reference-decision-ledger-apply.mjs apply",
    "--plan " + projectRelative(planPath),
    "--patch " + projectRelative(patchPath),
    "--input-manifest " + projectRelative(options.inventory),
    "--plan-sha " + result.plan.planSha256,
    "--patch-sha " + patchSha256,
    "--ledger-sha " + currentLedger.sha256,
    "--confirm",
  ].join(" ");
  console.log(
    JSON.stringify(
      {
        command: "plan",
        outputDir: options.outputDir,
        sourceProposalSha256: result.plan.sourceProposalSha256,
        planSha256: result.plan.planSha256,
        planFileSha256,
        patchSha256,
        expectedLedgerSha256: result.plan.expectedLedgerSha256,
        inputManifestSha256: result.plan.inputManifestSha256,
        scopedInputSha256: result.scopedInputSha256,
        proposedWordCount: result.plan.proposedWordCount,
        proposedAssetCount: result.plan.proposedAssetCount,
        preservedExistingEntryCount: result.preservedExistingEntryCount,
        addedWordCount: result.addedWordCount,
        unchangedWordCount: result.unchangedWordCount,
        expectedMergedEntryCount: result.plan.expectedMergedEntryCount,
        applicationSha256: application.applicationSha256,
        mergedLedgerSha256: application.mergedLedgerSha256,
        applyCommand,
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
