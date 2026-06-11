import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const timeoutMs = Number(process.env.SPEAKRIGHT_UI_SMOKE_TIMEOUT_MS ?? 20_000);

const languageChecks = [
  { languageId: "en-US", slug: "ee", route: "/phonemes/ee", label: "美式英语" },
  { languageId: "es-ES", slug: "es-a", route: "/phonemes/es-a", label: "西班牙语" },
  { languageId: "fr-FR", slug: "fr-i", route: "/phonemes/fr-i", label: "法语" },
  { languageId: "ru-RU", slug: "ru-a", route: "/phonemes/ru-a", label: "俄语" },
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
  return mkdtemp(path.join(os.tmpdir(), "speakright-desktop-ui-smoke-"));
}

function buildSmokeEnv(debuggingPort, smokeProfileRoot) {
  if (process.platform !== "win32") return process.env;
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
    WEBVIEW2_USER_DATA_FOLDER: path.join(smokeProfileRoot, "WebView2"),
  };
}

async function waitForDevtoolsTarget(debuggingPort) {
  const deadline = Date.now() + 10_000;
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
    throw new Error(
      `Desktop UI smoke evaluation failed: ${description}`,
    );
  }
  return result.result?.value;
}

async function waitForCondition(cdp, expression, label) {
  const deadline = Date.now() + 10_000;
  let lastResult = null;
  while (Date.now() < deadline) {
    lastResult = await evaluate(cdp, expression);
    if (lastResult?.ok) return lastResult;
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for ${label}: ${JSON.stringify(lastResult)}`,
  );
}

async function currentPathname(cdp) {
  return evaluate(cdp, "window.location.pathname");
}

async function clickRouteLink(cdp, pathname) {
  const deadline = Date.now() + 10_000;
  let target = null;
  while (Date.now() < deadline) {
    target = await evaluate(
      cdp,
      `
(() => {
  const pathname = ${JSON.stringify(pathname)};
  const anchors = [...document.querySelectorAll("a[href]")];
  const link = anchors.find((anchor) => {
    const attr = anchor.getAttribute("href");
    let parsedPathname = attr ?? "";
    try {
      parsedPathname = new URL(anchor.href, window.location.href).pathname;
    } catch {
      // Keep the raw href attribute for comparison.
    }
    return attr === pathname || parsedPathname === pathname;
  });
  if (!link) {
    return {
      ok: false,
      reason: "missing-link",
      links: anchors.slice(0, 20).map((anchor) => ({
        text: anchor.innerText.trim(),
        attr: anchor.getAttribute("href"),
        href: anchor.href
      }))
    };
  }
  link.scrollIntoView({ block: "center", inline: "center" });
  const rect = link.getBoundingClientRect();
  return {
    ok: rect.width > 0 && rect.height > 0,
    reason: rect.width > 0 && rect.height > 0 ? "ok" : "not-visible",
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    text: link.innerText.trim(),
    attr: link.getAttribute("href"),
    href: link.href
  };
})()
`,
    );
    if (target?.ok) break;
    await delay(250);
  }
  if (!target?.ok) {
    throw new Error(
      `Could not find visible route link for ${pathname}: ${JSON.stringify(
        target,
      )}`,
    );
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: target.x,
    y: target.y,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: target.x,
    y: target.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: target.x,
    y: target.y,
    button: "left",
    clickCount: 1,
  });
  await delay(300);
}

async function navigate(cdp, pathname, expectedSelector) {
  if ((await currentPathname(cdp)) !== pathname) {
    if (pathname.startsWith("/phonemes/")) {
      const current = await currentPathname(cdp);
      if (!current.startsWith("/phonemes")) {
        await clickRouteLink(cdp, "/phonemes");
        await waitForCondition(
          cdp,
          `
(() => ({
  ok:
    window.location.pathname.startsWith("/phonemes") &&
    document.readyState !== "loading" &&
    !!document.querySelector('[data-smoke="phoneme-detail-page"]'),
  href: window.location.href,
  bodyText: document.body.innerText.slice(0, 500)
}))()
`,
          "/phonemes shell to render",
        );
      }
    }
    if ((await currentPathname(cdp)) !== pathname) {
      await clickRouteLink(cdp, pathname);
    }
  }
  await waitForCondition(
    cdp,
    `
(() => {
  const bodyText = document.body ? document.body.innerText : "";
  const expectedPathname = ${JSON.stringify(pathname)};
  const releaseServedFromDevServer =
    (window.location.protocol === "http:" || window.location.protocol === "https:") &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  return {
    ok:
      window.location.pathname === expectedPathname &&
      document.readyState !== "loading" &&
      !!document.querySelector(${JSON.stringify(expectedSelector)}) &&
      bodyText.trim().length > 20 &&
      !releaseServedFromDevServer,
    bodyText: bodyText.slice(0, 500),
    href: window.location.href,
    releaseServedFromDevServer
  };
})()
`,
    `${pathname} to render ${expectedSelector}`,
  );
}

async function clickLanguage(cdp, languageId) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  const clicked = await evaluate(
    cdp,
    `
(() => {
  const button = document.querySelector(
    '[data-smoke="language-option"][data-language-id="${languageId}"]'
  );
  if (!button) {
    return {
      ok: false,
      bodyText: document.body.innerText.slice(0, 1000)
    };
  }
  button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ok: true };
})()
`,
  );
  if (!clicked?.ok) {
    throw new Error(`Could not switch language to ${languageId}.`);
  }
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    document.querySelector(
      '[data-smoke="language-option"][data-language-id="${languageId}"]'
    )?.getAttribute("data-selected") === "true",
  bodyText: document.body.innerText.slice(0, 500)
}))()
`,
    `${languageId} selection`,
  );
}

