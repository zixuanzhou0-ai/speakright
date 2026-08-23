import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeAssetRights,
  filesForEdition,
  listGitTrackedPackagedFiles,
  readJson,
  walkFiles,
} from "./lib/asset-rights-core.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const canonicalRoot = path.resolve(projectRoot, "public");
const browserRoot = path.resolve(projectRoot, "apps", "browser", "public");
const registryPath = path.join(
  projectRoot,
  "docs",
  "assets",
  "asset-rights-registry.json",
);
const flags = new Set(process.argv.slice(2));
const write = flags.has("--write");
const prune = flags.has("--prune");

if (flags.has("--check") && write) {
  throw new Error("Use either --check or --write, not both.");
}
if (prune && !write) throw new Error("--prune requires --write.");
for (const flag of flags) {
  if (!["--check", "--write", "--prune"].includes(flag)) {
    throw new Error(`Unknown option: ${flag}`);
  }
}

const expectedBrowserRoot = path.join(projectRoot, "apps", "browser", "public");
if (browserRoot !== expectedBrowserRoot || browserRoot === canonicalRoot) {
  throw new Error(
    "Refusing to sync outside the exact Browser public directory.",
  );
}

async function digestFile(filePath) {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

const registry = await readJson(registryPath);
const packagedFiles = await listGitTrackedPackagedFiles({
  projectRoot,
  canonicalRoot,
});
const analysis = await analyzeAssetRights({
  canonicalRoot,
  registry,
  packagedFiles,
});
if (analysis.errors.length > 0) {
  throw new Error(
    `Browser asset sync blocked by rights validation:\n- ${analysis.errors.join("\n- ")}`,
  );
}

const releaseFiles = filesForEdition(analysis, "browser");
let destinationFiles = [];
try {
  destinationFiles = await walkFiles(browserRoot);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const releaseSet = new Set(releaseFiles);
const destinationSet = new Set(destinationFiles);
const missing = releaseFiles.filter(
  (relativePath) => !destinationSet.has(relativePath),
);
const stale = destinationFiles.filter(
  (relativePath) => !releaseSet.has(relativePath),
);
const changed = [];

for (const relativePath of releaseFiles) {
  if (!destinationSet.has(relativePath)) continue;
  const sourcePath = path.join(canonicalRoot, ...relativePath.split("/"));
  const destinationPath = path.join(browserRoot, ...relativePath.split("/"));
  const [sourceStat, destinationStat] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(destinationPath),
  ]);
  if (
    sourceStat.size !== destinationStat.size ||
    (await digestFile(sourcePath)) !== (await digestFile(destinationPath))
  ) {
    changed.push(relativePath);
  }
}

if (write) {
  for (const relativePath of [...missing, ...changed]) {
    const sourcePath = path.join(canonicalRoot, ...relativePath.split("/"));
    const destinationPath = path.join(browserRoot, ...relativePath.split("/"));
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }
  if (prune) {
    for (const relativePath of stale) {
      await fs.unlink(path.join(browserRoot, ...relativePath.split("/")));
    }
  }
  console.log(
    `Browser asset sync wrote ${missing.length + changed.length} files${
      prune ? ` and pruned ${stale.length}` : ""
    } from canonical public/.`,
  );
  if (!prune && stale.length > 0) {
    console.warn(
      `${stale.length} stale Browser files remain; rerun with --write --prune after reviewing the list.`,
    );
  }
} else if (missing.length > 0 || changed.length > 0 || stale.length > 0) {
  const details = [
    ...missing.map((item) => `missing: ${item}`),
    ...changed.map((item) => `changed: ${item}`),
    ...stale.map((item) => `stale: ${item}`),
  ];
  console.error(`Browser asset mirror is stale:\n- ${details.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `Browser asset mirror matches ${releaseFiles.length} canonical files.`,
  );
}
