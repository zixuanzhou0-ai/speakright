#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertFetchConfirmed,
  assertSafeAuditInputPath,
  assertSafeLexiqueUrl,
  assertSafeReferenceOutputDir,
  buildLexiqueReferenceOutputs,
  buildLexiqueReferencePlan,
  getDefaultLexiqueOutputDir,
  LEXIQUE_DATASET_VERSION,
  LEXIQUE_INDEPENDENCE_GROUP,
  LEXIQUE_OFFICIAL_DATA_URLS,
  LEXIQUE_PUBLISHER_ID,
  parseLexiqueDataset,
  sha256,
} from "./lib/lexique-reference-enrichment-core.mjs";

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
const MAX_DATASET_BYTES = 128 * 1024 * 1024;
const CACHED_DATASET_FILE = "source/lexique-4.00.tsv";

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
    outputDir: getDefaultLexiqueOutputDir(),
    input: null,
    expectedSha256: null,
    sourceUrl: LEXIQUE_OFFICIAL_DATA_URLS[0],
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
    throw new Error("The import command requires --input <Lexique TSV>");
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
  options.sourceUrl = assertSafeLexiqueUrl(options.sourceUrl);
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
  return buildLexiqueReferencePlan({
    sourceAssets: basePlan.sourceAssets ?? [],
    unresolvedSourceAssetIds,
  });
}

async function writePlan(options) {
  const plan = await createCurrentPlan(options);
  const planPath = path.join(options.outputDir, "plan.json");
  await atomicWriteJson(planPath, plan);
  console.log(
    JSON.stringify(
      {
        output: planPath,
        strictQueueSourceAssetCount: plan.strictQueueSourceAssetCount,
        frenchSourceAssetCount: plan.sourceAssetCount,
        frenchWordCount: plan.wordCount,
        publisherId: plan.publisherId,
        independenceGroup: plan.independenceGroup,
        datasetVersion: plan.version,
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
      "Lexique reference plan is stale. Run plan again before acquisition or parsing.",
    );
  }
  return diskPlan;
}

function validateDatasetBuffer(buffer) {
  if (buffer.length === 0) throw new Error("Lexique dataset is empty");
  if (buffer.length > MAX_DATASET_BYTES) {
    throw new Error("Lexique dataset exceeds the 128 MiB safety limit");
  }
  const prefix = buffer
    .subarray(0, Math.min(buffer.length, 16_384))
    .toString("utf8");
  if (/^\s*<(?:!doctype|html)/iu.test(prefix)) {
    throw new Error("Lexique dataset unexpectedly contains HTML");
  }
  const header = prefix.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0];
  const normalizedHeaders = header.split(/[\t;,]/u).map((value) =>
    value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("fr-FR")
      .replace(/[^a-z0-9]/gu, "")
      .replace(/^\d+/u, ""),
  );
  if (
    !normalizedHeaders.some((value) =>
      ["mot", "ortho", "orthography", "orthographe"].includes(value),
    )
  ) {
    throw new Error("Lexique dataset header is missing an orthography column");
  }
  if (
    !normalizedHeaders.some((value) =>
      ["phon", "phono", "phonoipa", "phonology", "phonologie", "ipa"].includes(
        value,
      ),
    )
  ) {
    throw new Error("Lexique dataset header is missing a phonology/IPA column");
  }
}

function sourceFilePath(outputDir) {
  const resolved = path.resolve(outputDir, CACHED_DATASET_FILE);
  const relative = path.relative(outputDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe Lexique source cache path");
  }
  return resolved;
}

function buildCheckpoint(plan, source) {
  return {
    version: 1,
    planSha256: plan.planSha256,
    publisherId: LEXIQUE_PUBLISHER_ID,
    independenceGroup: LEXIQUE_INDEPENDENCE_GROUP,
    datasetVersion: LEXIQUE_DATASET_VERSION,
    source,
  };
}

async function fetchOfficialDataset(initialUrl) {
  let url = assertSafeLexiqueUrl(initialUrl);
  let requestsMade = 0;
  for (let redirect = 0; redirect <= 2; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        accept: "text/tab-separated-values,text/plain,application/octet-stream",
        "user-agent":
          "SpeakRight-Lexique-reference-import/1.0 (+local pronunciation QA)",
      },
      signal: AbortSignal.timeout(60_000),
    });
    requestsMade += 1;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Redirect without location (${response.status})`);
      }
      url = assertSafeLexiqueUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Lexique returned HTTP ${response.status}`);
    }
    const declaredLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (declaredLength > MAX_DATASET_BYTES) {
      throw new Error("Lexique dataset exceeds the 128 MiB safety limit");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    validateDatasetBuffer(buffer);
    return {
      buffer,
      finalUrl: url,
      httpStatus: response.status,
      requestsMade,
    };
  }
  throw new Error("Too many Lexique redirects");
}

