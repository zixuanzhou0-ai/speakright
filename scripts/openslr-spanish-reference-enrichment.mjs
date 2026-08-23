#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertFetchConfirmed,
  assertSafeAuditInputPath,
  assertSafeOpenSlrUrl,
  assertSafeReferenceOutputDir,
  buildOpenSlrCheckpoint,
  buildOpenSlrPlanReport,
  buildOpenSlrReferenceOutputs,
  buildOpenSlrReferencePlan,
  detectOpenSlrSourceFormat,
  getDefaultOpenSlrOutputDir,
  OPENSLR_DATASET_VERSION,
  OPENSLR_INDEPENDENCE_GROUP,
  OPENSLR_LICENSE,
  OPENSLR_LOCALE_BOUNDARY,
  OPENSLR_MAX_SOURCE_BYTES,
  OPENSLR_OFFICIAL_SOURCE_URLS,
  OPENSLR_PUBLISHER_ID,
  OPENSLR_RESOURCE_ID,
  parseOpenSlrLexiconSources,
  sha256,
  sourceBufferToLexiconSources,
  validateOpenSlrSourceBuffer,
} from "./lib/openslr-spanish-reference-enrichment-core.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_AUDIT_ROOT = path.join(
  PROJECT_ROOT,
  "outputs",
  "phoneme-word-auditory-audit-2026-07-14",
);
const DEFAULT_BASE_PLAN = path.join(
  DEFAULT_AUDIT_ROOT,
  "regenerated-candidates",
  "regeneration-plan.json",
);
const DEFAULT_THIRD_PLAN = path.join(
  DEFAULT_AUDIT_ROOT,
  "regenerated-candidates",
  "third-round-plan.json",
);
const CACHED_FILES = Object.freeze({
  "tar-gzip": "source/santiago.tar.gz",
  "lexicon-text": "source/santiago-lexicon.txt",
});

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const command = argv[0] ?? "plan";
  const options = {
    command,
    confirm: false,
    basePlan: DEFAULT_BASE_PLAN,
    thirdPlan: DEFAULT_THIRD_PLAN,
    outputDir: getDefaultOpenSlrOutputDir(),
    input: null,
    expectedSha256: null,
    sourceUrl: OPENSLR_OFFICIAL_SOURCE_URLS[0],
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--confirm") {
      options.confirm = true;
    } else if (arg === "--base-plan") {
      options.basePlan = path.resolve(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === "--third-plan") {
      options.thirdPlan = path.resolve(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = path.resolve(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === "--input") {
      options.input = path.resolve(takeValue(argv, index, arg));
      index += 1;
    } else if (arg === "--expected-sha256") {
      options.expectedSha256 = takeValue(argv, index, arg).toLowerCase();
      index += 1;
    } else if (arg === "--source-url") {
      options.sourceUrl = takeValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["plan", "fetch", "import", "parse"].includes(command)) {
    throw new Error(
      `Unknown command: ${command}. Use plan, fetch, import, or parse.`,
    );
  }
  if (command === "import" && !options.input) {
    throw new Error(
      "The import command requires --input <santiago.tar.gz|lexicon.txt>",
    );
  }
  if (
    options.expectedSha256 &&
    !/^[0-9a-f]{64}$/u.test(options.expectedSha256)
  ) {
    throw new Error("--expected-sha256 must be 64 lowercase hex characters");
  }
  options.basePlan = assertSafeAuditInputPath(options.basePlan);
  options.thirdPlan = assertSafeAuditInputPath(options.thirdPlan);
  options.outputDir = assertSafeReferenceOutputDir(options.outputDir);
  options.sourceUrl = assertSafeOpenSlrUrl(options.sourceUrl);
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function atomicWrite(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, value);
  await fs.rename(temporary, filePath);
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createCurrentPlan(options) {
  const basePlan = await readJson(options.basePlan);
  const thirdPlan = await readJson(options.thirdPlan);
  const blocked = thirdPlan.blocked ?? [];
  if (blocked.length !== thirdPlan.blockedCount) {
    throw new Error("Third-round blocked count does not match blocked items");
  }
  const unresolvedSourceAssetIds = blocked.map((item) => item.sourceAssetId);
  if (
    new Set(unresolvedSourceAssetIds).size !== unresolvedSourceAssetIds.length
  ) {
    throw new Error("Third-round blocked source asset IDs must be unique");
  }
  return buildOpenSlrReferencePlan({
    sourceAssets: basePlan.sourceAssets ?? [],
    unresolvedSourceAssetIds,
  });
}

async function writePlan(options) {
  const plan = await createCurrentPlan(options);
  const planPath = path.join(options.outputDir, "plan.json");
  const reportPath = path.join(options.outputDir, "plan-report.json");
  await atomicWriteJson(planPath, plan);
  await atomicWriteJson(reportPath, buildOpenSlrPlanReport(plan));
  console.log(
    JSON.stringify(
      {
        output: planPath,
        report: reportPath,
        strictQueueSourceAssetCount: plan.strictQueueSourceAssetCount,
        spanishSourceAssetCount: plan.sourceAssetCount,
        spanishWordCount: plan.wordCount,
        targetLocaleConfirmationEligibleWordCount: 0,
        localeMatchStatus: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
        publisherId: plan.publisherId,
        independenceGroup: plan.independenceGroup,
        datasetVersion: plan.datasetVersion,
        license: plan.license.id,
        planSha256: plan.planSha256,
        networkRequestsMade: 0,
      },
      null,
      2,
    ),
  );
  return plan;
}

async function loadValidatedPlan(options) {
  const diskPlan = await readJson(path.join(options.outputDir, "plan.json"));
  const currentPlan = await createCurrentPlan(options);
  if (diskPlan.planSha256 !== currentPlan.planSha256) {
    throw new Error(
      "OpenSLR reference plan is stale. Run plan again before acquisition or parsing.",
    );
  }
  return diskPlan;
}

function sourceFilePath(outputDir, cachedFile) {
  if (!Object.values(CACHED_FILES).includes(cachedFile)) {
    throw new Error(`Unknown OpenSLR source cache file: ${cachedFile}`);
  }
  const resolved = path.resolve(outputDir, cachedFile);
  const relative = path.relative(outputDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe OpenSLR source cache path");
  }
  return resolved;
}

function assertCheckpointIdentity(checkpoint, plan) {
  if (checkpoint.planSha256 !== plan.planSha256) {
    throw new Error("OpenSLR checkpoint plan SHA mismatch");
  }
  if (
    checkpoint.publisherId !== OPENSLR_PUBLISHER_ID ||
    checkpoint.independenceGroup !== OPENSLR_INDEPENDENCE_GROUP ||
    checkpoint.resourceId !== OPENSLR_RESOURCE_ID ||
    checkpoint.datasetVersion !== OPENSLR_DATASET_VERSION ||
    checkpoint.license?.id !== OPENSLR_LICENSE.id
  ) {
    throw new Error("OpenSLR checkpoint source identity mismatch");
  }
  if (
    checkpoint.localeBoundary?.localeMatchStatus !==
      OPENSLR_LOCALE_BOUNDARY.localeMatchStatus ||
    checkpoint.localeBoundary?.reliableForTargetLocaleConfirmation !== false
  ) {
    throw new Error("OpenSLR checkpoint locale boundary mismatch");
  }
}

async function fetchOfficialArchive(initialUrl) {
  let url = assertSafeOpenSlrUrl(initialUrl);
  let requestsMade = 0;
  for (let redirect = 0; redirect <= 2; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        accept: "application/gzip,application/x-gzip,application/octet-stream",
        "user-agent":
          "SpeakRight-OpenSLR-Santiago-reference-import/1.0 (+local pronunciation QA)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    requestsMade += 1;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `OpenSLR redirect without location (${response.status})`,
        );
      }
      url = assertSafeOpenSlrUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      throw new Error(`OpenSLR returned HTTP ${response.status}`);
    }
    const declaredLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (declaredLength > OPENSLR_MAX_SOURCE_BYTES) {
      throw new Error("OpenSLR source exceeds the 64 MiB safety limit");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    validateOpenSlrSourceBuffer(buffer, "tar-gzip");
    return {
      buffer,
      finalUrl: url,
      httpStatus: response.status,
      requestsMade,
    };
  }
  throw new Error("Too many OpenSLR redirects");
}

async function existingOfficialFetch(options, plan) {
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath).catch(() => null);
  if (
    !checkpoint ||
    checkpoint.source?.status !== "ready" ||
    checkpoint.source.acquisitionMode !== "official-fetch"
  ) {
    return null;
  }
  try {
    assertCheckpointIdentity(checkpoint, plan);
    assertSafeOpenSlrUrl(checkpoint.source.sourceUrl);
  } catch {
    return null;
  }
  const sourcePath = sourceFilePath(
    options.outputDir,
    checkpoint.source.cachedFile,
  );
  const buffer = await fs.readFile(sourcePath).catch(() => null);
  if (!buffer || sha256(buffer) !== checkpoint.source.sha256) return null;
  try {
    validateOpenSlrSourceBuffer(buffer, checkpoint.source.sourceFormat);
  } catch {
    return null;
  }
  return { checkpoint, checkpointPath };
}

