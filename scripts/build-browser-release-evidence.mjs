import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { RELEASE_EVIDENCE_VERSION } from "./lib/release-evidence-fixtures.mjs";
import {
  releaseEvidenceGitProvenance,
  releaseEvidenceSourceDigest,
} from "./lib/release-evidence-source-digest.mjs";

const root = process.cwd();
const allowedWorkspaceRoot = path.join(
  path.dirname(root),
  `${path.basename(root)}ReleaseEvidenceTemp`,
);
const defaultWorkspace = path.join(
  allowedWorkspaceRoot,
  "browser-fixture-workspace",
);

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function assertSafeWorkspace(value) {
  const resolved = path.resolve(value);
  const relative = path.relative(allowedWorkspaceRoot, resolved);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Evidence workspace must be a child of ${allowedWorkspaceRoot}.`,
    );
  }
  return resolved;
}

function copyFilter(sourceRoot) {
  const skipped = new Set([
    ".next",
    ".turbo",
    "node_modules",
    "out",
    "playwright-report",
    "public",
    "test-results",
  ]);
  return (source) => {
    const relative = path.relative(sourceRoot, source);
    if (!relative) return true;
    const firstSegment = relative.split(path.sep)[0];
    return (
      !skipped.has(firstSegment) &&
      !firstSegment.startsWith(".env") &&
      !relative.endsWith(".tsbuildinfo")
    );
  };
}

async function junction(source, destination) {
  await symlink(
    path.resolve(source),
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
}

function sanitizedEnvironment() {
  const sensitiveName =
    /API.?KEY|TOKEN|SECRET|PASSWORD|AZURE|ELEVEN|OPENAI|ANTHROPIC|GEMINI|GOOGLE|VERTEX|XAI|GROK|HERMES|GCLOUD|PROXY/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !sensitiveName.test(name)),
  );
}

async function main() {
  const unknownArguments = process.argv
    .slice(2)
    .filter((_argument, index, values) => values[index - 1] !== "--workspace")
    .filter((argument) => argument !== "--workspace");
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown arguments: ${unknownArguments.join(", ")}`);
  }

  const workspace = assertSafeWorkspace(
    readArgument("--workspace", defaultWorkspace),
  );
  const sourceBrowserRoot = path.join(root, "apps", "browser");
  const browserRoot = path.join(workspace, "apps", "browser");
  const coreRoot = path.join(workspace, "packages", "core");
  const provenance = releaseEvidenceGitProvenance(root, "browser");
  const commit = provenance.commit;

  await rm(workspace, { force: true, recursive: true });
  await mkdir(browserRoot, { recursive: true });
  await mkdir(path.dirname(coreRoot), { recursive: true });
  await cp(sourceBrowserRoot, browserRoot, {
    recursive: true,
    filter: copyFilter(sourceBrowserRoot),
  });
  await cp(path.join(root, "packages", "core"), coreRoot, {
    recursive: true,
    filter: copyFilter(path.join(root, "packages", "core")),
  });
  await copyFile(
    path.join(root, "package.json"),
    path.join(workspace, "package.json"),
  );
  await copyFile(
    path.join(root, "package-lock.json"),
    path.join(workspace, "package-lock.json"),
  );
  const sourceSnapshot = await releaseEvidenceSourceDigest(
    workspace,
    "browser",
  );
  const isolatedNextConfigPath = path.join(browserRoot, "next.config.ts");
  const isolatedNextConfig = await readFile(isolatedNextConfigPath, "utf8");
  const boundedNextConfig = isolatedNextConfig.replace(
    'root: path.resolve(process.cwd(), "../.."),',
    `root: ${JSON.stringify(path.dirname(root))},`,
  );
  if (boundedNextConfig === isolatedNextConfig) {
    throw new Error("Could not bind the isolated Turbopack root.");
  }
  await writeFile(isolatedNextConfigPath, boundedNextConfig, "utf8");
  await junction(
    path.join(root, "node_modules"),
    path.join(workspace, "node_modules"),
  );
  await junction(
    path.join(sourceBrowserRoot, "node_modules"),
    path.join(browserRoot, "node_modules"),
  );
  await junction(
    path.join(sourceBrowserRoot, "public"),
    path.join(browserRoot, "public"),
  );

  const nextCli = path.join(
    sourceBrowserRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const build = spawnSync(process.execPath, [nextCli, "build"], {
    cwd: browserRoot,
    env: {
      ...sanitizedEnvironment(),
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SPEAKRIGHT_BUILD_TIMESTAMP: "2026-08-16T12:00:00.000Z",
      NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA: commit,
      NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "1",
      NODE_ENV: "production",
      SPEAKRIGHT_STATIC_EXPORT: "1",
    },
    stdio: "inherit",
  });
  if (build.error || build.status !== 0) {
    throw new Error(
      `Isolated Browser fixture build failed: ${build.error?.message ?? `exit ${build.status}`}`,
    );
  }
  releaseEvidenceGitProvenance(root, "browser", commit);

  const indexPath = path.join(browserRoot, "out", "index.html");
  const index = await readFile(indexPath);
  await writeFile(
    path.join(workspace, "build-manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        version: RELEASE_EVIDENCE_VERSION,
        edition: "browser",
        fixtureBuild: true,
        fixtureGate: "NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES=1",
        paidApiCalls: false,
        sourceCommit: commit,
        sourceWorktreeClean: true,
        sourceSnapshot,
        output: "apps/browser/out",
        outputIndexSha256: createHash("sha256").update(index).digest("hex"),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Isolated Browser evidence build: ${browserRoot}`);
  console.log(`Formal Browser output was not modified: ${sourceBrowserRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
