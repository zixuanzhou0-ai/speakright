import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  assertCleanPreflight,
  assertRoundtripPathPolicy,
  buildNsisUninstallArgs,
  createSanitizedFailureSummary,
  createSanitizedSummary,
  InstallerRoundtripError,
  isStrictPathInside,
  runInstallerRoundtrip,
} from "./desktop-installer-roundtrip-core.mjs";

const execFileAsync = promisify(execFile);
const productName = "SpeakRight";
const manufacturer = "speakright";
const mainBinaryName = "speakright.exe";
const uninstallerName = "uninstall.exe";
const markerName = ".speakright-installer-roundtrip.json";
// Reviewed against tauri-cli-v2.10.1's installer.nsi: WriteUninstaller,
// currentUser registry keys, silent/passive shortcuts, and uninstall cleanup.
const reviewedTauriCliVersion = "2.10.1";
const childProcesses = new Map();

function fail(code, message) {
  throw new InstallerRoundtripError(code, message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

function unquoteRegistryPath(value) {
  return typeof value === "string" ? value.replace(/^"|"$/g, "") : "";
}

function sameWindowsPath(left, right) {
  return (
    path.resolve(unquoteRegistryPath(left)).toLocaleLowerCase("en-US") ===
    path.resolve(unquoteRegistryPath(right)).toLocaleLowerCase("en-US")
  );
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

async function pathKind(filePath) {
  try {
    const info = await lstat(filePath);
    if (info.isSymbolicLink()) return "symlink";
    if (info.isDirectory()) return "directory";
    if (info.isFile()) return "file";
    return "other";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

async function listTargetEntries(targetPath) {
  const kind = await pathKind(targetPath);
  if (kind === "missing") return [];
  if (kind !== "directory") return [`<${kind}>`];
  const entries = await readdir(targetPath);
  return entries.length === 0 ? ["<existing-empty-directory>"] : entries;
}

async function runPowerShell(script, env = {}, timeout = 60_000) {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      env: { ...process.env, ...env },
      maxBuffer: 4 * 1024 * 1024,
      timeout,
      windowsHide: true,
    },
  );
  return stdout.trim();
}

const inspectStatePowerShell = String.raw`
$ErrorActionPreference = "Stop"
$productName = $env:SPEAKRIGHT_RT_PRODUCT_NAME
$manufacturer = $env:SPEAKRIGHT_RT_MANUFACTURER
$mainBinary = $env:SPEAKRIGHT_RT_MAIN_BINARY

$registrations = @()
$uninstallRoots = @(
  @{ label = "hkcu"; path = "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall" },
  @{ label = "hklm"; path = "Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall" },
  @{ label = "hklm-wow6432"; path = "Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" }
)
foreach ($root in $uninstallRoots) {
  if (-not (Test-Path -LiteralPath $root.path)) { continue }
  foreach ($key in Get-ChildItem -LiteralPath $root.path -ErrorAction Stop) {
    $properties = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
    if ($key.PSChildName -ieq $productName -or [string]$properties.DisplayName -ieq $productName) {
      $registrations += [pscustomobject]@{
        label = "$($root.label):$($key.PSChildName)"
        displayName = [string]$properties.DisplayName
        publisher = [string]$properties.Publisher
        installLocation = [string]$properties.InstallLocation
        uninstallString = [string]$properties.UninstallString
      }
    }
  }
}

$productKeys = @()
$productKeyCandidates = @(
  @{ label = "hkcu"; path = "Registry::HKEY_CURRENT_USER\Software\$manufacturer\$productName" },
  @{ label = "hklm"; path = "Registry::HKEY_LOCAL_MACHINE\Software\$manufacturer\$productName" },
  @{ label = "hklm-wow6432"; path = "Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\$manufacturer\$productName" }
)
foreach ($candidate in $productKeyCandidates) {
  if (-not (Test-Path -LiteralPath $candidate.path)) { continue }
  $item = Get-Item -LiteralPath $candidate.path -ErrorAction Stop
  $productKeys += [pscustomobject]@{
    label = $candidate.label
    installLocation = [string]$item.GetValue("")
    valueNames = @($item.GetValueNames())
    subKeyNames = @($item.GetSubKeyNames())
  }
}

$shell = New-Object -ComObject WScript.Shell
$shortcutPaths = @(
  @{ kind = "start-menu"; path = [Environment]::GetFolderPath("Programs") },
  @{ kind = "start-menu"; path = [Environment]::GetFolderPath("CommonPrograms") },
  @{ kind = "desktop"; path = [Environment]::GetFolderPath("Desktop") },
  @{ kind = "desktop"; path = [Environment]::GetFolderPath("CommonDesktopDirectory") }
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_.path) }
$shortcuts = @()
foreach ($shortcutRoot in $shortcutPaths) {
  $shortcutPath = Join-Path $shortcutRoot.path "$productName.lnk"
  if (Test-Path -LiteralPath $shortcutPath) {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcuts += [pscustomobject]@{
      kind = $shortcutRoot.kind
      path = $shortcutPath
      targetPath = [string]$shortcut.TargetPath
    }
  }
}

$runEntries = @()
$runKeyPath = "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run"
if (Test-Path -LiteralPath $runKeyPath) {
  $runKey = Get-Item -LiteralPath $runKeyPath -ErrorAction Stop
  if (@($runKey.GetValueNames()) -contains $productName) {
    $runEntries += [pscustomobject]@{
      name = $productName
      value = [string]$runKey.GetValue($productName)
    }
  }
}

$processes = @()
foreach ($process in Get-CimInstance Win32_Process -Filter "Name = '$mainBinary'" -ErrorAction Stop) {
  $processes += [pscustomobject]@{
    processId = [int]$process.ProcessId
    executablePath = [string]$process.ExecutablePath
  }
}

$defaultInstallDirs = @()
$defaultRoots = @(
  [Environment]::GetFolderPath("LocalApplicationData"),
  [Environment]::GetFolderPath("ProgramFiles"),
  [Environment]::GetFolderPath("ProgramFilesX86")
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
foreach ($defaultRoot in $defaultRoots) {
  $candidate = Join-Path $defaultRoot $productName
  if (Test-Path -LiteralPath $candidate) { $defaultInstallDirs += $candidate }
}

[pscustomobject]@{
  registrations = @($registrations)
  productKeys = @($productKeys)
  shortcuts = @($shortcuts)
  runEntries = @($runEntries)
  processes = @($processes)
  defaultInstallDirs = @($defaultInstallDirs)
} | ConvertTo-Json -Depth 8 -Compress
`;

async function inspectSystemState(plan) {
  const output = await runPowerShell(inspectStatePowerShell, {
    SPEAKRIGHT_RT_PRODUCT_NAME: productName,
    SPEAKRIGHT_RT_MANUFACTURER: manufacturer,
    SPEAKRIGHT_RT_MAIN_BINARY: mainBinaryName,
  });
  if (!output)
    fail("preflight-unavailable", "Windows state inspection returned no data");
  const parsed = JSON.parse(output);
  return {
    registrations: asArray(parsed.registrations),
    productKeys: asArray(parsed.productKeys),
    shortcuts: asArray(parsed.shortcuts),
    runEntries: asArray(parsed.runEntries),
    processes: asArray(parsed.processes),
    defaultInstallDirs: asArray(parsed.defaultInstallDirs),
    targetEntries: await listTargetEntries(plan.installDir),
  };
}

async function assertMarker(plan) {
  assertRoundtripPathPolicy(plan);
  if ((await pathKind(plan.sandboxRoot)) !== "directory") {
    fail("unsafe-cleanup", "round-trip sandbox is missing or not a directory");
  }
  const resolvedSandbox = await realpath(plan.sandboxRoot);
  if (!isStrictPathInside(plan.tempRoot, resolvedSandbox)) {
    fail("unsafe-cleanup", "resolved sandbox escaped the TEMP boundary");
  }
  if ((await pathKind(plan.markerPath)) !== "file") {
    fail("unsafe-cleanup", "round-trip ownership marker is missing or unsafe");
  }
  const marker = await readJson(plan.markerPath);
  if (marker.schemaVersion !== 1 || marker.runId !== plan.runId) {
    fail(
      "unsafe-cleanup",
      "round-trip ownership marker does not match this run",
    );
  }
  const installKind = await pathKind(plan.installDir);
  if (installKind === "symlink" || installKind === "other") {
    fail("unsafe-cleanup", "round-trip install target has an unsafe file type");
  }
  if (installKind === "directory") {
    const resolvedInstall = await realpath(plan.installDir);
    if (!isStrictPathInside(resolvedSandbox, resolvedInstall)) {
      fail("unsafe-cleanup", "resolved install target escaped the sandbox");
    }
  }
}

async function assertReleaseExecutableUnchanged(plan) {
  if ((await pathKind(plan.releaseExe)) !== "file") {
    fail("release-executable-changed", "release executable is missing");
  }
  const info = await stat(plan.releaseExe);
  const digest = await sha256(plan.releaseExe);
  if (info.size !== plan.releaseExeBytes || digest !== plan.releaseExeSha256) {
    fail(
      "release-executable-changed",
      "release executable changed after the round-trip plan was created",
    );
  }
}

function processStateScript() {
  return `
$ErrorActionPreference = "Stop"
$processId = [int]$env:SPEAKRIGHT_RT_PID
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
if (-not $process) {
  [pscustomobject]@{ exists = $false } | ConvertTo-Json -Compress
  exit 0
}
$windowProcess = Get-Process -Id $processId -ErrorAction Stop
[pscustomobject]@{
  exists = $true
  executablePath = [string]$process.ExecutablePath
  mainWindowHandle = [long]$windowProcess.MainWindowHandle
  mainWindowTitle = [string]$windowProcess.MainWindowTitle
} | ConvertTo-Json -Compress
`;
}

async function getProcessState(pid) {
  const output = await runPowerShell(processStateScript(), {
    SPEAKRIGHT_RT_PID: String(pid),
  });
  return JSON.parse(output);
}

async function assertOwnedProcess(plan, pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    fail("invalid-process", "installed app did not return a valid process ID");
  }
  const state = await getProcessState(pid);
  if (
    !state.exists ||
    !sameWindowsPath(state.executablePath, plan.installedExe)
  ) {
    fail(
      "process-ownership",
      "process executable does not match the temporary installed app",
    );
  }
  return state;
}

async function waitForCondition(
  callback,
  timeoutMs,
  intervalMs,
  failureCode,
  failureMessage,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await callback();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (lastError instanceof InstallerRoundtripError) throw lastError;
  fail(failureCode, failureMessage);
}

async function removeOwnedProductKey(plan) {
  const script = String.raw`
$ErrorActionPreference = "Stop"
$keyPath = "Registry::HKEY_CURRENT_USER\Software\$env:SPEAKRIGHT_RT_MANUFACTURER\$env:SPEAKRIGHT_RT_PRODUCT_NAME"
if (-not (Test-Path -LiteralPath $keyPath)) {
  [pscustomobject]@{ removed = $false } | ConvertTo-Json -Compress
  exit 0
}
$item = Get-Item -LiteralPath $keyPath -ErrorAction Stop
$actual = ([string]$item.GetValue("")).Trim('"')
$expected = ([string]$env:SPEAKRIGHT_RT_INSTALL_DIR).Trim('"')
if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Product key is not owned by this round-trip install."
}
$unexpectedValues = @($item.GetValueNames() | Where-Object { $_ -ne "" -and $_ -ne "Installer Language" })
if ($unexpectedValues.Count -ne 0 -or @($item.GetSubKeyNames()).Count -ne 0) {
  throw "Product key contains unexpected values or subkeys."
}
Remove-Item -LiteralPath $keyPath -Force -ErrorAction Stop
$manufacturerPath = Split-Path -Parent $keyPath
if (Test-Path -LiteralPath $manufacturerPath) {
  $manufacturerKey = Get-Item -LiteralPath $manufacturerPath -ErrorAction Stop
  if (@($manufacturerKey.GetSubKeyNames()).Count -eq 0 -and @($manufacturerKey.GetValueNames()).Count -eq 0) {
    Remove-Item -LiteralPath $manufacturerPath -Force -ErrorAction Stop
  }
}
[pscustomobject]@{ removed = $true } | ConvertTo-Json -Compress
`;
  const output = await runPowerShell(script, {
    SPEAKRIGHT_RT_MANUFACTURER: manufacturer,
    SPEAKRIGHT_RT_PRODUCT_NAME: productName,
    SPEAKRIGHT_RT_INSTALL_DIR: plan.installDir,
  });
  return JSON.parse(output).removed === true;
}

async function removeOwnedExternalResidue(plan) {
  const script = String.raw`
$ErrorActionPreference = "Stop"
$productName = $env:SPEAKRIGHT_RT_PRODUCT_NAME
$expectedInstall = $env:SPEAKRIGHT_RT_INSTALL_DIR
$expectedExe = $env:SPEAKRIGHT_RT_INSTALLED_EXE
$uninstallKey = "Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\$productName"
if (Test-Path -LiteralPath $uninstallKey) {
  $registration = Get-ItemProperty -LiteralPath $uninstallKey -ErrorAction Stop
  $actual = ([string]$registration.InstallLocation).Trim('"')
  if (-not [string]::Equals($actual, $expectedInstall, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Uninstall registration is not owned by this round-trip install."
  }
  Remove-Item -LiteralPath $uninstallKey -Force -ErrorAction Stop
}
$shell = New-Object -ComObject WScript.Shell
$shortcutRoots = @(
  [Environment]::GetFolderPath("Programs"),
  [Environment]::GetFolderPath("CommonPrograms"),
  [Environment]::GetFolderPath("Desktop"),
  [Environment]::GetFolderPath("CommonDesktopDirectory")
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
foreach ($shortcutRoot in $shortcutRoots) {
  $shortcutPath = Join-Path $shortcutRoot "$productName.lnk"
  if (-not (Test-Path -LiteralPath $shortcutPath)) { continue }
  $target = [string]$shell.CreateShortcut($shortcutPath).TargetPath
  if (-not [string]::Equals($target, $expectedExe, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Shortcut is not owned by this round-trip install."
  }
  Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction Stop
}
`;
  await runPowerShell(script, {
    SPEAKRIGHT_RT_PRODUCT_NAME: productName,
    SPEAKRIGHT_RT_INSTALL_DIR: plan.installDir,
    SPEAKRIGHT_RT_INSTALLED_EXE: plan.installedExe,
  });
  await removeOwnedProductKey(plan);
}

function createWindowsAdapter() {
  return {
    async inspectPreflight(plan) {
      return inspectSystemState(plan);
    },

    async prepareSandbox(plan) {
      await mkdir(plan.sandboxParent, { recursive: true });
      const resolvedParent = await realpath(plan.sandboxParent);
      if (!isStrictPathInside(plan.tempRoot, resolvedParent)) {
        fail(
          "unsafe-path",
          "resolved sandbox parent escaped the TEMP boundary",
        );
      }
      await mkdir(plan.sandboxRoot);
      await writeFile(
        plan.markerPath,
        `${JSON.stringify({ schemaVersion: 1, runId: plan.runId })}\n`,
        { encoding: "utf8", flag: "wx" },
      );
      await mkdir(plan.webViewProfileDir);
      await mkdir(plan.logDir);
      await mkdir(plan.settingsStoreDir);
      await assertMarker(plan);
    },

    async runInstaller(plan, args) {
      await assertMarker(plan);
      await assertReleaseExecutableUnchanged(plan);
      // Tauri's silent NSIS template kills same-name processes. Recheck as close
      // as possible to execution so an existing user process is never a target.
      assertCleanPreflight(await inspectSystemState(plan));
      await execFileAsync(plan.installerPath, args, {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        timeout: 15 * 60_000,
        windowsHide: true,
        windowsVerbatimArguments: true,
      });
    },

    async verifyInstalled(plan) {
      await assertMarker(plan);
      await assertReleaseExecutableUnchanged(plan);
      let payload =
        (await pathKind(plan.installedExe)) === "file" &&
        (await pathKind(plan.uninstallerPath)) === "file";
      if (payload) {
        const [resolvedInstallDir, resolvedInstalledExe, installedInfo] =
          await Promise.all([
            realpath(plan.installDir),
            realpath(plan.installedExe),
            stat(plan.installedExe),
          ]);
        payload =
          path.dirname(resolvedInstalledExe).toLocaleLowerCase("en-US") ===
            resolvedInstallDir.toLocaleLowerCase("en-US") &&
          installedInfo.size === plan.releaseExeBytes &&
          (await sha256(resolvedInstalledExe)) === plan.releaseExeSha256;
      }
      const state = await inspectSystemState(plan);
      const registration = state.registrations.some(
        (entry) =>
          entry.label?.toLocaleLowerCase("en-US") === "hkcu:speakright" &&
          sameWindowsPath(entry.installLocation, plan.installDir) &&
          sameWindowsPath(entry.uninstallString, plan.uninstallerPath),
      );
      const productKey = state.productKeys.some(
        (entry) =>
          entry.label === "hkcu" &&
          sameWindowsPath(entry.installLocation, plan.installDir),
      );
      const ownedShortcuts = state.shortcuts.filter((entry) =>
        sameWindowsPath(entry.targetPath, plan.installedExe),
      );
      const shortcutKinds = new Set(ownedShortcuts.map((entry) => entry.kind));
      const shortcuts =
        ownedShortcuts.length === state.shortcuts.length &&
        shortcutKinds.has("desktop") &&
        shortcutKinds.has("start-menu");
      return { payload, registration: registration && productKey, shortcuts };
    },

    async launchInstalledApp(plan) {
      await assertMarker(plan);
      const child = spawn(plan.installedExe, [], {
        cwd: plan.installDir,
        env: {
          ...process.env,
          SPEAKRIGHT_LOG_DIR: plan.logDir,
          SPEAKRIGHT_SECURE_STORE_SERVICE: `com.speakright.desktop.installer-roundtrip-${randomUUID()}`,
          SPEAKRIGHT_SETTINGS_STORE_PATH: plan.settingsStorePath,
          WEBVIEW2_USER_DATA_FOLDER: plan.webViewProfileDir,
        },
        stdio: "ignore",
        windowsHide: false,
      });
      const spawned = new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      const exited = new Promise((resolve) => {
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });
      await spawned;
      childProcesses.set(child.pid, { child, exited });
      return child.pid;
    },

    async assertOwnedProcess(plan, pid) {
      await assertOwnedProcess(plan, pid);
    },

    async waitForWindow(plan, pid) {
      await waitForCondition(
        async () => {
          const state = await assertOwnedProcess(plan, pid);
          return (
            Number(state.mainWindowHandle) > 0 &&
            state.mainWindowTitle?.includes(productName)
          );
        },
        60_000,
        500,
        "window-timeout",
        "installed app did not expose the expected SpeakRight window",
      );
    },

    async assertIsolatedWebViewProfile(plan) {
      await assertMarker(plan);
      const entries = await readdir(plan.webViewProfileDir);
      if (entries.length === 0) {
        fail("webview-profile", "isolated WebView2 profile was not populated");
      }
      const logPath = path.join(plan.logDir, "speakright.log");
      await waitForCondition(
        async () => {
          if ((await pathKind(logPath)) !== "file") return false;
          return (await readFile(logPath, "utf8")).includes(
            "SpeakRight desktop runtime initialized",
          );
        },
        10_000,
        250,
        "isolated-log-missing",
        "installed app did not write its isolated runtime log",
      );
    },

    async closeAndWait(plan, pid) {
      await assertOwnedProcess(plan, pid);
      const closeScript = `
$ErrorActionPreference = "Stop"
$processId = [int]$env:SPEAKRIGHT_RT_PID
$expectedExe = $env:SPEAKRIGHT_RT_INSTALLED_EXE
$cim = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
if (-not $cim -or -not [string]::Equals([string]$cim.ExecutablePath, $expectedExe, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Process ownership changed before clean close."
}
$process = Get-Process -Id $processId -ErrorAction Stop
if (-not $process.CloseMainWindow()) { throw "Main window rejected the clean close request." }
`;
      await runPowerShell(closeScript, {
        SPEAKRIGHT_RT_PID: String(pid),
        SPEAKRIGHT_RT_INSTALLED_EXE: plan.installedExe,
      });
      const record = childProcesses.get(pid);
      if (!record)
        fail("process-tracking", "installed app process was not tracked");
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new InstallerRoundtripError(
                "exit-timeout",
                "installed app did not exit cleanly",
              ),
            ),
          30_000,
        );
      });
      let result;
      try {
        result = await Promise.race([record.exited, timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
      childProcesses.delete(pid);
      if (result.signal !== null) {
        fail("unclean-exit", "installed app exited due to a signal");
      }
      return result.code;
    },

    async terminateOwnedProcess(plan, pid) {
      const state = await getProcessState(pid);
      if (!state.exists) return;
      if (!sameWindowsPath(state.executablePath, plan.installedExe)) {
        fail(
          "process-ownership",
          "refusing to terminate a process whose executable path changed",
        );
      }
      const terminateScript = `
$ErrorActionPreference = "Stop"
$processId = [int]$env:SPEAKRIGHT_RT_PID
$expectedExe = $env:SPEAKRIGHT_RT_INSTALLED_EXE
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction Stop
if ($process -and [string]::Equals([string]$process.ExecutablePath, $expectedExe, [StringComparison]::OrdinalIgnoreCase)) {
  Stop-Process -Id $processId -Force -ErrorAction Stop
}
`;
      await runPowerShell(terminateScript, {
        SPEAKRIGHT_RT_PID: String(pid),
        SPEAKRIGHT_RT_INSTALLED_EXE: plan.installedExe,
      });
      await waitForCondition(
        async () => !(await getProcessState(pid)).exists,
        10_000,
        250,
        "termination-timeout",
        "owned installed app process did not terminate",
      );
      childProcesses.delete(pid);
    },

    async runUninstaller(plan, args) {
      await assertMarker(plan);
      const state = await inspectSystemState(plan);
      if (state.processes.length > 0) {
        fail(
          "foreign-process-before-uninstall",
          "refusing to run Tauri's name-based uninstaller while SpeakRight is running",
        );
      }
      if ((await pathKind(plan.uninstallerPath)) !== "file") {
        fail(
          "missing-uninstaller",
          "temporary installation did not contain uninstall.exe",
        );
      }
      await execFileAsync(plan.uninstallerPath, args, {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        timeout: 10 * 60_000,
        windowsHide: true,
        windowsVerbatimArguments: true,
      });
    },

    async cleanupExpectedNativeResidue(plan) {
      await assertMarker(plan);
      let selfResidueRemoved = false;
      if ((await pathKind(plan.installDir)) === "directory") {
        const entries = await readdir(plan.installDir);
        const unexpected = entries.filter(
          (entry) => entry.toLocaleLowerCase("en-US") !== uninstallerName,
        );
        if (unexpected.length > 0) {
          fail(
            "uninstall-residue",
            "native uninstaller left unexpected install files",
          );
        }
        if (entries.length === 1) {
          if ((await pathKind(plan.uninstallerPath)) !== "file") {
            fail(
              "unsafe-cleanup",
              "expected uninstaller self-residue is not a regular file",
            );
          }
          await unlink(plan.uninstallerPath);
          selfResidueRemoved = true;
        }
        await rmdir(plan.installDir);
      }
      const productKeyRemoved = await removeOwnedProductKey(plan);
      return { selfResidueRemoved, productKeyRemoved };
    },

    async inspectResiduals(plan) {
      const state = await inspectSystemState(plan);
      const installEntries = await listTargetEntries(plan.installDir);
      return {
        registrations: state.registrations,
        productKeys: state.productKeys,
        shortcuts: state.shortcuts,
        runEntries: state.runEntries,
        processes: state.processes,
        installEntries,
      };
    },

    async rollbackOwnedInstallation(plan) {
      await assertMarker(plan);
      const errors = [];
      if ((await pathKind(plan.uninstallerPath)) === "file") {
        try {
          const state = await inspectSystemState(plan);
          if (state.processes.length > 0) {
            fail(
              "foreign-process-before-rollback",
              "refusing to run Tauri's name-based uninstaller during rollback while SpeakRight is running",
            );
          } else {
            await execFileAsync(
              plan.uninstallerPath,
              buildNsisUninstallArgs(plan.installDir),
              {
                encoding: "utf8",
                maxBuffer: 4 * 1024 * 1024,
                timeout: 10 * 60_000,
                windowsHide: true,
                windowsVerbatimArguments: true,
              },
            );
          }
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        await removeOwnedExternalResidue(plan);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length > 0) {
        fail(
          "rollback-failed",
          `${errors.length} owned rollback operation(s) failed`,
        );
      }
    },

    async cleanupSandbox(plan) {
      await assertMarker(plan);
      await rm(plan.sandboxRoot, { recursive: true, force: false });
    },
  };
}

async function buildPlan(root, version) {
  if (process.platform !== "win32") {
    fail(
      "windows-required",
      "desktop installer round-trip must run on Windows",
    );
  }
  if (!process.env.TEMP) {
    fail(
      "temp-unavailable",
      "%TEMP% is required for the isolated installation",
    );
  }
  const tempRoot = await realpath(process.env.TEMP);
  const sandboxParent = path.join(tempRoot, "speakright-installer-roundtrip");
  const runId = randomUUID();
  const sandboxRoot = path.join(sandboxParent, `run-${runId}`);
  const installDir = path.join(sandboxRoot, "install");
  const webViewProfileDir = path.join(sandboxRoot, "webview2-profile");
  const logDir = path.join(sandboxRoot, "logs");
  const settingsStoreDir = path.join(sandboxRoot, "settings");
  const settingsStorePath = path.join(
    settingsStoreDir,
    "speakright-settings.json",
  );
  const installerPath = path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "nsis",
    `${productName}_${version}_x64-setup.exe`,
  );
  if ((await pathKind(installerPath)) !== "file") {
    fail("missing-installer", "expected NSIS release installer is missing");
  }
  const resolvedInstaller = await realpath(installerPath);
  const expectedBoundary = await realpath(path.dirname(installerPath));
  if (!isStrictPathInside(expectedBoundary, resolvedInstaller)) {
    fail(
      "unsafe-installer",
      "NSIS installer escaped its expected bundle directory",
    );
  }
  const releaseExePath = path.join(
    root,
    "src-tauri",
    "target",
    "release",
    mainBinaryName,
  );
  if ((await pathKind(releaseExePath)) !== "file") {
    fail(
      "missing-release-executable",
      "expected release executable is missing",
    );
  }
  const resolvedReleaseExe = await realpath(releaseExePath);
  const releaseBoundary = await realpath(path.dirname(releaseExePath));
  if (
    path.dirname(resolvedReleaseExe).toLocaleLowerCase("en-US") !==
    releaseBoundary.toLocaleLowerCase("en-US")
  ) {
    fail(
      "unsafe-release-executable",
      "release executable escaped its expected release directory",
    );
  }
  const releaseExeInfo = await stat(resolvedReleaseExe);
  const plan = {
    runId,
    tempRoot,
    sandboxParent,
    sandboxRoot,
    installDir,
    webViewProfileDir,
    logDir,
    settingsStoreDir,
    settingsStorePath,
    markerPath: path.join(sandboxRoot, markerName),
    installerPath: resolvedInstaller,
    releaseExe: resolvedReleaseExe,
    releaseExeBytes: releaseExeInfo.size,
    releaseExeSha256: await sha256(resolvedReleaseExe),
    installedExe: path.join(installDir, mainBinaryName),
    uninstallerPath: path.join(installDir, uninstallerName),
  };
  assertRoundtripPathPolicy(plan);
  return plan;
}

async function validateTauriNsisContract(root) {
  const config = await readJson(
    path.join(root, "src-tauri", "tauri.conf.json"),
  );
  const packageLock = await readJson(path.join(root, "package-lock.json"));
  const lockedTauriCliVersion =
    packageLock.packages?.["node_modules/@tauri-apps/cli"]?.version;
  if (lockedTauriCliVersion !== reviewedTauriCliVersion) {
    fail(
      "unreviewed-tauri-cli",
      "locked Tauri CLI version changed; review its NSIS template before running the installer round-trip",
    );
  }
  const nsis = config.bundle?.windows?.nsis ?? config.bundle?.nsis ?? {};
  const installMode = nsis.installMode ?? "currentUser";
  if (installMode !== "currentUser") {
    fail(
      "unsupported-install-mode",
      "round-trip only supports Tauri NSIS currentUser installs",
    );
  }
  if (nsis.installerHooks || nsis.template) {
    fail(
      "custom-nsis-unsupported",
      "custom NSIS hooks/template require a reviewed round-trip adapter",
    );
  }
  if (nsis.startMenuFolder) {
    fail(
      "custom-start-menu-folder-unsupported",
      "custom NSIS startMenuFolder requires reviewed shortcut ownership checks",
    );
  }
  if (config.productName !== productName) {
    fail("product-mismatch", "Tauri productName does not match SpeakRight");
  }
  if (config.identifier !== "com.speakright.desktop") {
    fail("identifier-mismatch", "Tauri identifier does not match SpeakRight");
  }
}

function summaryPath(root, version) {
  return path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    `${productName}_${version}_installer-roundtrip.json`,
  );
}

