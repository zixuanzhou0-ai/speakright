#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertReferenceLedgerApplyAuthorization,
  buildReferenceLedgerApplication,
} from "./lib/reference-decision-ledger-apply-core.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const ENGLISH_DECISION_ROOT = path.join(
  AUDIT_ROOT,
  "reference-sources",
  "english-decisions",
);
const FORMAL_LEDGER_PATH = path.join(
  PROJECT_ROOT,
  "scripts",
  "data",
  "phoneme-word-reference-decisions.json",
);

function assertPathUnder(root, candidate, label) {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must remain under ${root}`);
  }
  return resolved;
}

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    command: argv[0] ?? "plan",
    confirm: false,
    plan: path.join(ENGLISH_DECISION_ROOT, "plan.json"),
    patch: path.join(ENGLISH_DECISION_ROOT, "decision-ledger-patch.json"),
    inputManifest: null,
    expectedPlanSha256: null,
    expectedPatchSha256: null,
    expectedLedgerSha256: null,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--confirm") {
      options.confirm = true;
      continue;
    }
    const value = takeValue(argv, index, argument);
    if (argument === "--plan") options.plan = path.resolve(value);
    else if (argument === "--patch") options.patch = path.resolve(value);
    else if (argument === "--input-manifest")
      options.inputManifest = path.resolve(value);
    else if (argument === "--plan-sha") {
      options.expectedPlanSha256 = value.toLowerCase();
    } else if (argument === "--patch-sha") {
      options.expectedPatchSha256 = value.toLowerCase();
    } else if (argument === "--ledger-sha") {
      options.expectedLedgerSha256 = value.toLowerCase();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
    index += 1;
  }
  options.plan = assertPathUnder(AUDIT_ROOT, options.plan, "Decision plan");
  options.patch = assertPathUnder(AUDIT_ROOT, options.patch, "Ledger patch");
  if (options.inputManifest) {
    options.inputManifest = assertPathUnder(
      AUDIT_ROOT,
      options.inputManifest,
      "Input manifest",
    );
  }
  return options;
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJsonWithDigest(filePath) {
  const buffer = await fs.readFile(filePath);
  return {
    buffer,
    json: JSON.parse(buffer.toString("utf8")),
    sha256: digest(buffer),
  };
}

async function atomicReplaceLedger(content, expectedCurrentSha256) {
  const current = await fs.readFile(FORMAL_LEDGER_PATH);
  if (digest(current) !== expectedCurrentSha256) {
    throw new Error("Formal ledger changed after validation; refusing apply");
  }
  const temporary = `${FORMAL_LEDGER_PATH}.${process.pid}.${Date.now()}.tmp`;
  const handle = await fs.open(temporary, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporary, FORMAL_LEDGER_PATH);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  const written = await fs.readFile(FORMAL_LEDGER_PATH);
  if (written.toString("utf8") !== content) {
    throw new Error("Formal ledger post-write verification failed");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [plan, patch, ledger, inputManifest] = await Promise.all([
    readJsonWithDigest(options.plan),
    readJsonWithDigest(options.patch),
    readJsonWithDigest(FORMAL_LEDGER_PATH),
    options.inputManifest
      ? readJsonWithDigest(options.inputManifest)
      : Promise.resolve(null),
  ]);
  if (plan.json.inputManifestSha256 && !inputManifest) {
    throw new Error(
      "Decision plan requires --input-manifest for stale-input validation",
    );
  }
  const application = buildReferenceLedgerApplication({
    ledger: ledger.json,
    patch: patch.json,
    plan: plan.json,
    fileDigests: {
      planFileSha256: plan.sha256,
      patchFileSha256: patch.sha256,
      ledgerFileSha256: ledger.sha256,
      ...(inputManifest
        ? { inputManifestFileSha256: inputManifest.sha256 }
        : {}),
    },
  });
  const command = assertReferenceLedgerApplyAuthorization({
    command: options.command,
    confirm: options.confirm,
    expectedPlanSha256: options.expectedPlanSha256,
    expectedPatchSha256: options.expectedPatchSha256,
    expectedLedgerSha256: options.expectedLedgerSha256,
    actualPlanSha256: application.planSha256,
    actualPatchSha256: patch.sha256,
    actualLedgerSha256: ledger.sha256,
  });

  if (command === "apply") {
    await atomicReplaceLedger(
      `${JSON.stringify(application.mergedLedger, null, 2)}\n`,
      ledger.sha256,
    );
  }
  console.log(
    JSON.stringify(
      {
        command,
        target: FORMAL_LEDGER_PATH,
        planSha256: application.planSha256,
        planFileSha256: plan.sha256,
        patchSha256: patch.sha256,
        ledgerSha256: ledger.sha256,
        inputManifestSha256: inputManifest?.sha256 ?? null,
        applicationSha256: application.applicationSha256,
        mergedLedgerSha256: application.mergedLedgerSha256,
        existingEntryCount: application.existingEntryCount,
        patchEntryCount: application.patchEntryCount,
        addedEntryCount: application.addedEntryCount,
        unchangedEntryCount: application.unchangedEntryCount,
        mergedEntryCount: application.mergedEntryCount,
        requiredApplyArguments: {
          ...(plan.json.inputManifestSha256
            ? { "--input-manifest": options.inputManifest }
            : {}),
          "--plan-sha": application.planSha256,
          "--patch-sha": patch.sha256,
          "--ledger-sha": ledger.sha256,
          "--confirm": true,
        },
        networkRequestsMade: 0,
        paidCallsMade: 0,
        formalLedgerWrites: command === "apply" ? 1 : 0,
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
