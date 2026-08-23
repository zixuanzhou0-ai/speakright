import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PROCESS_QUERY_MAX_BUFFER = 8 * 1024 * 1024;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeProcessRecord(item) {
  const processId = Number(item?.processId);
  const parentProcessId = Number(item?.parentProcessId);
  const name = typeof item?.name === "string" ? item.name.trim() : "";
  if (
    !Number.isInteger(processId) ||
    processId <= 0 ||
    !Number.isInteger(parentProcessId) ||
    parentProcessId < 0 ||
    !name
  ) {
    throw new Error(
      "Windows process-tree inspection returned an invalid record.",
    );
  }
  return { processId, parentProcessId, name };
}

export async function queryWindowsProcessTable() {
  if (process.platform !== "win32") return [];

  const command = [
    '$ErrorActionPreference = "Stop"',
    "$items = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.ProcessId -gt 0 } | ForEach-Object {",
    "  [PSCustomObject]@{ processId = [int]$_.ProcessId; parentProcessId = [int]$_.ParentProcessId; name = [string]$_.Name }",
    "})",
    "ConvertTo-Json -InputObject $items -Compress",
  ].join("\n");
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { maxBuffer: PROCESS_QUERY_MAX_BUFFER },
  );
  const parsed = JSON.parse(stdout.trim() || "[]");
  const records = Array.isArray(parsed) ? parsed : [parsed];
  return records.map(normalizeProcessRecord);
}

export function findOwnedProcessSnapshots({
  processes,
  rootPid,
  executableName,
}) {
  if (
    !Array.isArray(processes) ||
    !Number.isInteger(rootPid) ||
    rootPid <= 0 ||
    typeof executableName !== "string" ||
    !executableName.trim()
  ) {
    throw new Error("Owned process-tree inspection is unavailable.");
  }

  const records = new Map();
  for (const item of processes) {
    const record = normalizeProcessRecord(item);
    if (records.has(record.processId)) {
      throw new Error(
        "Windows process-tree inspection returned a duplicate process.",
      );
    }
    records.set(record.processId, record);
  }
  if (!records.has(rootPid)) {
    throw new Error(
      "The owned process root is missing from process-tree inspection.",
    );
  }

  const ownedProcessIds = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records.values()) {
      if (
        !ownedProcessIds.has(record.processId) &&
        ownedProcessIds.has(record.parentProcessId)
      ) {
        ownedProcessIds.add(record.processId);
        changed = true;
      }
    }
  }

  const expectedName = executableName.trim().toLocaleLowerCase("en-US");
  return [...ownedProcessIds]
    .map((processId) => records.get(processId))
    .filter((record) => record.name.toLocaleLowerCase("en-US") === expectedName)
    .map(({ processId, name }) => ({ processId, name }));
}

export async function waitForWindowsProcessSnapshotsToExit(
  snapshots,
  {
    timeoutMs = 30_000,
    pollIntervalMs = 250,
    readProcessTable = queryWindowsProcessTable,
    wait = delay,
  } = {},
) {
  if (!Array.isArray(snapshots)) {
    throw new Error("Owned process snapshots are unavailable.");
  }
  if (snapshots.length === 0) return;

  const normalizedSnapshots = snapshots.map((snapshot) => {
    const processId = Number(snapshot?.processId);
    const name = typeof snapshot?.name === "string" ? snapshot.name.trim() : "";
    if (!Number.isInteger(processId) || processId <= 0 || !name) {
      throw new Error("Owned process snapshots contain an invalid record.");
    }
    return { processId, name: name.toLocaleLowerCase("en-US") };
  });
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const currentByPid = new Map(
      (await readProcessTable()).map((item) => {
        const record = normalizeProcessRecord(item);
        return [record.processId, record];
      }),
    );
    const exited = normalizedSnapshots.every((snapshot) => {
      const current = currentByPid.get(snapshot.processId);
      return (
        !current || current.name.toLocaleLowerCase("en-US") !== snapshot.name
      );
    });
    if (exited) return;
    if (Date.now() >= deadline) {
      throw new Error(
        "Owned WebView2 processes did not exit after the desktop host closed.",
      );
    }
    await wait(pollIntervalMs);
  }
}

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
