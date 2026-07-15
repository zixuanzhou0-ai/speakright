#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertFetchConfirmed,
  assertSafeKaikkiUrl,
  assertSafeReferenceOutputDir,
  buildKaikkiReferencePlan,
  buildReferenceOutputs,
  getDefaultKaikkiOutputDir,
  parseKaikkiHtml,
  rebaseKaikkiCheckpoint,
  sha256,
} from "./lib/kaikki-reference-enrichment-core.mjs";

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
const MAX_HTML_BYTES = 5 * 1024 * 1024;

function parseArgs(argv) {
  const command = argv[0] ?? "plan";
  const options = {
    command,
    confirm: false,
    basePlan: DEFAULT_BASE_PLAN,
    thirdPlan: DEFAULT_THIRD_PLAN,
    outputDir: getDefaultKaikkiOutputDir(),
    delayMs: 750,
    maxItems: Number.POSITIVE_INFINITY,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--confirm") options.confirm = true;
    else if (arg === "--base-plan")
      options.basePlan = path.resolve(argv[++index]);
    else if (arg === "--third-plan")
      options.thirdPlan = path.resolve(argv[++index]);
    else if (arg === "--output-dir")
      options.outputDir = path.resolve(argv[++index]);
    else if (arg === "--delay-ms")
      options.delayMs = Number.parseInt(argv[++index], 10);
    else if (arg === "--max-items")
      options.maxItems = Number.parseInt(argv[++index], 10);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["plan", "fetch", "parse", "rebase"].includes(command)) {
    throw new Error(
      `Unknown command: ${command}. Use plan, fetch, parse, or rebase.`,
    );
  }
  if (!Number.isFinite(options.delayMs) || options.delayMs < 500) {
    throw new Error("--delay-ms must be at least 500");
  }
  if (!(options.maxItems > 0)) throw new Error("--max-items must be positive");
  options.outputDir = assertSafeReferenceOutputDir(options.outputDir);
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function atomicWriteJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

async function createCurrentPlan(options) {
  const basePlan = await readJson(options.basePlan);
  const thirdPlan = await readJson(options.thirdPlan);
  const unresolvedSourceAssetIds = (thirdPlan.blocked ?? []).map(
    (item) => item.sourceAssetId,
  );
  if (unresolvedSourceAssetIds.length !== thirdPlan.blockedCount) {
    throw new Error(
      "Third-round blocked count does not match its source asset IDs",
    );
  }
  return buildKaikkiReferencePlan({
    sourceAssets: basePlan.sourceAssets,
    unresolvedSourceAssetIds,
  });
}

async function writePlan(options) {
  const plan = await createCurrentPlan(options);
  await atomicWriteJson(path.join(options.outputDir, "plan.json"), plan);
  console.log(
    JSON.stringify(
      {
        output: path.join(options.outputDir, "plan.json"),
        sourceAssetCount: plan.sourceAssetCount,
        wordCount: plan.wordCount,
        byLanguage: plan.byLanguage,
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
      "Reference plan is stale. Run the plan command again before fetching.",
    );
  }
  return diskPlan;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchSafeHtml(initialUrl, languageId) {
  let url = assertSafeKaikkiUrl(initialUrl, languageId);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "SpeakRight-pronunciation-reference-audit/1.0 (+local QA; rate-limited)",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location)
        throw new Error(`Redirect without location (${response.status})`);
      url = assertSafeKaikkiUrl(new URL(location, url).href, languageId);
      continue;
    }
    if (!response.ok) {
      const error = new Error(`Kaikki returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error(
        `Unexpected Kaikki content type: ${contentType || "missing"}`,
      );
    }
    const declaredLength = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    if (declaredLength > MAX_HTML_BYTES)
      throw new Error("Kaikki HTML exceeds 5 MiB limit");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_HTML_BYTES)
      throw new Error("Kaikki HTML exceeds 5 MiB limit");
    return {
      html: buffer.toString("utf8"),
      finalUrl: url,
      status: response.status,
    };
  }
  throw new Error("Too many Kaikki redirects");
}

async function fetchWithRetry(item) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return {
        ...(await fetchSafeHtml(item.sourceUrl, item.languageId)),
        attempt,
      };
    } catch (error) {
      lastError = error;
      const retryable =
        !Number.isInteger(error.status) ||
        error.status === 429 ||
        error.status >= 500;
      if (!retryable || attempt === 3) break;
      await sleep(750 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function writeDerivedOutputs(outputDir, plan, checkpoint) {
  const derived = buildReferenceOutputs(plan, checkpoint);
  await atomicWriteJson(
    path.join(outputDir, "observations.json"),
    derived.observations,
  );
  await atomicWriteJson(
    path.join(outputDir, "unresolved.json"),
    derived.unresolved,
  );
  return derived;
}

async function runFetch(options) {
  assertFetchConfirmed(options.confirm);
  const plan = await loadValidatedPlan(options);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const checkpoint = await readJson(checkpointPath).catch(() => ({
    version: 1,
    planSha256: plan.planSha256,
    items: {},
  }));
  if (checkpoint.planSha256 !== plan.planSha256) {
    throw new Error(
      "Checkpoint belongs to a different plan; archive it before continuing.",
    );
  }
  const htmlDir = path.join(options.outputDir, "html");
  await fs.mkdir(htmlDir, { recursive: true });
  let processed = 0;
  let requestsMade = 0;
  for (const item of plan.items) {
    if (checkpoint.items[item.sourceUrl]?.status === "fetched") continue;
    if (processed >= options.maxItems) break;
    if (requestsMade > 0) await sleep(options.delayMs);
    try {
      const fetched = await fetchWithRetry(item);
      requestsMade += fetched.attempt;
      const htmlFile = `${sha256(item.sourceUrl)}.html`;
      await fs.writeFile(path.join(htmlDir, htmlFile), fetched.html, "utf8");
      const observation = parseKaikkiHtml(fetched.html, {
        languageId: item.languageId,
        text: item.text,
        sourceUrl: fetched.finalUrl,
      });
      checkpoint.items[item.sourceUrl] = {
        status: "fetched",
        fetchedAt: new Date().toISOString(),
        finalUrl: fetched.finalUrl,
        httpStatus: fetched.status,
        attempts: fetched.attempt,
        htmlFile: `html/${htmlFile}`,
        observation,
      };
    } catch (error) {
      requestsMade += 1;
      checkpoint.items[item.sourceUrl] = {
        status: "fetch-failed",
        failedAt: new Date().toISOString(),
        error: String(error?.message ?? error),
      };
    }
    processed += 1;
    checkpoint.networkRequestsMade = (checkpoint.networkRequestsMade ?? 0) + 1;
    await atomicWriteJson(checkpointPath, checkpoint);
    await writeDerivedOutputs(options.outputDir, plan, checkpoint);
  }
  const derived = await writeDerivedOutputs(
    options.outputDir,
    plan,
    checkpoint,
  );
  console.log(
    JSON.stringify(
      {
        processed,
        requestsMade,
        observations: derived.observations.observationCount,
        unresolved: derived.unresolved.unresolvedCount,
        checkpoint: checkpointPath,
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
  if (checkpoint.planSha256 !== plan.planSha256)
    throw new Error("Checkpoint plan SHA mismatch");
  for (const item of plan.items) {
    const record = checkpoint.items?.[item.sourceUrl];
    if (record?.status !== "fetched" || !record.htmlFile) continue;
    const htmlPath = path.resolve(options.outputDir, record.htmlFile);
    const relative = path.relative(options.outputDir, htmlPath);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Unsafe HTML cache path");
    const html = await fs.readFile(htmlPath, "utf8");
    record.observation = parseKaikkiHtml(html, {
      languageId: item.languageId,
      text: item.text,
      sourceUrl: record.finalUrl ?? item.sourceUrl,
    });
  }
  await atomicWriteJson(checkpointPath, checkpoint);
  const derived = await writeDerivedOutputs(
    options.outputDir,
    plan,
    checkpoint,
  );
  console.log(
    JSON.stringify(
      {
        observations: derived.observations.observationCount,
        unresolved: derived.unresolved.unresolvedCount,
        networkRequestsMade: 0,
      },
      null,
      2,
    ),
  );
}

function assertPathWithin(rootPath, candidatePath, message) {
  const relative = path.relative(rootPath, candidatePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(message);
  }
}

async function validateRebasedHtmlCache(outputDir, checkpoint) {
  const realOutputDir = await fs.realpath(outputDir);
  for (const [sourceUrl, record] of Object.entries(checkpoint.items)) {
    if (record.status === "fetch-failed") continue;
    const htmlPath = path.resolve(outputDir, record.htmlFile);
    assertPathWithin(
      outputDir,
      htmlPath,
      `Unsafe HTML cache path for ${sourceUrl}`,
    );

    let realHtmlPath;
    try {
      realHtmlPath = await fs.realpath(htmlPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(
          `Missing HTML cache for ${sourceUrl}: ${record.htmlFile}`,
        );
      }
      throw error;
    }
    assertPathWithin(
      realOutputDir,
      realHtmlPath,
      `HTML cache resolves outside output directory for ${sourceUrl}`,
    );
    const stats = await fs.stat(realHtmlPath);
    if (!stats.isFile()) {
      throw new Error(`HTML cache is not a file for ${sourceUrl}`);
    }
    const html = await fs.readFile(realHtmlPath, "utf8");
    const expectedSha256 = record.observation?.htmlSha256;
    if (expectedSha256 && sha256(html) !== expectedSha256) {
      throw new Error(`HTML cache SHA-256 mismatch for ${sourceUrl}`);
    }
  }
}

async function runRebase(options) {
  const plan = await loadValidatedPlan(options);
  const checkpointPath = path.join(options.outputDir, "checkpoint.json");
  const previousCheckpoint = await readJson(checkpointPath);
  const checkpoint = rebaseKaikkiCheckpoint(plan, previousCheckpoint);
  await validateRebasedHtmlCache(options.outputDir, checkpoint);
  await atomicWriteJson(checkpointPath, checkpoint);
  console.log(
    JSON.stringify(
      {
        checkpoint: checkpointPath,
        sourcePlanSha256: checkpoint.lastOperation.sourcePlanSha256,
        planSha256: checkpoint.planSha256,
        reusedItemCount: checkpoint.lastOperation.reusedItemCount,
        reusedFetchedItemCount: checkpoint.lastOperation.reusedFetchedItemCount,
        carriedForwardFailureCount:
          checkpoint.lastOperation.carriedForwardFailureCount,
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
  else if (options.command === "parse") await runParse(options);
  else await runRebase(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
