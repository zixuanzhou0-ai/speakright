import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  hasExactPassingRoundtripChecks,
  matchesRoundtripArtifactIdentity,
  ROUNDTRIP_SCHEMA_VERSION,
} from "./desktop-installer-roundtrip-core.mjs";
import { inspectAuthenticodeSignature } from "./windows-authenticode-status.mjs";

const root = process.cwd();
const productName = "SpeakRight";

async function packageVersion() {
  const raw = await readFile(path.join(root, "package.json"), "utf8");
  return JSON.parse(raw).version;
}

function artifactCandidates(version) {
  return [
    {
      type: "exe",
      path: "src-tauri/target/release/speakright.exe",
    },
    {
      type: "nsis",
      path: path.join(
        "src-tauri",
        "target",
        "release",
        "bundle",
        "nsis",
        `${productName}_${version}_x64-setup.exe`,
      ),
    },
  ];
}

function installerRoundtripPath(version) {
  return path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    `${productName}_${version}_installer-roundtrip.json`,
  );
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function describeArtifact(artifact) {
  const relativePath = artifact.path.replaceAll("\\", "/");
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing desktop release artifact: ${relativePath}`);
  }
  const info = await stat(absolutePath);
  const signature = await inspectAuthenticodeSignature(absolutePath);
  return {
    type: artifact.type,
    path: relativePath,
    bytes: info.size,
    sha256: await sha256(absolutePath),
    signature,
    signed: signature ? signature.Status === "Valid" : null,
  };
}

async function describeInstallerRoundtrip(version, nsisArtifact, exeArtifact) {
  const absolutePath = installerRoundtripPath(version);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `Missing desktop installer round-trip report. Run npm run desktop:installer-roundtrip first.`,
    );
  }
  const summary = JSON.parse(await readFile(absolutePath, "utf8"));
  if (
    summary.schemaVersion !== ROUNDTRIP_SCHEMA_VERSION ||
    summary.productName !== productName ||
    summary.version !== version ||
    summary.platform !== "win32" ||
    summary.status !== "passed" ||
    !hasExactPassingRoundtripChecks(summary.checks) ||
    summary.cleanup?.sandboxRemoved !== true
  ) {
    throw new Error(
      "Desktop installer round-trip report is not a passing Windows result.",
    );
  }
  if (
    summary.installer?.fileName !== path.basename(nsisArtifact.path) ||
    summary.installer?.bytes !== nsisArtifact.bytes ||
    summary.installer?.sha256 !== nsisArtifact.sha256
  ) {
    throw new Error(
      "Desktop installer round-trip report does not match the current NSIS artifact.",
    );
  }
  if (
    !matchesRoundtripArtifactIdentity(summary.releaseExecutable, exeArtifact)
  ) {
    throw new Error(
      "Desktop installer round-trip report does not match the current release EXE artifact.",
    );
  }
  return {
    path: path.relative(root, absolutePath).replaceAll("\\", "/"),
    sha256: await sha256(absolutePath),
    status: summary.status,
    completedAt: summary.completedAt,
    checks: summary.checks,
    cleanup: summary.cleanup,
  };
}

async function main() {
  const artifactVersion = await packageVersion();
  const artifacts = await Promise.all(
    artifactCandidates(artifactVersion).map((artifact) =>
      describeArtifact(artifact),
    ),
  );
  const nsisArtifact = artifacts.find((artifact) => artifact.type === "nsis");
  const exeArtifact = artifacts.find((artifact) => artifact.type === "exe");
  if (!nsisArtifact) {
    throw new Error("Desktop release report is missing the NSIS artifact.");
  }
  if (!exeArtifact) {
    throw new Error("Desktop release report is missing the bare EXE artifact.");
  }
  const installerRoundtrip = await describeInstallerRoundtrip(
    artifactVersion,
    nsisArtifact,
    exeArtifact,
  );
  const report = {
    schemaVersion: 2,
    productName,
    version: artifactVersion,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    artifacts,
    installerRoundtrip,
    distribution: {
      channel: "desktop-preview",
      publishedArtifactTypes: ["exe", "nsis"],
      installerType: "nsis",
      excludedArtifactTypes: ["msi"],
      note: `MSI may be built for local metadata validation, but it is not a v${artifactVersion} Desktop Preview release artifact.`,
    },
    signing: {
      allValid:
        artifacts.every((artifact) => artifact.signed === true) || false,
      unsignedArtifacts: artifacts
        .filter((artifact) => artifact.signed === false)
        .map((artifact) => artifact.type),
    },
  };
  const outputDir = path.join(root, "src-tauri", "target", "release", "bundle");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${productName}_${artifactVersion}_release-report.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Desktop release report written: ${outputPath}`);
  for (const artifact of artifacts) {
    console.log(
      `${artifact.type}: ${artifact.path} ${artifact.bytes} bytes sha256=${artifact.sha256}${artifact.signature ? ` signature=${artifact.signature.Status}` : ""}`,
    );
  }
  if (report.signing.unsignedArtifacts.length > 0) {
    console.warn(
      `Unsigned desktop artifacts: ${report.signing.unsignedArtifacts.join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
