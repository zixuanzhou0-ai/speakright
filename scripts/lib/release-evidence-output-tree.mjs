import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

export const RELEASE_EVIDENCE_OUTPUT_TREE_SCHEMA = 1;
const OUTPUT_TREE_PREFIX = "speakright-release-evidence-output-tree-v";

export function assertSafeReleaseEvidenceTreePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    /^[A-Za-z]:/u.test(relativePath) ||
    relativePath.split("/").some((segment) => !segment || segment === "..")
  ) {
    throw new Error(
      `Unsafe release-evidence output path: ${String(relativePath)}.`,
    );
  }
  return relativePath;
}

async function collectOutputFiles(root, directory = "", files = []) {
  const absoluteDirectory = directory
    ? path.join(root, ...directory.split("/"))
    : root;
  const info = await lstat(absoluteDirectory).catch(() => null);
  if (!info) {
    throw new Error("Release-evidence output tree does not exist.");
  }
  if (info.isSymbolicLink()) {
    throw new Error(
      `Release-evidence output tree refuses symlinks: ${directory || "."}.`,
    );
  }
  if (!info.isDirectory()) {
    throw new Error("Release-evidence output tree root must be a directory.");
  }
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const relativePath = directory ? `${directory}/${entry.name}` : entry.name;
    assertSafeReleaseEvidenceTreePath(relativePath);
    const absolutePath = path.join(root, ...relativePath.split("/"));
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Release-evidence output tree refuses symlinks: ${relativePath}.`,
      );
    }
    if (entry.isDirectory()) {
      await collectOutputFiles(root, relativePath, files);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(
        `Release-evidence output tree contains a non-regular file: ${relativePath}.`,
      );
    }
    files.push({ absolutePath, relativePath });
  }
  return files;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function updateFramed(hash, value) {
  hash.update(String(value), "utf8");
  hash.update("\0");
}

export async function releaseEvidenceOutputTree(root) {
  const resolvedRoot = path.resolve(root);
  const files = await collectOutputFiles(resolvedRoot);
  if (files.length === 0) {
    throw new Error("Release-evidence output tree must contain files.");
  }
  const hash = createHash("sha256");
  hash.update(`${OUTPUT_TREE_PREFIX}${RELEASE_EVIDENCE_OUTPUT_TREE_SCHEMA}\0`);
  let totalBytes = 0;
  for (const file of files) {
    const before = await lstat(file.absolutePath);
    if (!before.isFile() || before.isSymbolicLink()) {
      throw new Error(
        `Release-evidence output changed type while hashing: ${file.relativePath}.`,
      );
    }
    const fileSha256 = await hashFile(file.absolutePath);
    const after = await lstat(file.absolutePath);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      throw new Error(
        `Release-evidence output changed while hashing: ${file.relativePath}.`,
      );
    }
    totalBytes += after.size;
    updateFramed(hash, file.relativePath);
    updateFramed(hash, after.size);
    updateFramed(hash, fileSha256);
  }
  return {
    schemaVersion: RELEASE_EVIDENCE_OUTPUT_TREE_SCHEMA,
    sha256: hash.digest("hex"),
    fileCount: files.length,
    totalBytes,
  };
}
