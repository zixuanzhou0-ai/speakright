import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  findConflictingSpeakRightProcesses,
  formatSpeakRightProcessConflicts,
} from "./lib/windows-process-boundary.mjs";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const desktopSmokeExecutableOverride =
  process.env.SPEAKRIGHT_UI_SMOKE_EXECUTABLE?.trim() || null;
const desktopSmokeDebuggingPortOverride = Number(
  process.env.SPEAKRIGHT_UI_SMOKE_DEBUGGING_PORT ?? 0,
);
const desktopTtsOnly = process.env.SPEAKRIGHT_UI_SMOKE_TTS_ONLY?.trim() === "1";
const desktopSmokeSecureStoreService = `com.speakright.desktop.ui-smoke-${randomUUID()}`;
const timeoutMs = Number(process.env.SPEAKRIGHT_UI_SMOKE_TIMEOUT_MS ?? 20_000);
const desktopTtsScreenshotDir =
  process.env.SPEAKRIGHT_DESKTOP_TTS_SCREENSHOT_DIR?.trim()
    ? path.resolve(
        root,
        process.env.SPEAKRIGHT_DESKTOP_TTS_SCREENSHOT_DIR.trim(),
      )
    : null;
const desktopTtsScreenshotText =
  "Mi perro corre por la plaza. La niña compra pan, queso y zumo por la mañana.";
const desktopTtsScreenshotAudioSrc =
  "/audio/language-packs/es-ES/mi-perro-corre-por-la-plaza-la-nina-compra-4d4bed99c7.mp3";
const desktopTtsScreenshotViewports = [
  { width: 1280, height: 920 },
  { width: 1024, height: 800 },
];
const smokeSummaryRoutes = [
  "/drill",
  "/drill/word",
  "/drill/sentence",
  "/drill/contrast",
  "/drill/prosody",
  "/drill/perception",
  "/drill/evidence",
  "/drill/pack/ee-ih",
  "/drill/scenarios",
  "/drill/spontaneous",
  "/sentences",
  "/assessment",
  "/assessment/passage",
  "/progress",
];

const languageChecks = [
  {
    languageId: "en-US",
    slug: "ee",
    route: "/phonemes/ee",
    label: "美式英语",
    expectHeaderAudio: true,
  },
  {
    languageId: "es-ES",
    slug: "es-a",
    route: "/phonemes/es-a",
    label: "西班牙语",
    expectHeaderAudio: true,
  },
  {
    languageId: "es-ES",
    slug: "es-diphthongs-j",
    route: "/phonemes/es-diphthongs-j",
    label: "西班牙语双元音滑音",
    expectHeaderAudio: true,
  },
  {
    languageId: "fr-FR",
    slug: "fr-i",
    route: "/phonemes/fr-i",
    label: "法语",
    expectHeaderAudio: true,
  },
  {
    languageId: "fr-FR",
    slug: "fr-schwa",
    route: "/phonemes/fr-schwa",
    label: "法语 schwa",
    expectHeaderAudio: true,
  },
  {
    languageId: "ru-RU",
    slug: "ru-a",
    route: "/phonemes/ru-a",
    label: "俄语",
    expectHeaderAudio: true,
  },
  {
    languageId: "ru-RU",
    slug: "ru-t-tj",
    route: "/phonemes/ru-t-tj",
    label: "俄语硬软 T",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "示范",
  },
];

const hiddenRuleRouteChecks = [
  {
    languageId: "es-ES",
    slug: "es-lexical-stress",
    route: "/phonemes/es-lexical-stress",
  },
  {
    languageId: "fr-FR",
    slug: "fr-liaison",
    route: "/phonemes/fr-liaison",
  },
  {
    languageId: "ru-RU",
    slug: "ru-stress-reduction",
    route: "/phonemes/ru-stress-reduction",
  },
];

const phonemePracticeSidebarChecks = [
  {
    languageId: "es-ES",
    route: "/phonemes/es-a",
    presentText: ["纯元音", "双元音/滑音"],
    absentText: ["重音与节奏", "鼻音位置", "词重音", "音节节奏"],
    absentRoutes: [
      "/phonemes/es-nasal-place",
      "/phonemes/es-lexical-stress",
      "/phonemes/es-syllable-rhythm",
    ],
  },
  {
    languageId: "fr-FR",
    route: "/phonemes/fr-i",
    presentText: ["口腔元音", "鼻化元音", "辅音与滑音", "弱读 /ə/"],
    absentText: ["连读/静音规则", "短语韵律", "连诵", "词尾静音"],
    absentRoutes: [
      "/phonemes/fr-final-consonant-silence",
      "/phonemes/fr-liaison",
      "/phonemes/fr-enchainement",
      "/phonemes/fr-elision",
      "/phonemes/fr-phrase-final-prominence",
    ],
  },
  {
    languageId: "ru-RU",
    route: "/phonemes/ru-a",
    presentText: ["元音", "硬软辅音", "核心辅音", "T/Tь"],
    absentText: ["重音与弱化", "拼写到发音规则", "重音弱化", "词尾清化"],
    absentRoutes: [
      "/phonemes/ru-hard-soft",
      "/phonemes/ru-soft-t-d",
      "/phonemes/ru-soft-s-z",
      "/phonemes/ru-soft-n-l-r",
      "/phonemes/ru-soft-labials",
      "/phonemes/ru-soft-sign",
      "/phonemes/ru-stress-reduction",
      "/phonemes/ru-unstressed-o-a",
      "/phonemes/ru-unstressed-e-ya",
      "/phonemes/ru-iotated-vowels",
      "/phonemes/ru-final-devoicing",
      "/phonemes/ru-voicing-assimilation",
      "/phonemes/ru-clusters",
    ],
  },
];

function executablePath() {
  if (desktopSmokeExecutableOverride) {
    return path.isAbsolute(desktopSmokeExecutableOverride)
      ? desktopSmokeExecutableOverride
      : path.resolve(root, desktopSmokeExecutableOverride);
  }
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

function getOpenPort(preferredPort = 0) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
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
  const profileRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-desktop-ui-smoke-"),
  );
  await Promise.all([
    mkdir(path.join(profileRoot, "WebView2"), { recursive: true }),
    mkdir(path.join(profileRoot, "logs"), { recursive: true }),
    mkdir(path.join(profileRoot, "settings"), { recursive: true }),
  ]);
  return profileRoot;
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
    SPEAKRIGHT_LOG_DIR: path.join(smokeProfileRoot, "logs"),
    SPEAKRIGHT_SECURE_STORE_SERVICE: desktopSmokeSecureStoreService,
    SPEAKRIGHT_SETTINGS_STORE_PATH: path.join(
      smokeProfileRoot,
      "settings",
      "speakright-settings.json",
    ),
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
    throw new Error(`Desktop UI smoke evaluation failed: ${description}`);
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

async function setViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(250);
}

async function clearViewport(cdp) {
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await delay(250);
}

async function captureViewportPng(cdp, outputPath) {
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  if (!screenshot?.data) {
    throw new Error(
      `Desktop screenshot did not return PNG data: ${outputPath}`,
    );
  }
  await writeFile(outputPath, Buffer.from(screenshot.data, "base64"));
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

async function expandPhonemeGroups(cdp) {
  await evaluate(
    cdp,
    `
(() => {
  const toggles = [...document.querySelectorAll("button")].filter((button) => {
    const text = button.innerText.trim();
    const chevron = button.querySelector("svg");
    return /\\(\\d+\\)/.test(text) && chevron?.classList.contains("-rotate-90");
  });
  for (const toggle of toggles) {
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }
  return { ok: true, expanded: toggles.length };
})()
`,
  );
  await delay(300);
}

async function forceNavigate(cdp, pathname) {
  const origin = await evaluate(cdp, "window.location.origin");
  await cdp.send("Page.navigate", { url: `${origin}${pathname}` });
  await delay(800);
}

async function navigate(cdp, pathname, expectedSelector, options = {}) {
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
    (!!document.querySelector('[data-smoke="phoneme-directory"]') ||
      !!document.querySelector('[data-smoke="phoneme-detail-page"]')),
  href: window.location.href,
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
          "/phonemes shell to render",
        );
      }
      await expandPhonemeGroups(cdp);
    }
    if ((await currentPathname(cdp)) !== pathname) {
      try {
        if (options.direct) {
          await forceNavigate(cdp, pathname);
        } else {
          await clickRouteLink(cdp, pathname);
        }
      } catch (error) {
        if (!pathname.startsWith("/phonemes/")) throw error;
        await forceNavigate(cdp, pathname);
      }
      if (
        pathname.startsWith("/phonemes/") &&
        (await currentPathname(cdp)) !== pathname
      ) {
        await forceNavigate(cdp, pathname);
      }
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
      bodyText: (document.body?.innerText ?? "").slice(0, 1000)
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
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
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

async function seedSettingsSmokeData(cdp) {
  await evaluate(
    cdp,
    `
(() => {
  const month = new Date().toISOString().slice(0, 7);
  const usage = {
    azure: {
      month,
      totalSeconds: 11,
      totalRequests: 1,
      lastUpdated: new Date().toISOString(),
      history: [{
        timestamp: new Date().toISOString(),
        durationSeconds: 11,
        target: "Trop grand, trop lent, trop fort avec une très longue phrase de diagnostic"
      }]
    },
    llm: {
      month,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalRequests: 0,
      estimatedCostYuan: 0
    }
  };
  localStorage.setItem("speakright_usage", JSON.stringify(usage));
  localStorage.setItem(
    "speakright_corrupt_data_v1",
    JSON.stringify([
      {
        key: "speakright_score_history",
        raw: "{broken score history",
        reason: "Malformed JSON",
        detectedAt: new Date().toISOString(),
        schemaVersion: 2
      }
    ])
  );
  return { ok: true };
})()
`,
  );
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    window.location.pathname === "/settings" &&
    !!document.querySelector('[data-smoke="settings-page"]') &&
    document.readyState !== "loading",
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    "settings page to reload with seeded usage history",
  );
}

async function seedProgressBenchmarkSmokeData(cdp) {
  await evaluate(
    cdp,
    `
(() => {
  const items = [
    {
      id: "smoke-progress-benchmark-missing-audio",
      createdAt: Date.now(),
      source: "prosody",
      title: "Stress baseline with a deliberately long benchmark title",
      text: "I think this sentence should keep every benchmark word visible on narrow desktop windows.",
      score: 82,
      targetLabel: "/th/, sentence stress, weak forms"
    }
  ];
  localStorage.setItem("speakright_benchmark_recordings_v1", JSON.stringify(items));
  localStorage.setItem(
    "speakright_mastery_profile_v2",
    JSON.stringify({
      version: 2,
      updatedAt: Date.now(),
      packs: {
        "s-th": {
          packId: "s-th",
          status: "stable",
          masteryState: "integrated",
          levelProgress: {},
          bestTargetScore: 88,
          perceptionBestRate: 0.9,
          completedSessions: 1,
          failureStreak: 0,
          lastPracticedAt: Date.now()
        }
      },
      phonemes: {},
      errorPatterns: {},
      sessions: [
        {
          id: "smoke-progress-session",
          packId: "s-th",
          startedAt: Date.now() - 120000,
          completedAt: Date.now() - 60000,
          perceptionCorrect: 4,
          perceptionTotal: 5,
          targetScores: [78, 82, 86],
          wordScores: [80],
          sentenceScores: [84],
          mastered: false,
          masteryStateAfter: "integrated"
        }
      ]
    })
  );
  return { ok: true };
})()
`,
  );
}

