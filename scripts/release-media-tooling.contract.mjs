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
  /\$PinnedFfmpegVersion\s*=\s*"9\.0\.1"/,
  "Release media tooling must pin FFmpeg 9.0.1.",
);
assert.match(
  installer,
  /\$PinnedPackageSha512\s*=\s*"4c8d776cf72275684078234242be61a9c7639dd9c7c50fa2800a584fc0d290fcfc77a5b05ee8dacf3b85c9425ae9383ef7952f3e1f7862a921c2977ac8dffa1e"/,
  "Release media tooling must pin the approved FFmpeg 9.0.1 package SHA-512.",
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
for (const capability of ["libx264", "loudnorm"]) {
  assert.ok(
    installer.includes(capability),
    `Release media tooling must verify the ${capability} capability.`,
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

const windowsBuild = readFileSync(
  path.join(root, ".github/workflows/build-windows.yml"),
  "utf8",
);
assert.match(
  windowsBuild,
  /uses: actions\/checkout@[0-9a-f]{40}[\s\S]*?with:\s*\n\s+fetch-depth:\s+0\s*\n\s+persist-credentials:\s+false/,
  "Ordinary Windows CI must fetch the evidence source commit without retaining push credentials.",
);
const windowsInstallerIndex = windowsBuild.indexOf(
  `pwsh -NoProfile -NonInteractive -File ${installerRelativePath}`,
);
const evidenceIndex = windowsBuild.indexOf("npm run release:evidence:check");
assert.ok(
  evidenceIndex > windowsInstallerIndex,
  "Ordinary Windows CI must validate release evidence with the pinned media tools.",
);

console.log(
  "Release media tooling contract passed (pinned FFmpeg + Windows CI coverage).",
);
