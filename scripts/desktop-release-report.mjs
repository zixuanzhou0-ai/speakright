import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
      path: path.join(root, "src-tauri", "target", "release", "speakright.exe"),
    },
    {
      type: "msi",
      path: path.join(
        root,
        "src-tauri",
        "target",
        "release",
        "bundle",
        "msi",
        `${productName}_${version}_x64_en-US.msi`,
      ),
    },
    {
      type: "nsis",
      path: path.join(
        root,
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

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function signatureStatus(filePath) {
  if (process.platform !== "win32") return null;
  const literalPath = filePath.replaceAll("'", "''");
  const command = [
    `$sig = Get-AuthenticodeSignature -LiteralPath '${literalPath}';`,
    "[pscustomobject]@{",
    "Status = [string]$sig.Status;",
    "StatusMessage = [string]$sig.StatusMessage;",
    "SignerCertificate = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }",
    "} | ConvertTo-Json -Compress",
  ].join(" ");
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      command,
    ]);
    return JSON.parse(stdout.trim());
  } catch (error) {
    return {
      Status: "Unknown",
      StatusMessage:
        error instanceof Error ? error.message : "Signature inspection failed",
      SignerCertificate: null,
    };
  }
}

async function describeArtifact(artifact) {
  if (!existsSync(artifact.path)) {
    throw new Error(`Missing desktop release artifact: ${artifact.path}`);
  }
  const info = await stat(artifact.path);
  const signature = await signatureStatus(artifact.path);
  return {
    type: artifact.type,
    path: artifact.path,
    bytes: info.size,
    sha256: await sha256(artifact.path),
    signature,
    signed: signature ? signature.Status === "Valid" : null,
  };
}

async function main() {
  const artifactVersion = await packageVersion();
  const artifacts = await Promise.all(
    artifactCandidates(artifactVersion).map((artifact) =>
      describeArtifact(artifact),
    ),
  );
  const report = {
    schemaVersion: 1,
    productName,
    version: artifactVersion,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    artifacts,
    signing: {
      allValid:
        artifacts.every((artifact) => artifact.signed === true) || false,
      unsignedArtifacts: artifacts
        .filter((artifact) => artifact.signed === false)
        .map((artifact) => artifact.type),
    },
  };
  const outputDir = path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
  );
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(
    outputDir,
    `${productName}_${artifactVersion}_release-report.json`,
  );
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Desktop release report written: ${outputPath}`);
  for (const artifact of artifacts) {
    console.log(
      `${artifact.type}: ${artifact.bytes} bytes sha256=${artifact.sha256}${artifact.signature ? ` signature=${artifact.signature.Status}` : ""}`,
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
