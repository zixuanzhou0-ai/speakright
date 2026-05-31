import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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

async function captureWindowEvidence(pid) {
  if (process.platform !== "win32") return null;

  const outputDir = path.join(
    root,
    "src-tauri",
    "target",
    "release",
    "smoke",
  );
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "speakright-window.png");
  const script = `
param([int]$TargetPid, [string]$OutputPath)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$nativeSource = @"
using System;
using System.Runtime.InteropServices;

public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}

public static class NativeWindow {
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
Add-Type -TypeDefinition $nativeSource
$process = Get-Process -Id $TargetPid -ErrorAction Stop
$handle = $process.MainWindowHandle
if ($handle -eq [IntPtr]::Zero) {
  throw "Main window handle is not available."
}
[NativeWindow]::ShowWindow($handle, 5) | Out-Null
[NativeWindow]::SetForegroundWindow($handle) | Out-Null
Start-Sleep -Milliseconds 800
$rect = New-Object RECT
if (-not [NativeWindow]::GetWindowRect($handle, [ref]$rect)) {
  throw "GetWindowRect failed."
}
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -lt 300 -or $height -lt 300) {
  throw ("Window bounds are too small: {0}x{1}." -f $width, $height)
}
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($OutputPath)) | Out-Null
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$clientTop = [Math]::Min(80, [Math]::Max(0, $height - 1))
$step = [Math]::Max(1, [Math]::Floor([Math]::Min($width, $height) / 120))
$total = 0
$nonWhite = 0
$distinct = New-Object 'System.Collections.Generic.HashSet[string]'
for ($y = $clientTop; $y -lt $height; $y += $step) {
  for ($x = 0; $x -lt $width; $x += $step) {
    $pixel = $bitmap.GetPixel($x, $y)
    $total += 1
    if (-not ($pixel.R -ge 248 -and $pixel.G -ge 248 -and $pixel.B -ge 248)) {
      $nonWhite += 1
    }
    $null = $distinct.Add("$($pixel.R),$($pixel.G),$($pixel.B)")
  }
}
$graphics.Dispose()
$bitmap.Dispose()

[pscustomobject]@{
  Path = $OutputPath
  Width = $width
  Height = $height
  SampledPixels = $total
  NonWhiteRatio = if ($total -gt 0) { $nonWhite / $total } else { 0 }
  DistinctColors = $distinct.Count
  ClientTop = $clientTop
} | ConvertTo-Json -Compress
`;

  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `& { ${script} }`,
    String(pid),
    outputPath,
  ]);
  const evidence = JSON.parse(stdout.trim());
  if (evidence.Width < 800 || evidence.Height < 600) {
    throw new Error(
      `Desktop smoke screenshot is too small: ${evidence.Width}x${evidence.Height}.`,
    );
  }
  if (evidence.NonWhiteRatio < 0.005 || evidence.DistinctColors < 12) {
    throw new Error(
      [
        "Desktop smoke screenshot looks blank.",
        `nonWhiteRatio=${evidence.NonWhiteRatio}`,
        `distinctColors=${evidence.DistinctColors}`,
        `path=${evidence.Path}`,
      ].join(" "),
    );
  }
  return evidence;
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
        await delay(1_000);
        const evidence = await captureWindowEvidence(child.pid);
        console.log(
          [
            `Desktop smoke test passed: pid=${child.pid}`,
            observedTitle ? `title="${observedTitle}"` : "",
            evidence
              ? `screenshot="${evidence.Path}" ${evidence.Width}x${evidence.Height} nonWhiteRatio=${evidence.NonWhiteRatio.toFixed(4)} distinctColors=${evidence.DistinctColors}`
              : "",
          ]
            .filter(Boolean)
            .join(" "),
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