function redactForConsole(message, root, tempRoot) {
  return String(message)
    .replaceAll(root, "<workspace>")
    .replaceAll(tempRoot ?? "__NO_TEMP__", "<temp>")
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, "<user-profile>");
}

async function main() {
  const root = await realpath(process.cwd());
  const packageJson = await readJson(path.join(root, "package.json"));
  const version = packageJson.version;
  const outputPath = summaryPath(root, version);
  let installer;
  let plan;
  try {
    await validateTauriNsisContract(root);
    plan = await buildPlan(root, version);
    const installerInfo = await stat(plan.installerPath);
    installer = {
      fileName: path.basename(plan.installerPath),
      bytes: installerInfo.size,
      sha256: await sha256(plan.installerPath),
    };
    const outcome = await runInstallerRoundtrip({
      plan,
      adapter: createWindowsAdapter(),
    });
    const summary = createSanitizedSummary({
      version,
      installer,
      outcome,
      completedAt: new Date().toISOString(),
    });
    await writeFile(
      outputPath,
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8",
    );
    console.log(
      `Desktop installer round-trip passed; report: ${path.relative(root, outputPath)}`,
    );
  } catch (error) {
    if (existsSync(path.dirname(outputPath))) {
      const failure = createSanitizedFailureSummary({
        version,
        installer,
        error,
        completedAt: new Date().toISOString(),
      });
      await writeFile(
        outputPath,
        `${JSON.stringify(failure, null, 2)}\n`,
        "utf8",
      );
    }
    const code = error?.code ?? "roundtrip-failed";
    const tempRoot = plan?.tempRoot ?? process.env.TEMP;
    console.error(
      redactForConsole(
        `Desktop installer round-trip failed [${code}]: ${error instanceof Error ? error.message : String(error)}`,
        root,
        tempRoot,
      ),
    );
    process.exitCode = 1;
  }
}

await main();
