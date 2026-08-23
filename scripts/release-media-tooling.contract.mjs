import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installerRelativePath = "scripts/install-release-media-tools.ps1";
const contractRelativePath = "scripts/release-media-tooling.contract.mjs";
const installer = readFileSync(path.join(root, installerRelativePath), "utf8");

assert.match(
  installer,
  /\$PinnedFfmpegVersion\s*=\s*"8\.1\.2"/,
  "Release media tooling must pin FFmpeg 8.1.2.",
);
assert.match(
  installer,
  /\$PinnedPackageSha512\s*=\s*"637fd984d75a98e3c05926d00bde79afefdda30a4b95d052b362655762f4d99d336eba0ad7ded638e248bb1363f5cdaa4eb3040b1fb53c2bfec4553eabc9c593"/,
  "Release media tooling must pin the approved FFmpeg 8.1.2 package SHA-512.",
);
assert.match(
  installer,
  /\$PackageUrl\s*=\s*"https:\/\/community\.chocolatey\.org\/api\/v2\/package\/ffmpeg\/\$PinnedFfmpegVersion"/,
  "Release media tooling must download the exact package from Chocolatey.",
);
assert.match(
  installer,
  /Get-FileHash\s+-Algorithm\s+SHA512/,
  "Release media tooling must verify the downloaded package with SHA-512.",
);
assert.match(
  installer,
  /"--source=\$packageDirectory"/,
  "Chocolatey must install from the verified local package directory.",
);
assert.match(
  installer,
  /installedNuspec\.SelectSingleNode/,
  "Release media tooling must verify the installed package manifest version.",
);
for (const requiredArgument of [
  "--require-checksums",
  "--allow-downgrade",
  "--no-progress",
]) {
  assert.ok(
    installer.includes(requiredArgument),
    `Release media tooling must include ${requiredArgument}.`,
  );
}
assert.ok(
  !installer.includes("--force"),
  "Release media tooling must not force-install an unverified package.",
);
for (const toolName of ["ffmpeg", "ffprobe"]) {
  assert.match(
    installer,
    new RegExp(`Assert-PinnedToolVersion\\s+-ToolName\\s+"${toolName}"`),
    `${toolName} must be checked against the pinned version.`,
  );
}
for (const environmentName of ["FFMPEG_PATH", "FFPROBE_PATH"]) {
  assert.match(
    installer,
    new RegExp(`Export-StepEnvironment\\s+-Name\\s+"${environmentName}"`),
    `${environmentName} must be exported for later workflow steps.`,
  );
}

const workflows = [
  ".github/workflows/build-windows.yml",
  ".github/workflows/release-browser.yml",
  ".github/workflows/release-desktop-preview.yml",
];

for (const workflowRelativePath of workflows) {
  const workflow = readFileSync(path.join(root, workflowRelativePath), "utf8");
  assert.match(
    workflow,
    /^\s{4}runs-on:\s+windows-2025\s*$/m,
    `${workflowRelativePath} must use the explicit Windows 2025 runner image.`,
  );
  const contractIndex = workflow.indexOf(`node ${contractRelativePath}`);
  const installerIndex = workflow.indexOf(
    `pwsh -NoProfile -NonInteractive -File ${installerRelativePath}`,
  );
  assert.ok(
    contractIndex >= 0,
    `${workflowRelativePath} must run the release media tooling contract.`,
  );
  assert.ok(
    installerIndex > contractIndex,
    `${workflowRelativePath} must install pinned media tools after checking the contract.`,
  );
}

console.log(
  "Release media tooling contract passed (pinned FFmpeg + Windows CI coverage).",
);
