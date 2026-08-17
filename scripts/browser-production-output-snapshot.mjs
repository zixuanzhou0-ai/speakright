import { randomUUID } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  RELEASE_EVIDENCE_OUTPUT_TREE_SCHEMA,
  releaseEvidenceOutputTree,
} from "./lib/release-evidence-output-tree.mjs";

export const BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_SCHEMA = 1;
export const BROWSER_PRODUCTION_OUTPUT_RELATIVE_PATH = "apps/browser/out";
export const BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_RELATIVE_PATH =
  "outputs/release/browser-production-output-snapshot.json";

const SNAPSHOT_KIND = "speakright-browser-production-output";
const SNAPSHOT_KEYS = Object.freeze([
  "channel",
  "commitSha",
  "createdAt",
  "edition",
  "kind",
  "outputRoot",
  "outputTree",
  "schemaVersion",
]);
const OUTPUT_TREE_KEYS = Object.freeze([
  "fileCount",
  "schemaVersion",
  "sha256",
  "totalBytes",
]);

function fail(message) {
  throw new Error(`Browser production output snapshot failed: ${message}`);
}

function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    fail(`${label} has an unexpected schema`);
  }
}

function assertCommitSha(commitSha) {
  if (typeof commitSha !== "string" || !/^[a-f0-9]{40}$/u.test(commitSha)) {
    fail("release commit must be a full lowercase Git SHA");
  }
  return commitSha;
}

function assertSha256(sha256, label) {
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(sha256)) {
    fail(`${label} must be a lowercase SHA-256 digest`);
  }
  return sha256;
}

function assertCreatedAt(createdAt) {
  if (
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString() !== createdAt
  ) {
    fail("createdAt must be a canonical ISO timestamp");
  }
  return createdAt;
}

function assertOutputTree(outputTree) {
  assertExactKeys(outputTree, OUTPUT_TREE_KEYS, "outputTree");
  if (outputTree.schemaVersion !== RELEASE_EVIDENCE_OUTPUT_TREE_SCHEMA) {
    fail("outputTree schema version is unsupported");
  }
  assertSha256(outputTree.sha256, "outputTree.sha256");
  if (
    !Number.isSafeInteger(outputTree.fileCount) ||
    outputTree.fileCount <= 0
  ) {
    fail("outputTree.fileCount must be a positive safe integer");
  }
  if (
    !Number.isSafeInteger(outputTree.totalBytes) ||
    outputTree.totalBytes <= 0
  ) {
    fail("outputTree.totalBytes must be a positive safe integer");
  }
  return outputTree;
}

function assertSnapshot(snapshot) {
  assertExactKeys(snapshot, SNAPSHOT_KEYS, "snapshot");
  if (snapshot.schemaVersion !== BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_SCHEMA) {
    fail("snapshot schema version is unsupported");
  }
  if (
    snapshot.kind !== SNAPSHOT_KIND ||
    snapshot.edition !== "browser" ||
    snapshot.channel !== "stable"
  ) {
    fail("snapshot release identity is invalid");
  }
  if (snapshot.outputRoot !== BROWSER_PRODUCTION_OUTPUT_RELATIVE_PATH) {
    fail("snapshot output root is invalid");
  }
  assertCommitSha(snapshot.commitSha);
  assertCreatedAt(snapshot.createdAt);
  assertOutputTree(snapshot.outputTree);
  return snapshot;
}

function workspacePaths(workspaceRoot) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  return {
    outputRoot: path.join(
      resolvedWorkspaceRoot,
      ...BROWSER_PRODUCTION_OUTPUT_RELATIVE_PATH.split("/"),
    ),
    snapshotPath: path.join(
      resolvedWorkspaceRoot,
      ...BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_RELATIVE_PATH.split("/"),
    ),
  };
}

async function ensureSafeSnapshotDirectory(snapshotPath) {
  const outputsDirectory = path.dirname(path.dirname(snapshotPath));
  const releaseDirectory = path.dirname(snapshotPath);
  for (const directory of [outputsDirectory, releaseDirectory]) {
    const existing = await lstat(directory).catch((error) => {
      if (error?.code === "ENOENT") return null;
      throw error;
    });
    if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) {
      fail("snapshot output directory must be a real directory");
    }
    if (!existing) await mkdir(directory);
  }
}

