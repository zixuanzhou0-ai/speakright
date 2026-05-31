import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const expectedTitle = "SpeakRight";
const appIdentifier = "com.speakright.desktop";
const expectedRuntimeLogLine = "SpeakRight desktop runtime initialized";
const desktopLlmPolicyMarker = "桌面版出于安全只允许预设 LLM provider";
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

function getOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not reserve a WebView2 debugging port."));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function buildSmokeEnv(debuggingPort) {
  if (!debuggingPort || process.platform !== "win32") return process.env;
  const existingArgs = process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? "";
  const smokeArgs = [
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-allow-origins=*",
  ].join(" ");
  return {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [existingArgs, smokeArgs]
      .filter(Boolean)
      .join(" "),
  };
}

function runtimeLogPath() {
  if (process.platform !== "win32") return null;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error(
      "LOCALAPPDATA is not set; cannot locate desktop runtime logs.",
    );
  }
  return path.join(localAppData, appIdentifier, "logs", "speakright.log");
}

async function captureRuntimeLogEvidence(smokeStartedAt) {
  const logPath = runtimeLogPath();
  if (!logPath) return null;

  const deadline = Date.now() + 5_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const [logStats, contents] = await Promise.all([
        stat(logPath),
        readFile(logPath, "utf8"),
      ]);
      if (
        logStats.mtimeMs >= smokeStartedAt - 1_000 &&
        contents.includes(expectedRuntimeLogLine)
      ) {
        const lastLine = contents.trim().split(/\r?\n/).at(-1) ?? "";
        return {
          path: logPath,
          bytes: logStats.size,
          lastLine,
        };
      }
      lastError = new Error(
        `Runtime log did not contain the expected startup line yet: ${logPath}`,
      );
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }

  throw new Error(
    `Desktop runtime log was not written after launch: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
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

async function analyzePngFile(outputPath) {
  const script = `
param([string]$ImagePath)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::FromFile($ImagePath)
try {
  $width = $bitmap.Width
  $height = $bitmap.Height
  $step = [Math]::Max(1, [Math]::Floor([Math]::Min($width, $height) / 120))
  $total = 0
  $nonWhite = 0
  $distinct = New-Object 'System.Collections.Generic.HashSet[string]'
  for ($y = 0; $y -lt $height; $y += $step) {
    for ($x = 0; $x -lt $width; $x += $step) {
      $pixel = $bitmap.GetPixel($x, $y)
      $total += 1
      if (-not ($pixel.R -ge 248 -and $pixel.G -ge 248 -and $pixel.B -ge 248)) {
        $nonWhite += 1
      }
      $null = $distinct.Add("$($pixel.R),$($pixel.G),$($pixel.B)")
    }
  }
  [pscustomobject]@{
    Path = $ImagePath
    Width = $width
    Height = $height
    SampledPixels = $total
    NonWhiteRatio = if ($total -gt 0) { $nonWhite / $total } else { 0 }
    DistinctColors = $distinct.Count
  } | ConvertTo-Json -Compress
} finally {
  $bitmap.Dispose()
}
`;

  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `& { ${script} }`,
    outputPath,
  ]);
  return JSON.parse(stdout.trim());
}

async function captureWebviewEvidence(cdp) {
  const outputDir = path.join(root, "src-tauri", "target", "release", "smoke");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "speakright-webview.png");
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  if (!screenshot?.data) {
    throw new Error("CDP did not return a WebView screenshot.");
  }
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));

  const evidence = await analyzePngFile(outputPath);
  if (evidence.Width < 800 || evidence.Height < 600) {
    throw new Error(
      `Desktop WebView screenshot is too small: ${evidence.Width}x${evidence.Height}.`,
    );
  }
  if (evidence.NonWhiteRatio < 0.005 || evidence.DistinctColors < 12) {
    throw new Error(
      [
        "Desktop WebView screenshot looks blank.",
        `nonWhiteRatio=${evidence.NonWhiteRatio}`,
        `distinctColors=${evidence.DistinctColors}`,
        `path=${evidence.Path}`,
      ].join(" "),
    );
  }
  return evidence;
}

async function waitForDevtoolsTarget(debuggingPort) {
  const deadline = Date.now() + 8_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${debuggingPort}/json/list`,
      );
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find(
          (item) => item.type === "page" && item.webSocketDebuggerUrl,
        );
        if (target) return target;
      }
      lastError = new Error(
        `WebView2 devtools returned HTTP ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `WebView2 devtools target was not available: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

function normalizeWebSocketData(data) {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data);
}

