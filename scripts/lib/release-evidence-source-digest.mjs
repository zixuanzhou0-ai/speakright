import { isUtf8 } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const RELEASE_EVIDENCE_SOURCE_DIGEST_SCHEMA = 2;
export const RELEASE_EVIDENCE_GENERATOR_DIGEST_SCHEMA = 2;

export const RELEASE_EVIDENCE_GENERATOR_INPUTS = Object.freeze([
  "scripts/build-browser-release-evidence.mjs",
  "scripts/build-desktop-release-evidence.mjs",
  "scripts/build-release-demo.mjs",
  "scripts/capture-browser-release-evidence.mjs",
  "scripts/capture-desktop-release-evidence.mjs",
  "scripts/serve-release-evidence-static.mjs",
  "scripts/release-evidence.contract.mjs",
  "scripts/release-evidence-assets.contract.mjs",
  "scripts/release-evidence-generator.contract.mjs",
  "scripts/release-evidence-output-tree.contract.mjs",
  "scripts/lib/asset-rights-core.mjs",
  "scripts/lib/release-evidence-assets.mjs",
  "scripts/lib/release-evidence-fixtures.mjs",
  "scripts/lib/release-evidence-output-tree.mjs",
  "scripts/lib/release-evidence-source-digest.mjs",
  "scripts/lib/windows-process-boundary.mjs",
]);

export const DESKTOP_EVIDENCE_TEST_SUPPORT_FILES = Object.freeze([
  "scripts/browser-production-output-snapshot.mjs",
  "scripts/desktop-installer-roundtrip-core.mjs",
  "scripts/lib/desktop-preview-release-gate-core.mjs",
  "scripts/lib/windows-process-boundary.mjs",
  "scripts/tauri-bundle-executable-identity.mjs",
  "scripts/windows-authenticode-status.mjs",
]);

const EXCLUDED_DIRECTORIES = new Set([
  ".next",
  ".turbo",
  "gen",
  "node_modules",
  "out",
  "playwright-report",
  "public",
  "target",
  "test-results",
]);

const INPUTS = {
  browser: [
    ".gitattributes",
    "apps/browser",
    "packages/core",
    "package.json",
    "package-lock.json",
  ],
  desktop: [
    ".gitattributes",
    "src",
    "src-tauri",
    "packages/core",
    ...DESKTOP_EVIDENCE_TEST_SUPPORT_FILES,
    "next-env.d.ts",
    "next.config.ts",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tsconfig.json",
  ],
};

function inputsForEdition(edition) {
  const inputs = INPUTS[edition];
  if (!inputs) throw new Error(`Unknown release evidence edition: ${edition}`);
  return inputs;
}

