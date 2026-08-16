import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, link, lstat, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  analyzeAssetRights,
  filesForEdition,
  listGitTrackedPackagedFiles,
  walkFiles,
} from "./asset-rights-core.mjs";

const ASSET_SET_PREFIX = "speakright-release-evidence-assets-v1\0";
const ASSET_POLICY_PATHS = [
  "public",
  "docs/assets/asset-rights-registry.json",
  "docs/assets/asset-rights-registry.schema.json",
  "scripts/lib/asset-rights-core.mjs",
  "scripts/lib/release-evidence-assets.mjs",
];
const COPY_FALLBACK_CODES = new Set(["EACCES", "ENOTSUP", "EPERM", "EXDEV"]);
const fileDigestCache = new Map();

export function compareReleaseEvidencePaths(left, right) {
  return left.localeCompare(right, "en");
}

function git(projectRoot, arguments_, options = {}) {
  return execFileSync("git", ["-C", projectRoot, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function assertEdition(edition) {
  if (!new Set(["browser", "desktop"]).has(edition)) {
    throw new Error(`Unknown release-evidence asset edition: ${edition}.`);
  }
}

function assertAssetPolicyProvenance(projectRoot, expectedCommit) {
  const sourceCommit = git(projectRoot, [
    "rev-parse",
    "--verify",
    `${expectedCommit ?? "HEAD"}^{commit}`,
  ]);
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) {
    throw new Error("Release-evidence asset source commit is not a full SHA.");
  }
  const worktreeStatus = git(projectRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...ASSET_POLICY_PATHS,
  ]);
  if (worktreeStatus) {
    throw new Error(
      "Release-evidence asset inputs contain staged, unstaged, or untracked changes.",
    );
  }
  if (expectedCommit) {
    try {
      execFileSync(
        "git",
        [
          "-C",
          projectRoot,
          "diff",
          "--quiet",
          sourceCommit,
          "HEAD",
          "--",
          ...ASSET_POLICY_PATHS,
        ],
        { stdio: "ignore" },
      );
    } catch {
      throw new Error(
        "Current release-evidence asset inputs differ from the declared source commit.",
      );
    }
  }
  return sourceCommit;
}

async function sha256File(filePath) {
  const cacheKey = path.resolve(filePath);
  let pending = fileDigestCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(cacheKey)) hash.update(chunk);
      return hash.digest("hex");
    })();
    fileDigestCache.set(cacheKey, pending);
  }
  return pending;
}

function updateFramed(hash, value) {
  hash.update(value, "utf8");
  hash.update("\0");
}

export async function releaseEvidenceAssetSet(
  projectRoot,
  edition,
  expectedCommit,
) {
  assertEdition(edition);
  assertAssetPolicyProvenance(projectRoot, expectedCommit);
  const canonicalRoot = path.join(projectRoot, "public");
  const registryPath = path.join(
    projectRoot,
    "docs",
    "assets",
    "asset-rights-registry.json",
  );
  const [registryBytes, packagedFiles] = await Promise.all([
    readFile(registryPath),
    listGitTrackedPackagedFiles({ projectRoot, canonicalRoot }),
  ]);
  const registry = JSON.parse(registryBytes.toString("utf8"));
  const analysis = await analyzeAssetRights({
    canonicalRoot,
    packagedFiles,
    registry,
  });
  if (analysis.errors.length > 0) {
    throw new Error(
      `Release-evidence asset rights validation failed:\n- ${analysis.errors.join("\n- ")}`,
    );
  }
  const trackedSet = new Set(packagedFiles);
  const releaseFiles = filesForEdition(analysis, edition).sort(
    compareReleaseEvidencePaths,
  );
  if (releaseFiles.length === 0) {
    throw new Error(`Release-evidence ${edition} asset set is empty.`);
  }
  const pathsHash = createHash("sha256");
  const pathHashPairs = createHash("sha256");
  updateFramed(pathsHash, `${ASSET_SET_PREFIX}${edition}`);
  updateFramed(pathHashPairs, `${ASSET_SET_PREFIX}${edition}`);
  const files = [];
  let totalBytes = 0;
  for (const relativePath of releaseFiles) {
    if (!trackedSet.has(relativePath)) {
      throw new Error(
        `Release-evidence ${edition} asset is not Git tracked: ${relativePath}.`,
      );
    }
    const sourcePath = path.join(canonicalRoot, ...relativePath.split("/"));
    const stats = await lstat(sourcePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(
        `Release-evidence asset must be a regular tracked file: ${relativePath}.`,
      );
    }
    const sha256 = await sha256File(sourcePath);
    totalBytes += stats.size;
    updateFramed(pathsHash, relativePath);
    updateFramed(pathHashPairs, relativePath);
    updateFramed(pathHashPairs, sha256);
    files.push({ path: relativePath, sha256, size: stats.size });
  }
  return {
    files,
    summary: {
      schemaVersion: 1,
      fileCount: files.length,
      totalBytes,
      pathDigestSha256: pathsHash.digest("hex"),
      pathHashDigestSha256: pathHashPairs.digest("hex"),
      registrySha256: createHash("sha256").update(registryBytes).digest("hex"),
    },
  };
}

export async function materializeReleaseEvidenceAssets({
  destinationRoot,
  edition,
  expectedCommit,
  projectRoot,
}) {
  const assetSet = await releaseEvidenceAssetSet(
    projectRoot,
    edition,
    expectedCommit,
  );
  const canonicalRoot = path.join(projectRoot, "public");
  await rm(destinationRoot, { force: true, recursive: true });
  await mkdir(destinationRoot, { recursive: true });
  let copied = 0;
  let hardlinked = 0;
  for (const entry of assetSet.files) {
    const sourcePath = path.join(canonicalRoot, ...entry.path.split("/"));
    const destinationPath = path.join(
      destinationRoot,
      ...entry.path.split("/"),
    );
    await mkdir(path.dirname(destinationPath), { recursive: true });
    try {
      await link(sourcePath, destinationPath);
      hardlinked += 1;
    } catch (error) {
      if (!COPY_FALLBACK_CODES.has(error?.code)) throw error;
      await copyFile(sourcePath, destinationPath);
      if ((await sha256File(destinationPath)) !== entry.sha256) {
        throw new Error(
          `Copied release-evidence asset changed: ${entry.path}.`,
        );
      }
      copied += 1;
    }
  }
  const materializedFiles = (await walkFiles(destinationRoot)).sort(
    compareReleaseEvidencePaths,
  );
  const expectedFiles = assetSet.files
    .map((entry) => entry.path)
    .sort(compareReleaseEvidencePaths);
  if (
    materializedFiles.length !== expectedFiles.length ||
    materializedFiles.some(
      (relativePath, index) => relativePath !== expectedFiles[index],
    )
  ) {
    throw new Error(
      `Materialized ${edition} asset paths differ from the approved tracked set.`,
    );
  }
  return {
    assetSet: assetSet.summary,
    copied,
    hardlinked,
  };
}
