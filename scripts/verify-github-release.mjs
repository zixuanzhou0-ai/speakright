import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  expectedReleaseAssetNames,
  readReleaseDirectoryEntries,
  resolveStagingDirectory,
  verifyReleaseStagingEntries,
} from "./verify-release-staging.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "zixuanzhou0-ai/speakright";
const repositoryUrl = `https://github.com/${repository}`;
const remoteVerificationRoot = path.join(
  root,
  "outputs",
  "release",
  "remote-verification",
);

function requireArgument(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${label} must be true or false.`);
}

function requireReleaseId(value) {
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new Error("--release-id must be a positive integer.");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("--release-id exceeds the safe integer range.");
  }
  return parsed;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function expectedReleaseTitle(edition, version) {
  return edition === "browser"
    ? `SpeakRight ${version} — Browser Stable`
    : `SpeakRight ${version} — Unsigned Desktop Preview`;
}

export function validateGithubReleaseMetadata({
  edition,
  version,
  tag,
  releaseId,
  draft,
  release,
  localEntries,
}) {
  const expectedNames = [
    ...expectedReleaseAssetNames(edition, version),
    "SHA256SUMS.txt",
  ].sort();
  if (!release || release.id !== releaseId) {
    throw new Error(
      `GitHub Release ID mismatch: expected ${releaseId}, received ${release?.id}.`,
    );
  }
  if (release.tag_name !== tag) {
    throw new Error(`GitHub Release tag mismatch: ${release.tag_name}.`);
  }
  if (release.name !== expectedReleaseTitle(edition, version)) {
    throw new Error(`GitHub Release title mismatch: ${release.name}.`);
  }
  if (release.draft !== draft) {
    throw new Error(
      `GitHub Release draft state mismatch: expected ${draft}, received ${release.draft}.`,
    );
  }
  const expectedPrerelease = edition === "desktop";
  if (release.prerelease !== expectedPrerelease) {
    throw new Error(
      `GitHub Release prerelease state mismatch: expected ${expectedPrerelease}.`,
    );
  }
  if (draft && release.published_at !== null) {
    throw new Error("Draft GitHub Release unexpectedly has published_at.");
  }
  if (!draft && typeof release.published_at !== "string") {
    throw new Error("Published GitHub Release has no published_at timestamp.");
  }

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const actualNames = assets.map((asset) => asset.name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `GitHub Release asset set mismatch. Expected ${expectedNames.join(", ")}; received ${actualNames.join(", ")}.`,
    );
  }

  for (const asset of assets) {
    if (!Number.isSafeInteger(asset.id) || asset.id <= 0) {
      throw new Error(`GitHub Release asset ${asset.name} has no valid ID.`);
    }
    if (asset.state !== "uploaded") {
      throw new Error(
        `GitHub Release asset ${asset.name} is not fully uploaded.`,
      );
    }
    const local = localEntries.get(asset.name);
    if (!Buffer.isBuffer(local)) {
      throw new Error(`Local release asset is missing: ${asset.name}.`);
    }
    if (asset.size !== local.length) {
      throw new Error(`GitHub Release asset size mismatch: ${asset.name}.`);
    }
    const expectedDigest = `sha256:${sha256(local)}`;
    if (asset.digest !== expectedDigest) {
      throw new Error(`GitHub Release asset digest mismatch: ${asset.name}.`);
    }
    const expectedDownloadUrl = `${repositoryUrl}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
    if (asset.browser_download_url !== expectedDownloadUrl) {
      throw new Error(
        `GitHub Release asset download URL mismatch: ${asset.name}.`,
      );
    }
  }

  return {
    releaseId: release.id,
    assetCount: assets.length,
    draft,
  };
}

function runGh(args, options = {}) {
  const result = spawnSync("gh", args, {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message || result.stderr?.toString() || "unknown error";
    throw new Error(`gh ${args[0]} failed: ${detail.trim()}`);
  }
  return result.stdout;
}

function downloadReleaseAssets(release, edition, version) {
  rmSync(remoteVerificationRoot, { recursive: true, force: true });
  mkdirSync(remoteVerificationRoot, { recursive: true });
  try {
    const assetsByName = new Map(
      release.assets.map((asset) => [asset.name, asset]),
    );
    const expectedNames = [
      ...expectedReleaseAssetNames(edition, version),
      "SHA256SUMS.txt",
    ].sort();
    for (const name of expectedNames) {
      const asset = assetsByName.get(name);
      if (!asset) {
        throw new Error(
          `GitHub Release asset is missing before download: ${name}.`,
        );
      }
      const output = path.join(remoteVerificationRoot, name);
      const descriptor = openSync(output, "wx");
      try {
        runGh(
          [
            "api",
            "-H",
            "Accept: application/octet-stream",
            `repos/${repository}/releases/assets/${asset.id}`,
          ],
          { encoding: null, stdio: ["ignore", descriptor, "pipe"] },
        );
      } finally {
        closeSync(descriptor);
      }
    }
    return readReleaseDirectoryEntries(remoteVerificationRoot);
  } finally {
    rmSync(remoteVerificationRoot, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const edition = requireArgument(args, "--edition");
  const version = requireArgument(args, "--version");
  const tag = requireArgument(args, "--tag");
  const releaseId = requireReleaseId(requireArgument(args, "--release-id"));
  const draft = requireBoolean(requireArgument(args, "--draft"), "--draft");
  const download = requireBoolean(
    requireArgument(args, "--download"),
    "--download",
  );
  const stage = resolveStagingDirectory(requireArgument(args, "--stage"));
  const config = JSON.parse(
    readFileSync(path.join(root, "release.config.json"), "utf8"),
  );
  if (config.repositoryUrl !== repositoryUrl || config.version !== version) {
    throw new Error("Release configuration identity mismatch.");
  }
  if (config.editions?.[edition]?.releaseTag !== tag) {
    throw new Error("Release tag does not match release.config.json.");
  }

  const localEntries = readReleaseDirectoryEntries(stage);
  verifyReleaseStagingEntries({ edition, version, entries: localEntries });
  const release = JSON.parse(
    runGh(["api", `repos/${repository}/releases/${releaseId}`]),
  );
  const result = validateGithubReleaseMetadata({
    edition,
    version,
    tag,
    releaseId,
    draft,
    release,
    localEntries,
  });

  if (download) {
    const downloadedEntries = downloadReleaseAssets(release, edition, version);
    verifyReleaseStagingEntries({
      edition,
      version,
      entries: downloadedEntries,
    });
    for (const [name, local] of localEntries) {
      if (sha256(downloadedEntries.get(name)) !== sha256(local)) {
        throw new Error(`Downloaded GitHub Release asset mismatch: ${name}.`);
      }
    }
  }

  console.log(
    `GitHub Release ${tag} verified: id ${result.releaseId}, ${result.assetCount} assets, draft=${draft}, downloaded=${download}.`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main();
}
