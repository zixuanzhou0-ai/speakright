import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  hasExactPassingRoundtripChecks,
  matchesRoundtripArtifactIdentity,
  ROUNDTRIP_SCHEMA_VERSION,
} from "./desktop-installer-roundtrip-core.mjs";
import { verifyReportedArtifacts } from "./lib/desktop-preview-release-gate-core.mjs";

const root = process.cwd();

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function fail(message) {
  throw new Error(`Desktop preview release gate failed: ${message}`);
}

function assertReportShape(report) {
  if (!report || typeof report !== "object") fail("report is not an object");
  if (!Array.isArray(report.artifacts) || report.artifacts.length === 0) {
    fail("report contains no artifacts");
  }
  if (!report.signing || typeof report.signing !== "object") {
    fail("report contains no signing summary");
  }
  if (
    report.distribution?.channel !== "desktop-preview" ||
    report.distribution?.installerType !== "nsis" ||
    JSON.stringify(report.distribution?.publishedArtifactTypes) !==
      JSON.stringify(["exe", "nsis"]) ||
    JSON.stringify(report.distribution?.excludedArtifactTypes) !==
      JSON.stringify(["msi"])
  ) {
    fail(
      "report must publish only the bare EXE and round-trip-validated NSIS installer; MSI is local-validation-only",
    );
  }
  if (
    report.installerRoundtrip?.status !== "passed" ||
    !hasExactPassingRoundtripChecks(report.installerRoundtrip?.checks) ||
    report.installerRoundtrip?.cleanup?.sandboxRemoved !== true
  ) {
    fail("report contains no passing installer round-trip result");
  }
}

async function verifyInstallerRoundtrip(report, version) {
  const expectedRelativePath = path.join(
    "src-tauri",
    "target",
    "release",
    "bundle",
    `SpeakRight_${version}_installer-roundtrip.json`,
  );
  if (
    report.installerRoundtrip?.path !==
    expectedRelativePath.replaceAll("\\", "/")
  ) {
    fail(
      "installer round-trip report path is not the expected release bundle path",
    );
  }
  const absolutePath = path.resolve(root, report.installerRoundtrip.path);
  if (
    absolutePath !== path.resolve(root, expectedRelativePath) ||
    !existsSync(absolutePath)
  ) {
    fail(
      "installer round-trip evidence is missing or outside its expected path",
    );
  }
  const contents = await readFile(absolutePath);
  const digest = createHash("sha256").update(contents).digest("hex");
  if (digest !== report.installerRoundtrip.sha256) {
    fail(
      "installer round-trip evidence SHA-256 does not match the release report",
    );
  }
  const summary = JSON.parse(contents.toString("utf8"));
  const nsisArtifact = report.artifacts.find(
    (artifact) => artifact.type === "nsis",
  );
  const exeArtifact = report.artifacts.find(
    (artifact) => artifact.type === "exe",
  );
  if (
    summary.schemaVersion !== ROUNDTRIP_SCHEMA_VERSION ||
    summary.status !== "passed" ||
    summary.version !== version ||
    summary.platform !== "win32" ||
    !hasExactPassingRoundtripChecks(summary.checks) ||
    summary.cleanup?.sandboxRemoved !== true ||
    summary.installer?.sha256 !== nsisArtifact?.sha256 ||
    summary.installer?.bytes !== nsisArtifact?.bytes ||
    !matchesRoundtripArtifactIdentity(summary.releaseExecutable, exeArtifact)
  ) {
    fail(
      "installer round-trip evidence does not match the current bare EXE and NSIS artifacts",
    );
  }
}

async function main() {
  if (process.platform !== "win32") {
    fail("Authenticode verification must run on Windows");
  }

  const releaseConfig = await readJson("release.config.json");
  const version = releaseConfig.version;
  const desktop = releaseConfig.editions?.desktop;
  if (
    desktop?.channel !== "preview" ||
    desktop.signed !== false ||
    desktop.signatureStatus !== "NotSigned"
  ) {
    fail("release.config.json must declare an unsigned desktop preview");
  }

  const reportRelativePath = path.join(
    "src-tauri",
    "target",
    "release",
    "bundle",
    `SpeakRight_${version}_release-report.json`,
  );
  const reportPath = path.join(root, reportRelativePath);
  if (!existsSync(reportPath)) {
    fail(`missing ${reportRelativePath}; run npm run desktop:release-report`);
  }

  const report = await readJson(reportRelativePath);
  assertReportShape(report);
  if (report.version !== version) {
    fail(
      `report version ${report.version ?? "missing"} does not match ${version}`,
    );
  }

  let verifiedArtifacts;
  try {
    verifiedArtifacts = await verifyReportedArtifacts({
      workspaceRoot: root,
      artifacts: report.artifacts,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  await verifyInstallerRoundtrip(report, version);

  const unexpectedlySigned = report.artifacts
    .filter(
      (artifact) =>
        artifact.signed !== false || artifact.signature?.Status !== "NotSigned",
    )
    .map((artifact) => artifact.type ?? artifact.path ?? "unknown");
  if (unexpectedlySigned.length > 0) {
    fail(
      `artifact signing state does not match the unsigned preview declaration: ${unexpectedlySigned.join(", ")}`,
    );
  }
  if (
    report.signing.allValid !== false ||
    report.signing.unsignedArtifacts?.length !== report.artifacts.length
  ) {
    fail("signing summary does not describe every artifact as unsigned");
  }

  console.log(
    `Desktop preview release gate passed: ${verifiedArtifacts.length} unsigned published artifacts (bare EXE + round-trip-validated NSIS), byte sizes, paths, and SHA-256 digests verified; MSI excluded from release publication.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
