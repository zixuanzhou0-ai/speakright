import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidateRelativePath = "docs/validation/V1.1.0_RELEASE_CANDIDATE.md";
const allowedOutputRoot = path.join(root, "outputs", "release", "staging");

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

function requireCommitSha(commit) {
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error(
      "Release commit must be a full lowercase 40-character SHA.",
    );
  }
}

export function readReleaseBlobAtCommit(
  commit,
  relativePath,
  executor = execFileSync,
) {
  requireCommitSha(commit);
  if (!["release.config.json", candidateRelativePath].includes(relativePath)) {
    throw new Error(`Unsupported release evidence path: ${relativePath}.`);
  }

  try {
    return Buffer.from(
      executor("git", ["show", `${commit}:${relativePath}`], {
        cwd: root,
        encoding: null,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      }),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read ${relativePath} from release commit ${commit}: ${detail}`,
    );
  }
}

export function loadReleaseInputsAtCommit(commit, executor = execFileSync) {
  const configBytes = readReleaseBlobAtCommit(
    commit,
    "release.config.json",
    executor,
  );
  const candidateBytes = readReleaseBlobAtCommit(
    commit,
    candidateRelativePath,
    executor,
  );

  let config;
  try {
    config = JSON.parse(configBytes.toString("utf8"));
  } catch {
    throw new Error(
      `release.config.json at commit ${commit} is not valid JSON.`,
    );
  }

  return {
    config,
    candidateSha256: sha256(candidateBytes),
  };
}

export function resolveReleaseValidationOutput(outputPath) {
  const resolved = path.resolve(root, outputPath);
  const relative = path.relative(allowedOutputRoot, resolved);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.extname(resolved).toLowerCase() !== ".md"
  ) {
    throw new Error(
      `Release validation output must be a Markdown file inside ${allowedOutputRoot}.`,
    );
  }
  return resolved;
}

export function renderReleaseValidationAttachment({
  config,
  edition,
  tag,
  commit,
  candidateSha256,
}) {
  if (!config || config.schemaVersion !== 1) {
    throw new Error("release.config.json must use schemaVersion 1.");
  }
  if (!Object.hasOwn(config.editions ?? {}, edition)) {
    throw new Error(`Unknown release edition: ${edition}.`);
  }
  requireCommitSha(commit);
  if (!/^[0-9a-f]{64}$/u.test(candidateSha256)) {
    throw new Error(
      "Candidate ledger SHA-256 must be 64 lowercase hex characters.",
    );
  }

  const release = config.editions[edition];
  if (tag !== release.releaseTag) {
    throw new Error(
      `Release tag ${tag} does not match ${edition} tag ${release.releaseTag}.`,
    );
  }
  if (config.repositoryUrl !== "https://github.com/zixuanzhou0-ai/speakright") {
    throw new Error("Unexpected release repository URL.");
  }

  const releaseUrl = `${config.repositoryUrl}/releases/tag/${encodeURIComponent(tag)}`;
  const candidateBlobUrl = `${config.repositoryUrl}/blob/${commit}/${candidateRelativePath}`;
  const artifactBoundary =
    edition === "desktop"
      ? "Unsigned Windows x64 bare EXE and NSIS setup; MSI excluded"
      : "Static Browser archive; executable code signing is not applicable";

  return `# SpeakRight ${config.version} release validation attachment

This deterministic attachment records the exact tag and commit accepted by the
${release.productName} build job. It does not claim that a downstream publish
job or the Codex for Open Source application has succeeded.

| Field | Value |
| --- | --- |
| Edition | ${release.productName} |
| Channel | ${release.channel} |
| Version | ${config.version} |
| Tag | \`${tag}\` |
| Tag commit | \`${commit}\` |
| Release page | [${tag}](${releaseUrl}) |
| Signature status | ${release.signatureStatus} |
| Artifact boundary | ${artifactBoundary} |
| Local-evidence ledger | [immutable source at tag commit](${candidateBlobUrl}) |
| Local-evidence ledger SHA-256 | \`${candidateSha256}\` |

## Workflow integrity boundary

Before staging this attachment, the build job verifies that checked-out HEAD is
the peeled tag commit and that the commit is an ancestor of origin/main. The
publish job independently refreshes the tag and origin/main, rejects a moved
tag, and creates the GitHub Release only from the already validated assets.

## Dated local-evidence snapshot

The linked ledger is intentionally preserved as a pre-publication snapshot.
Its unchecked external-state boxes are historical context, not live release
status. GitHub Actions and the linked Release page are authoritative for hosted
checks and publication state.
`;
}

function main() {
  const edition = requireArgument(process.argv.slice(2), "--edition");
  const tag = requireArgument(process.argv.slice(2), "--tag");
  const commit = requireArgument(process.argv.slice(2), "--commit");
  const output = resolveReleaseValidationOutput(
    requireArgument(process.argv.slice(2), "--output"),
  );
  const { config, candidateSha256 } = loadReleaseInputsAtCommit(commit);
  const rendered = renderReleaseValidationAttachment({
    config,
    edition,
    tag,
    commit,
    candidateSha256,
  });

  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, rendered, "utf8");
  console.log(`Release validation attachment: ${output}`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main();
}
