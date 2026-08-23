#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadCmuDictReference } from "./lib/cmudict-reference.mjs";
import { buildEnglishReferenceDecisionPlan } from "./lib/english-reference-decision-core.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const REFERENCE_ROOT = path.join(AUDIT_ROOT, "reference-sources");
const DEFAULT_BASE_PLAN = path.join(
  AUDIT_ROOT,
  "regenerated-candidates",
  "regeneration-plan.json",
);
const DEFAULT_THIRD_PLAN = path.join(
  AUDIT_ROOT,
  "regenerated-candidates",
  "third-round-plan.json",
);
const DEFAULT_KAIKKI = path.join(REFERENCE_ROOT, "kaikki", "observations.json");
const DEFAULT_OUTPUT_DIR = path.join(REFERENCE_ROOT, "english-decisions");

function assertWithin(root, candidate, label) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    if (resolved === path.resolve(root)) return resolved;
    throw new Error(`${label} must remain under ${root}`);
  }
  return resolved;
}

function parseArgs(argv) {
  const options = {
    command: argv[0] ?? "plan",
    basePlan: DEFAULT_BASE_PLAN,
    thirdPlan: DEFAULT_THIRD_PLAN,
    kaikki: DEFAULT_KAIKKI,
    outputDir: DEFAULT_OUTPUT_DIR,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    if (argument === "--base-plan") options.basePlan = value;
    else if (argument === "--third-plan") options.thirdPlan = value;
    else if (argument === "--kaikki") options.kaikki = value;
    else if (argument === "--output-dir") options.outputDir = value;
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (options.command !== "plan") {
    throw new Error("Only the read-only plan command is supported");
  }
  options.basePlan = assertWithin(AUDIT_ROOT, options.basePlan, "Base plan");
  options.thirdPlan = assertWithin(AUDIT_ROOT, options.thirdPlan, "Third plan");
  options.kaikki = assertWithin(
    AUDIT_ROOT,
    options.kaikki,
    "Kaikki observations",
  );
  options.outputDir = assertWithin(
    REFERENCE_ROOT,
    options.outputDir,
    "Decision output",
  );
  return options;
}

async function readWithDigest(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    json: JSON.parse(buffer.toString("utf8")),
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [base, third, kaikki] = await Promise.all([
    readWithDigest(options.basePlan),
    readWithDigest(options.thirdPlan),
    readWithDigest(options.kaikki),
  ]);
  const cmuReference = loadCmuDictReference();
  const plan = buildEnglishReferenceDecisionPlan({
    basePlan: base.json,
    thirdPlan: third.json,
    kaikkiObservations: kaikki.json,
    cmuReference,
    inputDigests: {
      basePlanSha256: base.sha256,
      thirdPlanSha256: third.sha256,
      kaikkiObservationsSha256: kaikki.sha256,
      cmudictSha256: cmuReference.sha256,
      cmudictRevision: cmuReference.revision,
    },
  });
  const ledgerPatch = {
    version: 1,
    revision: `english-reference-decisions-${plan.planSha256.slice(0, 12)}`,
    warning:
      "This is a generated ledger patch, not an automatic mutation. Review before merging it into scripts/data/phoneme-word-reference-decisions.json.",
    entries: plan.decisions,
  };
  await Promise.all([
    atomicWriteJson(path.join(options.outputDir, "plan.json"), plan),
    atomicWriteJson(
      path.join(options.outputDir, "decision-ledger-patch.json"),
      ledgerPatch,
    ),
    atomicWriteJson(path.join(options.outputDir, "blocked.json"), {
      version: 1,
      planSha256: plan.planSha256,
      entries: plan.blocked,
    }),
  ]);
  console.log(
    JSON.stringify(
      {
        outputDir: options.outputDir,
        strictQueueAssetCount: plan.strictQueueAssetCount,
        strictQueueWordCount: plan.strictQueueWordCount,
        confirmedAssetCount: plan.confirmedAssetCount,
        confirmedWordCount: plan.confirmedWordCount,
        blockedAssetCount: plan.blockedAssetCount,
        blockedWordCount: plan.blockedWordCount,
        planSha256: plan.planSha256,
        networkRequestsMade: 0,
        paidCallsMade: 0,
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
