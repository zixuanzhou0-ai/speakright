import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const args = new Set(process.argv.slice(2));
const allowMissingReleaseExe = args.has("--allow-missing-release-exe");
const releaseFreshnessToleranceMs = 2000;

function releaseExecutablePath() {
  if (process.platform === "win32") {
    return path.join(root, "src-tauri", "target", "release", "speakright.exe");
  }
  if (process.platform === "darwin") {
    return path.join(
      root,
      "src-tauri",
      "target",
      "release",
      "bundle",
      "macos",
      "SpeakRight.app",
      "Contents",
      "MacOS",
      "SpeakRight",
    );
  }
  return path.join(root, "src-tauri", "target", "release", "speakright");
}

function fail(message) {
  console.error(`Desktop preflight failed: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function newestFileMtimeMs(directory) {
  if (!existsSync(directory)) return null;

  let newest = null;
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;

      try {
        const mtimeMs = statSync(entryPath).mtimeMs;
        newest = Math.max(newest ?? 0, mtimeMs);
      } catch {
        // A concurrently rewritten static export file should not hide other files.
      }
    }
  }

  return newest;
}

function assertReleaseExecutableFresh(executable) {
  const staticExportPath = path.join(root, "out");
  const newestStaticMtimeMs = newestFileMtimeMs(staticExportPath);
  if (newestStaticMtimeMs === null) return;

  const executableMtimeMs = statSync(executable).mtimeMs;
  if (newestStaticMtimeMs - executableMtimeMs <= releaseFreshnessToleranceMs) {
    return;
  }

  fail(
    [
      "release executable is older than the static export.",
      `Static export: ${staticExportPath}`,
      `Release EXE: ${executable}`,
      "Run npm run desktop:build before Release EXE validation or launch.",
      "Do not use localhost/dev server as a substitute.",
    ].join(" "),
  );
}

async function gitStatus() {
  try {
    const { stdout } = await execFileAsync("git", [
      "-c",
      `safe.directory=${root}`,
      "status",
      "--short",
      "--branch",
    ]);
    return stdout.trim();
  } catch (error) {
    fail(
      `cannot read git status from ${root}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function gitTopLevel() {
  try {
    const { stdout } = await execFileAsync("git", [
      "-c",
      `safe.directory=${root}`,
      "rev-parse",
      "--show-toplevel",
    ]);
    return path.resolve(stdout.trim());
  } catch (error) {
    fail(
      `cannot resolve repository root from ${root}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function runningSpeakRightProcesses() {
  if (process.platform !== "win32") return [];
  try {
    const { stdout } = await execFileAsync("tasklist.exe", [
      "/FI",
      "IMAGENAME eq speakright.exe",
      "/FO",
      "CSV",
      "/NH",
    ]);
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.includes("INFO:"))
      .map((line) => {
        const parts = line
          .replace(/^"|"$/g, "")
          .split('","')
          .map((part) => part.replace(/^"|"$/g, ""));
        return {
          imageName: parts[0],
          pid: parts[1],
          session: parts[2],
          memory: parts[4],
        };
      })
      .filter((processInfo) =>
        processInfo.imageName?.toLowerCase().includes("speakright.exe"),
      );
  } catch {
    return [];
  }
}

async function main() {
  const packageJsonPath = path.join(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    fail(
      "package.json is missing. Run this from the SpeakRight repository root.",
    );
  }
  const packageJson = readJson("package.json");
  if (packageJson.name !== "speakright-desktop") {
    fail(`unexpected package name "${packageJson.name}".`);
  }

  const repositoryRoot = await gitTopLevel();
  if (repositoryRoot !== path.resolve(root)) {
    fail(`wrong working directory: ${root}. Run from ${repositoryRoot}.`);
  }

  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  if (tauriConfig.identifier !== "com.speakright.desktop") {
    fail(`unexpected Tauri identifier "${tauriConfig.identifier}".`);
  }
  if (tauriConfig.build?.frontendDist !== "../out") {
    fail(
      "Tauri release build is not configured to use the static export ../out.",
    );
  }

  const running = await runningSpeakRightProcesses();
  if (running.length > 0) {
    fail(
      [
        "speakright.exe is already running.",
        "Close the desktop app before building or validating release artifacts.",
        `Running PIDs: ${running.map((item) => item.pid).join(", ")}`,
      ].join(" "),
    );
  }

  const executable = releaseExecutablePath();
  if (!allowMissingReleaseExe && !existsSync(executable)) {
    fail(
      [
        "release executable is missing.",
        `Expected: ${executable}`,
        "Run npm run desktop:build before launch or smoke testing.",
      ].join(" "),
    );
  }
  if (!allowMissingReleaseExe && existsSync(executable)) {
    assertReleaseExecutableFresh(executable);
  }

  const status = await gitStatus();
  const isClean = status.split(/\r?\n/).every((line, index) => {
    if (index === 0 && line.startsWith("## ")) return true;
    return line.trim().length === 0;
  });

  console.log("Desktop preflight passed.");
  console.log(`Repository: ${root}`);
  console.log(`Git: ${isClean ? "clean" : "dirty; review before release"}`);
  console.log(
    `Release EXE: ${existsSync(executable) ? executable : "missing allowed"}`,
  );
  console.log("No running speakright.exe process was detected.");
  console.log(
    "Release launch remains static; this preflight does not start localhost.",
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