function createCdpClient(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map();
    let nextId = 1;
    let opened = false;

    const rejectPending = (error) => {
      for (const { reject: rejectCommand } of pending.values()) {
        rejectCommand(error);
      }
      pending.clear();
    };

    socket.addEventListener("open", () => {
      opened = true;
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          const payload = JSON.stringify({ id, method, params });
          return new Promise((resolveCommand, rejectCommand) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectCommand(new Error(`CDP command timed out: ${method}`));
            }, 8_000);
            pending.set(id, {
              resolve: (value) => {
                clearTimeout(timeout);
                resolveCommand(value);
              },
              reject: (error) => {
                clearTimeout(timeout);
                rejectCommand(error);
              },
            });
            socket.send(payload);
          });
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(normalizeWebSocketData(event.data));
      if (!message.id || !pending.has(message.id)) return;
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        command.reject(
          new Error(
            `CDP command failed: ${message.error.message ?? JSON.stringify(message.error)}`,
          ),
        );
      } else {
        command.resolve(message.result);
      }
    });

    socket.addEventListener("error", () => {
      const error = new Error("CDP WebSocket connection failed.");
      if (!opened) reject(error);
      rejectPending(error);
    });

    socket.addEventListener("close", () => {
      rejectPending(new Error("CDP WebSocket connection closed."));
    });
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      `Desktop runtime evaluation failed: ${result.exceptionDetails.text ?? "unknown exception"}`,
    );
  }
  return result.result?.value;
}

async function waitForBodyText(cdp, expectedText) {
  const deadline = Date.now() + 8_000;
  let bodyText = "";
  while (Date.now() < deadline) {
    bodyText =
      (await evaluate(cdp, "document.body ? document.body.innerText : ''")) ??
      "";
    if (bodyText.includes(expectedText)) return bodyText;
    await delay(250);
  }
  throw new Error(
    `Desktop route did not render expected text "${expectedText}". Last body text: ${bodyText.slice(0, 400)}`,
  );
}

