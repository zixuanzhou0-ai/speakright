import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const screenshotDir = path.join(root, "docs", "assets", "screenshots");
const timeoutMs = 12_000;

const shots = [
  {
    file: "settings.png",
    languageId: "en-US",
    path: "/settings",
    selector: '[data-smoke="settings-page"]',
  },
  {
    file: "english-phoneme-score.png",
    languageId: "en-US",
    path: "/phonemes/ee?smokeScoreSummary=1&smokeAssessmentTiles=1",
    selector: '[data-smoke="phoneme-detail-page"]',
  },
  {
    file: "free-practice.png",
    languageId: "en-US",
    path: "/sentences",
    selector: '[data-smoke="sentences-page"]',
  },
  {
    file: "english-assessment.png",
    languageId: "en-US",
    path: "/assessment",
    selector: '[data-smoke="assessment-page"]',
  },
  {
    file: "spanish-phoneme.png",
    languageId: "es-ES",
    path: "/phonemes/es-a",
    selector: '[data-smoke="phoneme-detail-page"]',
  },
  {
    file: "french-phoneme.png",
    languageId: "fr-FR",
    path: "/phonemes/fr-i",
    selector: '[data-smoke="phoneme-detail-page"]',
  },
  {
    file: "russian-phoneme.png",
    languageId: "ru-RU",
    path: "/phonemes/ru-a",
    selector: '[data-smoke="phoneme-detail-page"]',
  },
];

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
      .filter((line) => line.toLowerCase().includes("speakright.exe"));
  } catch {
    return [];
  }
}

function buildEnv(debuggingPort, profileRoot) {
  if (process.platform !== "win32") return process.env;
  const existingArgs = process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? "";
  const screenshotArgs = [
    `--remote-debugging-port=${debuggingPort}`,
    "--remote-allow-origins=*",
  ].join(" ");
  return {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: [existingArgs, screenshotArgs]
      .filter(Boolean)
      .join(" "),
    WEBVIEW2_USER_DATA_FOLDER: path.join(profileRoot, "WebView2"),
  };
}

async function waitForDevtoolsTarget(debuggingPort) {
  const deadline = Date.now() + timeoutMs;
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
      lastError = new Error(`WebView2 devtools HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `WebView2 devtools target was not available: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
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
            }, 10_000);
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
            `CDP command failed: ${
              message.error.message ?? JSON.stringify(message.error)
            }`,
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
    const exception = result.exceptionDetails.exception;
    const description =
      exception?.description ??
      exception?.value ??
      result.exceptionDetails.text ??
      "unknown exception";
    throw new Error(`Screenshot evaluation failed: ${description}`);
  }
  return result.result?.value;
}

async function waitForCondition(cdp, expression, label) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = null;
  while (Date.now() < deadline) {
    lastResult = await evaluate(cdp, expression);
    if (lastResult?.ok) return lastResult;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(lastResult)}`);
}

async function setViewport(cdp) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 920,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(250);
}

async function navigate(cdp, route, selector) {
  const origin = await evaluate(cdp, "window.location.origin");
  await cdp.send("Page.navigate", { url: `${origin}${route}` });
  await waitForCondition(
    cdp,
    `
(() => {
  const releaseServedFromDevServer =
    (window.location.protocol === "http:" || window.location.protocol === "https:") &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return {
    ok:
      document.readyState !== "loading" &&
      window.location.pathname === ${JSON.stringify(route.split("?")[0])} &&
      Boolean(document.querySelector(${JSON.stringify(selector)})) &&
      !releaseServedFromDevServer,
    href: window.location.href,
    bodyText: (document.body?.innerText ?? "").slice(0, 500),
    releaseServedFromDevServer
  };
})()
`,
    `${route} ${selector}`,
  );
  await delay(600);
}

async function clickLanguage(cdp, languageId) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  await waitForCondition(
    cdp,
    `
(() => ({
  ok: Boolean(document.querySelector('[data-smoke="language-option"][data-language-id="${languageId}"]')),
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    `${languageId} option`,
  );
  await evaluate(
    cdp,
    `
(() => {
  const button = document.querySelector('[data-smoke="language-option"][data-language-id="${languageId}"]');
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ok: true };
})()
`,
  );
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    document
      .querySelector('[data-smoke="language-option"][data-language-id="${languageId}"]')
      ?.getAttribute("data-selected") === "true",
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    `${languageId} selected`,
  );
}

async function capture(cdp, shot) {
  await clickLanguage(cdp, shot.languageId);
  await navigate(cdp, shot.path, shot.selector);
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const filePath = path.join(screenshotDir, shot.file);
  writeFileSync(filePath, Buffer.from(result.data, "base64"));
  console.log(`Captured ${shot.file}`);
}

async function main() {
  const exe = executablePath();
  if (!existsSync(exe)) {
    throw new Error(`Release executable not found: ${exe}`);
  }

  const running = await runningSpeakRightProcesses();
  if (running.length > 0) {
    throw new Error(
      `speakright.exe is already running. Close it before screenshots: ${running.join(" | ")}`,
    );
  }

  mkdirSync(screenshotDir, { recursive: true });
  const debuggingPort =
    process.platform === "win32" ? await getOpenPort() : null;
  const profileRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-release-screenshots-"),
  );
  const child = spawn(exe, [], {
    detached: false,
    env: buildEnv(debuggingPort, profileRoot),
    stdio: "ignore",
    windowsHide: false,
  });

  let cdp = null;
  try {
    const target = await waitForDevtoolsTarget(debuggingPort);
    cdp = await createCdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await setViewport(cdp);

    for (const shot of shots) {
      await capture(cdp, shot);
    }
  } finally {
    cdp?.close();
    if (!child.killed) child.kill();
    await delay(500);
    try {
      await rm(profileRoot, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        `Could not remove temporary WebView2 profile yet: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
