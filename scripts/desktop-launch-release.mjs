import { execFile, spawn } from "node:child_process";
import { existsSync, writeSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();

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

const executable = releaseExecutablePath();

function fail(message) {
  writeLine(2, `SpeakRight release launch failed: ${message}`);
  process.exit(1);
}

function writeLine(fd, message) {
  writeSync(fd, `${message}\n`);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
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
        };
      })
      .filter((processInfo) =>
        processInfo.imageName?.toLowerCase().includes("speakright.exe"),
      );
  } catch {
    return [];
  }
}

if (!existsSync(executable)) {
  fail(
    [
      "release executable was not found.",
      `Expected: ${executable}`,
      "Run npm run desktop:run-release to build and launch the static desktop app.",
    ].join(" "),
  );
}

const running = await runningSpeakRightProcesses();
if (running.length > 0) {
  fail(
    [
      "speakright.exe is already running.",
      "Use the existing app window, or close SpeakRight before launching another Release EXE.",
      `Running PIDs: ${running.map((item) => item.pid).join(", ")}`,
    ].join(" "),
  );
}

writeLine(2, "SpeakRight release desktop app launch requested.");
writeLine(2, `Executable: ${executable}`);
writeLine(2, "This command does not start localhost or the Next dev server.");

let child;
try {
  child = spawn(executable, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
} catch (error) {
  fail(`could not start release executable. ${formatError(error)}`);
}

writeLine(2, `PID: ${child.pid ?? "unknown"}`);

child.unref();