async function runFetch(options) {
  assertFetchConfirmed(options.confirm);
  const plan = await loadValidatedPlan(options);
  const ready = await existingOfficialFetch(options, plan);
  if (ready) {
    console.log(
      JSON.stringify(
        {
          checkpoint: ready.checkpointPath,
          sourceSha256: ready.checkpoint.source.sha256,
          reusedCheckpoint: true,
          networkRequestsMade: 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  const fetched = await fetchOfficialArchive(options.sourceUrl);
  const sourceSha256 = sha256(fetched.buffer);
  const cachedFile = CACHED_FILES["tar-gzip"];
  await atomicWrite(
    sourceFilePath(options.outputDir, cachedFile),
    fetched.buffer,
  );
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = buildOpenSlrCheckpoint(plan, {
    status: "ready",
    acquisitionMode: "official-fetch",
    provenanceStatus: "official-openslr-fetch",
    sourceUrl: fetched.finalUrl,
    sourceFormat: "tar-gzip",
    cachedFile,
    sha256: sourceSha256,
    bytes: fetched.buffer.length,
    httpStatus: fetched.httpStatus,
    acquiredAt: new Date().toISOString(),
    networkRequestsMade: fetched.requestsMade,
  });
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        checkpoint: checkpointPath,
        sourceSha256,
        bytes: fetched.buffer.length,
        networkRequestsMade: fetched.requestsMade,
      },
      null,
      2,
    ),
  );
}

async function runImport(options) {
  const plan = await loadValidatedPlan(options);
  const stat = await fs.stat(options.input);
  if (!stat.isFile()) throw new Error("--input must point to a regular file");
  if (stat.size > OPENSLR_MAX_SOURCE_BYTES) {
    throw new Error("OpenSLR source exceeds the 64 MiB safety limit");
  }
  const buffer = await fs.readFile(options.input);
  const sourceFormat = detectOpenSlrSourceFormat(buffer, options.input);
  validateOpenSlrSourceBuffer(buffer, sourceFormat);
  const sourceSha256 = sha256(buffer);
  if (options.expectedSha256 && sourceSha256 !== options.expectedSha256) {
    throw new Error(
      "OpenSLR source SHA-256 mismatch: expected " +
        options.expectedSha256 +
        ", received " +
        sourceSha256,
    );
  }
  const cachedFile = CACHED_FILES[sourceFormat];
  await atomicWrite(sourceFilePath(options.outputDir, cachedFile), buffer);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = buildOpenSlrCheckpoint(plan, {
    status: "ready",
    acquisitionMode: "local-import",
    provenanceStatus: options.expectedSha256
      ? "operator-hash-verified"
      : "operator-supplied-unverified",
    sourceUrl: options.sourceUrl,
    sourceFormat,
    inputFileName: path.basename(options.input),
    cachedFile,
    sha256: sourceSha256,
    bytes: buffer.length,
    importedAt: new Date().toISOString(),
    networkRequestsMade: 0,
  });
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        checkpoint: checkpointPath,
        sourceSha256,
        sourceFormat,
        bytes: buffer.length,
        provenanceStatus: checkpoint.source.provenanceStatus,
        networkRequestsMade: 0,
      },
      null,
      2,
    ),
  );
}

