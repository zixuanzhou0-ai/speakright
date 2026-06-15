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
    slug: "es-lexical-stress",
    route: "/phonemes/es-lexical-stress",
    label: "西班牙语词重音",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "es-ES",
    slug: "es-syllable-rhythm",
    route: "/phonemes/es-syllable-rhythm",
    label: "西班牙语音节节奏",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
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
    languageId: "fr-FR",
    slug: "fr-liaison",
    route: "/phonemes/fr-liaison",
    label: "法语 liaison",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "fr-FR",
    slug: "fr-enchainement",
    route: "/phonemes/fr-enchainement",
    label: "法语 enchainement",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "fr-FR",
    slug: "fr-elision",
    route: "/phonemes/fr-elision",
    label: "法语 elision",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "fr-FR",
    slug: "fr-final-consonant-silence",
    route: "/phonemes/fr-final-consonant-silence",
    label: "法语词尾静音",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
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
    slug: "ru-stress-reduction",
    route: "/phonemes/ru-stress-reduction",
    label: "俄语重音弱化",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-unstressed-o-a",
    route: "/phonemes/ru-unstressed-o-a",
    label: "俄语非重读 O/A",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-unstressed-e-ya",
    route: "/phonemes/ru-unstressed-e-ya",
    label: "俄语非重读 E/Я",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-iotated-vowels",
    route: "/phonemes/ru-iotated-vowels",
    label: "俄语带 /j/ 元音",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-final-devoicing",
    route: "/phonemes/ru-final-devoicing",
    label: "俄语词尾清化",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-voicing-assimilation",
    route: "/phonemes/ru-voicing-assimilation",
    label: "俄语清浊同化",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
  },
  {
    languageId: "ru-RU",
    slug: "ru-clusters",
    route: "/phonemes/ru-clusters",
    label: "俄语辅音丛",
    expectHeaderAudio: false,
    expectPracticeAudioLabelIncludes: "规则",
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
    !!document.querySelector('[data-smoke="phoneme-detail-page"]'),
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
    throw new Error(`English progress archive smoke failed: ${JSON.stringify(result)}`);
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

async function assertSettings(cdp) {
  await navigate(cdp, "/settings", '[data-smoke="settings-page"]');
  await seedSettingsSmokeData(cdp);
  const result = await evaluate(
    cdp,
    `
(() => {
  const bodyText = document.body?.innerText ?? "";
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
  const settingsActionRows = [
    ...document.querySelectorAll(
      '[data-smoke="azure-config-actions"], [data-smoke="tts-config-actions"], [data-smoke="llm-config-actions"]'
    ),
  ];
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
      settingsActionRowsWrap &&
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
    settingsActionRowCount: settingsActionRows.length,
    settingsActionRowsWrap,
    llmProviderLabels,
    llmProvidersWrap,
    bodyText: bodyText.slice(0, 1200)
  };
})()
`,
  );
  if (!result?.ok) {
    throw new Error(`Settings UI smoke failed: ${result?.bodyText ?? ""}`);
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
        ariaLabel.includes("发音") &&
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

async function assertScoringTileAudioPolicy(cdp) {
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
  const tiles = [...document.querySelectorAll('[data-smoke="assessment-phoneme-tile"]')];
  const hasVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const tilePolicies = tiles.map((tile) => {
    const maxDurationMs = Number(tile.getAttribute("data-audio-max-duration-ms") ?? 0);
    const fadeOutMs = Number(tile.getAttribute("data-audio-fade-out-ms") ?? 0);
    const audioSrc = tile.getAttribute("data-audio-src") ?? "";
    const playable = tile.getAttribute("data-audio-playable") === "true";
    const ariaDisabled = tile.getAttribute("aria-disabled") === "true";
    const ariaLabel = tile.getAttribute("aria-label") ?? "";
    const kind = tile.getAttribute("data-audio-kind") ?? "none";
    const isHeaderClip =
      /^\\/audio\\/language-assets\\/es-ES\\/header-clips\\/.+\\.m4a$/i.test(audioSrc);

    return {
      hasVisibleRect: hasVisibleRect(tile),
      playable,
      ariaDisabled,
      ariaLabel,
      kind,
      audioSrc,
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
      tile.kind === "none" &&
      tile.audioSrc === "" &&
      tile.maxDurationMs === 0 &&
      tile.fadeOutMs === 0 &&
      tile.ariaLabel === "",
  );
  const tilePoliciesAreStrict = tilePolicies.every((tile) => {
    if (!tile.hasVisibleRect || tile.isVideo || tile.isLanguagePack) return false;
    if (!tile.playable) {
      return (
        tile.ariaDisabled &&
        tile.kind === "none" &&
        tile.audioSrc === "" &&
        tile.maxDurationMs === 0 &&
        tile.fadeOutMs === 0 &&
        tile.ariaLabel === ""
      );
    }
    return (
      !tile.ariaDisabled &&
      tile.ariaLabel.includes("播放音标") &&
      tile.kind === "sound-unit" &&
      tile.isHeaderClip &&
      tile.maxDurationMs > 0 &&
      tile.maxDurationMs <= 560 &&
      tile.fadeOutMs > 0
    );
  });
  const tileAudioPolicyReady =
    Boolean(fixture) &&
    tiles.length >= 2 &&
    hasPlayableExactHeaderClip &&
    hasLockedUnverifiedTile &&
    tilePoliciesAreStrict;
  return {
    ok: tileAudioPolicyReady,
    tileCount: tiles.length,
    tileAudioPolicyReady,
    hasPlayableExactHeaderClip,
    hasLockedUnverifiedTile,
    tilePoliciesAreStrict,
    tileAudio: tiles.map((tile) => ({
      kind: tile.getAttribute("data-audio-kind"),
      src: tile.getAttribute("data-audio-src"),
      maxDurationMs: tile.getAttribute("data-audio-max-duration-ms"),
      fadeOutMs: tile.getAttribute("data-audio-fade-out-ms"),
      playable: tile.getAttribute("data-audio-playable"),
      ariaDisabled: tile.getAttribute("aria-disabled"),
      ariaLabel: tile.getAttribute("aria-label")
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
}

async function assertMainRoutes(cdp) {
  const routes = [
    { path: "/drill", selector: '[data-smoke="drill-page"]' },
    {
      path: "/drill/prosody",
      selector: '[data-smoke="prosody-page"]',
      direct: true,
    },
    {
      path: "/drill/perception",
      selector: '[data-smoke="perception-experimental-blocker"]',
      direct: true,
    },
    { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
    { path: "/assessment", selector: '[data-smoke="assessment-page"]' },
    {
      path: "/progress",
      selector: '[data-smoke="progress-experimental-blocker"]',
      direct: true,
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
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-input-card"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')));
  const assessmentHooksReady =
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
  return {
    ok:
      bodyText.trim().length > 20 &&
      sentenceHooksReady &&
      assessmentHooksReady &&
      prosodyHooksReady &&
      perceptionHooksReady &&
      !bodyText.includes("Merriam-Webster") &&
      !bodyText.includes("多语言发音包") &&
      !bodyText.includes("无法访问此页面"),
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
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

async function assertNarrowViewportRoutes(cdp) {
  await setViewport(cdp, 760, 720);
  try {
    await assertSettings(cdp);
    await clickLanguage(cdp, "fr-FR");
    await navigate(
      cdp,
      "/phonemes/fr-liaison",
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
      { path: "/drill", selector: '[data-smoke="drill-page"]' },
      {
        path: "/drill/prosody",
        selector: '[data-smoke="prosody-page"]',
        direct: true,
      },
      {
        path: "/drill/perception",
        selector: '[data-smoke="perception-experimental-blocker"]',
        direct: true,
      },
      { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
      { path: "/assessment", selector: '[data-smoke="assessment-page"]' },
      {
        path: "/progress",
        selector: '[data-smoke="progress-experimental-blocker"]',
        direct: true,
      },
    ]) {
      await navigate(cdp, route.path, route.selector, route);
      const result = await evaluate(
        cdp,
        `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const routePath = ${JSON.stringify(route.path)};
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-input-card"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')));
  const assessmentHooksReady =
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
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
      buttonTextReadable &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
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

    await clickLanguage(cdp, "ru-RU");
    await navigate(
      cdp,
      "/phonemes/ru-clusters",
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
      { path: "/drill", selector: '[data-smoke="drill-page"]' },
      {
        path: "/drill/prosody",
        selector: '[data-smoke="prosody-page"]',
        direct: true,
      },
      {
        path: "/drill/perception",
        selector: '[data-smoke="perception-experimental-blocker"]',
        direct: true,
      },
      { path: "/sentences", selector: '[data-smoke="sentences-page"]' },
      { path: "/assessment", selector: '[data-smoke="assessment-page"]' },
      {
        path: "/progress",
        selector: '[data-smoke="progress-experimental-blocker"]',
        direct: true,
      },
    ]) {
      await navigate(cdp, route.path, route.selector, route);
      const result = await evaluate(
        cdp,
        `
(() => {
  const bodyText = document.body?.innerText ?? "";
  const routePath = ${JSON.stringify(route.path)};
  const sentenceHooksReady =
    routePath !== "/sentences" ||
    (Boolean(document.querySelector('[data-smoke="sentences-page"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-input-card"]')) &&
      Boolean(document.querySelector('[data-smoke="sentence-recording-card"]')));
  const assessmentHooksReady =
    routePath !== "/assessment" ||
    (Boolean(document.querySelector('[data-smoke="assessment-page"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-intro-card"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-start-button"]')) &&
      Boolean(document.querySelector('[data-smoke="assessment-passage-link"]')));
  const prosodyHooksReady =
    routePath !== "/drill/prosody" ||
    (Boolean(document.querySelector('[data-smoke="prosody-page"]')) &&
      Boolean(document.querySelector('[data-smoke="prosody-exercise-header"]')));
  const perceptionHooksReady =
    routePath !== "/drill/perception" ||
    (Boolean(document.querySelector('[data-smoke="perception-page"]')) &&
      Boolean(document.querySelector('[data-smoke="perception-experimental-blocker"]')));
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
      interactiveTextReadable &&
      document.documentElement.scrollWidth <= window.innerWidth + 24,
    sentenceHooksReady,
    assessmentHooksReady,
    prosodyHooksReady,
    perceptionHooksReady,
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
    await assertScoringTileAudioPolicy(cdp);
    await assertEnglishProgressArchive(cdp);
    await clickLanguage(cdp, "fr-FR");
    await assertMainRoutes(cdp);
    await assertNarrowViewportRoutes(cdp);
    await assertLowHeightViewportRoutes(cdp);
    await clickLanguage(cdp, originalLanguageId);

    console.log(
      [
        "Desktop UI smoke passed:",
        `pid=${child.pid}`,
        `settings=ok`,
        `details=${details
          .map((item) => `${item.languageId}:${item.slug}`)
          .join(",")}`,
        "routes=/drill,/drill/prosody,/drill/perception,/sentences,/assessment,/progress",
        "scoringTileAudioPolicy=ok",
        "practiceAudioLabels=ok",
        "freePracticeSmoke=ok",
        "assessmentSmoke=ok",
        "narrowViewport=ok",
        "lowHeightViewport=ok",
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
