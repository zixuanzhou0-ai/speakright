import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function canonicalExecutablePath(executablePath) {
  let resolved = path.resolve(executablePath);
  try {
    resolved = await realpath(resolved);
  } catch {
    // A process can exit between the CIM query and path resolution. The
    // absolute lexical path is still useful for a conservative comparison.
  }
  return resolved.replaceAll("/", "\\").toLowerCase();
}

export async function findConflictingSpeakRightProcesses(targetExecutable) {
  if (process.platform !== "win32") return [];

  const command = [
    "$items = @(Get-CimInstance Win32_Process -Filter \"Name = 'speakright.exe'\" -ErrorAction Stop | ForEach-Object {",
    "  [PSCustomObject]@{ processId = [int]$_.ProcessId; executablePath = [string]$_.ExecutablePath }",
    "})",
    "ConvertTo-Json -InputObject $items -Compress",
  ].join("\n");
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    command,
  ]);
  const parsed = JSON.parse(stdout.trim() || "[]");
  const processes = Array.isArray(parsed) ? parsed : [parsed];
  const canonicalTarget = await canonicalExecutablePath(targetExecutable);
  const conflicts = [];

  for (const item of processes) {
    const processId = Number(item?.processId);
    const executablePath =
      typeof item?.executablePath === "string"
        ? item.executablePath.trim()
        : "";
    if (!Number.isInteger(processId) || processId <= 0 || !executablePath) {
      conflicts.push({
        processId: Number.isInteger(processId) ? processId : null,
        executablePath: executablePath || null,
        reason: "process-path-unavailable",
      });
      continue;
    }
    if ((await canonicalExecutablePath(executablePath)) === canonicalTarget) {
      conflicts.push({
        processId,
        executablePath,
        reason: "same-executable",
      });
    }
  }

  return conflicts;
}

export function formatSpeakRightProcessConflicts(conflicts) {
  return conflicts
    .map(
      ({ processId, executablePath, reason }) =>
        `pid=${processId ?? "unknown"} path=${executablePath ?? "unavailable"} reason=${reason}`,
    )
    .join(" | ");
}
