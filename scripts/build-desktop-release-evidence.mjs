import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
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
  "desktop-fixture-workspace",
);
const defaultCargoTarget = path.join(allowedWorkspaceRoot, "desktop-target");

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function assertSafeChild(value, label) {
  const resolved = path.resolve(value);
  const relative = path.relative(allowedWorkspaceRoot, resolved);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be a child of ${allowedWorkspaceRoot}.`);
  }
  return resolved;
}

function unknownArguments() {
  const valueOptions = new Set(["--cargo-target", "--workspace"]);
  const unknown = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (valueOptions.has(argument)) {
      index += 1;
      continue;
    }
    unknown.push(argument);
  }
  return unknown;
}

function copyFilter(sourceRoot) {
  const skipped = new Set([
    ".next",
    ".turbo",
    "gen",
    "node_modules",
    "out",
    "public",
    "target",
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

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function replaceExactlyOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0 || source.indexOf(search, first + search.length) >= 0) {
    throw new Error(
      `Could not apply the isolated ${label} guard exactly once.`,
    );
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

async function hardenEvidenceRuntime(workspace) {
  const tauriHttpPath = path.join(workspace, "src", "lib", "tauri-http.ts");
  const tauriHttpGuard = `/**
 * Release-evidence-only HTTP guard.
 * This file exists only in the isolated fixture workspace and is never copied
 * back into the product source tree.
 */

declare global {
  var __SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_GUARD__: true | undefined;
  var __SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_ATTEMPTS__: string[] | undefined;
}

globalThis.__SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_GUARD__ = true;
globalThis.__SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_ATTEMPTS__ ??= [];

export async function apiFetch(
  url: string,
  _options?: RequestInit,
): Promise<Response> {
  globalThis.__SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_ATTEMPTS__?.push(
    String(url),
  );
  throw new Error(
    "External HTTP is disabled in the SpeakRight release-evidence build.",
  );
}
`;
  await writeFile(tauriHttpPath, tauriHttpGuard, "utf8");

  const capabilityPath = path.join(
    workspace,
    "src-tauri",
    "capabilities",
    "default.json",
  );
  const capability = JSON.parse(await readFile(capabilityPath, "utf8"));
  capability.permissions = capability.permissions.filter((permission) =>
    typeof permission === "string"
      ? !permission.startsWith("http:")
      : permission?.identifier !== "http:default",
  );
  if (
    capability.permissions.some((permission) =>
      typeof permission === "string"
        ? permission.startsWith("http:")
        : String(permission?.identifier ?? "").startsWith("http:"),
    )
  ) {
    throw new Error("Evidence capability still contains a native HTTP grant.");
  }
  await writeFile(
    capabilityPath,
    `${JSON.stringify(capability, null, 2)}\n`,
    "utf8",
  );

  const tauriConfigPath = path.join(workspace, "src-tauri", "tauri.conf.json");
  const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
  tauriConfig.app.security.csp =
    "default-src 'self' asset: http://asset.localhost; script-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost; font-src 'self'; img-src 'self' asset: http://asset.localhost blob: data:; style-src 'self' 'unsafe-inline'; media-src 'self' blob: asset: http://asset.localhost; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  await writeFile(
    tauriConfigPath,
    `${JSON.stringify(tauriConfig, null, 2)}\n`,
    "utf8",
  );

  const rustPath = path.join(workspace, "src-tauri", "src", "lib.rs");
  let rust = await readFile(rustPath, "utf8");
  rust = replaceExactlyOnce(
    rust,
    "fn run_hermes_python(\n",
    `fn release_evidence_capture_enabled() -> bool {
    env::var("SPEAKRIGHT_RELEASE_EVIDENCE_CAPTURE").as_deref() == Ok("1")
}

fn run_hermes_python(
`,
    "runtime marker",
  );
  rust = replaceExactlyOnce(
    rust,
    ") -> Result<HermesPythonResult, String> {\n    let (python, root) = hermes_runtime()?;",
    `) -> Result<HermesPythonResult, String> {
    if release_evidence_capture_enabled() {
        return Err("External provider execution is disabled in release evidence.".to_string());
    }
    let (python, root) = hermes_runtime()?;`,
    "Hermes provider",
  );
  rust = replaceExactlyOnce(
    rust,
    "fn run_gcloud(args: &[&str], timeout_seconds: u64) -> Result<String, String> {\n    let mut command = gcloud_command();",
    `fn run_gcloud(args: &[&str], timeout_seconds: u64) -> Result<String, String> {
    if release_evidence_capture_enabled() {
        return Err("Google Cloud execution is disabled in release evidence.".to_string());
    }
    let mut command = gcloud_command();`,
    "Google Cloud provider",
  );
  rust = replaceExactlyOnce(
    rust,
    ") -> Result<VertexGeminiAudio, String> {\n    let text = validate_vertex_text(&text)?;",
    `) -> Result<VertexGeminiAudio, String> {
    if release_evidence_capture_enabled() {
        return Err("Vertex HTTP is disabled in release evidence.".to_string());
    }
    let text = validate_vertex_text(&text)?;`,
    "Vertex provider",
  );
  rust = replaceExactlyOnce(
    rust,
    "        .setup(|_app| {\n            start_hermes_bridge();",
    `        .setup(|_app| {
            if release_evidence_capture_enabled() {
                log::info!("SpeakRight local TTS bridge disabled for release evidence");
            } else {
                start_hermes_bridge();
            }`,
    "local provider bridge",
  );
  await writeFile(rustPath, rust, "utf8");

  return {
    tauriHttpGuardSha256: sha256(Buffer.from(tauriHttpGuard)),
    rustGuardSha256: sha256(Buffer.from(rust)),
  };
}

async function main() {
  const unknown = unknownArguments();
  if (unknown.length > 0) {
    throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  }
  if (process.platform !== "win32") {
    throw new Error("Desktop release evidence currently requires Windows.");
  }

  const workspace = assertSafeChild(
    readArgument("--workspace", defaultWorkspace),
    "Evidence workspace",
  );
  const cargoTarget = assertSafeChild(
    readArgument("--cargo-target", defaultCargoTarget),
    "Evidence Cargo target",
  );
  const provenance = releaseEvidenceGitProvenance(root, "desktop");
  const commit = provenance.commit;

  await rm(workspace, { force: true, recursive: true });
  await mkdir(workspace, { recursive: true });
  for (const directory of ["src", "src-tauri", path.join("packages", "core")]) {
    const source = path.join(root, directory);
    await cp(source, path.join(workspace, directory), {
      recursive: true,
      filter: copyFilter(source),
    });
  }
  for (const file of [
    "next-env.d.ts",
    "next.config.ts",
    "package-lock.json",
    "package.json",
    "postcss.config.mjs",
    "tsconfig.json",
  ]) {
    await copyFile(path.join(root, file), path.join(workspace, file));
  }
  for (const file of [
    path.join("scripts", "desktop-installer-roundtrip-core.mjs"),
    path.join("scripts", "lib", "desktop-preview-release-gate-core.mjs"),
  ]) {
    const destination = path.join(workspace, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(root, file), destination);
  }
  const sourceSnapshot = await releaseEvidenceSourceDigest(
    workspace,
    "desktop",
  );
  const credentialNamespace = `com.speakright.desktop.release-evidence-${randomBytes(8).toString("hex")}`;
  const tauriConfigPath = path.join(workspace, "src-tauri", "tauri.conf.json");
  const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
  tauriConfig.identifier = credentialNamespace;
  await writeFile(
    tauriConfigPath,
    `${JSON.stringify(tauriConfig, null, 2)}\n`,
    "utf8",
  );
  const runtimeGuard = await hardenEvidenceRuntime(workspace);
  await junction(
    path.join(root, "node_modules"),
    path.join(workspace, "node_modules"),
  );
  await junction(path.join(root, "public"), path.join(workspace, "public"));

  const tauriCli = path.join(
    root,
    "node_modules",
    "@tauri-apps",
    "cli",
    "tauri.js",
  );
  const build = spawnSync(
    process.execPath,
    [tauriCli, "build", "--no-bundle"],
    {
      cwd: workspace,
      env: {
        ...sanitizedEnvironment(),
        CARGO_BUILD_JOBS: "1",
        CARGO_TARGET_DIR: cargoTarget,
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SPEAKRIGHT_BUILD_TIMESTAMP: "2026-08-16T12:00:00.000Z",
        NEXT_PUBLIC_SPEAKRIGHT_COMMIT_SHA: commit,
        NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES: "1",
        NODE_ENV: "production",
        SPEAKRIGHT_STATIC_EXPORT: "1",
        SPEAKRIGHT_TEST_ARTIFACT: "1",
      },
      stdio: "inherit",
    },
  );
  if (build.error || build.status !== 0) {
    throw new Error(
      `Isolated Desktop fixture build failed: ${build.error?.message ?? `exit ${build.status}`}`,
    );
  }
  releaseEvidenceGitProvenance(root, "desktop", commit);

  const executable = path.join(cargoTarget, "release", "speakright.exe");
  if (!existsSync(executable)) {
    throw new Error(`Desktop fixture executable not found: ${executable}`);
  }
  const executableBuffer = await readFile(executable);
  await writeFile(
    path.join(workspace, "build-manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        version: RELEASE_EVIDENCE_VERSION,
        edition: "desktop",
        channel: "preview",
        signed: false,
        fixtureBuild: true,
        fixtureGate: "NEXT_PUBLIC_SPEAKRIGHT_TEST_FIXTURES=1",
        paidApiCalls: false,
        credentialNamespace,
        sourceSnapshot,
        runtimeIsolation: {
          temporaryLogDirectoryRequired: true,
          temporarySettingsStorePathRequired: true,
          temporaryWebViewProfileRequired: true,
        },
        networkGuard: {
          nativeHttp: "fail-closed",
          nativeHttpCapability: false,
          externalConnectCsp: false,
          rustExternalProviders: "fail-closed",
          ...runtimeGuard,
        },
        sourceCommit: commit,
        sourceWorktreeClean: true,
        executable: path
          .relative(allowedWorkspaceRoot, executable)
          .replaceAll("\\", "/"),
        executableSha256: sha256(executableBuffer),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Isolated Desktop evidence build: ${workspace}`);
  console.log(`Desktop fixture executable: ${executable}`);
  console.log(`Formal root out and Cargo target were not modified: ${root}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
