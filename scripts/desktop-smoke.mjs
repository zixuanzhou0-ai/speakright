import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const expectedTitle = "SpeakRight";
const timeoutMs = Number(process.env.SPEAKRIGHT_SMOKE_TIMEOUT_MS ?? 15_000);

function executablePath() {
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWindowTitle(pid) {
  if (process.platform !== "win32") return "";
  const command = `try { (Get-Process -Id ${pid} -ErrorAction Stop).MainWindowTitle } catch { '' }`;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    command,
  ]);
  return stdout.trim();
}

async function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function stopProcess(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    try {
      await execFileAsync("taskkill.exe", [
        "/PID",
        String(child.pid),
        "/T",
        "/F",
      ]);
      return;
    } catch {
      // Fall through to process.kill.
    }
  }
  try {
    child.kill("SIGTERM");
  } catch {
    // Process already exited.
  }
}

async function smoke() {
  const exe = executablePath();
  if (!existsSync(exe)) {
    throw new Error(
      `Desktop release executable is missing. Build first: ${exe}`,
    );
  }

  const child = spawn(exe, [], {
    detached: false,
    stdio: "ignore",
    windowsHide: false,
  });

  if (!child.pid) {
    throw new Error("Desktop release executable did not return a process id.");
  }

  let exitCode = null;
  child.once("exit", (code) => {
    exitCode = code;
  });

  const deadline = Date.now() + timeoutMs;
  let observedTitle = "";
  try {
    while (Date.now() < deadline) {
      if (!(await isRunning(child.pid))) {
        throw new Error(
          `Desktop release executable exited during smoke test with code ${exitCode ?? "unknown"}.`,
        );
      }
      observedTitle = await getWindowTitle(child.pid);
      if (process.platform !== "win32" || observedTitle === expectedTitle) {
        console.log(
          `Desktop smoke test passed: pid=${child.pid}${observedTitle ? ` title="${observedTitle}"` : ""}`,
        );
        return;
      }
      await delay(500);
    }
    throw new Error(
      `Desktop release executable started but window title was "${observedTitle || "<empty>"}", expected "${expectedTitle}".`,
    );
  } finally {
    await stopProcess(child);
  }
}

smoke().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
