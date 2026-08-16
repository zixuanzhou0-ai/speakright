import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertSafeReleaseEvidenceTreePath,
  releaseEvidenceOutputTree,
} from "./lib/release-evidence-output-tree.mjs";

async function main() {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-release-evidence-output-contract-"),
  );
  const outputRoot = path.join(temporaryRoot, "out");
  try {
    await mkdir(path.join(outputRoot, "_next"), { recursive: true });
    await writeFile(path.join(outputRoot, "index.html"), "<main>one</main>");
    await writeFile(path.join(outputRoot, "_next", "app.js"), "alpha");
    const initial = await releaseEvidenceOutputTree(outputRoot);
    assert.equal(initial.fileCount, 2);
    assert.ok(initial.totalBytes > 0);

    await writeFile(path.join(outputRoot, "_next", "app.js"), "bravo");
    const changedBytes = await releaseEvidenceOutputTree(outputRoot);
    assert.notEqual(changedBytes.sha256, initial.sha256);

    await writeFile(path.join(outputRoot, "_next", "app.js"), "alpha");
    await rename(
      path.join(outputRoot, "_next", "app.js"),
      path.join(outputRoot, "_next", "renamed.js"),
    );
    const changedPath = await releaseEvidenceOutputTree(outputRoot);
    assert.notEqual(changedPath.sha256, initial.sha256);

    assert.throws(
      () => assertSafeReleaseEvidenceTreePath("../escape.js"),
      /Unsafe release-evidence output path/,
    );
    assert.throws(
      () => assertSafeReleaseEvidenceTreePath("unsafe\\name.js"),
      /Unsafe release-evidence output path/,
    );

    const symlinkTarget = path.join(temporaryRoot, "symlink-target");
    await mkdir(symlinkTarget);
    await writeFile(path.join(symlinkTarget, "outside.js"), "outside");
    await symlink(
      symlinkTarget,
      path.join(outputRoot, "linked-output"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      releaseEvidenceOutputTree(outputRoot),
      /output tree refuses symlinks/,
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
  console.log("Release evidence output-tree contract passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
