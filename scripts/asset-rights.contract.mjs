import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  analyzeAssetRights,
  digestAssetFamily,
  digestFile,
  filesForEdition,
  refreshRegistryDigests,
} from "./lib/asset-rights-core.mjs";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "speakright-rights-"));
const canonicalRoot = path.join(tempRoot, "public");
await fs.mkdir(path.join(canonicalRoot, "audio"), { recursive: true });
await fs.writeFile(path.join(canonicalRoot, "audio", "sample.mp3"), "original");
await fs.writeFile(
  path.join(canonicalRoot, "manifest.json"),
  '{"version":1}\n',
);

function registryFor(redistribution = "approved") {
  return {
    $schema: "./asset-rights-registry.schema.json",
    version: 1,
    canonicalRoot: "public",
    generatedAt: "2026-08-16",
    records: [
      {
        id: "fixture-audio",
        path: "audio/**/*.mp3",
        sha256: "0".repeat(64),
        assetCount: 0,
        kind: "audio",
        sourceName: "Fixture source",
        creator: "Fixture creator",
        licenseSpdx: "MIT",
        evidenceRef: "FIXTURE-EVIDENCE-001",
        redistribution,
        modifications: "None.",
        editions: ["browser", "desktop"],
        reviewedAt: "2026-08-16",
      },
    ],
  };
}

try {
  const refreshed = await refreshRegistryDigests({
    canonicalRoot,
    registry: registryFor(),
  });
  assert.equal(refreshed.records[0].assetCount, 1);
  assert.equal(
    refreshed.records[0].sha256,
    await digestAssetFamily(canonicalRoot, ["audio/sample.mp3"]),
  );

  const valid = await analyzeAssetRights({
    canonicalRoot,
    registry: refreshed,
  });
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(filesForEdition(valid, "browser"), [
    "audio/sample.mp3",
    "manifest.json",
  ]);

  await fs.writeFile(
    path.join(canonicalRoot, "audio", "sample.mp3"),
    "tampered",
  );
  const tampered = await analyzeAssetRights({
    canonicalRoot,
    registry: refreshed,
  });
  assert.ok(
    tampered.errors.some((error) =>
      error.includes("tree digest does not match"),
    ),
    "tampered bytes must fail the committed digest",
  );

  await fs.unlink(path.join(canonicalRoot, "audio", "sample.mp3"));
  const missing = await analyzeAssetRights({
    canonicalRoot,
    registry: refreshed,
  });
  assert.ok(
    missing.errors.some(
      (error) =>
        error.includes("matches no files") || error.includes("assetCount"),
    ),
    "missing assets must fail validation",
  );

  await fs.writeFile(
    path.join(canonicalRoot, "audio", "sample.mp3"),
    "original",
  );

  const detailsDirectory = path.join(tempRoot, "docs");
  const detailsPath = path.join(
    detailsDirectory,
    "fixture-source-details.json",
  );
  await fs.mkdir(detailsDirectory, { recursive: true });
  const sourceDetails = {
    rightsDetailsContract: "asset-file-rights-v1",
    assets: [
      {
        kind: "audio",
        source: "Fixture Commons source",
        license: "CC-BY-SA-4.0",
        attribution: "Fixture creator, CC BY-SA 4.0.",
        sourcePageUrl: "https://fixtures.example/wiki/File:sample.mp3",
        sourceUrl: "https://fixtures.example/files/sample.mp3",
        localPublicPath: "/audio/sample.mp3",
        localFile: "audio/sample.mp3",
        bytes: 8,
        sha256: await digestFile(
          path.join(canonicalRoot, "audio", "sample.mp3"),
        ),
        downloaded: true,
      },
    ],
  };
  const writeSourceDetails = async (document) => {
    await fs.writeFile(
      detailsPath,
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8",
    );
  };
  await writeSourceDetails(sourceDetails);

  const strictRegistry = registryFor();
  Object.assign(strictRegistry.records[0], {
    sourceUrl: "https://fixtures.example/",
    sourceDetailsPath: "docs/fixture-source-details.json",
    sourceDetailsSha256: "0".repeat(64),
  });
  const strictRefreshed = await refreshRegistryDigests({
    canonicalRoot,
    registry: strictRegistry,
  });
  const strictValid = await analyzeAssetRights({
    canonicalRoot,
    registry: strictRefreshed,
  });
  assert.deepEqual(
    strictValid.errors,
    [],
    "strict per-file source details must validate against packaged bytes",
  );

  const noAttribution = structuredClone(sourceDetails);
  delete noAttribution.assets[0].attribution;
  await writeSourceDetails(noAttribution);
  const missingAttribution = await analyzeAssetRights({
    canonicalRoot,
    registry: strictRefreshed,
  });
  assert.ok(
    missingAttribution.errors.some((error) =>
      error.includes("missing creator or attribution"),
    ),
    "removing per-file attribution must fail validation",
  );

  const changedLicense = structuredClone(sourceDetails);
  changedLicense.assets[0].license = "LicenseRef-Tampered";
  await writeSourceDetails(changedLicense);
  const tamperedLicense = await analyzeAssetRights({
    canonicalRoot,
    registry: strictRefreshed,
  });
  assert.ok(
    tamperedLicense.errors.some((error) =>
      error.includes("source details SHA-256 does not match"),
    ),
    "changing a non-empty per-file license must fail the committed details digest",
  );

  const changedAttribution = structuredClone(sourceDetails);
  changedAttribution.assets[0].attribution = "Different attribution";
  await writeSourceDetails(changedAttribution);
  const tamperedAttribution = await analyzeAssetRights({
    canonicalRoot,
    registry: strictRefreshed,
  });
  assert.ok(
    tamperedAttribution.errors.some((error) =>
      error.includes("source details SHA-256 does not match"),
    ),
    "changing non-empty per-file attribution must fail the committed details digest",
  );

  const changedHash = structuredClone(sourceDetails);
  changedHash.assets[0].sha256 = "f".repeat(64);
  await writeSourceDetails(changedHash);
  const tamperedSourceHash = await analyzeAssetRights({
    canonicalRoot,
    registry: strictRefreshed,
  });
  assert.ok(
    tamperedSourceHash.errors.some((error) =>
      error.includes("sha256 does not match the packaged file"),
    ),
    "changing a per-file hash must fail against the packaged bytes",
  );
  await writeSourceDetails(sourceDetails);

  const referenceRegistry = registryFor("reference-only");
  referenceRegistry.records[0].assetCount = 1;
  referenceRegistry.records[0].sha256 = await digestAssetFamily(canonicalRoot, [
    "audio/sample.mp3",
  ]);
  const referenceOnly = await analyzeAssetRights({
    canonicalRoot,
    registry: referenceRegistry,
  });
  assert.ok(
    referenceOnly.errors.some((error) =>
      error.includes("reference-only record"),
    ),
    "reference-only sources must never match packaged files",
  );

  await fs.writeFile(
    path.join(canonicalRoot, "manifest.json"),
    '{"outputDir":"E:\\\\SpeakRight\\\\public"}\n',
  );
  const leakedPath = await analyzeAssetRights({
    canonicalRoot,
    registry: refreshed,
  });
  assert.ok(
    leakedPath.errors.some((error) => error.includes("local absolute path")),
    "local absolute paths must not enter packaged manifests",
  );

  console.log("Asset-rights contract passed.");
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
