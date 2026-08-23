import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = path.join(root, "outputs", "release", "staging");
const checksumName = "SHA256SUMS.txt";

function requireArgument(args, name) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function expectedReleaseAssetNames(edition, version) {
  if (version !== "1.1.0") {
    throw new Error(`Unexpected release version: ${version}.`);
  }

  const common = [
    "CHANGELOG.md",
    "LICENSE",
    "NOTICE.md",
    "PRIVACY.md",
    "THIRD_PARTY_NOTICES.md",
    "speakright-browser.cdx.json",
    "speakright-cargo.cdx.json",
    "speakright-root.cdx.json",
    "SpeakRight_v1.1.0_asset-rights-registry.json",
    "SpeakRight_v1.1.0_release-validation.md",
    "SpeakRight_v1.1.0_user-testing-summary.md",
  ];

  if (edition === "browser") {
    return [
      ...common,
      "SpeakRight_Browser_1.1.0.zip",
      "SpeakRight_Browser_1.1.0_validation-report.json",
      "SpeakRight_v1.1.0_browser-screenshots.json",
      "SpeakRight_v1.1.0_demo-manifest.json",
      "SpeakRight_v1.1.0_desktop-screenshots.json",
      "speakright-v1.1.0-overview.en.srt",
      "speakright-v1.1.0-overview.en.vtt",
      "speakright-v1.1.0-overview.mp4",
    ].sort();
  }
  if (edition === "desktop") {
    return [
      ...common,
      "SpeakRight_1.1.0_installer-roundtrip.json",
      "SpeakRight_1.1.0_release-report.json",
      "SpeakRight_1.1.0_x64-setup.exe",
      "speakright.exe",
    ].sort();
  }
  throw new Error(`Unknown release edition: ${edition}.`);
}

export function verifyReleaseStagingEntries({ edition, version, entries }) {
  const expectedAssets = expectedReleaseAssetNames(edition, version);
  const expectedAll = [...expectedAssets, checksumName].sort();
  const actualAll = [...entries.keys()].sort();
  if (JSON.stringify(actualAll) !== JSON.stringify(expectedAll)) {
    throw new Error(
      `Release asset set mismatch. Expected ${expectedAll.join(", ")}; received ${actualAll.join(", ")}.`,
    );
  }

  const checksumContents = entries.get(checksumName).toString("utf8");
  const checksumLines = checksumContents
    .split(/\r?\n/u)
    .filter((line) => line.length > 0);
  if (checksumLines.length !== expectedAssets.length) {
    throw new Error(
      `Expected ${expectedAssets.length} checksum lines, received ${checksumLines.length}.`,
    );
  }

  const checksums = new Map();
  for (const line of checksumLines) {
    const match = /^([0-9a-f]{64}) {2}([^\\/\r\n]+)$/u.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line}.`);
    const [, digest, name] = match;
    if (checksums.has(name)) {
      throw new Error(`Duplicate checksum entry: ${name}.`);
    }
    checksums.set(name, digest);
  }

  if (
    JSON.stringify([...checksums.keys()].sort()) !==
    JSON.stringify(expectedAssets)
  ) {
    throw new Error("Checksum asset set does not match the release asset set.");
  }

  for (const name of expectedAssets) {
    const actual = sha256(entries.get(name));
    if (checksums.get(name) !== actual) {
      throw new Error(`Checksum mismatch for ${name}.`);
    }
  }

  return {
    edition,
    assetCount: expectedAll.length,
    checksumEntryCount: expectedAssets.length,
  };
}

export function resolveStagingDirectory(value) {
  const resolved = path.resolve(root, value);
  if (resolved !== stagingRoot) {
    throw new Error(
      `Release staging directory must be exactly ${stagingRoot}.`,
    );
  }
  return resolved;
}

function main() {
  const args = process.argv.slice(2);
  const edition = requireArgument(args, "--edition");
  const version = requireArgument(args, "--version");
  const stage = resolveStagingDirectory(requireArgument(args, "--stage"));
  const entries = new Map();
  for (const name of readdirSync(stage)) {
    const assetPath = path.join(stage, name);
    if (!statSync(assetPath).isFile()) {
      throw new Error(`Release staging contains a non-file entry: ${name}.`);
    }
    entries.set(name, readFileSync(assetPath));
  }
  const result = verifyReleaseStagingEntries({ edition, version, entries });
  console.log(
    `${edition} release staging verified: ${result.assetCount} assets, ${result.checksumEntryCount} checksum entries.`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main();
}
