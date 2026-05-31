import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
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

async function createSmokeProfileRoot() {
  const rootDir = await mkdtemp(
    path.join(os.tmpdir(), "speakright-desktop-smoke-"),
  );
  await mkdir(path.join(rootDir, "WebView2"), { recursive: true });
  return rootDir;
}

function buildSmokeEnv(debuggingPort, smokeProfileRoot) {
  if (process.platform !== "win32") return process.env;
  const existingArgs = process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? "";
  const smokeArgs = [
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-allow-origins=*",
  ].join(" ");
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [existingArgs, smokeArgs]
      .filter(Boolean)
      .join(" "),
  };
  if (!smokeProfileRoot) return env;
  return {
    ...env,
    WEBVIEW2_USER_DATA_FOLDER: path.join(smokeProfileRoot, "WebView2"),
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

async function clickVisibleButtonByText(
  cdp,
  text,
  { withinSelector = null, timeoutMs = 8_000 } = {},
) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = null;
  while (Date.now() < deadline) {
    lastResult = await evaluate(
      cdp,
      `
(async () => {
  const root = ${
    withinSelector
      ? `document.querySelector(${JSON.stringify(withinSelector)})`
      : "document"
  };
  if (!root) {
    return {
      ok: false,
      reason: "scope missing",
      bodyText: document.body.innerText.slice(0, 1200)
    };
  }
  const candidates = [...root.querySelectorAll("button")].filter((button) => {
    const rect = button.getBoundingClientRect();
    const style = window.getComputedStyle(button);
    return (
      (button.textContent || "").trim() === ${JSON.stringify(text)} &&
      button.disabled !== true &&
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });
  const button = candidates[0];
  if (!button) {
    return {
      ok: false,
      reason: "button missing or disabled",
      bodyText: document.body.innerText.slice(0, 1200)
    };
  }
  button.scrollIntoView({ block: "center", inline: "center" });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const hitTarget = document.elementFromPoint(x, y);
  const hitButton = hitTarget?.closest?.("button");
  if (hitButton !== button) {
    return {
      ok: false,
      reason: "button center is covered or outside the viewport",
      targetText: hitButton ? (hitButton.textContent || "").trim() : null,
      x,
      y,
      bodyText: document.body.innerText.slice(0, 1200)
    };
  }
  return {
    ok: true,
    x,
    y,
    text: (button.textContent || "").trim()
  };
})()
`,
    );
    if (lastResult?.ok) {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: lastResult.x,
        y: lastResult.y,
        buttons: 0,
      });
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: lastResult.x,
        y: lastResult.y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: lastResult.x,
        y: lastResult.y,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
      return lastResult;
    }
    await delay(100);
  }
  throw new Error(
    `Could not click visible button "${text}": ${lastResult?.reason ?? "unknown"} ${lastResult?.bodyText ?? ""}`,
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
    await waitForBodyText(cdp, "桌面端准备状态");
    await waitForBodyText(cdp, "检测麦克风");
    await waitForBodyText(cdp, "建立诊断");
    const screenshot = await captureWebviewEvidence(cdp);

    await evaluate(
      cdp,
      'window.location.assign(new URL("/settings", window.location.href).href); "navigating";',
    );
    await waitForBodyText(cdp, "数据与隐私中心");
    await waitForBodyText(cdp, desktopLlmPolicyMarker);
    await waitForBodyText(cdp, "internal");
    await waitForBodyText(cdp, "NotSigned");
    await waitForBodyText(cdp, "可控内测");

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
      diagnostics.bundle?.logPath &&
      !diagnostics.bundle.logPath.startsWith("<local-app-data>/")
    ) {
      throw new Error(
        `Desktop diagnostics log path was not redacted: ${diagnostics.bundle.logPath}`,
      );
    }
    if (/Users[\\\\/][^\\\\/]+/i.test(diagnostics.bundle?.logPath ?? "")) {
      throw new Error(
        "Desktop diagnostics log path exposed a local user profile path.",
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

    const learningExport = await evaluate(
      cdp,
      `
(async () => {
  const button = [...document.querySelectorAll("button")].find((item) =>
    (item.textContent || "").includes("导出学习数据")
  );
  if (!button) {
    return {
      ok: false,
      reason: "learning data export button missing",
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
    return "blob:speakright-smoke-learning-data";
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {
    capturedDownload = {
      download: this.download,
      href: this.href
    };
  };

  try {
    localStorage.setItem(
      "speakright_mastery_profile_v2",
      JSON.stringify({ version: 2, desktopSmokeExport: true })
    );
    localStorage.setItem(
      "speakright_azure_config",
      JSON.stringify({ subscriptionKey: "desktop-smoke-secret" })
    );

    const deadline = Date.now() + 10000;
    let attempts = 0;
    while (!capturedBlob && Date.now() < deadline) {
      const currentButton = [...document.querySelectorAll("button")].find((item) =>
        (item.textContent || "").includes("导出学习数据")
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
        reason: "learning data export did not create a blob",
        attempts,
        bodyText: document.body.innerText.slice(0, 1200)
      };
    }
    const snapshot = JSON.parse(await capturedBlob.text());
    return {
      ok: true,
      download: capturedDownload,
      snapshot: {
        schemaVersion: snapshot.schemaVersion,
        product: snapshot.product,
        hasSmokeMastery:
          snapshot.localStorage?.speakright_mastery_profile_v2
            ?.desktopSmokeExport === true,
        exportedApiKey:
          Object.prototype.hasOwnProperty.call(
            snapshot.localStorage ?? {},
            "speakright_azure_config"
          ) ||
          Object.prototype.hasOwnProperty.call(
            snapshot.appSettings ?? {},
            "speakright_azure_config"
          ),
        benchmarkAudioIsArray: Array.isArray(
          snapshot.indexedDb?.benchmarkRecordings?.audio
        ),
        excluded: snapshot.excluded
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  } finally {
    localStorage.removeItem("speakright_mastery_profile_v2");
    localStorage.removeItem("speakright_azure_config");
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLAnchorElement.prototype.click = originalClick;
  }
})()
`,
    );

    if (!learningExport?.ok) {
      throw new Error(
        `Desktop learning data export failed in release window: ${learningExport?.reason ?? "unknown"} ${learningExport?.bodyText ?? ""}`,
      );
    }
    if (learningExport.snapshot?.product !== "SpeakRight Desktop") {
      throw new Error("Desktop learning data export product marker is wrong.");
    }
    if (
      typeof learningExport.snapshot?.schemaVersion !== "number" ||
      learningExport.snapshot.schemaVersion < 4
    ) {
      throw new Error(
        `Desktop learning data export schema is too old: ${learningExport.snapshot?.schemaVersion}.`,
      );
    }
    if (!learningExport.snapshot?.hasSmokeMastery) {
      throw new Error(
        "Desktop learning data export did not include learning localStorage data.",
      );
    }
    if (learningExport.snapshot?.exportedApiKey) {
      throw new Error("Desktop learning data export included an API key slot.");
    }
    if (!learningExport.snapshot?.benchmarkAudioIsArray) {
      throw new Error(
        "Desktop learning data export did not include benchmark audio archive metadata.",
      );
    }
    if (!learningExport.snapshot?.excluded?.includes("API keys")) {
      throw new Error(
        "Desktop learning data export does not document API key exclusion.",
      );
    }
    if (
      !learningExport.download?.download?.startsWith("speakright-data-")
    ) {
      throw new Error("Desktop learning data export filename is not versioned.");
    }

    await evaluate(
      cdp,
      `
(() => {
  localStorage.setItem(
    "speakright_mastery_profile_v2",
    JSON.stringify({ version: 2, desktopSmokeDelete: true })
  );
  localStorage.setItem("speakright_score_history", JSON.stringify({ th: [82] }));
  localStorage.setItem("speakright_ipa_cache", JSON.stringify({ th: true }));
  localStorage.setItem(
    "speakright_azure_config",
    JSON.stringify({ subscriptionKey: "desktop-smoke-preserve-key" })
  );
  return true;
})()
`,
    );

    let learningDelete = null;
    try {
      await clickVisibleButtonByText(cdp, "删除学习数据", {
        timeoutMs: 10_000,
      });
      await waitForBodyText(cdp, "删除本机学习数据？");
      await clickVisibleButtonByText(cdp, "删除学习数据", {
        withinSelector: '[data-slot="dialog-content"]',
      });
      learningDelete = await evaluate(
        cdp,
        `
(async () => {
  const deleteDeadline = Date.now() + 10000;
  while (
    localStorage.getItem("speakright_mastery_profile_v2") !== null &&
    Date.now() < deleteDeadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    ok: true,
    deletedLearning:
      localStorage.getItem("speakright_mastery_profile_v2") === null &&
      localStorage.getItem("speakright_score_history") === null,
    deletedCache: localStorage.getItem("speakright_ipa_cache") === null,
    preservedApiKey:
      localStorage.getItem("speakright_azure_config")?.includes(
        "desktop-smoke-preserve-key"
      ) === true
  };
})()
`,
      );
    } finally {
      await evaluate(
        cdp,
        `
(() => {
  localStorage.removeItem("speakright_mastery_profile_v2");
  localStorage.removeItem("speakright_score_history");
  localStorage.removeItem("speakright_ipa_cache");
  localStorage.removeItem("speakright_azure_config");
  return true;
})()
`,
      );
    }

    if (!learningDelete?.ok) {
      throw new Error(
        `Desktop learning data delete failed in release window: ${learningDelete?.reason ?? "unknown"} ${learningDelete?.bodyText ?? ""}`,
      );
    }
    if (!learningDelete.deletedLearning) {
      throw new Error("Desktop learning data delete did not clear learning data.");
    }
    if (!learningDelete.deletedCache) {
      throw new Error("Desktop learning data delete did not clear local caches.");
    }
    if (!learningDelete.preservedApiKey) {
      throw new Error("Desktop learning data delete removed an API key slot.");
    }

    await evaluate(
      cdp,
      `
(() => {
  localStorage.setItem(
    "speakright_azure_config",
    JSON.stringify({ subscriptionKey: "desktop-smoke-azure-key", region: "eastus" })
  );
  localStorage.setItem(
    "speakright_elevenlabs_config",
    JSON.stringify({ apiKey: "desktop-smoke-elevenlabs-key" })
  );
  localStorage.setItem(
    "speakright_llm_config",
    JSON.stringify({
      provider: "openai",
      apiKey: "desktop-smoke-llm-key",
      model: "gpt-4o-mini"
    })
  );
  localStorage.setItem(
    "speakright_mw_config",
    JSON.stringify({ apiKey: "desktop-smoke-mw-key" })
  );
  return true;
})()
`,
    );

    let apiKeysDelete = null;
    try {
      await clickVisibleButtonByText(cdp, "删除 API keys", {
        timeoutMs: 10_000,
      });
      await waitForBodyText(cdp, "删除所有 API keys？");
      await clickVisibleButtonByText(cdp, "删除 API keys", {
        withinSelector: '[data-slot="dialog-content"]',
      });
      apiKeysDelete = await evaluate(
        cdp,
        `
(async () => {
  const keys = [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config",
    "speakright_mw_config"
  ];
  const deleteDeadline = Date.now() + 10000;
  while (
    keys.some((key) => localStorage.getItem(key) !== null) &&
    Date.now() < deleteDeadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    ok: true,
    deletedApiKeys: keys.every((key) => localStorage.getItem(key) === null)
  };
})()
`,
      );
    } finally {
      await evaluate(
        cdp,
        `
(() => {
  for (const key of [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config",
    "speakright_mw_config"
  ]) {
    localStorage.removeItem(key);
  }
  return true;
})()
`,
      );
    }

    if (!apiKeysDelete?.ok) {
      throw new Error(
        `Desktop API key delete failed in release window: ${apiKeysDelete?.reason ?? "unknown"} ${apiKeysDelete?.bodyText ?? ""}`,
      );
    }
    if (!apiKeysDelete.deletedApiKeys) {
      throw new Error("Desktop API key delete did not clear all API key slots.");
    }

    await evaluate(
      cdp,
      `
(() => {
  localStorage.setItem(
    "speakright_mastery_profile_v2",
    JSON.stringify({ version: 2, desktopSmokeReset: true })
  );
  localStorage.setItem("speakright_score_history", JSON.stringify({ th: [74] }));
  localStorage.setItem("speakright_ipa_cache", JSON.stringify({ th: true }));
  localStorage.setItem("speakright_mw_words_th", JSON.stringify({ value: "think" }));
  localStorage.setItem(
    "speakright_desktop_mic_check_v1",
    JSON.stringify({ version: 1, passedAt: Date.now(), deviceLabel: "Smoke Mic" })
  );
  localStorage.setItem("speakright_local_data_schema_version", "4");
  localStorage.setItem("speakright_local_data_migrated_at", String(Date.now()));
  localStorage.setItem(
    "speakright_pronunciation_config",
    JSON.stringify({ source: "merriam-webster" })
  );
  localStorage.setItem("speakright_coach_mode", JSON.stringify("strict"));
  localStorage.setItem("theme", "dark");
  localStorage.setItem(
    "speakright_azure_config",
    JSON.stringify({ subscriptionKey: "desktop-smoke-reset-preserve-key" })
  );
  return true;
})()
`,
    );

    let localReset = null;
    try {
      await clickVisibleButtonByText(cdp, "重置本机数据", {
        timeoutMs: 10_000,
      });
      await waitForBodyText(cdp, "重置本机数据？");
      await clickVisibleButtonByText(cdp, "重置本机数据", {
        withinSelector: '[data-slot="dialog-content"]',
      });
      localReset = await evaluate(
        cdp,
        `
(async () => {
  const removedKeys = [
    "speakright_mastery_profile_v2",
    "speakright_score_history",
    "speakright_ipa_cache",
    "speakright_mw_words_th",
    "speakright_desktop_mic_check_v1",
    "speakright_local_data_schema_version",
    "speakright_local_data_migrated_at",
    "speakright_pronunciation_config",
    "speakright_coach_mode",
    "theme"
  ];
  const deleteDeadline = Date.now() + 10000;
  while (
    removedKeys.some((key) => localStorage.getItem(key) !== null) &&
    Date.now() < deleteDeadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    ok: true,
    removedResetData: removedKeys.every((key) => localStorage.getItem(key) === null),
    preservedApiKey:
      localStorage.getItem("speakright_azure_config")?.includes(
        "desktop-smoke-reset-preserve-key"
      ) === true
  };
})()
`,
      );
    } finally {
      await evaluate(
        cdp,
        `
(() => {
  for (const key of [
    "speakright_mastery_profile_v2",
    "speakright_score_history",
    "speakright_ipa_cache",
    "speakright_mw_words_th",
    "speakright_desktop_mic_check_v1",
    "speakright_local_data_schema_version",
    "speakright_local_data_migrated_at",
    "speakright_pronunciation_config",
    "speakright_coach_mode",
    "speakright_azure_config",
    "theme"
  ]) {
    localStorage.removeItem(key);
  }
  return true;
})()
`,
      );
    }

    if (!localReset?.ok) {
      throw new Error(
        `Desktop local data reset failed in release window: ${localReset?.reason ?? "unknown"} ${localReset?.bodyText ?? ""}`,
      );
    }
    if (!localReset.removedResetData) {
      throw new Error("Desktop local data reset did not clear reset-scoped data.");
    }
    if (!localReset.preservedApiKey) {
      throw new Error("Desktop local data reset did not preserve API keys by default.");
    }

    await evaluate(
      cdp,
      `
(async () => {
  const id = "desktop-smoke-benchmark-audio";
  localStorage.setItem(
    "speakright_benchmark_recordings_v1",
    JSON.stringify([
      {
        id,
        createdAt: Date.now(),
        source: "spontaneous",
        title: "Desktop smoke benchmark",
        text: "I think so.",
        score: 83,
        targetLabel: "/th/"
      }
    ])
  );

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("speakright-benchmark-audio", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("recordings")) {
        request.result.createObjectStore("recordings");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").put(
        new Blob(["desktop-smoke-audio"], { type: "audio/webm" }),
        id
      );
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return true;
})()
`,
    );

    let benchmarkAudioClear = null;
    try {
      await clickVisibleButtonByText(cdp, "清空 benchmark 音频", {
        timeoutMs: 10_000,
      });
      await waitForBodyText(cdp, "清空 benchmark 音频？");
      await clickVisibleButtonByText(cdp, "清空音频", {
        withinSelector: '[data-slot="dialog-content"]',
      });
      benchmarkAudioClear = await evaluate(
        cdp,
        `
(async () => {
  const id = "desktop-smoke-benchmark-audio";
  const deadline = Date.now() + 10000;
  let meta = localStorage.getItem("speakright_benchmark_recordings_v1");
  while (meta !== null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    meta = localStorage.getItem("speakright_benchmark_recordings_v1");
  }

  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("speakright-benchmark-audio", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", "readonly");
      const request = tx.objectStore("recordings").get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    return {
      ok: true,
      clearedMeta: meta === null,
      clearedAudio: blob === null
    };
  } finally {
    db.close();
  }
})()
`,
      );
    } finally {
      await evaluate(
        cdp,
        `
(async () => {
  const id = "desktop-smoke-benchmark-audio";
  localStorage.removeItem("speakright_benchmark_recordings_v1");
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("speakright-benchmark-audio", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("recordings", "readwrite");
      tx.objectStore("recordings").delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return true;
})()
`,
      );
    }

    if (!benchmarkAudioClear?.ok) {
      throw new Error(
        `Desktop benchmark audio clear failed in release window: ${benchmarkAudioClear?.reason ?? "unknown"} ${benchmarkAudioClear?.bodyText ?? ""}`,
      );
    }
    if (!benchmarkAudioClear.clearedMeta || !benchmarkAudioClear.clearedAudio) {
      throw new Error(
        "Desktop benchmark audio clear did not remove both metadata and audio blob.",
      );
    }

    return {
      route: "/settings",
      diagnosticsDownload: diagnostics.download.download,
      learningDataDownload: learningExport.download.download,
      appIdentifier: diagnostics.bundle.appIdentifier,
      llmCustomDisabled: llmPolicy.customButtonDisabled,
      learningDeletePreservedKey: learningDelete.preservedApiKey,
      apiKeysDeleted: apiKeysDelete.deletedApiKeys,
      localResetPreservedKey: localReset.preservedApiKey,
      benchmarkAudioCleared:
        benchmarkAudioClear.clearedMeta && benchmarkAudioClear.clearedAudio,
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
  const smokeProfileRoot =
    process.platform === "win32" ? await createSmokeProfileRoot() : null;
  const smokeEnv = buildSmokeEnv(debuggingPort, smokeProfileRoot);
  const smokeStartedAt = Date.now();
  const child = spawn(exe, [], {
    detached: false,
    env: smokeEnv,
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
              ? `diagnostics="${interactiveEvidence.diagnosticsDownload}" learningData="${interactiveEvidence.learningDataDownload}" learningDeletePreservedKey=${interactiveEvidence.learningDeletePreservedKey} apiKeysDeleted=${interactiveEvidence.apiKeysDeleted} localResetPreservedKey=${interactiveEvidence.localResetPreservedKey} benchmarkAudioCleared=${interactiveEvidence.benchmarkAudioCleared} route=${interactiveEvidence.route} appIdentifier=${interactiveEvidence.appIdentifier} llmCustomDisabled=${interactiveEvidence.llmCustomDisabled}`
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
    if (smokeProfileRoot) {
      await rm(smokeProfileRoot, { force: true, recursive: true }).catch(
        () => {},
      );
    }
  }
}

smoke().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
