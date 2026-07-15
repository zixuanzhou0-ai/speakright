#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  OPENSLR_AUDIT_ROOT,
  sha256,
} from "./lib/openslr-spanish-reference-enrichment-core.mjs";

let assertions = 0;
function equal(actual, expected, message) {
  assert.equal(actual, expected, message);
  assertions += 1;
}
function deepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const cliPath = path.join(
  projectRoot,
  "scripts",
  "openslr-spanish-reference-enrichment.mjs",
);
const contractRoot = path.join(
  OPENSLR_AUDIT_ROOT,
  "reference-sources",
  `openslr-cli-contract-${process.pid}`,
);
const inputDir = path.join(contractRoot, "inputs");
const outputDir = path.join(contractRoot, "run");
const basePlanPath = path.join(inputDir, "regeneration-plan.json");
const thirdPlanPath = path.join(inputDir, "third-round-plan.json");
const lexiconPath = path.join(inputDir, "santiago.lexicon");

const sourceAssets = [
  {
    sourceAssetId: "es-a",
    languageId: "es-ES",
    role: "example-word",
    text: "casa",
    canonicalIpa: "/ˈkasa/",
    targetUnits: ["es-k"],
    phonemePageIds: ["es-k"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-b",
    languageId: "es-ES",
    role: "minimal-pair",
    text: "Casa",
    canonicalIpa: "/ˈkasa/",
    targetUnits: ["es-a"],
    phonemePageIds: ["es-a"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-c",
    languageId: "es-ES",
    role: "example-word",
    text: "pero",
    canonicalIpa: "/ˈpeɾo/",
    targetUnits: ["es-r-tap"],
    phonemePageIds: ["es-r-tap"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "es-d",
    languageId: "es-ES",
    role: "example-word",
    text: "desconocido",
    canonicalIpa: "/deskonoˈθiðo/",
    targetUnits: ["es-th"],
    phonemePageIds: ["es-th"],
    relationshipIssues: [],
  },
  {
    sourceAssetId: "fr-a",
    languageId: "fr-FR",
    role: "example-word",
    text: "robe",
    canonicalIpa: "/ʁɔb/",
    targetUnits: ["fr-r"],
    phonemePageIds: ["fr-r"],
    relationshipIssues: [],
  },
];
const blocked = sourceAssets.map((asset) => ({
  sourceAssetId: asset.sourceAssetId,
}));
const fixture = [
  "# local import fixture",
  "word\tphonemes",
  "casa\tk a s a",
  "pero\tp e r o",
  "malformed",
  "",
].join("\n");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
  });
}

try {
  mkdirSync(inputDir, { recursive: true });
  writeFileSync(
    basePlanPath,
    `${JSON.stringify({ sourceAssets }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    thirdPlanPath,
    `${JSON.stringify(
      {
        blockedCount: blocked.length,
        blocked,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  writeFileSync(lexiconPath, fixture, "utf8");

  const sharedArgs = [
    "--base-plan",
    basePlanPath,
    "--third-plan",
    thirdPlanPath,
    "--output-dir",
    outputDir,
  ];
  const planned = runCli(["plan", ...sharedArgs]);
  equal(planned.status, 0, planned.stderr);
  const plan = JSON.parse(
    readFileSync(path.join(outputDir, "plan.json"), "utf8"),
  );
  equal(plan.strictQueueSourceAssetCount, 5);
  equal(plan.sourceAssetCount, 4);
  equal(plan.wordCount, 3);
  const planReport = JSON.parse(
    readFileSync(path.join(outputDir, "plan-report.json"), "utf8"),
  );
  equal(planReport.confirmationCoverage.eligibleSourceAssetCount, 0);
  equal(planReport.confirmationCoverage.eligibleWordCount, 0);
  equal(planReport.safety.networkRequestsMade, 0);

  const deniedFetch = runCli(["fetch", ...sharedArgs]);
  equal(deniedFetch.status, 1);
  check(
    deniedFetch.stderr.includes("pass --confirm explicitly"),
    "Fetch must fail before network access without explicit confirmation",
  );

  const imported = runCli([
    "import",
    ...sharedArgs,
    "--input",
    lexiconPath,
    "--expected-sha256",
    sha256(Buffer.from(fixture, "utf8")),
  ]);
  equal(imported.status, 0, imported.stderr);
  const importedCheckpoint = JSON.parse(
    readFileSync(path.join(outputDir, "checkpoint.json"), "utf8"),
  );
  equal(importedCheckpoint.publisherId, "openslr");
  equal(
    importedCheckpoint.independenceGroup,
    "santiago-spanish-lexicon-resource-34",
  );
  equal(importedCheckpoint.datasetVersion, "SLR34");
  equal(importedCheckpoint.license.id, "Apache-2.0");
  equal(importedCheckpoint.source.acquisitionMode, "local-import");
  equal(importedCheckpoint.source.provenanceStatus, "operator-hash-verified");
  equal(importedCheckpoint.source.networkRequestsMade, 0);
  equal(
    importedCheckpoint.localeBoundary.localeMatchStatus,
    "cross-locale-variant-risk",
  );

  const parsed = runCli(["parse", ...sharedArgs]);
  equal(parsed.status, 0, parsed.stderr);
  const observations = JSON.parse(
    readFileSync(path.join(outputDir, "observations.json"), "utf8"),
  );
  const unresolved = JSON.parse(
    readFileSync(path.join(outputDir, "unresolved.json"), "utf8"),
  );
  const report = JSON.parse(
    readFileSync(path.join(outputDir, "report.json"), "utf8"),
  );
  equal(observations.coverage.observationWordCount, 2);
  equal(observations.coverage.observedSourceAssetCount, 3);
  equal(observations.coverage.targetLocaleConfirmedWordCount, 0);
  equal(observations.coverage.targetLocaleConfirmedSourceAssetCount, 0);
  equal(unresolved.unresolvedCount, 3);
  equal(unresolved.unresolvedSourceAssetCount, 4);
  check(
    unresolved.entries.some(
      (entry) =>
        entry.text === "casa" && entry.reason === "cross-locale-variant-risk",
    ),
    "Mapped Santiago entries must remain unresolved for es-ES",
  );
  equal(report.disposition.status, "observation-only-cross-locale");
  equal(report.disposition.autoConfirmationAllowed, false);
  equal(report.disposition.formalAudioMutationCount, 0);
  equal(report.acquisition.networkRequestsMade, 0);
  check(
    !JSON.stringify(report).includes("two-source-confirmed"),
    "Report must never manufacture a confirmation status",
  );
  const parsedCheckpoint = JSON.parse(
    readFileSync(path.join(outputDir, "checkpoint.json"), "utf8"),
  );
  equal(parsedCheckpoint.parse.networkRequestsMade, 0);
  deepEqual(parsedCheckpoint.parse.outputs, [
    "parsed.json",
    "observations.json",
    "unresolved.json",
    "report.json",
  ]);
} finally {
  rmSync(contractRoot, { recursive: true, force: true });
}

console.log(`OpenSLR Spanish CLI contract passed (${assertions} assertions).`);
