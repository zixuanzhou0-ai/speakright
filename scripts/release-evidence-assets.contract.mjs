import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { digestAssetFamily, walkFiles } from "./lib/asset-rights-core.mjs";
import {
  materializeReleaseEvidenceAssets,
  releaseEvidenceAssetSet,
} from "./lib/release-evidence-assets.mjs";

function git(projectRoot, arguments_) {
  return execFileSync("git", ["-C", projectRoot, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function writeFixture(projectRoot) {
  const publicRoot = path.join(projectRoot, "public");
  const registryPath = path.join(
    projectRoot,
    "docs",
    "assets",
    "asset-rights-registry.json",
  );
  await Promise.all([
    mkdir(path.join(publicRoot, "audio"), { recursive: true }),
    mkdir(path.join(publicRoot, "videos", "phonemes"), { recursive: true }),
    mkdir(path.join(projectRoot, "docs", "assets"), { recursive: true }),
    mkdir(path.join(projectRoot, "scripts", "lib"), { recursive: true }),
  ]);
  await writeFile(path.join(publicRoot, "audio", "demo.mp3"), "demo-audio");
  await writeFile(
    path.join(publicRoot, "videos", "phonemes", "ignored.mp4"),
    "ignored-local-video",
  );
  await writeFile(
    path.join(projectRoot, ".gitignore"),
    "public/videos/phonemes/\n",
  );
  await writeFile(
    path.join(
      projectRoot,
      "docs",
      "assets",
      "asset-rights-registry.schema.json",
    ),
    "{}\n",
  );
  await writeFile(
    path.join(projectRoot, "scripts", "lib", "asset-rights-core.mjs"),
    "// fixture policy input\n",
  );
  await writeFile(
    path.join(projectRoot, "scripts", "lib", "release-evidence-assets.mjs"),
    "// fixture evidence policy input\n",
  );
  const digest = await digestAssetFamily(publicRoot, ["audio/demo.mp3"]);
  const registry = {
    $schema: "./asset-rights-registry.schema.json",
    version: 1,
    canonicalRoot: "public",
    generatedAt: "2026-08-16",
    records: [
      {
        id: "fixture-audio",
        path: "audio/*.mp3",
        sha256: digest,
        assetCount: 1,
        kind: "audio",
        sourceName: "Release evidence contract fixture",
        creator: "SpeakRight test fixture",
        evidenceRef: "TEST-EVIDENCE-001",
        redistribution: "approved",
        modifications: "Deterministic test bytes only.",
        editions: ["browser", "desktop"],
        reviewedAt: "2026-08-16",
      },
    ],
  };
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  return { publicRoot, registryPath };
}

async function main() {
  const projectRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-release-evidence-assets-contract-"),
  );
  try {
    const { publicRoot, registryPath } = await writeFixture(projectRoot);
    git(projectRoot, ["init", "--quiet"]);
    git(projectRoot, [
      "config",
      "user.email",
      "release-evidence@example.invalid",
    ]);
    git(projectRoot, ["config", "user.name", "SpeakRight Evidence Contract"]);
    git(projectRoot, ["add", "--all"]);
    git(projectRoot, ["commit", "--quiet", "-m", "fixture"]);
    const sourceCommit = git(projectRoot, ["rev-parse", "HEAD"]);

    const initial = await releaseEvidenceAssetSet(
      projectRoot,
      "browser",
      sourceCommit,
    );
    assert.equal(initial.summary.fileCount, 1);
    assert.deepEqual(
      initial.files.map((entry) => entry.path),
      ["audio/demo.mp3"],
    );

    const destinationRoot = path.join(projectRoot, "staging-browser");
    const materialized = await materializeReleaseEvidenceAssets({
      destinationRoot,
      edition: "browser",
      expectedCommit: sourceCommit,
      projectRoot,
    });
    assert.deepEqual(materialized.assetSet, initial.summary);
    assert.deepEqual(await walkFiles(destinationRoot), ["audio/demo.mp3"]);
    assert.equal(
      existsSync(
        path.join(destinationRoot, "videos", "phonemes", "ignored.mp4"),
      ),
      false,
      "Git-ignored physical assets must not enter evidence staging",
    );

    const registryBytes = await readFile(registryPath);
    await writeFile(
      registryPath,
      Buffer.concat([registryBytes, Buffer.from(" ")]),
    );
    await assert.rejects(
      releaseEvidenceAssetSet(projectRoot, "browser", sourceCommit),
      /asset inputs contain staged, unstaged, or untracked changes/,
    );
    await writeFile(registryPath, registryBytes);

    const audioPath = path.join(publicRoot, "audio", "demo.mp3");
    const audioBytes = await readFile(audioPath);
    await writeFile(audioPath, "changed-audio");
    await assert.rejects(
      releaseEvidenceAssetSet(projectRoot, "browser", sourceCommit),
      /asset inputs contain staged, unstaged, or untracked changes/,
    );
    await writeFile(audioPath, audioBytes);

    const evidencePolicyPath = path.join(
      projectRoot,
      "scripts",
      "lib",
      "release-evidence-assets.mjs",
    );
    await writeFile(evidencePolicyPath, "// changed selection policy\n");
    git(projectRoot, ["add", "--all"]);
    git(projectRoot, ["commit", "--quiet", "-m", "change policy"]);
    await assert.rejects(
      releaseEvidenceAssetSet(projectRoot, "browser", sourceCommit),
      /asset inputs differ from the declared source commit/,
    );
  } finally {
    await rm(projectRoot, { force: true, recursive: true });
  }
  console.log("Release evidence tracked-asset contract passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