async function selectedLanguage(cdp) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  const result = await evaluate(
    cdp,
    `
(() => {
  const selected = document.querySelector(
    '[data-smoke="language-option"][data-selected="true"]'
  );
  return selected?.getAttribute("data-language-id") ?? "en-US";
})()
`,
  );
  return result || "en-US";
}

async function assertSettings(cdp) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  const result = await evaluate(
    cdp,
    `
(() => {
  const bodyText = document.body.innerText;
  return {
    ok:
      !!document.querySelector('[data-smoke="data-privacy-center"]') &&
      !!document.querySelector('[data-smoke="desktop-llm-policy"]') &&
      !!document.querySelector('[data-smoke="release-unsigned-warning"]') &&
      bodyText.includes("实验") &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("dictionaryapi.com") &&
      !bodyText.includes("韦氏") &&
      !bodyText.includes("多语言发音包"),
    bodyText: bodyText.slice(0, 1200)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(`Settings UI smoke failed: ${result?.bodyText ?? ""}`);
  }
}

async function assertDetail(cdp, language) {
  await clickLanguage(cdp, language.languageId);
  await navigate(
    cdp,
    language.route,
    '[data-smoke="phoneme-detail-page"]',
  );
  const result = await evaluate(
    cdp,
    `
(() => {
  const detail = document.querySelector('[data-smoke="phoneme-detail-page"]');
  const bodyText = document.body.innerText;
  const buttons = [...document.querySelectorAll("button")];
  return {
    ok:
      detail?.getAttribute("data-language-id") === ${JSON.stringify(
        language.languageId,
      )} &&
      detail?.getAttribute("data-sound-unit") === ${JSON.stringify(
        language.slug,
      )} &&
      buttons.length >= 2 &&
      !bodyText.includes("未找到") &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("多语言发音包"),
    buttonCount: buttons.length,
    bodyText: bodyText.slice(0, 1000)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `${language.languageId} phoneme detail smoke failed: ${JSON.stringify(
        result,
      )}`,
    );
  }
  return { languageId: language.languageId, slug: language.slug };
}

async function assertMainRoutes(cdp) {
  const routes = [
    { path: "/drill", selector: '[data-smoke="drill-page"]' },
    { path: "/sentences", selector: "body" },
    { path: "/assessment", selector: '[data-smoke="assessment-page"]' },
  ];

  for (const route of routes) {
    await navigate(cdp, route.path, route.selector);
    const result = await evaluate(
      cdp,
      `
(() => {
  const bodyText = document.body.innerText;
  return {
    ok:
      bodyText.trim().length > 20 &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("多语言发音包") &&
      !bodyText.includes("无法访问此页面"),
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(`${route.path} smoke failed: ${result?.bodyText ?? ""}`);
    }
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
    throw new Error(`Desktop release executable is missing: ${exe}`);
  }
  const alreadyRunning = await runningSpeakRightProcesses();
  if (alreadyRunning.length > 0) {
    throw new Error(
      "speakright.exe is already running. Close it before desktop:ui-smoke.",
    );
  }

  const debuggingPort =
    process.platform === "win32" ? await getOpenPort() : null;
  const smokeProfileRoot =
    process.platform === "win32" ? await createSmokeProfileRoot() : null;
  const child = spawn(exe, [], {
    detached: false,
    env: buildSmokeEnv(debuggingPort, smokeProfileRoot),
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

  let cdp = null;
  let originalLanguageId = "en-US";
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await isRunning(child.pid))) {
        throw new Error(
          `Desktop release executable exited during UI smoke with code ${exitCode ?? "unknown"}.`,
        );
      }
      try {
        const target = await waitForDevtoolsTarget(debuggingPort);
        cdp = await createCdpClient(target.webSocketDebuggerUrl);
        await cdp.send("Runtime.enable");
        await cdp.send("Page.enable");
        break;
      } catch (error) {
        await delay(500);
        if (Date.now() >= deadline) throw error;
      }
    }
    if (!cdp) throw new Error("Could not connect to desktop WebView.");

    originalLanguageId = await selectedLanguage(cdp);
    await assertSettings(cdp);

    const details = [];
    for (const language of languageChecks) {
      details.push(await assertDetail(cdp, language));
    }
    await clickLanguage(cdp, "fr-FR");
    await assertMainRoutes(cdp);
    await clickLanguage(cdp, originalLanguageId);

    console.log(
      [
        "Desktop UI smoke passed:",
        `pid=${child.pid}`,
        `settings=ok`,
        `details=${details
          .map((item) => `${item.languageId}:${item.slug}`)
          .join(",")}`,
        "routes=/drill,/sentences,/assessment",
        "releaseServedFromDevServer=false",
      ].join(" "),
    );
  } finally {
    if (cdp) {
      try {
        await clickLanguage(cdp, originalLanguageId);
      } catch {
        // Best-effort restore only; the child process is stopped below.
      }
      cdp.close();
    }
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