function runGit(baseRoot, args, label) {
  const result = spawnSync("git", args, {
    cwd: baseRoot,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Could not ${label} for release evidence.`);
  }
  return result.stdout.trim();
}

function assertCleanInputs(baseRoot, inputs, label) {
  const status = runGit(
    baseRoot,
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...inputs],
    `verify the ${label} worktree`,
  );
  if (status) {
    throw new Error(
      `Release evidence ${label} inputs must be committed and clean.`,
    );
  }
}

function gitInputProvenance(baseRoot, inputs, label, expectedCommit) {
  const head = runGit(baseRoot, ["rev-parse", "HEAD"], "resolve HEAD");
  if (!/^[0-9a-f]{40}$/.test(head)) {
    throw new Error("Release evidence requires a concrete Git source commit.");
  }
  assertCleanInputs(baseRoot, inputs, label);

  if (expectedCommit === undefined) {
    return { commit: head, sourceWorktreeClean: true };
  }
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) {
    throw new Error("Release evidence sourceCommit must be a full commit SHA.");
  }
  const resolved = runGit(
    baseRoot,
    ["rev-parse", "--verify", `${expectedCommit}^{commit}`],
    "resolve sourceCommit",
  );
  if (resolved !== expectedCommit) {
    throw new Error("Release evidence sourceCommit did not resolve exactly.");
  }
  const treeDiff = spawnSync(
    "git",
    ["diff", "--quiet", "--no-ext-diff", expectedCommit, head, "--", ...inputs],
    { cwd: baseRoot, encoding: "utf8" },
  );
  if (treeDiff.status === 1) {
    throw new Error(`Current ${label} inputs differ from sourceCommit.`);
  }
  if (treeDiff.status !== 0) {
    throw new Error(
      `Could not compare ${label} sourceCommit inputs for release evidence.`,
    );
  }
  return { commit: expectedCommit, sourceWorktreeClean: true };
}

export function releaseEvidenceGitProvenance(
  baseRoot,
  edition,
  expectedCommit,
) {
  return gitInputProvenance(
    baseRoot,
    inputsForEdition(edition),
    `${edition} source`,
    expectedCommit,
  );
}

export function releaseEvidenceGeneratorGitProvenance(
  baseRoot,
  expectedCommit,
) {
  return gitInputProvenance(
    baseRoot,
    RELEASE_EVIDENCE_GENERATOR_INPUTS,
    "generator",
    expectedCommit,
  );
}

function shouldExclude(relativePath) {
  const segments = relativePath.split(/[\\/]/);
  return (
    segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment)) ||
    segments.some((segment) => segment.startsWith(".env")) ||
    segments.at(-1)?.endsWith(".tsbuildinfo") === true
  );
}

async function collectFiles(baseRoot, relativePath, files, excludeBuildFiles) {
  if (excludeBuildFiles && shouldExclude(relativePath)) return;
  const absolutePath = path.join(baseRoot, relativePath);
  const info = await lstat(absolutePath).catch(() => null);
  if (!info) {
    throw new Error(
      `Release evidence digest input is missing: ${relativePath}`,
    );
  }
  if (info.isSymbolicLink()) {
    throw new Error(
      `Release evidence digest refuses symlinks: ${relativePath}`,
    );
  }
  if (info.isFile()) {
    files.push(relativePath);
    return;
  }
  if (!info.isDirectory()) {
    throw new Error(
      `Release evidence digest input is not a regular file or directory: ${relativePath}`,
    );
  }
  const entries = await readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Release evidence source digest refuses symlinks: ${relativePath}/${entry.name}`,
      );
    }
    await collectFiles(
      baseRoot,
      path.join(relativePath, entry.name),
      files,
      excludeBuildFiles,
    );
  }
}

async function digestInputs({
  baseRoot,
  excludeBuildFiles,
  inputs,
  prefix,
  schemaVersion,
}) {
  const files = [];
  for (const input of inputs) {
    await collectFiles(baseRoot, input, files, excludeBuildFiles);
  }
  files.sort((left, right) => left.localeCompare(right, "en"));

  const hash = createHash("sha256");
  hash.update(`${prefix}${schemaVersion}\0`);
  let totalBytes = 0;
  for (const relativePath of files) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    const rawContents = await readFile(path.join(baseRoot, relativePath));
    const contents = canonicalizeReleaseEvidenceBytes(rawContents);
    totalBytes += contents.length;
    hash.update(normalizedPath);
    hash.update("\0");
    hash.update(String(contents.length));
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return {
    schemaVersion,
    sha256: hash.digest("hex"),
    fileCount: files.length,
    totalBytes,
  };
}

export function canonicalizeReleaseEvidenceBytes(contents) {
  if (!Buffer.isBuffer(contents)) {
    throw new TypeError("Release evidence canonicalization requires a Buffer.");
  }
  if (contents.includes(0) || !isUtf8(contents)) return contents;
  return Buffer.from(contents.toString("utf8").replace(/\r\n?/g, "\n"), "utf8");
}

export async function releaseEvidenceSourceDigest(baseRoot, edition) {
  const digest = await digestInputs({
    baseRoot,
    excludeBuildFiles: true,
    inputs: inputsForEdition(edition),
    prefix: "speakright-release-evidence-source-v",
    schemaVersion: RELEASE_EVIDENCE_SOURCE_DIGEST_SCHEMA,
  });
  return {
    schemaVersion: digest.schemaVersion,
    sha256: digest.sha256,
    fileCount: digest.fileCount,
  };
}

export async function releaseEvidenceGeneratorDigest(baseRoot) {
  return digestInputs({
    baseRoot,
    excludeBuildFiles: false,
    inputs: RELEASE_EVIDENCE_GENERATOR_INPUTS,
    prefix: "speakright-release-evidence-generator-v",
    schemaVersion: RELEASE_EVIDENCE_GENERATOR_DIGEST_SCHEMA,
  });
}
