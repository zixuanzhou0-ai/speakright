import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeAssetRights,
  listGitTrackedPackagedFiles,
  readJson,
  refreshRegistryDigests,
  validateAssetRightsDocuments,
} from "./lib/asset-rights-core.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const canonicalRoot = path.join(projectRoot, "public");
const registryPath = path.join(
  projectRoot,
  "docs",
  "assets",
  "asset-rights-registry.json",
);
const command = process.argv[2] ?? "check";

if (!new Set(["check", "update"]).has(command)) {
  throw new Error("Usage: node scripts/asset-rights.mjs [check|update]");
}

const registry = await readJson(registryPath);
const packagedFiles = await listGitTrackedPackagedFiles({
  projectRoot,
  canonicalRoot,
});

if (command === "update") {
  const updated = await refreshRegistryDigests({
    canonicalRoot,
    registry,
    packagedFiles,
  });
  await fs.writeFile(
    registryPath,
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Updated ${updated.records.length} asset-rights records in ${path.relative(projectRoot, registryPath)}.`,
  );
}

const checkedRegistry =
  command === "update" ? await readJson(registryPath) : registry;
const analysis = await analyzeAssetRights({
  canonicalRoot,
  registry: checkedRegistry,
  packagedFiles,
});
analysis.errors.push(...(await validateAssetRightsDocuments(projectRoot)));
if (analysis.errors.length > 0) {
  console.error(
    `Asset-rights validation failed:\n- ${analysis.errors.join("\n- ")}`,
  );
  process.exitCode = 1;
} else {
  const assetCount = analysis.recordResults.reduce(
    (sum, result) => sum + result.matchingFiles.length,
    0,
  );
  console.log(
    `Asset-rights validation passed: ${assetCount} media files in ${analysis.recordResults.length} rights records; ${analysis.metadataFiles.length} metadata files.`,
  );
}
