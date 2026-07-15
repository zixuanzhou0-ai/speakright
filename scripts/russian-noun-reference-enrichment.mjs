#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertOfficialRussianNounLexiconUrl,
  assertRussianNounFetchConfirmed,
  assertSafeRussianNounAuditInputPath,
  assertSafeRussianNounReferenceOutputDir,
  buildRussianNounReferenceOutputs,
  buildRussianNounReferencePlan,
  getDefaultRussianNounReferenceOutputDir,
  parseRussianNounLexiconDataset,
  RUSSIAN_NOUN_LEXICON_COMMIT,
  RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
  RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES,
  RUSSIAN_NOUN_LEXICON_PUBLISHER_ID,
  sha256,
  validateRussianNounSourceFile,
} from "./lib/russian-noun-reference-enrichment-core.mjs";

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
const SOURCE_SUBDIRECTORY = "source";

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
    outputDir: getDefaultRussianNounReferenceOutputDir(),
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--confirm") options.confirm = true;
    else if (argument === "--base-plan") {
      options.basePlan = path.resolve(takeValue(argv, index, argument));
      index += 1;
    } else if (argument === "--third-plan") {
      options.thirdPlan = path.resolve(takeValue(argv, index, argument));
      index += 1;
    } else if (argument === "--output-dir") {
      options.outputDir = path.resolve(takeValue(argv, index, argument));
      index += 1;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!["plan", "fetch", "parse"].includes(command)) {
    throw new Error(`Unknown command: ${command}. Use plan, fetch, or parse.`);
  }
  options.basePlan = assertSafeRussianNounAuditInputPath(options.basePlan);
  options.thirdPlan = assertSafeRussianNounAuditInputPath(options.thirdPlan);
  options.outputDir = assertSafeRussianNounReferenceOutputDir(
    options.outputDir,
  );
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
  return buildRussianNounReferencePlan({
    sourceAssets: basePlan.sourceAssets ?? [],
    unresolvedSourceAssetIds,
  });
}

async function writePlan(options) {
  const plan = await createCurrentPlan(options);
  const outputPath = path.join(options.outputDir, "plan.json");
  await atomicWriteJson(outputPath, plan);
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        strictQueueSourceAssetCount: plan.strictQueueSourceAssetCount,
        russianSourceAssetCount: plan.sourceAssetCount,
        russianWordCount: plan.wordCount,
        publisherId: plan.publisherId,
        independenceGroup: plan.independenceGroup,
        commit: plan.version,
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
      "Russian noun reference plan is stale. Run plan again before fetch or parse.",
    );
  }
  return diskPlan;
}

function sourceFilePath(outputDir, descriptor) {
  const sourceRoot = path.resolve(outputDir, SOURCE_SUBDIRECTORY);
  const resolved = path.resolve(sourceRoot, descriptor.fileName);
  const relative = path.relative(sourceRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe Russian noun source cache path");
  }
  return resolved;
}

async function readValidatedSourceFiles(outputDir) {
  const buffers = {};
  const digests = {};
  for (const descriptor of RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES) {
    const buffer = await fs.readFile(sourceFilePath(outputDir, descriptor));
    const metadata = validateRussianNounSourceFile(descriptor.id, buffer);
    buffers[descriptor.id] = buffer;
    digests[descriptor.id] = metadata;
  }
  return { buffers, digests };
}

async function existingReadyCheckpoint(options, plan) {
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath).catch(() => null);
  if (
    !checkpoint ||
    checkpoint.source?.status !== "ready" ||
    checkpoint.source?.commit !== RUSSIAN_NOUN_LEXICON_COMMIT
  ) {
    return null;
  }
  const sourceFiles = await readValidatedSourceFiles(options.outputDir).catch(
    () => null,
  );
  if (!sourceFiles) return null;
  for (const descriptor of RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES) {
    if (
      checkpoint.source.files?.[descriptor.id]?.sha256 !==
      sourceFiles.digests[descriptor.id].sha256
    ) {
      return null;
    }
  }
  return {
    checkpoint,
    checkpointPath,
    sourceFiles,
    planRebased: checkpoint.planSha256 !== plan.planSha256,
  };
}

