import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

const EXPECTED_TYPES = ["exe", "nsis"];
const EXPECTED_EXTENSIONS = {
  exe: ".exe",
  nsis: ".exe",
};

function isWithin(boundary, candidate, { allowEqual = false } = {}) {
  const relative = path.relative(boundary, candidate);
  if (relative === "") return allowEqual;
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function isSamePath(left, right) {
  return path.relative(left, right) === "";
}

function requireArtifactField(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function lexicalBoundaryFor(type, releaseRoot, bundleRoot) {
  if (type === "exe") return releaseRoot;
  return path.join(bundleRoot, type);
}

function assertLexicalBoundary(type, artifactPath, releaseRoot, bundleRoot) {
  const boundary = lexicalBoundaryFor(type, releaseRoot, bundleRoot);
  if (type === "exe") {
    requireArtifactField(
      isSamePath(path.dirname(artifactPath), boundary),
      `artifact exe must be an immediate child of ${boundary}`,
    );
    return;
  }
  requireArtifactField(
    isWithin(boundary, artifactPath),
    `artifact ${type} path escapes expected bundle boundary ${boundary}`,
  );
}

export async function verifyReportedArtifacts({ workspaceRoot, artifacts }) {
  requireArtifactField(
    Array.isArray(artifacts) && artifacts.length > 0,
    "report contains no artifacts",
  );

  const resolvedWorkspace = path.resolve(workspaceRoot);
  const releaseRoot = path.resolve(
    resolvedWorkspace,
    "src-tauri",
    "target",
    "release",
  );
  const bundleRoot = path.join(releaseRoot, "bundle");
  const [realWorkspace, realReleaseRoot, realBundleRoot] = await Promise.all([
    realpath(resolvedWorkspace),
    realpath(releaseRoot),
    realpath(bundleRoot),
  ]);
  requireArtifactField(
    isWithin(realWorkspace, realReleaseRoot),
    "resolved release directory escapes the workspace",
  );
  requireArtifactField(
    isWithin(realReleaseRoot, realBundleRoot),
    "resolved bundle directory escapes the release directory",
  );

  const seenTypes = new Set();
  const verified = [];
  for (const artifact of artifacts) {
    requireArtifactField(
      artifact && typeof artifact === "object",
      "artifact entry is not an object",
    );
    requireArtifactField(
      EXPECTED_TYPES.includes(artifact.type),
      `unexpected artifact type ${artifact.type ?? "missing"}`,
    );
    requireArtifactField(
      !seenTypes.has(artifact.type),
      `duplicate artifact type ${artifact.type}`,
    );
    seenTypes.add(artifact.type);
    requireArtifactField(
      typeof artifact.path === "string" && artifact.path.trim() !== "",
      `artifact ${artifact.type} has no path`,
    );
    requireArtifactField(
      typeof artifact.sha256 === "string" &&
        /^[a-f0-9]{64}$/i.test(artifact.sha256),
      `artifact ${artifact.type} has an invalid SHA-256 digest`,
    );
    requireArtifactField(
      Number.isSafeInteger(artifact.bytes) && artifact.bytes >= 0,
      `artifact ${artifact.type} has invalid bytes`,
    );

    const resolvedArtifact = path.isAbsolute(artifact.path)
      ? path.resolve(artifact.path)
      : path.resolve(resolvedWorkspace, artifact.path);
    requireArtifactField(
      isWithin(resolvedWorkspace, resolvedArtifact),
      `artifact ${artifact.type} path escapes workspace: ${artifact.path}`,
    );
    assertLexicalBoundary(
      artifact.type,
      resolvedArtifact,
      releaseRoot,
      bundleRoot,
    );
    requireArtifactField(
      path.extname(resolvedArtifact).toLowerCase() ===
        EXPECTED_EXTENSIONS[artifact.type],
      `artifact ${artifact.type} has an unexpected extension`,
    );

    let realArtifact;
    let fileStats;
    try {
      [realArtifact, fileStats] = await Promise.all([
        realpath(resolvedArtifact),
        stat(resolvedArtifact),
      ]);
    } catch (error) {
      throw new Error(
        `artifact ${artifact.type} cannot be resolved: ${error instanceof Error ? error.message : error}`,
      );
    }
    requireArtifactField(
      fileStats.isFile(),
      `artifact ${artifact.type} is not a regular file`,
    );
    requireArtifactField(
      isWithin(realWorkspace, realArtifact),
      `artifact ${artifact.type} real path escapes workspace`,
    );
    assertLexicalBoundary(
      artifact.type,
      realArtifact,
      realReleaseRoot,
      realBundleRoot,
    );

    requireArtifactField(
      fileStats.size === artifact.bytes,
      `artifact ${artifact.type} byte-size mismatch: report=${artifact.bytes}, actual=${fileStats.size}`,
    );
    const actualSha256 = await sha256(realArtifact);
    requireArtifactField(
      actualSha256 === artifact.sha256.toLowerCase(),
      `artifact ${artifact.type} SHA-256 mismatch: report=${artifact.sha256.toLowerCase()}, actual=${actualSha256}`,
    );
    verified.push({
      type: artifact.type,
      path: realArtifact,
      bytes: fileStats.size,
      sha256: actualSha256,
    });
  }

  const missingTypes = EXPECTED_TYPES.filter((type) => !seenTypes.has(type));
  requireArtifactField(
    missingTypes.length === 0,
    `missing expected artifacts: ${missingTypes.join(", ")}`,
  );
  return verified;
}
