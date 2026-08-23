import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canonicalizeReleaseEvidenceBytes,
  RELEASE_EVIDENCE_GENERATOR_DIGEST_SCHEMA,
  RELEASE_EVIDENCE_GENERATOR_INPUTS,
  releaseEvidenceGeneratorDigest,
  releaseEvidenceGeneratorGitProvenance,
} from "./lib/release-evidence-source-digest.mjs";

function git(projectRoot, arguments_) {
  return execFileSync("git", ["-C", projectRoot, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function main() {
  assert.deepEqual(
    canonicalizeReleaseEvidenceBytes(Buffer.from("line one\r\nline two\r")),
    Buffer.from("line one\nline two\n"),
    "Text digests must be independent of checkout line endings.",
  );
  const binaryFixture = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]);
  assert.deepEqual(
    canonicalizeReleaseEvidenceBytes(binaryFixture),
    binaryFixture,
    "Binary evidence inputs must retain their exact bytes.",
  );

  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-release-evidence-generator-contract-"),
  );
  try {
    for (const relativePath of RELEASE_EVIDENCE_GENERATOR_INPUTS) {
      const filePath = path.join(projectRoot, ...relativePath.split("/"));
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, `fixture:${relativePath}\n`);
    }
    git(projectRoot, ["init", "--quiet"]);
    git(projectRoot, [
      "config",
      "user.email",
      "release-evidence@example.invalid",
    ]);
    git(projectRoot, ["config", "user.name", "SpeakRight Evidence Contract"]);
    git(projectRoot, ["add", "--all"]);
    git(projectRoot, ["commit", "--quiet", "-m", "generator fixture"]);
    const sourceCommit = git(projectRoot, ["rev-parse", "HEAD"]);
    assert.deepEqual(
      releaseEvidenceGeneratorGitProvenance(projectRoot, sourceCommit),
      { commit: sourceCommit, sourceWorktreeClean: true },
    );
    const initial = await releaseEvidenceGeneratorDigest(projectRoot);
    assert.equal(
      initial.schemaVersion,
      RELEASE_EVIDENCE_GENERATOR_DIGEST_SCHEMA,
    );
    assert.equal(initial.fileCount, RELEASE_EVIDENCE_GENERATOR_INPUTS.length);
    assert.ok(initial.totalBytes > 0);

    const changedPath = path.join(
      projectRoot,
      "scripts",
      "capture-browser-release-evidence.mjs",
    );
    await writeFile(changedPath, "dirty generator bytes\n");
    assert.throws(
      () => releaseEvidenceGeneratorGitProvenance(projectRoot, sourceCommit),
      /generator inputs must be committed and clean/,
    );
    const dirtyDigest = await releaseEvidenceGeneratorDigest(projectRoot);
    assert.notEqual(dirtyDigest.sha256, initial.sha256);

    git(projectRoot, [
      "checkout",
      "--",
      "scripts/capture-browser-release-evidence.mjs",
    ]);
    const committedDriftPath = path.join(
      projectRoot,
      "scripts",
      "lib",
      "release-evidence-fixtures.mjs",
    );
    await writeFile(committedDriftPath, "committed generator drift\n");
    git(projectRoot, ["add", "--all"]);
    git(projectRoot, ["commit", "--quiet", "-m", "generator drift"]);
    assert.throws(
      () => releaseEvidenceGeneratorGitProvenance(projectRoot, sourceCommit),
      /generator inputs differ from sourceCommit/,
    );
  } finally {
    await rm(projectRoot, { force: true, recursive: true });
  }
  console.log("Release evidence generator provenance contract passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
