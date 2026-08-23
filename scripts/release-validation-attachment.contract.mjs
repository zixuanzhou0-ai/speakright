import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  loadReleaseInputsAtCommit,
  readReleaseBlobAtCommit,
  renderReleaseValidationAttachment,
  resolveReleaseValidationOutput,
} from "./generate-release-validation-attachment.mjs";

const config = JSON.parse(readFileSync("release.config.json", "utf8"));
const candidate = readFileSync(
  "docs/validation/V1.1.0_RELEASE_CANDIDATE.md",
  "utf8",
);
const candidateSha256 = createHash("sha256").update(candidate).digest("hex");
const commit = "0123456789abcdef0123456789abcdef01234567";

const committedConfig = Buffer.from(JSON.stringify(config), "utf8");
const committedCandidate = Buffer.from("committed candidate bytes\n", "utf8");
const dirtyWorktreeCandidate = Buffer.from("dirty worktree bytes\n", "utf8");
const gitCalls = [];
const fakeGit = (command, args, options) => {
  gitCalls.push({ command, args, options });
  const object = args[1];
  if (object === `${commit}:release.config.json`) return committedConfig;
  if (object === `${commit}:docs/validation/V1.1.0_RELEASE_CANDIDATE.md`) {
    return committedCandidate;
  }
  throw new Error(`Unexpected Git object: ${object}`);
};
const committedInputs = loadReleaseInputsAtCommit(commit, fakeGit);
assert.deepEqual(committedInputs.config, config);
assert.equal(
  committedInputs.candidateSha256,
  createHash("sha256").update(committedCandidate).digest("hex"),
);
assert.notEqual(
  committedInputs.candidateSha256,
  createHash("sha256").update(dirtyWorktreeCandidate).digest("hex"),
);
assert.deepEqual(
  gitCalls.map(({ command, args }) => [command, ...args]),
  [
    ["git", "show", `${commit}:release.config.json`],
    ["git", "show", `${commit}:docs/validation/V1.1.0_RELEASE_CANDIDATE.md`],
  ],
);
assert.equal(
  gitCalls.every(({ options }) => options.encoding === null),
  true,
);

const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
assert.deepEqual(
  readReleaseBlobAtCommit(
    currentCommit,
    "docs/validation/V1.1.0_RELEASE_CANDIDATE.md",
  ),
  execFileSync(
    "git",
    ["show", `${currentCommit}:docs/validation/V1.1.0_RELEASE_CANDIDATE.md`],
    { encoding: null },
  ),
);

const browser = renderReleaseValidationAttachment({
  config,
  edition: "browser",
  tag: "v1.1.0",
  commit,
  candidateSha256,
});
assert.match(browser, /SpeakRight Browser Edition/u);
assert.match(browser, /Signature status \| NotApplicable/u);
assert.match(browser, /releases\/tag\/v1\.1\.0/u);
assert.match(browser, new RegExp(commit, "u"));
assert.match(browser, new RegExp(candidateSha256, "u"));
assert.match(
  browser,
  new RegExp(
    `blob/${commit}/docs/validation/V1\\.1\\.0_RELEASE_CANDIDATE\\.md`,
    "u",
  ),
);

const desktop = renderReleaseValidationAttachment({
  config,
  edition: "desktop",
  tag: "v1.1.0-desktop-preview.1",
  commit,
  candidateSha256,
});
assert.match(desktop, /SpeakRight Desktop/u);
assert.match(desktop, /Signature status \| NotSigned/u);
assert.match(desktop, /bare EXE and NSIS setup; MSI excluded/u);

for (const output of [browser, desktop]) {
  assert.doesNotMatch(output, /not yet (?:created|published)/iu);
  assert.match(output, /peeled tag commit/u);
  assert.match(output, /rejects a moved\s+tag/u);
  assert.match(output, /pre-publication snapshot/u);
}

assert.throws(
  () =>
    renderReleaseValidationAttachment({
      config,
      edition: "browser",
      tag: "v9.9.9",
      commit,
      candidateSha256,
    }),
  /does not match/u,
);
assert.throws(
  () =>
    renderReleaseValidationAttachment({
      config,
      edition: "desktop",
      tag: "v1.1.0-desktop-preview.1",
      commit: "short",
      candidateSha256,
    }),
  /full lowercase 40-character SHA/u,
);
assert.throws(
  () =>
    renderReleaseValidationAttachment({
      config,
      edition: "unknown",
      tag: "v1.1.0",
      commit,
      candidateSha256,
    }),
  /Unknown release edition/u,
);
assert.match(
  resolveReleaseValidationOutput(
    "outputs/release/staging/SpeakRight_v1.1.0_release-validation.md",
  ),
  /outputs[\\/]release[\\/]staging[\\/]SpeakRight_v1\.1\.0_release-validation\.md$/u,
);
assert.throws(
  () => resolveReleaseValidationOutput("docs/release-validation.md"),
  /inside/u,
);
assert.throws(
  () => readReleaseBlobAtCommit("short", "release.config.json", fakeGit),
  /full lowercase 40-character SHA/u,
);
assert.throws(
  () => readReleaseBlobAtCommit(commit, "CHANGELOG.md", fakeGit),
  /Unsupported release evidence path/u,
);

console.log(
  "Release validation attachment contract passed for Browser Stable and unsigned Desktop Preview.",
);
