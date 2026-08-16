import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const productName = "SpeakRight";

async function packageVersion() {
  const raw = await readFile(path.join(root, "package.json"), "utf8");
  return JSON.parse(raw).version;
}

function reportPath(version) {
  return path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    `${productName}_${version}_release-report.json`,
  );
}

function assertReportShape(report) {
  if (!report || typeof report !== "object") {
    throw new Error("Desktop release report is not an object");
  }
  if (!Array.isArray(report.artifacts) || report.artifacts.length === 0) {
    throw new Error("Desktop release report has no artifacts");
  }
  if (!report.signing || typeof report.signing !== "object") {
    throw new Error("Desktop release report has no signing summary");
  }
}

async function main() {
  const version = await packageVersion();
  const filePath = reportPath(version);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing desktop release report: ${filePath}. Run npm run validate:desktop first.`,
    );
  }

  const report = JSON.parse(await readFile(filePath, "utf8"));
  assertReportShape(report);

  const unsignedArtifacts = report.signing.unsignedArtifacts ?? [];
  const missingHashes = report.artifacts
    .filter((artifact) => !artifact.sha256)
    .map((artifact) => artifact.type ?? artifact.path ?? "unknown");
  const missingPaths = report.artifacts
    .filter((artifact) => {
      if (!artifact.path) return true;
      const artifactPath = path.isAbsolute(artifact.path)
        ? artifact.path
        : path.join(root, artifact.path);
      return !existsSync(artifactPath);
    })
    .map((artifact) => artifact.type ?? artifact.path ?? "unknown");

  if (missingHashes.length > 0) {
    throw new Error(
      `Desktop release artifacts missing SHA-256 digests: ${missingHashes.join(", ")}`,
    );
  }

  if (missingPaths.length > 0) {
    throw new Error(
      `Desktop release artifacts missing on disk: ${missingPaths.join(", ")}`,
    );
  }

  if (report.signing.allValid !== true || unsignedArtifacts.length > 0) {
    throw new Error(
      [
        "Desktop public release gate failed: unsigned artifacts are present.",
        `Unsigned: ${unsignedArtifacts.join(", ") || "unknown"}.`,
        "Use this build for controlled internal testing only, or sign every published desktop artifact before a future Desktop Stable release.",
      ].join(" "),
    );
  }

  console.log(
    `Desktop public release gate passed: ${report.artifacts.length} signed artifacts verified.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