async function writeSnapshotAtomically(snapshotPath, snapshot) {
  await ensureSafeSnapshotDirectory(snapshotPath);
  const temporaryPath = `${snapshotPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rm(snapshotPath, { force: true });
    await rename(temporaryPath, snapshotPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function readSnapshot(snapshotPath) {
  const info = await lstat(snapshotPath).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!info || !info.isFile() || info.isSymbolicLink()) {
    fail("snapshot file is missing or is not a regular file");
  }
  let snapshot;
  try {
    snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch {
    fail("snapshot file is not valid JSON");
  }
  return assertSnapshot(snapshot);
}

function outputTreesMatch(left, right) {
  return OUTPUT_TREE_KEYS.every((key) => left[key] === right[key]);
}

export async function createBrowserProductionOutputSnapshot({
  commitSha,
  createdAt = new Date().toISOString(),
  workspaceRoot = process.cwd(),
}) {
  const releaseCommit = assertCommitSha(commitSha);
  const timestamp = assertCreatedAt(createdAt);
  const { outputRoot, snapshotPath } = workspacePaths(workspaceRoot);
  const outputTree = assertOutputTree(
    await releaseEvidenceOutputTree(outputRoot),
  );
  const snapshot = assertSnapshot({
    schemaVersion: BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_SCHEMA,
    kind: SNAPSHOT_KIND,
    edition: "browser",
    channel: "stable",
    commitSha: releaseCommit,
    createdAt: timestamp,
    outputRoot: BROWSER_PRODUCTION_OUTPUT_RELATIVE_PATH,
    outputTree,
  });
  await writeSnapshotAtomically(snapshotPath, snapshot);
  return snapshot;
}

export async function verifyBrowserProductionOutputSnapshot({
  commitSha,
  expectedTreeSha256,
  workspaceRoot = process.cwd(),
}) {
  const releaseCommit = assertCommitSha(commitSha);
  const anchoredTreeSha256 = assertSha256(
    expectedTreeSha256,
    "anchored output-tree digest",
  );
  const { outputRoot, snapshotPath } = workspacePaths(workspaceRoot);
  const snapshot = await readSnapshot(snapshotPath);
  if (snapshot.commitSha !== releaseCommit) {
    fail("snapshot commit does not match the release commit");
  }
  if (snapshot.outputTree.sha256 !== anchoredTreeSha256) {
    fail("snapshot does not match the anchored output-tree digest");
  }
  const currentOutputTree = assertOutputTree(
    await releaseEvidenceOutputTree(outputRoot),
  );
  if (!outputTreesMatch(currentOutputTree, snapshot.outputTree)) {
    fail("Browser production output tree changed after validation");
  }
  return snapshot;
}

function parseCliArguments(argumentsList) {
  const [command, ...argumentsAfterCommand] = argumentsList;
  if (command !== "write" && command !== "verify") {
    fail(
      "usage: browser-production-output-snapshot.mjs <write|verify> --commit <sha> [--expected-tree-sha256 <sha>]",
    );
  }
  const values = new Map();
  for (let index = 0; index < argumentsAfterCommand.length; index += 2) {
    const name = argumentsAfterCommand[index];
    const value = argumentsAfterCommand[index + 1];
    if (
      !["--commit", "--expected-tree-sha256"].includes(name) ||
      typeof value !== "string" ||
      values.has(name)
    ) {
      fail("snapshot command contains invalid or duplicate arguments");
    }
    values.set(name, value);
  }
  if (!values.has("--commit")) fail("snapshot command requires --commit");
  if (command === "write" && values.has("--expected-tree-sha256")) {
    fail("write does not accept --expected-tree-sha256");
  }
  if (command === "verify" && !values.has("--expected-tree-sha256")) {
    fail("verify requires --expected-tree-sha256");
  }
  return {
    command,
    commitSha: values.get("--commit"),
    expectedTreeSha256: values.get("--expected-tree-sha256"),
  };
}

async function appendGithubOutputs(snapshot) {
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (!githubOutput) return;
  await appendFile(
    githubOutput,
    [
      `tree_sha256=${snapshot.outputTree.sha256}`,
      `file_count=${snapshot.outputTree.fileCount}`,
      `total_bytes=${snapshot.outputTree.totalBytes}`,
      `snapshot_path=${BROWSER_PRODUCTION_OUTPUT_SNAPSHOT_RELATIVE_PATH}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  if (options.command === "write") {
    const snapshot = await createBrowserProductionOutputSnapshot({
      commitSha: options.commitSha,
    });
    await appendGithubOutputs(snapshot);
    console.log(
      `Browser production output snapshot created: ${snapshot.outputTree.sha256}`,
    );
    return;
  }
  const snapshot = await verifyBrowserProductionOutputSnapshot({
    commitSha: options.commitSha,
    expectedTreeSha256: options.expectedTreeSha256,
  });
  console.log(
    `Browser production output snapshot verified: ${snapshot.outputTree.sha256}`,
  );
}

const invokedAsScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
