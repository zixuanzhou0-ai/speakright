import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

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

if (!existsSync(executable)) {
  console.error(
    [
      "SpeakRight release executable was not found.",
      `Expected: ${executable}`,
      "Run npm run desktop:run-release to build and launch the static desktop app.",
    ].join("\n"),
  );
  process.exit(1);
}

const child = spawn(executable, [], {
  detached: true,
  stdio: "ignore",
  windowsHide: false,
});

child.unref();

console.log("SpeakRight release desktop app launched.");
console.log(`Executable: ${executable}`);
console.log("This command does not start localhost or the Next dev server.");
