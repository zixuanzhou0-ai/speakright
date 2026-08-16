import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(root, "src-tauri", "speakright.cdx.json");
const outputPath = path.join(
  root,
  "outputs",
  "release",
  "sbom",
  "speakright-cargo.cdx.json",
);

const result = spawnSync(
  "cargo",
  ["cyclonedx", "--manifest-path", "src-tauri/Cargo.toml", "--format", "json"],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    "Cargo SBOM generation failed. Install the pinned cargo-cyclonedx version used by the release workflow before retrying.",
  );
  process.exit(result.status ?? 1);
}

let document;
try {
  document = JSON.parse(await readFile(generatedPath, "utf8"));
} catch {
  console.error("cargo-cyclonedx did not produce a readable JSON SBOM.");
  process.exit(1);
}
if (document?.bomFormat !== "CycloneDX") {
  console.error("cargo-cyclonedx produced an unexpected SBOM format.");
  process.exit(1);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await copyFile(generatedPath, outputPath);
await rm(generatedPath, { force: true });
console.log(
  `Cargo CycloneDX SBOM written to ${path.relative(root, outputPath)}.`,
);