async function existingReadySource(options, plan) {
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath).catch(() => null);
  if (
    !checkpoint ||
    checkpoint.planSha256 !== plan.planSha256 ||
    checkpoint.source?.status !== "ready" ||
    checkpoint.source.cachedFile !== CACHED_DATASET_FILE
  ) {
    return null;
  }
  const filePath = sourceFilePath(options.outputDir);
  const buffer = await fs.readFile(filePath).catch(() => null);
  if (!buffer || sha256(buffer) !== checkpoint.source.sha256) return null;
  validateDatasetBuffer(buffer);
  return { checkpoint, checkpointPath };
}

async function runFetch(options) {
  assertFetchConfirmed(options.confirm);
  const plan = await loadValidatedPlan(options);
  const ready = await existingReadySource(options, plan);
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

  const fetched = await fetchOfficialDataset(options.sourceUrl);
  const datasetSha256 = sha256(fetched.buffer);
  const datasetPath = sourceFilePath(options.outputDir);
  await atomicWrite(datasetPath, fetched.buffer);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = buildCheckpoint(plan, {
    status: "ready",
    acquisitionMode: "official-fetch",
    sourceUrl: fetched.finalUrl,
    cachedFile: CACHED_DATASET_FILE,
    sha256: datasetSha256,
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
        sourceSha256: datasetSha256,
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
  const extension = path.extname(options.input).toLocaleLowerCase("en-US");
  if (![".tsv", ".txt", ".csv"].includes(extension)) {
    throw new Error(
      "Local Lexique import must be an extracted TSV, TXT, or CSV file",
    );
  }
  const stat = await fs.stat(options.input);
  if (!stat.isFile()) throw new Error("--input must point to a regular file");
  if (stat.size > MAX_DATASET_BYTES) {
    throw new Error("Lexique dataset exceeds the 128 MiB safety limit");
  }
  const buffer = await fs.readFile(options.input);
  validateDatasetBuffer(buffer);
  const datasetSha256 = sha256(buffer);
  if (options.expectedSha256 && datasetSha256 !== options.expectedSha256) {
    throw new Error(
      `Lexique dataset SHA-256 mismatch: expected ${options.expectedSha256}, received ${datasetSha256}`,
    );
  }
  await atomicWrite(sourceFilePath(options.outputDir), buffer);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = buildCheckpoint(plan, {
    status: "ready",
    acquisitionMode: "local-import",
    provenanceStatus: options.expectedSha256
      ? "operator-hash-verified"
      : "operator-supplied-unverified",
    sourceUrl: options.sourceUrl,
    inputFileName: path.basename(options.input),
    cachedFile: CACHED_DATASET_FILE,
    sha256: datasetSha256,
    bytes: buffer.length,
    importedAt: new Date().toISOString(),
    networkRequestsMade: 0,
  });
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        checkpoint: checkpointPath,
        sourceSha256: datasetSha256,
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
  if (checkpoint.planSha256 !== plan.planSha256) {
    throw new Error("Lexique checkpoint plan SHA mismatch");
  }
  if (
    checkpoint.source?.status !== "ready" ||
    checkpoint.source.cachedFile !== CACHED_DATASET_FILE
  ) {
    throw new Error("Lexique checkpoint has no ready source dataset");
  }
  const buffer = await fs.readFile(sourceFilePath(options.outputDir));
  validateDatasetBuffer(buffer);
  const datasetSha256 = sha256(buffer);
  if (datasetSha256 !== checkpoint.source.sha256) {
    throw new Error("Cached Lexique dataset SHA-256 does not match checkpoint");
  }
  const parsed = parseLexiqueDataset(buffer.toString("utf8"), {
    items: plan.items,
    datasetSha256,
    sourceUrl: checkpoint.source.sourceUrl,
  });
  const derived = buildLexiqueReferenceOutputs(plan, parsed);
  await atomicWriteJson(path.join(options.outputDir, "parsed.json"), parsed);
  await atomicWriteJson(
    path.join(options.outputDir, "observations.json"),
    derived.observations,
  );
  await atomicWriteJson(
    path.join(options.outputDir, "unresolved.json"),
    derived.unresolved,
  );
  checkpoint.parse = {
    parsedAt: new Date().toISOString(),
    parserVersion: 1,
    sourceRowCount: parsed.sourceRowCount,
    malformedRowCount: parsed.malformedRowCount,
    coverage: derived.observations.coverage,
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
