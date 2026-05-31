import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const productName = "SpeakRight";
const manufacturer = "speakright";
const minArtifactBytes = {
  exe: 10 * 1024 * 1024,
  msi: 8 * 1024 * 1024,
  nsis: 8 * 1024 * 1024,
};

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function packageVersion() {
  const pkg = await readJson(path.join(root, "package.json"));
  return pkg.version;
}

function artifactPaths(version) {
  return {
    exe: path.join(root, "src-tauri", "target", "release", "speakright.exe"),
    msi: path.join(
      root,
      "src-tauri",
      "target",
      "release",
      "bundle",
      "msi",
      `${productName}_${version}_x64_en-US.msi`,
    ),
    nsis: path.join(
      root,
      "src-tauri",
      "target",
      "release",
      "bundle",
      "nsis",
      `${productName}_${version}_x64-setup.exe`,
    ),
  };
}

function releaseReportPath(version) {
  return path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    `${productName}_${version}_release-report.json`,
  );
}

function fail(message) {
  throw new Error(`Desktop installer smoke failed: ${message}`);
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function assertArtifact(type, filePath, minBytes) {
  if (!existsSync(filePath)) {
    fail(`missing ${type} artifact at ${path.relative(root, filePath)}`);
  }
  const info = await stat(filePath);
  if (info.size < minBytes) {
    fail(`${type} artifact is too small: ${info.size} bytes`);
  }
  return info.size;
}

async function inspectVersionInfo(paths) {
  const script = `
param([string[]]$Paths)
$ErrorActionPreference = "Stop"
$Paths | ForEach-Object {
  $item = Get-Item -LiteralPath $_
  $version = $item.VersionInfo
  [pscustomobject]@{
    Path = $item.FullName
    ProductName = [string]$version.ProductName
    ProductVersion = [string]$version.ProductVersion
    FileVersion = [string]$version.FileVersion
    FileDescription = [string]$version.FileDescription
    CompanyName = [string]$version.CompanyName
  }
} | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `& { ${script} }`,
    ...paths,
  ]);
  const parsed = JSON.parse(stdout.trim());
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function inspectMsi(msiPath) {
  const script = `
param([string]$Path)
$ErrorActionPreference = "Stop"
$properties = @("ProductName", "ProductVersion", "Manufacturer", "ProductCode", "UpgradeCode")
$installer = New-Object -ComObject WindowsInstaller.Installer
$database = $installer.GetType().InvokeMember("OpenDatabase", "InvokeMethod", $null, $installer, @($Path, 0))
$result = [ordered]@{}
foreach ($property in $properties) {
  $query = "SELECT Value FROM Property WHERE Property='$property'"
  $view = $database.GetType().InvokeMember("OpenView", "InvokeMethod", $null, $database, @($query))
  $view.GetType().InvokeMember("Execute", "InvokeMethod", $null, $view, $null) | Out-Null
  $record = $view.GetType().InvokeMember("Fetch", "InvokeMethod", $null, $view, $null)
  if ($record) {
    $result[$property] = $record.GetType().InvokeMember("StringData", "GetProperty", $null, $record, 1)
  } else {
    $result[$property] = $null
  }
}
[pscustomobject]$result | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `& { ${script} }`,
    msiPath,
  ]);
  return JSON.parse(stdout.trim());
}

function assertVersionInfo(info, expectedVersion) {
  if (info.ProductName !== productName) {
    fail(`${path.basename(info.Path)} ProductName is "${info.ProductName}"`);
  }
  if (info.ProductVersion !== expectedVersion) {
    fail(
      `${path.basename(info.Path)} ProductVersion is "${info.ProductVersion}", expected "${expectedVersion}"`,
    );
  }
  if (info.FileVersion !== expectedVersion) {
    fail(
      `${path.basename(info.Path)} FileVersion is "${info.FileVersion}", expected "${expectedVersion}"`,
    );
  }
  if (info.FileDescription !== productName) {
    fail(`${path.basename(info.Path)} FileDescription is "${info.FileDescription}"`);
  }
}

function assertMsiProperties(msi, expectedVersion) {
  if (msi.ProductName !== productName) {
    fail(`MSI ProductName is "${msi.ProductName}"`);
  }
  if (msi.ProductVersion !== expectedVersion) {
    fail(`MSI ProductVersion is "${msi.ProductVersion}", expected "${expectedVersion}"`);
  }
  if (msi.Manufacturer !== manufacturer) {
    fail(`MSI Manufacturer is "${msi.Manufacturer}"`);
  }
  for (const property of ["ProductCode", "UpgradeCode"]) {
    if (!/^\{[0-9A-F-]{36}\}$/i.test(msi[property] ?? "")) {
      fail(`MSI ${property} is not a GUID: "${msi[property]}"`);
    }
  }
}

async function assertReleaseReport(version, paths) {
  const filePath = releaseReportPath(version);
  if (!existsSync(filePath)) {
    fail(`missing release report at ${path.relative(root, filePath)}`);
  }
  const report = await readJson(filePath);
  if (report.productName !== productName || report.version !== version) {
    fail("release report product/version does not match package metadata");
  }
  for (const [type, filePathForType] of Object.entries(paths)) {
    const artifact = report.artifacts?.find((item) => item.type === type);
    if (!artifact) {
      fail(`release report is missing ${type} artifact`);
    }
    if (path.resolve(artifact.path) !== path.resolve(filePathForType)) {
      fail(`release report ${type} path does not match expected artifact path`);
    }
    if (artifact.sha256 !== (await sha256(filePathForType))) {
      fail(`release report ${type} SHA-256 does not match file contents`);
    }
  }
}

async function main() {
  const version = await packageVersion();
  const paths = artifactPaths(version);
  await assertArtifact("exe", paths.exe, minArtifactBytes.exe);
  await assertArtifact("msi", paths.msi, minArtifactBytes.msi);
  await assertArtifact("nsis", paths.nsis, minArtifactBytes.nsis);
  await assertReleaseReport(version, paths);

  if (process.platform !== "win32") {
    console.log("Desktop installer smoke skipped Windows metadata checks on non-Windows platform.");
    return;
  }

  const versionInfos = await inspectVersionInfo([paths.exe, paths.nsis]);
  for (const info of versionInfos) {
    assertVersionInfo(info, version);
  }
  const msiProperties = await inspectMsi(paths.msi);
  assertMsiProperties(msiProperties, version);
  console.log(
    `Desktop installer smoke passed: ${productName} ${version} EXE/MSI/NSIS metadata and release report are consistent.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