async function fetchOfficialFile(descriptor) {
  const url = assertOfficialRussianNounLexiconUrl(descriptor.url);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      accept: "text/csv,text/plain,text/markdown,application/octet-stream",
      "user-agent":
        "SpeakRight-RussianNounLexicon-reference-import/1.0 (+local pronunciation QA)",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    throw new Error(
      `RussianNounLexicon ${descriptor.id} unexpectedly redirected; no unlisted destination will be followed`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `RussianNounLexicon ${descriptor.id} returned HTTP ${response.status}`,
    );
  }
  const declaredLength = Number.parseInt(
    response.headers.get("content-length") ?? "0",
    10,
  );
  if (declaredLength > descriptor.maxBytes) {
    throw new Error(
      `RussianNounLexicon ${descriptor.id} exceeds its size limit`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    metadata: validateRussianNounSourceFile(descriptor.id, buffer),
  };
}

async function runFetch(options) {
  assertRussianNounFetchConfirmed(options.confirm);
  const plan = await loadValidatedPlan(options);
  const ready = await existingReadyCheckpoint(options, plan);
  if (ready) {
    if (ready.planRebased) {
      ready.checkpoint.planSha256 = plan.planSha256;
      delete ready.checkpoint.parse;
      await atomicWriteJson(ready.checkpointPath, ready.checkpoint);
    }
    console.log(
      JSON.stringify(
        {
          checkpoint: ready.checkpointPath,
          reusedCheckpoint: true,
          planRebased: ready.planRebased,
          files: ready.checkpoint.source.files,
          networkRequestsMade: 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  const files = {};
  for (const descriptor of RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES) {
    const fetched = await fetchOfficialFile(descriptor);
    await atomicWrite(
      sourceFilePath(options.outputDir, descriptor),
      fetched.buffer,
    );
    files[descriptor.id] = {
      ...fetched.metadata,
      cachedFile: `${SOURCE_SUBDIRECTORY}/${descriptor.fileName}`,
    };
  }
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = {
    version: 1,
    planSha256: plan.planSha256,
    publisherId: RUSSIAN_NOUN_LEXICON_PUBLISHER_ID,
    independenceGroup: RUSSIAN_NOUN_LEXICON_INDEPENDENCE_GROUP,
    source: {
      status: "ready",
      acquisitionMode: "official-immutable-fetch",
      projectId: 14256370,
      commit: RUSSIAN_NOUN_LEXICON_COMMIT,
      acquiredAt: new Date().toISOString(),
      networkRequestsMade: RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES.length,
      files,
    },
  };
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        checkpoint: checkpointPath,
        commit: RUSSIAN_NOUN_LEXICON_COMMIT,
        files,
        networkRequestsMade: RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES.length,
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
  if (
    checkpoint.planSha256 !== plan.planSha256 ||
    checkpoint.source?.status !== "ready" ||
    checkpoint.source?.commit !== RUSSIAN_NOUN_LEXICON_COMMIT
  ) {
    throw new Error("Russian noun checkpoint is stale or incomplete");
  }
  const sourceFiles = await readValidatedSourceFiles(options.outputDir);
  for (const descriptor of RUSSIAN_NOUN_LEXICON_OFFICIAL_FILES) {
    if (
      checkpoint.source.files?.[descriptor.id]?.sha256 !==
      sourceFiles.digests[descriptor.id].sha256
    ) {
      throw new Error(
        `Cached ${descriptor.id} SHA-256 does not match checkpoint`,
      );
    }
  }
  const parsed = parseRussianNounLexiconDataset(
    sourceFiles.buffers.dataset.toString("utf8"),
  );
  const fileDigests = Object.fromEntries(
    Object.entries(sourceFiles.digests).map(([id, metadata]) => [
      id,
      {
        fileName: metadata.fileName,
        url: metadata.url,
        sha256: metadata.sha256,
        bytes: metadata.bytes,
      },
    ]),
  );
  const derived = buildRussianNounReferenceOutputs({
    plan,
    parsed,
    fileDigests,
  });
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
    outputSha256: {
      observations: sha256(JSON.stringify(derived.observations)),
      unresolved: sha256(JSON.stringify(derived.unresolved)),
    },
    networkRequestsMade: 0,
  };
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        observations: path.join(options.outputDir, "observations.json"),
        unresolved: path.join(options.outputDir, "unresolved.json"),
        coverage: derived.observations.coverage,
        networkRequestsMade: 0,
        decisionLedgerWrites: 0,
      },
      null,
      2,
    ),
  );
}

const options = parseArgs(process.argv.slice(2));
if (options.command === "plan") await writePlan(options);
else if (options.command === "fetch") await runFetch(options);
else await runParse(options);