async function assertEnglishProgressArchive(cdp) {
  await clickLanguage(cdp, "en-US");
  await seedProgressBenchmarkSmokeData(cdp);
  await navigate(cdp, "/progress", '[data-smoke="progress-page"]', {
    direct: true,
  });

  const result = await evaluate(
    cdp,
    `
(() => {
  const rows = [...document.querySelectorAll('[data-smoke="progress-benchmark-row"]')];
  const recentRows = [...document.querySelectorAll('[data-smoke="progress-recent-session-row"]')];
  const childrenDoNotOverlap = (element) => {
    const children = [...element.children].filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return children.every((child, index) => {
      const rect = child.getBoundingClientRect();
      return children.every((other, otherIndex) => {
        if (index >= otherIndex) return true;
        const otherRect = other.getBoundingClientRect();
        return (
          rect.right <= otherRect.left ||
          otherRect.right <= rect.left ||
          rect.bottom <= otherRect.top ||
          otherRect.bottom <= rect.top
        );
      });
    });
  };
  const wraps = (element) => {
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      element.scrollWidth <= element.clientWidth + 2
    );
  };
  const benchmarkTextNodes = [
    ...document.querySelectorAll('[data-smoke="progress-benchmark-title"]'),
    ...document.querySelectorAll('[data-smoke="progress-benchmark-meta"]'),
    ...document.querySelectorAll('[data-smoke="progress-benchmark-text"]'),
    ...document.querySelectorAll('[data-smoke="progress-benchmark-date"]'),
  ].filter((element) => element.innerText.trim().length > 0);
  const recentTextNodes = [
    ...document.querySelectorAll('[data-smoke="progress-recent-session-title"]'),
    ...document.querySelectorAll('[data-smoke="progress-recent-session-meta"]'),
  ].filter((element) => element.innerText.trim().length > 0);
  return {
    ok:
      rows.length > 0 &&
      recentRows.length > 0 &&
      rows.every((row) => row.scrollWidth <= row.clientWidth + 2) &&
      recentRows.every((row) => row.scrollWidth <= row.clientWidth + 2) &&
      rows.every(childrenDoNotOverlap) &&
      recentRows.every(childrenDoNotOverlap) &&
      benchmarkTextNodes.every(wraps) &&
      recentTextNodes.every(wraps) &&
      document.body.innerText.includes("Stress baseline with a deliberately long benchmark title"),
    rowCount: rows.length,
    recentRowCount: recentRows.length,
    rowsDoNotOverlap: rows.every(childrenDoNotOverlap),
    recentRowsDoNotOverlap: recentRows.every(childrenDoNotOverlap),
    benchmarkTextWraps: benchmarkTextNodes.every(wraps),
    recentTextWraps: recentTextNodes.every(wraps),
    bodyText: (document.body?.innerText ?? "").slice(0, 1000)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `English progress archive smoke failed: ${JSON.stringify(result)}`,
    );
  }

  await evaluate(
    cdp,
    `
(() => {
  const playButton = document.querySelector('[aria-label^="播放 benchmark 录音"]');
  playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ok: Boolean(playButton) };
})()
`,
  );
  await waitForCondition(
    cdp,
    `
(() => {
  const alert = document.querySelector('[data-smoke="progress-benchmark-archive-status"]');
  return {
    ok:
      Boolean(alert) &&
      alert.getAttribute("role") === "alert" &&
      alert.innerText.includes("本机音频数据缺失"),
    bodyText: (document.body?.innerText ?? "").slice(0, 1000)
  };
})()
`,
    "progress missing benchmark audio warning",
  );
}

async function assertSettingsWheelScroll(cdp) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  const target = await evaluate(
    cdp,
    `
(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const servicesTab = tabs[1];
  if (!servicesTab) {
    return { ok: false, reason: "missing-services-tab" };
  }
  servicesTab.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  const main = document.querySelector("#main-content");
  if (!main) {
    return { ok: false, reason: "missing-main-content" };
  }
  main.scrollTop = 0;
  const rect = main.getBoundingClientRect();
  return {
    ok: main.scrollHeight > main.clientHeight,
    clientHeight: main.clientHeight,
    scrollHeight: main.scrollHeight,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
})()
`,
  );
  if (!target?.ok) {
    throw new Error(
      `Settings wheel target is not scrollable: ${JSON.stringify(target)}`,
    );
  }
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: target.x,
    y: target.y,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: target.x,
    y: target.y,
    deltaX: 0,
    deltaY: 600,
  });
  await waitForCondition(
    cdp,
    `(() => ({ ok: (document.querySelector("#main-content")?.scrollTop ?? 0) > 0 }))()`,
    "settings page to respond to a mouse-wheel event",
  );
}

async function assertSettings(cdp) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  await seedSettingsSmokeData(cdp);
  const result = await evaluate(
    cdp,
    `
(() => {
  // Settings are rendered as four tab panels now. Expose every mounted panel
  // for this aggregate geometry audit; tab interaction and wheel scrolling are
  // exercised separately by assertSettingsWheelScroll.
  for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
    panel.hidden = false;
  }
  const bodyText = document.body?.innerText ?? "";
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const wraps = (element) => {
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      element.scrollWidth <= element.clientWidth + 2
    );
  };
  const languageMissing = [...document.querySelectorAll('[data-smoke="language-option-missing"]')];
  const usageTargets = [...document.querySelectorAll('[data-smoke="usage-history-target"]')];
  const pronunciationRows = [...document.querySelectorAll('[data-smoke="pronunciation-test-row"]')];
  const settingsBadges = [...document.querySelectorAll('[data-slot="badge"]')].filter(hasVisibleRect);
  const settingsTextButtons = [...document.querySelectorAll('[data-slot="button"]')]
    .filter((element) => hasVisibleRect(element) && element.innerText.trim().length > 0);
  const ttsSelects = [
    ...document.querySelectorAll(
      '[data-smoke="tts-voice-select"], [data-smoke="tts-model-select"], [data-smoke="vertex-gemini-voice-select"]'
    ),
  ];
  const activeTtsProvider = [...document.querySelectorAll('[data-smoke^="tts-provider-"]')]
    .find((element) => element.getAttribute("aria-pressed") === "true")
    ?.getAttribute("data-smoke") ?? "";
  const expectedTtsSelectCount =
    activeTtsProvider === "tts-provider-elevenlabs"
      ? 2
      : activeTtsProvider === "tts-provider-vertex-gemini"
        ? 1
        : 0;
  const settingsActionRows = [
    ...document.querySelectorAll(
      '[data-smoke="azure-config-actions"], [data-smoke="tts-config-actions"], [data-smoke="hermes-grok-config-actions"], [data-smoke="vertex-gemini-config-actions"], [data-smoke="llm-config-actions"]'
    ),
  ];
  const corruptWarning = document.querySelector('[data-smoke="data-control-corrupt-data-warning"]');
  const llmProviderChips = [...document.querySelectorAll('[data-smoke="llm-provider-chip"]')];
  const llmProviderLabels = llmProviderChips.map((chip) => chip.innerText.trim());
  const childrenDoNotOverlap = (element) => {
    const children = [...element.children].filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return children.every((child, index) => {
      const rect = child.getBoundingClientRect();
      return children.every((other, otherIndex) => {
        if (index >= otherIndex) return true;
        const otherRect = other.getBoundingClientRect();
        return (
          rect.right <= otherRect.left ||
          otherRect.right <= rect.left ||
          rect.bottom <= otherRect.top ||
          otherRect.bottom <= rect.top
        );
      });
    });
  };
  const pronunciationRowsWrap = pronunciationRows.every((element) => {
    const style = window.getComputedStyle(element);
    return (
      style.flexWrap !== "nowrap" &&
      element.scrollWidth <= element.clientWidth + 2 &&
      childrenDoNotOverlap(element)
      );
    });
  const settingsBadgesWrap =
    settingsBadges.length >= 6 && settingsBadges.every(wraps);
  const settingsTextButtonsWrap =
    settingsTextButtons.length >= 8 && settingsTextButtons.every(wraps);
  const ttsSelectsWrap =
    ttsSelects.length === expectedTtsSelectCount &&
    ttsSelects.every((element) => {
      const value = element.querySelector('[data-slot="select-value"]');
      const valueStyle = value ? window.getComputedStyle(value) : null;
      return (
        element.scrollWidth <= element.clientWidth + 2 &&
        (activeTtsProvider !== "tts-provider-elevenlabs" ||
          (wraps(element) &&
            Boolean(value) &&
            valueStyle?.whiteSpace !== "nowrap" &&
            valueStyle?.webkitLineClamp !== "1"))
      );
    });
  const settingsActionRowsWrap =
    settingsActionRows.length === 3 &&
    settingsActionRows.every((element) => {
      const style = window.getComputedStyle(element);
      return (
        style.flexWrap !== "nowrap" &&
        element.scrollWidth <= element.clientWidth + 2 &&
        childrenDoNotOverlap(element)
      );
    });
  const llmProvidersWrap =
    llmProviderChips.length >= 10 &&
    ["GPT", "GLM / Z.ai", "Kimi", "MiniMax", "Xiaomi MiMo"].every((label) =>
      llmProviderLabels.includes(label)
    ) &&
    llmProviderChips.every(wraps);
  return {
    ok:
      !!document.querySelector('[data-smoke="data-privacy-center"]') &&
      !!document.querySelector('[data-smoke="desktop-llm-policy"]') &&
      !!document.querySelector('[data-smoke="release-unsigned-warning"]') &&
      languageMissing.length > 0 &&
      languageMissing.every(wraps) &&
      usageTargets.length > 0 &&
      usageTargets.every(wraps) &&
      pronunciationRows.length > 0 &&
      pronunciationRowsWrap &&
      settingsBadgesWrap &&
      settingsTextButtonsWrap &&
      ttsSelectsWrap &&
      settingsActionRowsWrap &&
      Boolean(corruptWarning) &&
      corruptWarning.getAttribute("role") === "alert" &&
      wraps(corruptWarning) &&
      bodyText.includes("已隔离 1 项损坏的本机数据") &&
      bodyText.includes("重置本机数据") &&
      bodyText.includes("默认不会删除 API keys") &&
      llmProvidersWrap &&
      bodyText.includes("实验") &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("dictionaryapi.com") &&
      !bodyText.includes("韦氏") &&
      !bodyText.includes("多语言发音包"),
    languageMissingCount: languageMissing.length,
    usageTargetCount: usageTargets.length,
    pronunciationRowCount: pronunciationRows.length,
    pronunciationRowsWrap,
    settingsBadgeCount: settingsBadges.length,
    settingsBadgesWrap,
    settingsTextButtonCount: settingsTextButtons.length,
    settingsTextButtonsWrap,
    ttsSelectCount: ttsSelects.length,
    activeTtsProvider,
    expectedTtsSelectCount,
    ttsSelectsWrap,
    settingsActionRowCount: settingsActionRows.length,
    settingsActionRowsWrap,
    hasCorruptWarning: Boolean(corruptWarning),
    llmProviderLabels,
    llmProvidersWrap,
    bodyText: bodyText.slice(0, 1200)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(`Settings UI smoke failed: ${JSON.stringify(result)}`);
  }

  const openedResetDialog = await evaluate(
    cdp,
    `
(() => {
  const resetButton = [...document.querySelectorAll("button")].find(
    (button) => button.innerText.trim() === "重置本机数据"
  );
  if (!resetButton) {
    return {
      ok: false,
      reason: "missing-reset-button",
      bodyText: (document.body?.innerText ?? "").slice(0, 800)
    };
  }
  resetButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ok: true };
})()
`,
  );
  if (!openedResetDialog?.ok) {
    throw new Error(
      `Settings data-control reset dialog could not open: ${JSON.stringify(
        openedResetDialog,
      )}`,
    );
  }

  const resetDialogResult = await waitForCondition(
    cdp,
    `
(() => {
  const row = document.querySelector('[data-smoke="data-control-api-key-toggle-row"]');
  const childrenDoNotOverlap = (element) => {
    const children = [...element.children].filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return children.every((child, index) => {
      const rect = child.getBoundingClientRect();
      return children.every((other, otherIndex) => {
        if (index >= otherIndex) return true;
        const otherRect = other.getBoundingClientRect();
        return (
          rect.right <= otherRect.left ||
          otherRect.right <= rect.left ||
          rect.bottom <= otherRect.top ||
          otherRect.bottom <= rect.top
        );
      });
    });
  };
  const label = row?.querySelector("div");
  const labelWraps = label ? (() => {
    const style = window.getComputedStyle(label);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      label.scrollWidth <= label.clientWidth + 2
    );
  })() : false;
  return {
    ok:
      Boolean(row) &&
      row.scrollWidth <= row.clientWidth + 2 &&
      childrenDoNotOverlap(row) &&
      labelWraps,
    rowExists: Boolean(row),
    rowScrollWidth: row?.scrollWidth ?? 0,
    rowClientWidth: row?.clientWidth ?? 0,
    labelWraps,
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
    "settings reset-data dialog toggle row",
  );
  if (!resetDialogResult?.ok) {
    throw new Error(
      `Settings data-control reset dialog smoke failed: ${JSON.stringify(
        resetDialogResult,
      )}`,
    );
  }

  await evaluate(
    cdp,
    `
(() => {
  const cancelButton = [...document.querySelectorAll("button")].find(
    (button) => button.innerText.trim() === "取消"
  );
  cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  return { ok: true };
})()
`,
  );
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    !document.querySelector('[data-smoke="data-control-api-key-toggle-row"]') &&
    ![...document.querySelectorAll('[role="dialog"]')].some((dialog) =>
      dialog.innerText.includes("重置本机数据？")
    ),
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    "settings reset-data dialog to close",
  );
  await delay(250);
}

async function assertDetail(cdp, language) {
  await clickLanguage(cdp, language.languageId);
  await navigate(cdp, language.route, '[data-smoke="phoneme-detail-page"]');
  const result = await evaluate(
    cdp,
    `
(() => {
  const detail = document.querySelector('[data-smoke="phoneme-detail-page"]');
  const bodyText = document.body?.innerText ?? "";
  const buttons = [...document.querySelectorAll("button")];
  const primary = document.querySelector('[data-smoke="practice-primary-text"]');
  const secondary = document.querySelector('[data-smoke="practice-secondary-text"]');
  const controls = [...document.querySelectorAll('[data-smoke="practice-controls"] button')];
  const voiceSelectors = [...document.querySelectorAll('[data-smoke="practice-voice-selector"]')];
  const wordAudioButtons = [...document.querySelectorAll('[data-smoke="practice-word-audio"]')];
  const videoSelectors = [...document.querySelectorAll('[data-smoke="video-selector"]')];
  const videoButtons = [...document.querySelectorAll('[data-smoke="video-selector"] button')];
  const headerAudio = document.querySelector('[data-smoke="sound-unit-header-audio"]');
  const breakdownPlaceholder = document.querySelector('[data-smoke="assessment-breakdown-placeholder"]');
  const targetIpaReference = document.querySelector('[data-smoke="assessment-target-ipa-reference"]');
  const expectedHeaderAudio = ${JSON.stringify(language.expectHeaderAudio)};
  const expectedPracticeAudioLabelIncludes = ${JSON.stringify(
    language.expectPracticeAudioLabelIncludes ?? "",
  )};
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const elementsDoNotOverlap = (elements) => {
    const rects = elements.map((element) => element.getBoundingClientRect());
    return rects.every((rect, index) =>
      rects.every((other, otherIndex) => {
        if (index >= otherIndex) return true;
        return (
          rect.right <= other.left ||
          other.right <= rect.left ||
          rect.bottom <= other.top ||
          other.bottom <= rect.top
        );
      })
    );
  };
  const textElements = [primary, secondary].filter(Boolean);
  const textIsCentered = textElements.every((element) => {
    const style = window.getComputedStyle(element);
    return style.textAlign === "center";
  });
  const textIsReadable = textElements.every((element) => {
    const style = window.getComputedStyle(element);
    const text = element.innerText.trim();
    return (
      text.length > 0 &&
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      element.scrollWidth <= element.clientWidth + 2
    );
  });
  const controlsDoNotOverlap = elementsDoNotOverlap(controls);
  const voiceSelectorReady = voiceSelectors.length === 1 && voiceSelectors.every((selector) => {
    const options = [...selector.querySelectorAll("button")];
    const labels = options.map((button) => button.innerText.trim()).sort().join("");
    return (
      hasVisibleRect(selector) &&
      options.length === 2 &&
      labels === "AB" &&
      options.every(hasVisibleRect) &&
      elementsDoNotOverlap(options) &&
      selector.scrollWidth <= selector.clientWidth + 2
    );
  });
  const wordAudioReady =
    wordAudioButtons.length === 1 &&
    wordAudioButtons.every((button) => {
      const style = window.getComputedStyle(button);
      const ariaLabel = button.getAttribute("aria-label") ?? "";
      return (
        hasVisibleRect(button) &&
        style.display !== "none" &&
        !button.disabled &&
        button.getAttribute("aria-disabled") !== "true" &&
        (ariaLabel.includes("发音") || ariaLabel.includes("示范")) &&
        (!expectedPracticeAudioLabelIncludes ||
          (ariaLabel.includes(expectedPracticeAudioLabelIncludes) &&
            ariaLabel !== "播放单词发音"))
      );
    });
  const wordAudioLabels = wordAudioButtons.map(
    (button) => button.getAttribute("aria-label") ?? "",
  );
  const videoSelectorReady = videoSelectors.every((selector) => {
    const options = [...selector.querySelectorAll("button")];
    return (
      hasVisibleRect(selector) &&
      selector.scrollWidth <= selector.clientWidth + 2 &&
      options.length > 0 &&
      options.every((button) => {
        const style = window.getComputedStyle(button);
        return (
          hasVisibleRect(button) &&
          style.textOverflow !== "ellipsis" &&
          style.whiteSpace !== "nowrap" &&
          button.scrollWidth <= button.clientWidth + 2
        );
      }) &&
      elementsDoNotOverlap(options)
    );
  });
  const headerAudioReady = expectedHeaderAudio
    ? Boolean(headerAudio) && (() => {
        const headerStyle = window.getComputedStyle(headerAudio);
        const headerButton = headerAudio.querySelector("button");
        if (!headerButton) return false;
        const buttonStyle = window.getComputedStyle(headerButton);
        return (
          hasVisibleRect(headerAudio) &&
          hasVisibleRect(headerButton) &&
          headerStyle.display !== "none" &&
          buttonStyle.display !== "none" &&
          !headerButton.disabled &&
          headerButton.getAttribute("aria-disabled") !== "true" &&
          (headerButton.getAttribute("aria-label") ?? "").includes("发音")
        );
      })()
    : !headerAudio;
  const breakdownSmokeElement = breakdownPlaceholder || targetIpaReference;
  const breakdownSmokeReady = Boolean(breakdownSmokeElement) && (() => {
    const style = window.getComputedStyle(breakdownSmokeElement);
    const text = breakdownSmokeElement.innerText.trim();
    return (
      hasVisibleRect(breakdownSmokeElement) &&
      text.length > 0 &&
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      breakdownSmokeElement.scrollWidth <= breakdownSmokeElement.clientWidth + 2
    );
  })();
  return {
    ok:
      detail?.getAttribute("data-language-id") === ${JSON.stringify(
        language.languageId,
      )} &&
      detail?.getAttribute("data-sound-unit") === ${JSON.stringify(
        language.slug,
      )} &&
      buttons.length >= 2 &&
      textIsCentered &&
      textIsReadable &&
      controlsDoNotOverlap &&
      voiceSelectorReady &&
      wordAudioReady &&
      videoSelectorReady &&
      breakdownSmokeReady &&
      headerAudioReady &&
      !bodyText.includes("未找到") &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("多语言发音包"),
    buttonCount: buttons.length,
    primaryText: primary?.innerText,
    secondaryText: secondary?.innerText,
    textIsCentered,
    textIsReadable,
    controlsDoNotOverlap,
    voiceSelectorReady,
    wordAudioReady,
    expectedPracticeAudioLabelIncludes,
    wordAudioLabels,
    videoSelectorReady,
    videoSelectorCount: videoSelectors.length,
    videoButtonCount: videoButtons.length,
    hasHeaderAudio: Boolean(headerAudio),
    expectedHeaderAudio,
    headerAudioReady,
    hasBreakdownSmokeHook: Boolean(breakdownSmokeElement),
    breakdownSmokeReady,
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

async function assertPhonemeLeftColumnFitsLaunchHeight(cdp) {
  await setViewport(cdp, 1280, 920);
  try {
    await clickLanguage(cdp, "en-US");
    await forceNavigate(cdp, "/phonemes/ee?smokeScoreSummary=1");
    await waitForCondition(
      cdp,
      `
(() => ({
  ok:
    window.location.pathname === "/phonemes/ee" &&
    new URLSearchParams(window.location.search).get("smokeScoreSummary") === "1" &&
    !!document.querySelector('[data-smoke="phoneme-detail-left-column"]') &&
    !!document.querySelector('[data-smoke="phoneme-score-summary"]'),
  href: window.location.href,
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
      "phoneme detail launch-height score fixture to render",
    );

    const result = await evaluate(
      cdp,
      `
(() => {
  const left = document.querySelector('[data-smoke="phoneme-detail-left-column"]');
  const score = document.querySelector('[data-smoke="phoneme-score-summary"]');
  const video = left?.querySelector("video");
  const wordAudio = left?.querySelector('[data-smoke="practice-word-audio"]');
  const recordButton = [...(left?.querySelectorAll("button") ?? [])].find((button) =>
    (button.getAttribute("aria-label") ?? "").includes("开始录音")
  );
  const hasVisibleRect = (element) => {
    const rect = element?.getBoundingClientRect();
    return Boolean(rect && rect.width > 0 && rect.height > 0);
  };
  const leftRect = left?.getBoundingClientRect();
  return {
    ok:
      window.innerWidth === 1280 &&
      window.innerHeight === 920 &&
      Boolean(left) &&
      left.scrollHeight <= left.clientHeight + 2 &&
      hasVisibleRect(video) &&
      hasVisibleRect(wordAudio) &&
      hasVisibleRect(recordButton) &&
      hasVisibleRect(score) &&
      score.innerText.includes("总分"),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    leftClientHeight: left?.clientHeight ?? 0,
    leftScrollHeight: left?.scrollHeight ?? 0,
    leftRectHeight: leftRect?.height ?? 0,
    hasVideo: hasVisibleRect(video),
    hasWordAudio: hasVisibleRect(wordAudio),
    hasRecordButton: hasVisibleRect(recordButton),
    hasScore: hasVisibleRect(score),
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(
        `Phoneme left column launch-height fit failed: ${JSON.stringify(
          result,
        )}`,
      );
    }
  } finally {
    await clearViewport(cdp);
  }
}

async function assertHiddenRuleRouteBlocked(cdp, check) {
  await clickLanguage(cdp, check.languageId);
  await navigate(
    cdp,
    check.route,
    '[data-smoke="phoneme-rule-route-blocked"]',
    { direct: true },
  );
  const result = await evaluate(
    cdp,
    `
(() => {
  const blocked = document.querySelector('[data-smoke="phoneme-rule-route-blocked"]');
  const bodyText = document.body?.innerText ?? "";
  return {
    ok:
      blocked?.getAttribute("data-language-id") === ${JSON.stringify(check.languageId)} &&
      blocked?.getAttribute("data-sound-unit") === ${JSON.stringify(check.slug)} &&
      bodyText.includes("该内容属于规则/短语训练") &&
      bodyText.includes("不属于单音标练习") &&
      bodyText.includes("返回当前语言音标练习") &&
      !document.querySelector('[data-smoke="phoneme-detail-page"]') &&
      !document.querySelector('[data-smoke="sound-unit-header-audio"]') &&
      !document.querySelector('[data-smoke="assessment-breakdown-placeholder"]'),
    bodyText: bodyText.slice(0, 1000),
    hasDetailPage: Boolean(document.querySelector('[data-smoke="phoneme-detail-page"]')),
    hasHeaderAudio: Boolean(document.querySelector('[data-smoke="sound-unit-header-audio"]')),
    hasBreakdown: Boolean(document.querySelector('[data-smoke="assessment-breakdown-placeholder"]'))
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `${check.languageId} hidden rule route was not blocked: ${JSON.stringify(
        result,
      )}`,
    );
  }
  return { languageId: check.languageId, slug: check.slug };
}

async function assertPhonemePracticeSidebarPurity(cdp, check) {
  await clickLanguage(cdp, check.languageId);
  await navigate(cdp, check.route, '[data-smoke="phoneme-detail-page"]');
  await expandPhonemeGroups(cdp);
  const result = await evaluate(
    cdp,
    `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const links = [...document.querySelectorAll("a[href]")].map((anchor) => {
    try {
      return new URL(anchor.href, window.location.href).pathname;
    } catch {
      return anchor.getAttribute("href") ?? "";
    }
  });
  const presentText = ${JSON.stringify(check.presentText)};
  const absentText = ${JSON.stringify(check.absentText)};
  const absentRoutes = ${JSON.stringify(check.absentRoutes)};
  const missingText = presentText.filter((text) => !bodyText.includes(text));
  const leakedText = absentText.filter((text) => bodyText.includes(text));
  const leakedRoutes = absentRoutes.filter((route) => links.includes(route));
  return {
    ok: missingText.length === 0 && leakedText.length === 0 && leakedRoutes.length === 0,
    missingText,
    leakedText,
    leakedRoutes,
    links: links.filter((link) => link.startsWith("/phonemes/")).slice(0, 80),
    bodyText: bodyText.slice(0, 1500)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `${check.languageId} phoneme practice sidebar purity failed: ${JSON.stringify(
        result,
      )}`,
    );
  }
  return { languageId: check.languageId };
}

async function _assertScoringTileAudioPolicy(cdp) {
  await clickLanguage(cdp, "es-ES");
  await forceNavigate(cdp, "/phonemes/es-a?smokeAssessmentTiles=1");
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    window.location.pathname === "/phonemes/es-a" &&
    window.location.search.includes("smokeAssessmentTiles=1") &&
    document.readyState !== "loading" &&
    document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]').length >= 2,
  href: window.location.href,
  bodyText: (document.body?.innerText ?? "").slice(0, 800)
}))()
`,
    "scoring tile smoke fixture to render",
  );
  const result = await evaluate(
    cdp,
    `
(() => {
  const fixture = document.querySelector('[data-smoke="assessment-phoneme-tile-fixture"]');
  const audioHint = document.querySelector('[data-smoke="assessment-phoneme-audio-hint"]');
  const headerButton = document.querySelector('[data-smoke="sound-unit-header-audio"] button');
  const tiles = [...document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]')];
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const headerPolicy = {
    hasVisibleRect: Boolean(headerButton) && hasVisibleRect(headerButton),
    playable: headerButton?.getAttribute("data-audio-playable") === "true",
    kind: headerButton?.getAttribute("data-audio-kind") ?? "none",
    audioSrc: headerButton?.getAttribute("data-audio-src") ?? "",
    startMs: Number(headerButton?.getAttribute("data-audio-start-ms") ?? 0),
    maxDurationMs: Number(headerButton?.getAttribute("data-audio-max-duration-ms") ?? 0),
    fadeOutMs: Number(headerButton?.getAttribute("data-audio-fade-out-ms") ?? 0),
    ariaDisabled: headerButton?.getAttribute("aria-disabled") === "true",
    ariaLabel: headerButton?.getAttribute("aria-label") ?? "",
    disabled: Boolean(headerButton?.disabled),
    isHeaderClip: /^\\/audio\\/language-assets\\/es-ES\\/header-clips\\/.+\\.m4a$/i.test(
      headerButton?.getAttribute("data-audio-src") ?? "",
    ),
    isVideo: /\\.(mp4|m4v|webm)(?:$|\\?)/i.test(
      headerButton?.getAttribute("data-audio-src") ?? "",
    ),
    isLanguagePack: (headerButton?.getAttribute("data-audio-src") ?? "").includes(
      "/audio/language-packs/",
    )
  };
  const tilePolicies = tiles.map((tile) => {
    const startMs = Number(tile.getAttribute("data-audio-start-ms") ?? 0);
    const maxDurationMs = Number(tile.getAttribute("data-audio-max-duration-ms") ?? 0);
    const fadeOutMs = Number(tile.getAttribute("data-audio-fade-out-ms") ?? 0);
    const audioSrc = tile.getAttribute("data-audio-src") ?? "";
    const playable = tile.getAttribute("data-audio-playable") === "true";
    const ariaDisabled = tile.getAttribute("aria-disabled") === "true";
    const ariaLabel = tile.getAttribute("aria-label") ?? "";
    const role = tile.getAttribute("role") ?? "";
    const tabIndex = tile.getAttribute("tabindex") ?? "";
    const kind = tile.getAttribute("data-audio-kind") ?? "none";
    const isHeaderClip =
      /^\\/audio\\/language-assets\\/es-ES\\/header-clips\\/.+\\.m4a$/i.test(audioSrc);

    return {
      hasVisibleRect: hasVisibleRect(tile),
      playable,
      ariaDisabled,
      ariaLabel,
      role,
      tabIndex,
      kind,
      audioSrc,
      startMs,
      maxDurationMs,
      fadeOutMs,
      isHeaderClip,
      isVideo: /\\.(mp4|m4v|webm)(?:$|\\?)/i.test(audioSrc),
      isLanguagePack: audioSrc.includes("/audio/language-packs/")
    };
  });
  const hasPlayableExactHeaderClip = tilePolicies.some(
    (tile) =>
      tile.hasVisibleRect &&
      tile.playable &&
      !tile.ariaDisabled &&
      tile.ariaLabel.includes("播放音标") &&
      tile.kind === "sound-unit" &&
      tile.isHeaderClip &&
      tile.startMs >= 0 &&
      tile.startMs <= 25 &&
      tile.maxDurationMs > 0 &&
      tile.maxDurationMs <= 560 &&
      tile.fadeOutMs > 0 &&
      !tile.isVideo &&
      !tile.isLanguagePack,
  );
  const hasLockedUnverifiedTile = tilePolicies.some(
    (tile) =>
      tile.hasVisibleRect &&
      !tile.playable &&
      tile.ariaDisabled &&
      tile.role === "" &&
      tile.tabIndex === "-1" &&
      tile.kind === "none" &&
      tile.audioSrc === "" &&
      tile.startMs === 0 &&
      tile.maxDurationMs === 0 &&
      tile.fadeOutMs === 0 &&
      tile.ariaLabel === "",
  );
  const tilePoliciesAreStrict = tilePolicies.every((tile) => {
    if (!tile.hasVisibleRect || tile.isVideo || tile.isLanguagePack) return false;
    if (!tile.playable) {
      return (
        tile.ariaDisabled &&
        tile.role === "" &&
        tile.tabIndex === "-1" &&
        tile.kind === "none" &&
        tile.audioSrc === "" &&
        tile.startMs === 0 &&
        tile.maxDurationMs === 0 &&
        tile.fadeOutMs === 0 &&
        tile.ariaLabel === ""
      );
    }
    return (
      !tile.ariaDisabled &&
      tile.role === "button" &&
      tile.tabIndex === "0" &&
      tile.ariaLabel.includes("播放音标") &&
      tile.kind === "sound-unit" &&
      tile.isHeaderClip &&
      tile.startMs >= 0 &&
      tile.startMs <= 25 &&
      tile.maxDurationMs > 0 &&
      tile.maxDurationMs <= 560 &&
      tile.fadeOutMs > 0
    );
  });
  const headerPolicyIsStrict =
    headerPolicy.hasVisibleRect &&
    headerPolicy.playable &&
    !headerPolicy.disabled &&
    !headerPolicy.ariaDisabled &&
    headerPolicy.ariaLabel.includes("发音") &&
    headerPolicy.kind === "sound-unit" &&
    headerPolicy.isHeaderClip &&
    headerPolicy.startMs >= 0 &&
    headerPolicy.startMs <= 25 &&
    headerPolicy.maxDurationMs > 0 &&
    headerPolicy.maxDurationMs <= 560 &&
    headerPolicy.fadeOutMs > 0 &&
    !headerPolicy.isVideo &&
    !headerPolicy.isLanguagePack;
  const hasTileMatchingHeader = tilePolicies.some(
    (tile) =>
      tile.playable &&
      tile.kind === headerPolicy.kind &&
      tile.audioSrc === headerPolicy.audioSrc &&
      tile.startMs === headerPolicy.startMs &&
      tile.maxDurationMs === headerPolicy.maxDurationMs &&
      tile.fadeOutMs === headerPolicy.fadeOutMs,
  );
  const tileAudioPolicyReady =
    Boolean(fixture) &&
    audioHint?.textContent?.includes("有本地音频的片段可点击") &&
    tiles.length >= 2 &&
    hasPlayableExactHeaderClip &&
    tilePoliciesAreStrict &&
    headerPolicyIsStrict &&
    hasTileMatchingHeader;
  return {
    ok: tileAudioPolicyReady,
    tileCount: tiles.length,
    tileAudioPolicyReady,
    audioHint: audioHint?.textContent ?? "",
    hasPlayableExactHeaderClip,
    hasLockedUnverifiedTile,
    tilePoliciesAreStrict,
    headerPolicyIsStrict,
    hasTileMatchingHeader,
    headerAudio: headerPolicy,
    tileAudio: tiles.map((tile) => ({
      kind: tile.getAttribute("data-audio-kind"),
      src: tile.getAttribute("data-audio-src"),
      startMs: tile.getAttribute("data-audio-start-ms"),
      maxDurationMs: tile.getAttribute("data-audio-max-duration-ms"),
      fadeOutMs: tile.getAttribute("data-audio-fade-out-ms"),
      playable: tile.getAttribute("data-audio-playable"),
      ariaDisabled: tile.getAttribute("aria-disabled"),
      ariaLabel: tile.getAttribute("aria-label"),
      role: tile.getAttribute("role"),
      tabIndex: tile.getAttribute("tabindex")
    })),
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `Scoring tile audio policy smoke failed: ${JSON.stringify(result)}`,
    );
  }

  await clickLanguage(cdp, "ru-RU");
  await forceNavigate(cdp, "/phonemes/ru-a?smokeAssessmentTiles=1");
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    window.location.pathname === "/phonemes/ru-a" &&
    window.location.search.includes("smokeAssessmentTiles=1") &&
    document.readyState !== "loading" &&
    document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]').length >= 2,
  href: window.location.href,
  bodyText: (document.body?.innerText ?? "").slice(0, 800)
}))()
`,
    "unverified scoring tile smoke fixture to render",
  );
  const lockedResult = await evaluate(
    cdp,
    `
(() => {
  const fixture = document.querySelector('[data-smoke="assessment-phoneme-tile-fixture"]');
  const audioHint = document.querySelector('[data-smoke="assessment-phoneme-audio-hint"]');
  const tiles = [...document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]')];
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const tilePolicies = tiles.map((tile) => {
    const startMs = Number(tile.getAttribute("data-audio-start-ms") ?? 0);
    const maxDurationMs = Number(tile.getAttribute("data-audio-max-duration-ms") ?? 0);
    const fadeOutMs = Number(tile.getAttribute("data-audio-fade-out-ms") ?? 0);
    const audioSrc = tile.getAttribute("data-audio-src") ?? "";
    const playable = tile.getAttribute("data-audio-playable") === "true";
    const ariaDisabled = tile.getAttribute("aria-disabled") === "true";
    const ariaLabel = tile.getAttribute("aria-label") ?? "";
    const role = tile.getAttribute("role") ?? "";
    const tabIndex = tile.getAttribute("tabindex") ?? "";
    const kind = tile.getAttribute("data-audio-kind") ?? "none";

    return {
      hasVisibleRect: hasVisibleRect(tile),
      playable,
      ariaDisabled,
      ariaLabel,
      role,
      tabIndex,
      kind,
      audioSrc,
      startMs,
      maxDurationMs,
      fadeOutMs,
      isVideo: /\\.(mp4|m4v|webm)(?:$|\\?)/i.test(audioSrc),
      isLanguagePack: audioSrc.includes("/audio/language-packs/"),
      isHeaderClip:
        /^\\/audio\\/language-assets\\/ru-RU\\/header-clips\\/.+\\.m4a$/i.test(
          audioSrc,
        )
    };
  });
  const isLockedUnverifiedTile = (tile) =>
    tile.hasVisibleRect &&
    !tile.playable &&
    tile.ariaDisabled &&
    tile.role === "" &&
    tile.tabIndex === "-1" &&
    tile.kind === "none" &&
    tile.audioSrc === "" &&
    tile.startMs === 0 &&
    tile.maxDurationMs === 0 &&
    tile.fadeOutMs === 0 &&
    tile.ariaLabel === "" &&
    !tile.isVideo &&
    !tile.isLanguagePack;
  const hasLockedUnverifiedTile = tilePolicies.some(isLockedUnverifiedTile);
  const tilePoliciesAreStrict = tilePolicies.every((tile) => {
    if (isLockedUnverifiedTile(tile)) return true;
    return (
      tile.hasVisibleRect &&
      tile.playable &&
      !tile.ariaDisabled &&
      tile.role === "button" &&
      tile.tabIndex === "0" &&
      tile.ariaLabel.includes("播放音标") &&
      tile.kind === "sound-unit" &&
      tile.isHeaderClip &&
      tile.startMs >= 0 &&
      tile.startMs <= 25 &&
      tile.maxDurationMs > 0 &&
      tile.maxDurationMs <= 560 &&
      tile.fadeOutMs > 0 &&
      !tile.isVideo &&
      !tile.isLanguagePack
    );
  });
  const lockedTilePolicyReady =
    Boolean(fixture) &&
    audioHint?.textContent?.includes("有本地音频的片段可点击") &&
    tiles.length >= 2 &&
    hasLockedUnverifiedTile &&
    tilePoliciesAreStrict;
  return {
    ok: lockedTilePolicyReady,
    tileCount: tiles.length,
    lockedTilePolicyReady,
    hasLockedUnverifiedTile,
    tilePoliciesAreStrict,
    audioHint: audioHint?.textContent ?? "",
    tileAudio: tiles.map((tile) => ({
      kind: tile.getAttribute("data-audio-kind"),
      src: tile.getAttribute("data-audio-src"),
      startMs: tile.getAttribute("data-audio-start-ms"),
      maxDurationMs: tile.getAttribute("data-audio-max-duration-ms"),
      fadeOutMs: tile.getAttribute("data-audio-fade-out-ms"),
      playable: tile.getAttribute("data-audio-playable"),
      ariaDisabled: tile.getAttribute("aria-disabled"),
      ariaLabel: tile.getAttribute("aria-label"),
      role: tile.getAttribute("role"),
      tabIndex: tile.getAttribute("tabindex")
    })),
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
  );
  if (!lockedResult?.ok) {
    throw new Error(
      `Locked scoring tile audio policy smoke failed: ${JSON.stringify(lockedResult)}`,
    );
  }
}

async function assertMainRoutes(cdp) {
  const routes = [
    {
      path: "/drill",
      selector: '[data-smoke="non-english-core-only-boundary"]',
      direct: true,
      boundary: true,
    },
    {
      path: "/drill/prosody",
      selector: '[data-smoke="non-english-core-only-boundary"]',
      direct: true,
      boundary: true,
    },
    {
      path: "/drill/perception",
      selector: '[data-smoke="non-english-core-only-boundary"]',
      direct: true,
      boundary: true,
    },
    { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
    {
      path: "/assessment",
      selector: '[data-smoke="non-english-core-only-boundary"]',
      direct: true,
      boundary: true,
    },
    {
      path: "/progress",
      selector: '[data-smoke="non-english-core-only-boundary"]',
      direct: true,
      boundary: true,
    },
  ];

  for (const route of routes) {
    await navigate(cdp, route.path, route.selector, route);
    const result = await evaluate(
      cdp,
      `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const routePath = ${JSON.stringify(route.path)};
  const expectsBoundary = ${JSON.stringify(Boolean(route.boundary))};
  const sentenceCard = document.querySelector('[data-smoke="sentence-input-card"]');
  const sentenceColumn = document.querySelector('[data-smoke="free-practice-left-column"]');
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(sentenceCard) &&
      Boolean(sentenceColumn) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')) &&
      window.getComputedStyle(sentenceCard).flexShrink === "0" &&
      window.getComputedStyle(sentenceCard).overflow !== "hidden" &&
      (window.innerWidth < 1024 || window.getComputedStyle(sentenceColumn).overflowY === "auto"));
  const assessmentHooksReady =
    expectsBoundary ||
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    expectsBoundary ||
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    expectsBoundary ||
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
  const coreBoundaryReady =
    !expectsBoundary ||
    (Boolean(document.querySelector('[data-smoke="non-english-core-only-boundary"]')) &&
      bodyText.includes("公开版只开放音标") &&
      bodyText.includes("去音标练习") &&
      bodyText.includes("去自由练习") &&
      !bodyText.includes("实验训练") &&
      !bodyText.includes("发音诊断\\n") &&
      !bodyText.includes("今日学习计划"));
  return {
    ok:
      bodyText.trim().length > 20 &&
      sentenceHooksReady &&
      assessmentHooksReady &&
      prosodyHooksReady &&
      perceptionHooksReady &&
      coreBoundaryReady &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("多语言发音包") &&
      !bodyText.includes("无法访问此页面"),
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
    coreBoundaryReady,
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

async function assertEnglishTransferRoutes(cdp) {
  await clickLanguage(cdp, "en-US");
  const routes = [
    {
      path: "/drill/scenarios",
      selector: '[data-smoke="scenario-page"]',
      pageSmoke: "scenario-page",
      promptSmoke: "scenario-prompt-card",
      recordingSmoke: "scenario-recording-card",
    },
    {
      path: "/drill/spontaneous",
      selector: '[data-smoke="spontaneous-page"]',
      pageSmoke: "spontaneous-page",
      promptSmoke: "spontaneous-prompt-card",
      recordingSmoke: "spontaneous-recording-card",
    },
  ];

  for (const route of routes) {
    await navigate(cdp, route.path, route.selector, { direct: true });
    const result = await evaluate(
      cdp,
      `
(() => {
  const page = document.querySelector('[data-smoke="${route.pageSmoke}"]');
  const prompt = document.querySelector('[data-smoke="${route.promptSmoke}"]');
  const recording = document.querySelector('[data-smoke="${route.recordingSmoke}"]');
  const bodyText = document.body?.innerText ?? "";
  const readableText = [...document.querySelectorAll("h1,h2,p,textarea")].every((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1"
    );
  });
  return {
    ok:
      Boolean(page) &&
      Boolean(prompt) &&
      Boolean(recording) &&
      bodyText.trim().length > 20 &&
      readableText &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    hasPage: Boolean(page),
    hasPrompt: Boolean(prompt),
    hasRecording: Boolean(recording),
    readableText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(
        `English transfer route smoke failed for ${route.path}: ${JSON.stringify(
          result,
        )}`,
      );
    }
  }
}

async function assertEnglishCoreDrillRoutes(cdp) {
  await clickLanguage(cdp, "en-US");
  const routes = [
    {
      path: "/drill/word",
      selector: '[data-smoke="word-drill-page"]',
      pageSmoke: "word-drill-page",
      configSmoke: "word-drill-config-card",
    },
    {
      path: "/drill/sentence",
      selector: '[data-smoke="sentence-drill-page"]',
      pageSmoke: "sentence-drill-page",
      configSmoke: "sentence-drill-config-card",
    },
    {
      path: "/drill/contrast",
      selector: '[data-smoke="contrast-page"]',
      pageSmoke: "contrast-page",
      configSmoke: "contrast-config-card",
    },
  ];

  for (const route of routes) {
    await navigate(cdp, route.path, route.selector, { direct: true });
    const result = await evaluate(
      cdp,
      `
(() => {
  const page = document.querySelector('[data-smoke="${route.pageSmoke}"]');
  const config = document.querySelector('[data-smoke="${route.configSmoke}"]');
  const bodyText = document.body?.innerText ?? "";
  const readableText = [...document.querySelectorAll("h1,h2,h3,p,textarea")].every((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1"
    );
  });
  return {
    ok:
      Boolean(page) &&
      Boolean(config) &&
      bodyText.trim().length > 20 &&
      readableText &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    hasPage: Boolean(page),
    hasConfig: Boolean(config),
    readableText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(
        `English core drill route smoke failed for ${route.path}: ${JSON.stringify(
          result,
        )}`,
      );
    }
  }
}

async function assertAdvancedDirectRoutes(cdp) {
  await clickLanguage(cdp, "en-US");
  const englishRoutes = [
    {
      path: "/assessment/passage",
      selector: '[data-smoke="assessment-passage-page"]',
      pageSmoke: "assessment-passage-page",
      requiredSmokes: [
        "assessment-passage-intro-card",
        "assessment-passage-text-card",
        "assessment-passage-start-button",
      ],
    },
    {
      path: "/drill/evidence",
      selector: '[data-smoke="evidence-page"]',
      pageSmoke: "evidence-page",
      requiredSmokes: ["evidence-summary-stats"],
    },
    {
      path: "/drill/pack/ee-ih",
      selector: '[data-smoke="pack-runner-page"]',
      pageSmoke: "pack-runner-page",
      requiredSmokes: ["pack-runner-intro-card", "pack-runner-course-map"],
    },
  ];

  for (const route of englishRoutes) {
    await navigate(cdp, route.path, route.selector, { direct: true });
    const result = await evaluate(
      cdp,
      `
(() => {
  const page = document.querySelector('[data-smoke="${route.pageSmoke}"]');
  const requiredSmokes = ${JSON.stringify(route.requiredSmokes)};
  const requiredReady = requiredSmokes.every((smoke) =>
    Boolean(document.querySelector(\`[data-smoke="\${smoke}"]\`))
  );
  const bodyText = document.body?.innerText ?? "";
  const readableText = [...document.querySelectorAll("h1,h2,h3,p,textarea")].every((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1"
    );
  });
  return {
    ok:
      Boolean(page) &&
      requiredReady &&
      bodyText.trim().length > 20 &&
      readableText &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    hasPage: Boolean(page),
    requiredReady,
    readableText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(
        `Advanced direct route smoke failed for ${route.path}: ${JSON.stringify(
          result,
        )}`,
      );
    }
  }

  await clickLanguage(cdp, "fr-FR");
  const experimentalRoutes = [
    {
      path: "/assessment/passage",
      selector: '[data-smoke="assessment-passage-experimental-blocker"]',
      requiredText: [
        "暂不开放英语覆盖文章诊断",
        "返回当前语言诊断",
        "切换语言",
      ],
    },
    {
      path: "/drill/evidence",
      selector: '[data-smoke="evidence-experimental-blocker"]',
      requiredText: ["暂不生成正式错题证据库", "返回当前语言训练", "切换语言"],
    },
    {
      path: "/drill/pack/ee-ih",
      selector: '[data-smoke="pack-runner-experimental-blocker"]',
      requiredText: [
        "Labs 暂不使用英语训练包",
        "当前语言单词训练",
        "当前语言对比训练",
        "返回训练首页",
      ],
    },
  ];

  for (const route of experimentalRoutes) {
    await navigate(cdp, route.path, route.selector, { direct: true });
    const result = await evaluate(
      cdp,
      `
(() => {
  const blocker = document.querySelector(${JSON.stringify(route.selector)});
  const requiredText = ${JSON.stringify(route.requiredText)};
  const bodyText = document.body?.innerText ?? "";
  const readableText = [...document.querySelectorAll("h1,h2,p")].every((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1"
    );
  });
  return {
    ok:
      Boolean(blocker) &&
      requiredText.every((text) => bodyText.includes(text)) &&
      !bodyText.includes("训练证据库\\n汇总训练中的错题") &&
      !bodyText.includes("完整朗读稿") &&
      !bodyText.includes("词尾别吞") &&
      !bodyText.includes("课前任务单") &&
      !bodyText.includes("实验训练") &&
      readableText &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    hasBlocker: Boolean(blocker),
    readableText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
    );
    if (!result?.ok) {
      throw new Error(
        `Experimental advanced route blocker smoke failed for ${route.path}: ${JSON.stringify(
          result,
        )}`,
      );
    }
  }
}

async function assertCorruptLocalDataWarnings(cdp) {
  await clickLanguage(cdp, "en-US");
  await evaluate(
    cdp,
    `
(() => {
  localStorage.setItem("speakright_mastery_profile_v2", "{broken mastery");
  localStorage.setItem("speakright_assessment_result_v2:en-US", "{broken drill report");
  localStorage.setItem("speakright_assessment_result_v2:coverage:en-US", "{broken coverage");
  return { ok: true };
})()
`,
  );
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]', {
    direct: true,
  });
  await cdp.send("Page.reload", { ignoreCache: true });
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    window.location.pathname === "/settings" &&
    !!document.querySelector('[data-smoke="settings-page"]') &&
    document.readyState !== "loading",
  masteryStorage: localStorage.getItem("speakright_mastery_profile_v2"),
  drillReportStorage: localStorage.getItem("speakright_assessment_result_v2:en-US"),
  corruptStorage: localStorage.getItem("speakright_corrupt_data_v1"),
  coverageStorage: localStorage.getItem("speakright_assessment_result_v2:coverage:en-US"),
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    "settings reload after corrupt local data seed",
  );

  const checks = [
    {
      path: "/assessment",
      selector: '[data-smoke="assessment-page"]',
      warningSmoke: "assessment-storage-warning",
      expectedText: "上次快速诊断报告无法读取",
    },
    {
      path: "/drill",
      selector: '[data-smoke="drill-page"]',
      warningSmoke: "drill-report-storage-warning",
      expectedText: "上次诊断报告无法读取",
    },
    {
      path: "/progress",
      selector: '[data-smoke="progress-page"]',
      warningSmoke: "progress-mastery-storage-warning",
      expectedText: "本机训练进度数据无法读取",
    },
    {
      path: "/drill/evidence",
      selector: '[data-smoke="evidence-page"]',
      warningSmoke: "evidence-mastery-storage-warning",
      expectedText: "本机训练进度数据无法读取",
    },
    {
      path: "/assessment/passage",
      selector: '[data-smoke="assessment-passage-page"]',
      warningSmoke: "assessment-passage-storage-warning",
      expectedText: "上次全音诊断报告无法读取",
    },
  ];

  try {
    for (const check of checks) {
      await forceNavigate(cdp, check.path);
      await waitForCondition(
        cdp,
        `
(() => {
  const page = document.querySelector(${JSON.stringify(check.selector)});
  const warningSmoke = ${JSON.stringify(check.warningSmoke)};
  const warning = document.querySelector(\`[data-smoke="\${warningSmoke}"]\`);
  const bodyText = document.body?.innerText ?? "";
  const style = warning ? window.getComputedStyle(warning) : null;
  return {
    ok:
      Boolean(page) &&
      Boolean(warning) &&
      warning.getAttribute("role") === "alert" &&
      warning.innerText.includes(${JSON.stringify(check.expectedText)}) &&
      warning.innerText.includes("重置本机学习数据") &&
      style?.textOverflow !== "ellipsis" &&
      style?.whiteSpace !== "nowrap" &&
      style?.webkitLineClamp !== "1" &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    hasPage: Boolean(page),
    hasWarning: Boolean(warning),
    role: warning?.getAttribute("role"),
    warningText: warning?.innerText ?? "",
    masteryStorage: localStorage.getItem("speakright_mastery_profile_v2"),
    drillReportStorage: localStorage.getItem("speakright_assessment_result_v2:en-US"),
    corruptStorage: localStorage.getItem("speakright_corrupt_data_v1"),
    coverageStorage: localStorage.getItem("speakright_assessment_result_v2:coverage:en-US"),
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
        `corrupt local data warning for ${check.path}`,
      );
    }
  } finally {
    await evaluate(
      cdp,
      `
(() => {
  localStorage.removeItem("speakright_mastery_profile_v2");
  localStorage.removeItem("speakright_assessment_result_v2:en-US");
  localStorage.removeItem("speakright_corrupt_data_v1");
  localStorage.removeItem("speakright_assessment_result_v2:coverage:en-US");
  return { ok: true };
})()
`,
    ).catch(() => {});
  }
}

async function assertNarrowViewportRoutes(cdp) {
  await setViewport(cdp, 760, 720);
  try {
    await assertSettings(cdp);
    await assertEnglishTransferRoutes(cdp);
    await assertEnglishCoreDrillRoutes(cdp);
    await assertAdvancedDirectRoutes(cdp);
    await clickLanguage(cdp, "fr-FR");
    await navigate(
      cdp,
      "/phonemes/fr-schwa",
      '[data-smoke="phoneme-detail-page"]',
    );

    const detailResult = await evaluate(
      cdp,
      `
(() => {
  const targets = [
    ...document.querySelectorAll('[data-smoke="practice-primary-text"]'),
    ...document.querySelectorAll('[data-smoke="practice-secondary-text"]'),
    ...document.querySelectorAll('[data-smoke="video-selector"] button span')
  ];
  const readable = targets.every((element) => {
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      element.scrollWidth <= element.clientWidth + 2
    );
  });
  const controls = [...document.querySelectorAll('[data-smoke="practice-controls"] button')];
  const rects = controls.map((button) => button.getBoundingClientRect());
  const controlsDoNotOverlap = rects.every((rect, index) =>
    rects.every((other, otherIndex) => {
      if (index >= otherIndex) return true;
      return (
        rect.right <= other.left ||
        other.right <= rect.left ||
        rect.bottom <= other.top ||
        other.bottom <= rect.top
      );
    })
  );
  const breakdownSmokeElement =
    document.querySelector('[data-smoke="assessment-breakdown-placeholder"]') ||
    document.querySelector('[data-smoke="assessment-target-ipa-reference"]');
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const breakdownViewportSmokeReady = Boolean(breakdownSmokeElement) && (() => {
    const style = window.getComputedStyle(breakdownSmokeElement);
    const text = breakdownSmokeElement.innerText.trim();
    return (
      hasVisibleRect(breakdownSmokeElement) &&
      text.length > 0 &&
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      breakdownSmokeElement.scrollWidth <= breakdownSmokeElement.clientWidth + 2
    );
  })();
  return {
    ok:
      window.innerWidth === 760 &&
      readable &&
      controlsDoNotOverlap &&
      breakdownViewportSmokeReady,
    targetCount: targets.length,
    readable,
    controlsDoNotOverlap,
    breakdownViewportSmokeReady,
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
    );
    if (!detailResult?.ok) {
      throw new Error(
        `Narrow detail smoke failed: ${JSON.stringify(detailResult)}`,
      );
    }

    await assertEnglishProgressArchive(cdp);
    await clickLanguage(cdp, "fr-FR");

    for (const route of [
      {
        path: "/drill",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/drill/prosody",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/drill/perception",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
      {
        path: "/assessment",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/progress",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
    ]) {
      await navigate(cdp, route.path, route.selector, route);
      const result = await evaluate(
        cdp,
        `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const routePath = ${JSON.stringify(route.path)};
  const expectsBoundary = ${JSON.stringify(Boolean(route.boundary))};
  const sentenceCard = document.querySelector('[data-smoke="sentence-input-card"]');
  const sentenceColumn = document.querySelector('[data-smoke="free-practice-left-column"]');
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(sentenceCard) &&
      Boolean(sentenceColumn) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')) &&
      window.getComputedStyle(sentenceCard).flexShrink === "0" &&
      window.getComputedStyle(sentenceCard).overflow !== "hidden" &&
      (window.innerWidth < 1024 || window.getComputedStyle(sentenceColumn).overflowY === "auto"));
  const assessmentHooksReady =
    expectsBoundary ||
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    expectsBoundary ||
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    expectsBoundary ||
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
  const coreBoundaryReady =
    !expectsBoundary ||
    (Boolean(document.querySelector('[data-smoke="non-english-core-only-boundary"]')) &&
      bodyText.includes("公开版只开放音标") &&
      bodyText.includes("去音标练习") &&
      bodyText.includes("去自由练习") &&
      !bodyText.includes("实验训练"));
  const visibleButtons = [...document.querySelectorAll("button,a")].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const buttonTextReadable = visibleButtons.every((element) => {
    const style = window.getComputedStyle(element);
    return style.textOverflow !== "ellipsis";
  });
  return {
    ok:
      bodyText.trim().length > 20 &&
      sentenceHooksReady &&
      assessmentHooksReady &&
      prosodyHooksReady &&
      perceptionHooksReady &&
      coreBoundaryReady &&
      buttonTextReadable &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
    coreBoundaryReady,
    buttonTextReadable,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
      );
      if (!result?.ok) {
        throw new Error(
          `Narrow route smoke failed for ${route.path}: ${JSON.stringify(
            result,
          )}`,
        );
      }
    }
  } finally {
    await clearViewport(cdp);
  }
}

async function assertLowHeightViewportRoutes(cdp) {
  await setViewport(cdp, 980, 560);
  try {
    await assertSettings(cdp);
    const settingsResult = await evaluate(
      cdp,
      `
(() => ({
  ok:
    window.innerHeight === 560 &&
    document.documentElement.scrollWidth <= window.innerWidth + 24,
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  bodyText: (document.body?.innerText ?? "").slice(0, 800)
}))()
`,
    );
    if (!settingsResult?.ok) {
      throw new Error(
        `Low-height settings smoke failed: ${JSON.stringify(settingsResult)}`,
      );
    }

    await assertEnglishTransferRoutes(cdp);
    await assertEnglishCoreDrillRoutes(cdp);
    await assertAdvancedDirectRoutes(cdp);
    await clickLanguage(cdp, "ru-RU");
    await navigate(
      cdp,
      "/phonemes/ru-t-tj",
      '[data-smoke="phoneme-detail-page"]',
    );

    const detailResult = await evaluate(
      cdp,
      `
(() => {
  const targets = [
    ...document.querySelectorAll('[data-smoke="practice-primary-text"]'),
    ...document.querySelectorAll('[data-smoke="practice-secondary-text"]'),
    ...document.querySelectorAll('[data-smoke="video-selector"] button span')
  ];
  const readable = targets.every((element) => {
    const style = window.getComputedStyle(element);
    return (
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      element.scrollWidth <= element.clientWidth + 2
    );
  });
  const controls = [...document.querySelectorAll('[data-smoke="practice-controls"] button')];
  const rects = controls.map((button) => button.getBoundingClientRect());
  const controlsDoNotOverlap = rects.every((rect, index) =>
    rects.every((other, otherIndex) => {
      if (index >= otherIndex) return true;
      return (
        rect.right <= other.left ||
        other.right <= rect.left ||
        rect.bottom <= other.top ||
        other.bottom <= rect.top
      );
    })
  );
  const breakdownSmokeElement =
    document.querySelector('[data-smoke="assessment-breakdown-placeholder"]') ||
    document.querySelector('[data-smoke="assessment-target-ipa-reference"]');
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const breakdownViewportSmokeReady = Boolean(breakdownSmokeElement) && (() => {
    const style = window.getComputedStyle(breakdownSmokeElement);
    const text = breakdownSmokeElement.innerText.trim();
    return (
      hasVisibleRect(breakdownSmokeElement) &&
      text.length > 0 &&
      style.textOverflow !== "ellipsis" &&
      style.whiteSpace !== "nowrap" &&
      style.webkitLineClamp !== "1" &&
      breakdownSmokeElement.scrollWidth <= breakdownSmokeElement.clientWidth + 2
    );
  })();
  return {
    ok:
      window.innerHeight === 560 &&
      readable &&
      controlsDoNotOverlap &&
      document.documentElement.scrollWidth <= window.innerWidth + 24 &&
      breakdownViewportSmokeReady,
    targetCount: targets.length,
    readable,
    controlsDoNotOverlap,
    breakdownViewportSmokeReady,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: (document.body?.innerText ?? "").slice(0, 800)
  };
})()
`,
    );
    if (!detailResult?.ok) {
      throw new Error(
        `Low-height detail smoke failed: ${JSON.stringify(detailResult)}`,
      );
    }

    await assertEnglishProgressArchive(cdp);
    await clickLanguage(cdp, "fr-FR");

    for (const route of [
      {
        path: "/drill",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/drill/prosody",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/drill/perception",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
      {
        path: "/assessment",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
      {
        path: "/progress",
        selector: '[data-smoke="non-english-core-only-boundary"]',
        direct: true,
        boundary: true,
      },
    ]) {
      await navigate(cdp, route.path, route.selector, route);
      const result = await evaluate(
        cdp,
        `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const routePath = ${JSON.stringify(route.path)};
  const expectsBoundary = ${JSON.stringify(Boolean(route.boundary))};
  const sentenceCard = document.querySelector('[data-smoke="sentence-input-card"]');
  const sentenceColumn = document.querySelector('[data-smoke="free-practice-left-column"]');
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(sentenceCard) &&
      Boolean(sentenceColumn) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')) &&
      window.getComputedStyle(sentenceCard).flexShrink === "0" &&
      window.getComputedStyle(sentenceCard).overflow !== "hidden" &&
      (window.innerWidth < 1024 || window.getComputedStyle(sentenceColumn).overflowY === "auto"));
  const assessmentHooksReady =
    expectsBoundary ||
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    expectsBoundary ||
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    expectsBoundary ||
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
  const coreBoundaryReady =
    !expectsBoundary ||
    (Boolean(document.querySelector('[data-smoke="non-english-core-only-boundary"]')) &&
      bodyText.includes("公开版只开放音标") &&
      bodyText.includes("去音标练习") &&
      bodyText.includes("去自由练习") &&
      !bodyText.includes("实验训练"));
  const visibleInteractive = [...document.querySelectorAll("button,a")].filter((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const interactiveTextReadable = visibleInteractive.every((element) => {
    const style = window.getComputedStyle(element);
    return style.textOverflow !== "ellipsis";
  });
  return {
    ok:
      window.innerHeight === 560 &&
      bodyText.trim().length > 20 &&
      sentenceHooksReady &&
      assessmentHooksReady &&
      prosodyHooksReady &&
      perceptionHooksReady &&
      coreBoundaryReady &&
      interactiveTextReadable &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
    coreBoundaryReady,
    interactiveTextReadable,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
      );
      if (!result?.ok) {
        throw new Error(
          `Low-height route smoke failed for ${route.path}: ${JSON.stringify(
            result,
          )}`,
        );
      }
    }
  } finally {
    await clearViewport(cdp);
  }
}

async function assertLabsScoringTileBoundary(cdp) {
  for (const fixture of [
    { languageId: "es-ES", route: "/phonemes/es-a" },
    { languageId: "ru-RU", route: "/phonemes/ru-a" },
  ]) {
    await clickLanguage(cdp, fixture.languageId);
    await forceNavigate(cdp, `${fixture.route}?smokeAssessmentTiles=1`);
    const result = await waitForCondition(
      cdp,
      `
(() => {
  const placeholder = document.querySelector('[data-smoke="assessment-breakdown-placeholder"]');
  const bodyText = document.body?.innerText ?? "";
  return {
    ok:
      window.location.pathname === ${JSON.stringify(fixture.route)} &&
      window.location.search.includes("smokeAssessmentTiles=1") &&
      document.readyState !== "loading" &&
      Boolean(placeholder) &&
      bodyText.includes("Labs 仅显示整体与词级观测，不展示未校准的音素细分") &&
      !document.querySelector('[data-smoke="assessment-phoneme-tile-fixture"]') &&
      document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]').length === 0,
    placeholder: placeholder?.textContent ?? "",
    tileCount: document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]').length,
    bodyText: bodyText.slice(0, 800)
  };
})()
`,
      `${fixture.languageId} calibrated scoring-detail boundary`,
    );
    if (!result?.ok) {
      throw new Error(
        `${fixture.languageId} scoring-detail boundary failed: ${JSON.stringify(
          result,
        )}`,
      );
    }
  }
}

async function assertDesktopTtsScreenshotLayout(cdp, requireReplay) {
  const result = await evaluate(
    cdp,
    `
(() => {
  const requireReplay = ${JSON.stringify(requireReplay)};
  const inputCard = document.querySelector('[data-smoke="sentence-input-card"]');
  const recordingCard = document.querySelector('[data-smoke="sentence-recording-card"]');
  const leftColumn = document.querySelector('[data-smoke="free-practice-left-column"]');
  const output = document.querySelector('[data-smoke="free-practice-tts-output"]');
  const replay = document.querySelector('[data-smoke="free-practice-tts-replay"]');
  const readAlong = document.querySelector('[data-smoke="read-along-text"]');
  if (!inputCard || !recordingCard || !leftColumn || !output || !readAlong) {
    return {
      ok: false,
      reason: "missing-free-practice-elements",
      hasInputCard: Boolean(inputCard),
      hasRecordingCard: Boolean(recordingCard),
      hasLeftColumn: Boolean(leftColumn),
      hasOutput: Boolean(output),
      hasReadAlong: Boolean(readAlong)
    };
  }

  const intersects = (first, second) =>
    Math.max(first.left, second.left) < Math.min(first.right, second.right) - 0.5 &&
    Math.max(first.top, second.top) < Math.min(first.bottom, second.bottom) - 0.5;
  const inputRect = inputCard.getBoundingClientRect();
  const recordingRect = recordingCard.getBoundingClientRect();
  const cardsDoNotOverlap = !intersects(inputRect, recordingRect);
  const wordRects = [...output.querySelectorAll('[data-word-index]')].map((word) =>
    word.getBoundingClientRect()
  );
  const replayRect = replay?.getBoundingClientRect() ?? null;
  const replayDoesNotCoverText =
    !requireReplay ||
    (Boolean(replayRect) && wordRects.every((wordRect) => !intersects(replayRect, wordRect)));

  const previousScrollTop = leftColumn.scrollTop;
  leftColumn.scrollTop = leftColumn.scrollHeight;
  const maxScrollTop = leftColumn.scrollTop;
  const scrolledRecordingRect = recordingCard.getBoundingClientRect();
  const leftRect = leftColumn.getBoundingClientRect();
  const visibleRecordingHeight = Math.max(
    0,
    Math.min(scrolledRecordingRect.bottom, leftRect.bottom) -
      Math.max(scrolledRecordingRect.top, leftRect.top)
  );
  leftColumn.scrollTop = previousScrollTop;

  const scrollRange = leftColumn.scrollHeight - leftColumn.clientHeight;
  const leftColumnStyle = window.getComputedStyle(leftColumn);
  const leftColumnCanReachRecording =
    (scrollRange <= 1 || maxScrollTop > 0) && visibleRecordingHeight > 20;
  const inputCardStyle = window.getComputedStyle(inputCard);
  const noHorizontalOverflow =
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;

  return {
    ok:
      cardsDoNotOverlap &&
      replayDoesNotCoverText &&
      noHorizontalOverflow &&
      leftColumnCanReachRecording &&
      inputCardStyle.flexShrink === "0" &&
      inputCardStyle.overflow !== "hidden" &&
      (scrollRange <= 1 || leftColumnStyle.overflowY === "auto"),
    cardsDoNotOverlap,
    replayDoesNotCoverText,
    replayFound: Boolean(replay),
    wordCount: wordRects.length,
    noHorizontalOverflow,
    leftColumnCanReachRecording,
    visibleRecordingHeight,
    scrollRange,
    maxScrollTop,
    leftColumnOverflowY: leftColumnStyle.overflowY,
    inputCardFlexShrink: inputCardStyle.flexShrink,
    inputCardOverflow: inputCardStyle.overflow,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(
      `Desktop free-practice TTS layout failed: ${JSON.stringify(result)}`,
    );
  }
}

async function startDesktopTtsScreenshotPlayback(cdp, width, height) {
  await setViewport(cdp, width, height);
  await forceNavigate(cdp, "/sentences");
  await waitForCondition(
    cdp,
    `
(() => ({
  ok:
    window.location.pathname === "/sentences" &&
    window.innerWidth === ${width} &&
    window.innerHeight === ${height} &&
    !!document.querySelector('[data-smoke="sentences-page"]') &&
    !!document.querySelector('[data-smoke="sentence-input-card"]') &&
    !!document.querySelector('[data-smoke="sentence-recording-card"]'),
  pathname: window.location.pathname,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  bodyText: (document.body?.innerText ?? "").slice(0, 500)
}))()
`,
    `desktop TTS screenshot page at ${width}x${height}`,
  );

  const prepared = await evaluate(
    cdp,
    `
(async () => {
  const text = ${JSON.stringify(desktopTtsScreenshotText)};
  const expectedAudioSrc = ${JSON.stringify(desktopTtsScreenshotAudioSrc)};
  const manifestResponse = await fetch("/audio/language-packs/es-ES/manifest.json");
  if (!manifestResponse.ok) {
    return { ok: false, reason: "manifest-unavailable", status: manifestResponse.status };
  }
  const manifest = await manifestResponse.json();
  const item = Array.isArray(manifest.items)
    ? manifest.items.find((entry) => entry.text === text && entry.audioSrc === expectedAudioSrc)
    : null;
  if (!item) {
    return { ok: false, reason: "fixture-not-in-manifest" };
  }
  const audioResponse = await fetch(expectedAudioSrc);
  const audioBlob = audioResponse.ok ? await audioResponse.blob() : null;
  if (!audioResponse.ok || !audioBlob || audioBlob.size < 1000) {
    return {
      ok: false,
      reason: "fixture-audio-unavailable",
      status: audioResponse.status,
      bytes: audioBlob?.size ?? 0
    };
  }

  const textarea = document.querySelector('textarea[placeholder="输入单词或句子"]');
  if (!textarea) return { ok: false, reason: "missing-textarea" };
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  if (!valueSetter) return { ok: false, reason: "missing-value-setter" };
  valueSetter.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, bytes: audioBlob.size };
})()
`,
  );
  if (!prepared?.ok) {
    throw new Error(
      `Desktop TTS screenshot fixture was not ready: ${JSON.stringify(prepared)}`,
    );
  }

  const listenTarget = await waitForCondition(
    cdp,
    `
(() => {
  const textarea = document.querySelector('textarea[placeholder="输入单词或句子"]');
  const button = document.querySelector('[data-smoke="free-practice-listen-control"]');
  const rect = button?.getBoundingClientRect();
  const ok =
    textarea?.value === ${JSON.stringify(desktopTtsScreenshotText)} &&
    Boolean(button) &&
    !button.disabled &&
    Boolean(rect && rect.width > 0 && rect.height > 0);
  return {
    ok,
    value: textarea?.value ?? "",
    disabled: button?.disabled ?? null,
    x: rect ? rect.left + rect.width / 2 : 0,
    y: rect ? rect.top + rect.height / 2 : 0
  };
})()
`,
    "desktop TTS listen control to become ready",
  );
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: listenTarget.x,
    y: listenTarget.y,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: listenTarget.x,
    y: listenTarget.y,
    button: "left",
    clickCount: 1,
  });
  await cdp.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: listenTarget.x,
    y: listenTarget.y,
    button: "left",
    clickCount: 1,
  });

  await waitForCondition(
    cdp,
    `
(() => {
  const card = document.querySelector('[data-smoke="sentence-input-card"]');
  const readAlong = document.querySelector('[data-smoke="read-along-text"]');
  const status = document.querySelector('[data-smoke="read-along-untimed-status"]');
  return {
    ok:
      card?.getAttribute("data-tts-state") === "playing" &&
      readAlong?.getAttribute("data-playback-mode") === "sentence-untimed" &&
      readAlong?.getAttribute("data-playing") === "true" &&
      status?.textContent?.includes("整句播放中"),
    state: card?.getAttribute("data-tts-state"),
    playbackMode: readAlong?.getAttribute("data-playback-mode"),
    playing: readAlong?.getAttribute("data-playing"),
    status: status?.textContent ?? "",
    error: document.querySelector('[data-smoke="free-practice-tts-error"]')?.textContent ?? ""
  };
})()
`,
    "desktop untimed TTS playback to start",
  );
  await delay(350);
}

async function captureDesktopTtsScreenshots(cdp, outputDir) {
  const fixturePath = path.join(
    root,
    "public",
    desktopTtsScreenshotAudioSrc.replace(/^\//, "").replaceAll("/", path.sep),
  );
  if (!existsSync(fixturePath)) {
    throw new Error(
      `Desktop TTS screenshot fixture is missing: ${fixturePath}`,
    );
  }

  await mkdir(outputDir, { recursive: true });
  await clickLanguage(cdp, "es-ES");
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  const files = [];
  try {
    for (const { width, height } of desktopTtsScreenshotViewports) {
      await startDesktopTtsScreenshotPlayback(cdp, width, height);
      await assertDesktopTtsScreenshotLayout(cdp, false);

      const playingFile = path.join(
        outputDir,
        `desktop-free-practice-tts-playing-${width}x${height}.png`,
      );
      await captureViewportPng(cdp, playingFile);
      files.push(playingFile);

      await waitForCondition(
        cdp,
        `
(() => {
  const card = document.querySelector('[data-smoke="sentence-input-card"]');
  const readAlong = document.querySelector('[data-smoke="read-along-text"]');
  const replay = document.querySelector('[data-smoke="free-practice-tts-replay"]');
  return {
    ok:
      card?.getAttribute("data-tts-state") === "ready" &&
      readAlong?.getAttribute("data-playing") === "false" &&
      Boolean(replay),
    state: card?.getAttribute("data-tts-state"),
    playing: readAlong?.getAttribute("data-playing"),
    replayFound: Boolean(replay),
    error: document.querySelector('[data-smoke="free-practice-tts-error"]')?.textContent ?? ""
  };
})()
`,
        "desktop untimed TTS playback to finish",
      );
      await delay(300);
      await assertDesktopTtsScreenshotLayout(cdp, true);

      const completedFile = path.join(
        outputDir,
        `desktop-free-practice-tts-complete-${width}x${height}.png`,
      );
      await captureViewportPng(cdp, completedFile);
      files.push(completedFile);
    }
  } finally {
    await cdp
      .send("Emulation.setEmulatedMedia", { features: [] })
      .catch(() => {});
    await clearViewport(cdp).catch(() => {});
  }
  return files;
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
  const alreadyRunning = await findConflictingSpeakRightProcesses(exe);
  if (alreadyRunning.length > 0) {
    throw new Error(
      `The desktop UI smoke executable is already running. Close only that test instance before retrying: ${formatSpeakRightProcessConflicts(alreadyRunning)}`,
    );
  }

  const debuggingPort =
    process.platform === "win32"
      ? await getOpenPort(
          Number.isInteger(desktopSmokeDebuggingPortOverride) &&
            desktopSmokeDebuggingPortOverride > 0 &&
            desktopSmokeDebuggingPortOverride <= 65_535
            ? desktopSmokeDebuggingPortOverride
            : 0,
        )
      : null;
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
    if (desktopTtsOnly) {
      if (!desktopTtsScreenshotDir) {
        throw new Error(
          "SPEAKRIGHT_DESKTOP_TTS_SCREENSHOT_DIR is required in TTS-only smoke mode.",
        );
      }
      const ttsScreenshots = await captureDesktopTtsScreenshots(
        cdp,
        desktopTtsScreenshotDir,
      );
      console.log(
        [
          "Desktop free-practice TTS smoke passed:",
          `pid=${child.pid}`,
          "geometry=ok",
          "untimedPlayback=ok",
          `screenshots=${ttsScreenshots
            .map((file) => path.basename(file))
            .join(",")}`,
          "paidTtsRequests=0",
        ].join(" "),
      );
      return;
    }
    await assertSettingsWheelScroll(cdp);
    await assertSettings(cdp);

    const details = [];
    for (const language of languageChecks) {
      details.push(await assertDetail(cdp, language));
    }
    await assertPhonemeLeftColumnFitsLaunchHeight(cdp);
    const hiddenRuleRoutes = [];
    for (const check of hiddenRuleRouteChecks) {
      hiddenRuleRoutes.push(await assertHiddenRuleRouteBlocked(cdp, check));
    }
    const sidebarPurity = [];
    for (const check of phonemePracticeSidebarChecks) {
      sidebarPurity.push(await assertPhonemePracticeSidebarPurity(cdp, check));
    }
    await assertLabsScoringTileBoundary(cdp);
    await assertEnglishProgressArchive(cdp);
    await assertEnglishTransferRoutes(cdp);
    await assertEnglishCoreDrillRoutes(cdp);
    await assertAdvancedDirectRoutes(cdp);
    await clickLanguage(cdp, "fr-FR");
    await assertMainRoutes(cdp);
    await assertNarrowViewportRoutes(cdp);
    await assertLowHeightViewportRoutes(cdp);
    await assertCorruptLocalDataWarnings(cdp);
    const ttsScreenshots = desktopTtsScreenshotDir
      ? await captureDesktopTtsScreenshots(cdp, desktopTtsScreenshotDir)
      : [];
    await clickLanguage(cdp, originalLanguageId);

    console.log(
      [
        "Desktop UI smoke passed:",
        `pid=${child.pid}`,
        `settings=ok`,
        "settingsWheel=ok",
        `details=${details
          .map((item) => `${item.languageId}:${item.slug}`)
          .join(",")}`,
        "phonemeLeftColumn=ok",
        `hiddenRuleRoutes=ok(${hiddenRuleRoutes
          .map((item) => `${item.languageId}:${item.slug}`)
          .join(",")})`,
        `phonemePracticeSidebar=ok(${sidebarPurity
          .map((item) => item.languageId)
          .join(",")})`,
        `routes=${smokeSummaryRoutes.join(",")}`,
        "labsScoringTileBoundary=ok",
        "englishTransferRoutes=ok",
        "englishCoreDrillRoutes=ok",
        "advancedDirectRoutes=ok",
        "corruptLocalDataWarnings=ok",
        "practiceAudioLabels=ok",
        "freePracticeSmoke=ok",
        "assessmentSmoke=ok",
        "narrowViewport=ok",
        "lowHeightViewport=ok",
        ...(ttsScreenshots.length > 0
          ? [
              `desktopTtsScreenshots=${ttsScreenshots
                .map((file) => path.basename(file))
                .join(",")}`,
            ]
          : []),
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