async function runParse(options) {
  const plan = await loadValidatedPlan(options);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath);
  assertCheckpointIdentity(checkpoint, plan);
  if (
    checkpoint.source?.status !== "ready" ||
    !Object.hasOwn(CACHED_FILES, checkpoint.source.sourceFormat)
  ) {
    throw new Error("OpenSLR checkpoint has no ready source dataset");
  }
  const sourcePath = sourceFilePath(
    options.outputDir,
    checkpoint.source.cachedFile,
  );
  const buffer = await fs.readFile(sourcePath);
  validateOpenSlrSourceBuffer(buffer, checkpoint.source.sourceFormat);
  const sourceSha256 = sha256(buffer);
  if (sourceSha256 !== checkpoint.source.sha256) {
    throw new Error("Cached OpenSLR source SHA-256 does not match checkpoint");
  }
  const sources = sourceBufferToLexiconSources(buffer, {
    sourceFormat: checkpoint.source.sourceFormat,
    memberName:
      checkpoint.source.inputFileName ??
      path.basename(checkpoint.source.cachedFile),
  });
  const parsed = parseOpenSlrLexiconSources(sources, {
    items: plan.items,
    datasetSha256: sourceSha256,
    sourceUrl: checkpoint.source.sourceUrl,
  });
  const derived = buildOpenSlrReferenceOutputs(plan, parsed, {
    acquisitionMode: checkpoint.source.acquisitionMode,
    acquisitionNetworkRequests: checkpoint.source.networkRequestsMade ?? 0,
  });
  await atomicWriteJson(path.join(options.outputDir, "parsed.json"), parsed);
  await atomicWriteJson(
    path.join(options.outputDir, "observations.json"),
    derived.observations,
  );
  await atomicWriteJson(
    path.join(options.outputDir, "unresolved.json"),
    derived.unresolved,
  );
  await atomicWriteJson(
    path.join(options.outputDir, "report.json"),
    derived.report,
  );
  checkpoint.parse = {
    parsedAt: new Date().toISOString(),
    parserVersion: 1,
    sourceRowCount: parsed.sourceRowCount,
    malformedRowCount: parsed.malformedRowCount,
    sourceMembers: parsed.source.sourceMembers,
    coverage: derived.observations.coverage,
    outputs: [
      "parsed.json",
      "observations.json",
      "unresolved.json",
      "report.json",
    ],
    networkRequestsMade: 0,
  };
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        sourceRowCount: parsed.sourceRowCount,
        malformedRowCount: parsed.malformedRowCount,
        coverage: derived.observations.coverage,
        unresolved: derived.unresolved.unresolvedCount,
        localeMatchStatus: OPENSLR_LOCALE_BOUNDARY.localeMatchStatus,
        report: path.join(options.outputDir, "report.json"),
        networkRequestsMade: 0,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "plan") await writePlan(options);
  else if (options.command === "fetch") await runFetch(options);
  else if (options.command === "import") await runImport(options);
  else await runParse(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