async function captureInteractiveEvidence(debuggingPort) {
  if (!debuggingPort || process.platform !== "win32") return null;

  const target = await waitForDevtoolsTarget(debuggingPort);
  const cdp = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await waitForBodyText(cdp, "今日学习计划");
    const screenshot = await captureWebviewEvidence(cdp);

    await evaluate(
      cdp,
      'window.location.assign(new URL("/settings", window.location.href).href); "navigating";',
    );
    await waitForBodyText(cdp, "数据与隐私中心");
    await waitForBodyText(cdp, desktopLlmPolicyMarker);

    const llmPolicy = await evaluate(
      cdp,
      `
(() => {
  const customButton = [...document.querySelectorAll("button")].find((item) =>
    (item.textContent || "").trim() === "Custom"
  );
  return {
    customButtonDisabled: customButton?.disabled === true,
    policyVisible: document.body.innerText.includes("${desktopLlmPolicyMarker}")
  };
})()
`,
    );
    if (!llmPolicy?.policyVisible || !llmPolicy?.customButtonDisabled) {
      throw new Error(
        "Desktop LLM custom endpoint policy was not enforced in the settings UI.",
      );
    }

    const diagnostics = await evaluate(
      cdp,
      `
(async () => {
  const button = [...document.querySelectorAll("button")].find((item) =>
    (item.textContent || "").includes("导出诊断包")
  );
  if (!button) {
    return {
      ok: false,
      reason: "diagnostics button missing",
      bodyText: document.body.innerText.slice(0, 1200)
    };
  }

  const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
  const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
  const originalClick = HTMLAnchorElement.prototype.click;
  let capturedBlob = null;
  let capturedDownload = null;

  URL.createObjectURL = (blob) => {
    capturedBlob = blob;
    return "blob:speakright-smoke-diagnostics";
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {
    capturedDownload = {
      download: this.download,
      href: this.href
    };
  };

  try {
    const deadline = Date.now() + 10000;
    let attempts = 0;
    while (!capturedBlob && Date.now() < deadline) {
      const currentButton = [...document.querySelectorAll("button")].find((item) =>
        (item.textContent || "").includes("导出诊断包")
      );
      if (currentButton && !currentButton.disabled) {
        attempts += 1;
        currentButton.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          })
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!capturedBlob) {
      return {
        ok: false,
        reason: "diagnostics export did not create a blob",
        attempts,
        bodyText: document.body.innerText.slice(0, 1200)
      };
    }
    const bundle = JSON.parse(await capturedBlob.text());
    return {
      ok: true,
      download: capturedDownload,
      bundle: {
        schemaVersion: bundle.schemaVersion,
        product: bundle.product,
        releaseVersion: bundle.release?.currentVersion,
        appIdentifier: bundle.runtime?.app_identifier,
        logPath: bundle.runtime?.log?.path,
        logBytes: bundle.runtime?.log?.bytes,
        logError: bundle.runtime?.log?.error,
        tailContainsStartup: Array.isArray(bundle.runtime?.log?.tail)
          ? bundle.runtime.log.tail.some((line) =>
              line.includes("SpeakRight desktop runtime initialized")
            )
          : false,
        excluded: bundle.excluded
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  } finally {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalClick;
  }
})()
`,
    );

    if (!diagnostics?.ok) {
      throw new Error(
        `Desktop diagnostics export failed in release window: ${diagnostics?.reason ?? "unknown"} ${diagnostics?.bodyText ?? ""}`,
      );
    }
    if (diagnostics.bundle?.product !== "SpeakRight Desktop") {
      throw new Error(
        "Desktop diagnostics bundle product marker is incorrect.",
      );
    }
    if (diagnostics.bundle?.appIdentifier !== appIdentifier) {
      throw new Error(
        `Desktop diagnostics app identifier was ${diagnostics.bundle?.appIdentifier}, expected ${appIdentifier}.`,
      );
    }
    if (!diagnostics.bundle?.tailContainsStartup) {
      throw new Error(
        "Desktop diagnostics bundle did not include the runtime startup log line.",
      );
    }
    if (
      !diagnostics.download?.download?.startsWith("speakright-diagnostics-")
    ) {
      throw new Error(
        "Desktop diagnostics download filename is not versioned.",
      );
    }
    if (!diagnostics.bundle?.excluded?.includes("API keys")) {
      throw new Error(
        "Desktop diagnostics bundle does not document secret exclusions.",
      );
    }

    return {
      route: "/settings",
      download: diagnostics.download.download,
      appIdentifier: diagnostics.bundle.appIdentifier,
      llmCustomDisabled: llmPolicy.customButtonDisabled,
      logPath: diagnostics.bundle.logPath,
      logBytes: diagnostics.bundle.logBytes,
      screenshot,
    };
  } finally {
    cdp.close();
  }
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

  const debuggingPort =
    process.platform === "win32" ? await getOpenPort() : null;
  const smokeStartedAt = Date.now();
  const child = spawn(exe, [], {
    detached: false,
    env: buildSmokeEnv(debuggingPort),
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
        const [runtimeLog, interactiveEvidence] = await Promise.all([
          captureRuntimeLogEvidence(smokeStartedAt),
          captureInteractiveEvidence(debuggingPort),
        ]);
        console.log(
          [
            `Desktop smoke test passed: pid=${child.pid}`,
            observedTitle ? `title="${observedTitle}"` : "",
            interactiveEvidence?.screenshot
              ? `webviewScreenshot="${interactiveEvidence.screenshot.Path}" ${interactiveEvidence.screenshot.Width}x${interactiveEvidence.screenshot.Height} nonWhiteRatio=${interactiveEvidence.screenshot.NonWhiteRatio.toFixed(4)} distinctColors=${interactiveEvidence.screenshot.DistinctColors}`
              : "",
            runtimeLog
              ? `runtimeLog="${runtimeLog.path}" bytes=${runtimeLog.bytes}`
              : "",
            interactiveEvidence
              ? `diagnostics="${interactiveEvidence.download}" route=${interactiveEvidence.route} appIdentifier=${interactiveEvidence.appIdentifier} llmCustomDisabled=${interactiveEvidence.llmCustomDisabled}`
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
