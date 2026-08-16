import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { releaseEvidenceAssetSet } from "./lib/release-evidence-assets.mjs";
import {
  DESKTOP_EVIDENCE_BROWSER_ARGUMENTS,
  DESKTOP_EVIDENCE_VIEWPORTS,
  EXAMPLE_SCORE_DISCLOSURE,
  evidenceBannerExpression,
  FREE_PRACTICE_DEMO_TEXT,
  RELEASE_EVIDENCE_SHOTS,
  RELEASE_EVIDENCE_VERSION,
  storageSeedExpression,
} from "./lib/release-evidence-fixtures.mjs";
import {
  releaseEvidenceGeneratorDigest,
  releaseEvidenceGeneratorGitProvenance,
  releaseEvidenceGitProvenance,
  releaseEvidenceSourceDigest,
} from "./lib/release-evidence-source-digest.mjs";
import {
  findConflictingSpeakRightProcesses,
  formatSpeakRightProcessConflicts,
} from "./lib/windows-process-boundary.mjs";

const root = process.cwd();
const timeoutMs = 15_000;
const SETTINGS_STORE_FILE_NAME = "speakright-settings.json";
const evidenceTempRoot = path.join(
  path.dirname(root),
  `${path.basename(root)}ReleaseEvidenceTemp`,
);
const defaultOutputRoot = path.join(
  root,
  "docs",
  "assets",
  "screenshots",
  "release",
  `v${RELEASE_EVIDENCE_VERSION}`,
  "desktop",
);

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function defaultExecutablePath() {
  if (process.platform !== "win32") {
    throw new Error(
      "Desktop release evidence capture currently requires Windows WebView2.",
    );
  }
  return path.join(
    evidenceTempRoot,
    "desktop-target",
    "release",
    "speakright.exe",
  );
}

function defaultBuildManifestPath() {
  return path.join(
    evidenceTempRoot,
    "desktop-fixture-workspace",
    "build-manifest.json",
  );
}

function assertEvidenceTempPath(value, label) {
  const resolved = path.resolve(value);
  const relative = path.relative(evidenceTempRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside ${evidenceTempRoot}.`);
  }
  return resolved;
}

function assertOutputRoot(value) {
  const resolved = path.resolve(value);
  if (path.relative(defaultOutputRoot, resolved) !== "") {
    throw new Error(
      `Desktop evidence output must be exactly ${defaultOutputRoot}.`,
    );
  }
  return resolved;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function localWindowsPathIdentity(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    return null;
  }
  let candidate = value.replaceAll("/", "\\");
  const segments = candidate.split("\\").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  if (candidate.toLowerCase().startsWith("\\\\?\\unc\\")) {
    candidate = `\\\\${candidate.slice(8)}`;
  } else if (candidate.startsWith("\\\\?\\")) {
    candidate = candidate.slice(4);
  }
  if (
    candidate.startsWith("\\\\") ||
    candidate.startsWith("\\\\.\\") ||
    !/^[A-Za-z]:\\/u.test(candidate)
  ) {
    return null;
  }
  return path.win32.normalize(candidate).toLowerCase();
}

export function isExactWindowsSettingsStorePath(
  resolvedStorePath,
  canonicalSettingsDirectory,
) {
  const actual = localWindowsPathIdentity(resolvedStorePath);
  const directory = localWindowsPathIdentity(canonicalSettingsDirectory);
  if (!actual || !directory) return false;
  const expected = path.win32.join(directory, SETTINGS_STORE_FILE_NAME);
  return (
    actual === expected &&
    path.win32.dirname(actual) === directory &&
    path.win32.basename(actual) === SETTINGS_STORE_FILE_NAME
  );
}

async function assertCurrentSourceSnapshot(expected, expectedCommit) {
  const provenance = releaseEvidenceGitProvenance(
    root,
    "desktop",
    expectedCommit,
  );
  const current = await releaseEvidenceSourceDigest(root, "desktop");
  if (
    current.schemaVersion !== expected.schemaVersion ||
    current.sha256 !== expected.sha256 ||
    current.fileCount !== expected.fileCount
  ) {
    throw new Error(
      "Desktop source changed after the isolated evidence build; rebuild before capture.",
    );
  }
  return provenance;
}

function pngDimensions(buffer) {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Captured evidence is not a PNG image.");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function assertCurrentAssetSet(expected, expectedCommit) {
  const current = (
    await releaseEvidenceAssetSet(root, "desktop", expectedCommit)
  ).summary;
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(
      "Desktop tracked release asset set changed after the isolated evidence build; rebuild before capture.",
    );
  }
  return current;
}

async function assertCurrentGeneratorSnapshot(expected, expectedCommit) {
  releaseEvidenceGeneratorGitProvenance(root, expectedCommit);
  const current = await releaseEvidenceGeneratorDigest(root);
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(
      "Release-evidence generator snapshot changed; rebuild first.",
    );
  }
  return current;
}

function buildEnv(profileRoot, credentialNamespace, logDir, settingsStorePath) {
  const sensitiveName =
    /API.?KEY|TOKEN|SECRET|PASSWORD|AZURE|ELEVEN|OPENAI|ANTHROPIC|GEMINI|GOOGLE|VERTEX|XAI|GROK|HERMES|GCLOUD|PROXY/i;
  const sanitizedEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !sensitiveName.test(name)),
  );
  delete sanitizedEnvironment.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS;
  delete sanitizedEnvironment.WEBVIEW2_USER_DATA_FOLDER;
  return {
    ...sanitizedEnvironment,
    SPEAKRIGHT_LOG_DIR: logDir,
    SPEAKRIGHT_RELEASE_EVIDENCE_CAPTURE: "1",
    SPEAKRIGHT_SECURE_STORE_SERVICE: credentialNamespace,
    SPEAKRIGHT_SETTINGS_STORE_PATH: settingsStorePath,
    WEBVIEW2_USER_DATA_FOLDER: path.join(profileRoot, "WebView2"),
  };
}

async function waitForRuntimeLog(logDir) {
  const logPath = path.join(logDir, "speakright.log");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const contents = await readFile(logPath, "utf8");
      if (contents.includes("SpeakRight desktop runtime initialized")) {
        return true;
      }
    } catch {
      // The logger may not have created or flushed its first entry yet.
    }
    await delay(200);
  }
  throw new Error("Desktop evidence did not initialize its isolated TEMP log.");
}

async function waitForDevtoolsTarget(profileRoot, childState) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  const portFile = path.join(
    profileRoot,
    "WebView2",
    "EBWebView",
    "DevToolsActivePort",
  );
  while (Date.now() < deadline) {
    if (childState.error) {
      throw new Error(
        `Desktop evidence process failed to start: ${childState.error.message}`,
      );
    }
    if (childState.exited) {
      throw new Error(
        `Desktop evidence process exited before WebView2 was ready (code=${String(childState.code)}, signal=${String(childState.signal)}).`,
      );
    }
    try {
      const document = await readFile(portFile, "utf8");
      const [portLine] = document.trim().split(/\r?\n/);
      const debuggingPort = Number(portLine);
      if (
        !Number.isInteger(debuggingPort) ||
        debuggingPort < 1 ||
        debuggingPort > 65_535
      ) {
        throw new Error(
          "WebView2 DevToolsActivePort contained an invalid port.",
        );
      }
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
    const listeners = new Map();
    let nextId = 1;
    let opened = false;

    const rejectPending = (error) => {
      for (const command of pending.values()) command.reject(error);
      pending.clear();
    };

    socket.addEventListener("open", () => {
      opened = true;
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((resolveCommand, rejectCommand) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectCommand(new Error(`CDP command timed out: ${method}`));
            }, 10_000);
            pending.set(id, {
              resolve(value) {
                clearTimeout(timeout);
                resolveCommand(value);
              },
              reject(error) {
                clearTimeout(timeout);
                rejectCommand(error);
              },
            });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          socket.close();
        },
        on(method, handler) {
          const handlers = listeners.get(method) ?? new Set();
          handlers.add(handler);
          listeners.set(method, handlers);
          return () => handlers.delete(handler);
        },
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(normalizeWebSocketData(event.data));
      if (!message.id && message.method) {
        for (const handler of listeners.get(message.method) ?? []) {
          handler(message.params ?? {});
        }
        return;
      }
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
    const exception = result.exceptionDetails.exception;
    throw new Error(
      `Desktop evidence evaluation failed: ${
        exception?.description ??
        exception?.value ??
        result.exceptionDetails.text ??
        "unknown exception"
      }`,
    );
  }
  return result.result?.value;
}

async function waitForCondition(cdp, expression, label) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = null;
  while (Date.now() < deadline) {
    lastResult = await evaluate(cdp, expression);
    if (lastResult?.ok) return lastResult;
    await delay(200);
  }
  throw new Error(
    `Timed out waiting for ${label}: ${JSON.stringify(lastResult)}`,
  );
}

async function setViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(150);
}

async function seedStorage(cdp) {
  await evaluate(cdp, storageSeedExpression());
}

async function navigate(cdp, route, selector) {
  await seedStorage(cdp);
  const origin = await evaluate(cdp, "window.location.origin");
  await cdp.send("Page.navigate", { url: `${origin}${route}` });
  await waitForCondition(
    cdp,
    `
(() => ({
  releaseServedFromDevServer:
    (window.location.protocol === "http:" || window.location.protocol === "https:") &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname),
  ok:
    document.readyState !== "loading" &&
    window.location.pathname === ${JSON.stringify(route.split("?")[0])} &&
    Boolean(document.querySelector(${JSON.stringify(selector)})) &&
    !(
      (window.location.protocol === "http:" || window.location.protocol === "https:") &&
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    ),
  href: window.location.href,
  protocol: window.location.protocol,
  bodyText: (document.body?.innerText ?? "").slice(0, 600)
}))()
`,
    `${route} ${selector}`,
  );
}

async function settle(cdp) {
  await evaluate(
    cdp,
    `
(async () => {
  let style = document.querySelector('[data-release-evidence-motion-style]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-release-evidence-motion-style', 'true');
    style.textContent = '*,:before,:after{animation-duration:0s!important;animation-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important;transition-duration:0s!important}';
    document.head.appendChild(style);
  }
  await document.fonts.ready;
  window.scrollTo(0, 0);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return { ok: true };
})()
`,
  );
}

async function assertFreePracticeText(cdp, label) {
  await waitForCondition(
    cdp,
    `
(() => {
  const textarea = document.querySelector('textarea[aria-label="练习文本"]');
  const value = textarea instanceof HTMLTextAreaElement ? textarea.value : null;
  return {
    ok: value === ${JSON.stringify(FREE_PRACTICE_DEMO_TEXT)},
    value,
  };
})()
`,
    `${label} free-practice text`,
  );
}

async function prepareShot(cdp, shot) {
  const initialSelector =
    shot.id === "guided-repeat"
      ? '[data-smoke="guided-repeat-trigger"]'
      : shot.id === "diagnosis-example"
        ? '[data-smoke="assessment-page"]'
        : shot.id === "no-key"
          ? '[data-smoke="settings-page"]'
          : shot.readySelector;
  await navigate(cdp, shot.route, initialSelector);

  if (shot.id === "guided-repeat") {
    await evaluate(
      cdp,
      `document.querySelector('[data-smoke="guided-repeat-trigger"]')?.click(); ({ ok: true })`,
    );
  } else if (shot.id === "free-practice") {
    await settle(cdp);
    await delay(250);
    await evaluate(
      cdp,
      `
(() => {
  const textarea = document.querySelector('textarea[aria-label="练习文本"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, ${JSON.stringify(FREE_PRACTICE_DEMO_TEXT)});
  textarea?.dispatchEvent(new Event('input', { bubbles: true }));
  textarea?.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: textarea?.value === ${JSON.stringify(FREE_PRACTICE_DEMO_TEXT)} };
})()
`,
    );
    await assertFreePracticeText(cdp, "post-fill");
  } else if (shot.id === "diagnosis-example") {
    await evaluate(
      cdp,
      `
(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('查看上次报告'));
  button?.click();
  return { ok: Boolean(button) };
})()
`,
    );
  }

  await waitForCondition(
    cdp,
    `(() => ({ ok: Boolean(document.querySelector(${JSON.stringify(shot.readySelector)})) }))()`,
    `${shot.id} ready state`,
  );
  if (shot.id === "no-key") {
    await evaluate(
      cdp,
      `document.querySelector(${JSON.stringify(shot.readySelector)})?.scrollIntoView({ block: 'center' }); ({ ok: true })`,
    );
  }
  await settle(cdp);
  await delay(150);
  const bannerPlacement = await evaluate(
    cdp,
    evidenceBannerExpression(shot.bannerKind, shot.id, shot.readySelector),
  );
  if (!bannerPlacement?.ok) {
    throw new Error(
      `Evidence banner overlaps content on ${shot.id}: ${JSON.stringify(bannerPlacement)}`,
    );
  }

  if (shot.bannerKind === "example-score") {
    const disclosure = await evaluate(
      cdp,
      `(() => ({
        ok: true,
        text: document.querySelector('[data-release-evidence-banner="example-score"]')?.textContent ?? null
      }))()`,
    );
    if (disclosure.text !== EXAMPLE_SCORE_DISCLOSURE) {
      throw new Error(`Missing score disclosure on ${shot.id}.`);
    }
  }
  if (shot.id === "free-practice") {
    await assertFreePracticeText(cdp, "pre-screenshot");
  }
  return bannerPlacement;
}

async function proveFixtureBuild(cdp) {
  await navigate(
    cdp,
    "/phonemes/ee?smokeScoreSummary=1&smokeAssessmentTiles=1",
    '[data-smoke="phoneme-score-summary"]',
  );
  await waitForCondition(
    cdp,
    `(() => ({
      ok: Boolean(document.querySelector('[data-smoke="assessment-phoneme-tile-fixture"]'))
    }))()`,
    "desktop compile-time fixture marker",
  );
}

async function inspectRuntimeBoundary(cdp, canonicalSettingsDirectory) {
  await navigate(
    cdp,
    "/settings?section=labs",
    '[data-smoke="release-status"]',
  );
  await delay(500);
  const observation = await evaluate(
    cdp,
    `
(async () => {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") {
    return { ok: false, reason: "Tauri invoke bridge is unavailable" };
  }
  const keys = [
    "speakright_azure_config",
    "speakright_elevenlabs_config",
    "speakright_llm_config"
  ];
  const secureValues = await Promise.all(
    keys.map((key) => invoke("secure_store_get", { key }))
  );
  const resolvedSettingsStorePath = await invoke("desktop_settings_store_path");
  const attempts = globalThis.__SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_ATTEMPTS__;
  return {
    ok: true,
    guardActive:
      globalThis.__SPEAKRIGHT_RELEASE_EVIDENCE_NATIVE_HTTP_GUARD__ === true,
    nativeHttpAttempts: Array.isArray(attempts) ? attempts.length : null,
    secureStoreSlotsEmpty: secureValues.every((value) => value === null),
    localSecretSlotsEmpty: keys.every((key) => localStorage.getItem(key) === null),
    resolvedSettingsStorePath
  };
})()
`,
  );
  return {
    ok: observation?.ok === true,
    reason:
      typeof observation?.reason === "string" ? observation.reason : undefined,
    guardActive: observation?.guardActive === true,
    nativeHttpAttempts: observation?.nativeHttpAttempts ?? null,
    secureStoreSlotsEmpty: observation?.secureStoreSlotsEmpty === true,
    localSecretSlotsEmpty: observation?.localSecretSlotsEmpty === true,
    settingsStorePathIsolated: isExactWindowsSettingsStorePath(
      observation?.resolvedSettingsStorePath,
      canonicalSettingsDirectory,
    ),
  };
}

function assertRuntimeBoundary(boundary, phase) {
  if (
    !boundary?.ok ||
    boundary.guardActive !== true ||
    boundary.nativeHttpAttempts !== 0 ||
    boundary.secureStoreSlotsEmpty !== true ||
    boundary.localSecretSlotsEmpty !== true ||
    boundary.settingsStorePathIsolated !== true
  ) {
    throw new Error(
      `Desktop evidence runtime boundary failed during ${phase}: ${JSON.stringify(boundary)}`,
    );
  }
}

async function main() {
  const executable = assertEvidenceTempPath(
    readArgument("--executable", defaultExecutablePath()),
    "Desktop evidence executable",
  );
  const buildManifestPath = assertEvidenceTempPath(
    readArgument("--build-manifest", defaultBuildManifestPath()),
    "Desktop evidence build manifest",
  );
  const outputRoot = assertOutputRoot(
    readArgument("--output-root", defaultOutputRoot),
  );
  if (!existsSync(executable)) {
    throw new Error(`Desktop evidence executable not found: ${executable}`);
  }
  if (!existsSync(buildManifestPath)) {
    throw new Error(
      `Desktop evidence build manifest not found: ${buildManifestPath}`,
    );
  }
  const executableBuffer = await readFile(executable);
  const executableHash = sha256(executableBuffer);
  const buildManifestBuffer = await readFile(buildManifestPath);
  const buildManifest = JSON.parse(buildManifestBuffer.toString("utf8"));
  if (
    buildManifest.version !== RELEASE_EVIDENCE_VERSION ||
    buildManifest.edition !== "desktop" ||
    buildManifest.fixtureBuild !== true ||
    buildManifest.paidApiCalls !== false ||
    buildManifest.assetSet?.schemaVersion !== 1 ||
    !Number.isInteger(buildManifest.assetSet?.fileCount) ||
    buildManifest.assetSet.fileCount <= 0 ||
    !Number.isSafeInteger(buildManifest.assetSet?.totalBytes) ||
    buildManifest.assetSet.totalBytes <= 0 ||
    !/^[a-f0-9]{64}$/.test(buildManifest.assetSet?.pathDigestSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(
      buildManifest.assetSet?.pathHashDigestSha256 ?? "",
    ) ||
    !/^[a-f0-9]{64}$/.test(buildManifest.assetSet?.registrySha256 ?? "") ||
    buildManifest.generatorSnapshot?.schemaVersion !== 1 ||
    !/^[a-f0-9]{64}$/.test(buildManifest.generatorSnapshot?.sha256 ?? "") ||
    !Number.isInteger(buildManifest.generatorSnapshot?.fileCount) ||
    !Number.isSafeInteger(buildManifest.generatorSnapshot?.totalBytes) ||
    buildManifest.captureTransport?.mode !== "ephemeral-loopback-cdp" ||
    buildManifest.captureTransport?.portFile !==
      "WebView2/EBWebView/DevToolsActivePort" ||
    buildManifest.captureTransport?.additionalBrowserArgsSha256 !==
      sha256(Buffer.from(DESKTOP_EVIDENCE_BROWSER_ARGUMENTS)) ||
    !/^com\.speakright\.desktop\.release-evidence-[a-f0-9]{16}$/.test(
      buildManifest.credentialNamespace,
    ) ||
    buildManifest.networkGuard?.nativeHttp !== "fail-closed" ||
    buildManifest.networkGuard?.nativeHttpCapability !== false ||
    buildManifest.networkGuard?.externalConnectCsp !== false ||
    buildManifest.networkGuard?.rustExternalProviders !== "fail-closed" ||
    buildManifest.runtimeIsolation?.temporaryLogDirectoryRequired !== true ||
    buildManifest.runtimeIsolation?.temporarySettingsStorePathRequired !==
      true ||
    buildManifest.runtimeIsolation?.temporaryWebViewProfileRequired !== true ||
    buildManifest.sourceSnapshot?.schemaVersion !== 1 ||
    !/^[a-f0-9]{40}$/.test(buildManifest.sourceCommit ?? "") ||
    buildManifest.sourceWorktreeClean !== true ||
    !/^[a-f0-9]{64}$/.test(buildManifest.sourceSnapshot?.sha256 ?? "") ||
    !Number.isInteger(buildManifest.sourceSnapshot?.fileCount) ||
    buildManifest.sourceSnapshot.fileCount <= 0 ||
    !/^[a-f0-9]{64}$/.test(
      buildManifest.networkGuard?.tauriHttpGuardSha256 ?? "",
    ) ||
    !/^[a-f0-9]{64}$/.test(buildManifest.networkGuard?.rustGuardSha256 ?? "") ||
    buildManifest.executableSha256 !== executableHash
  ) {
    throw new Error("Desktop evidence build provenance check failed.");
  }
  await assertCurrentSourceSnapshot(
    buildManifest.sourceSnapshot,
    buildManifest.sourceCommit,
  );
  await assertCurrentAssetSet(
    buildManifest.assetSet,
    buildManifest.sourceCommit,
  );
  await assertCurrentGeneratorSnapshot(
    buildManifest.generatorSnapshot,
    buildManifest.sourceCommit,
  );

  const running = await findConflictingSpeakRightProcesses(executable);
  if (running.length > 0) {
    throw new Error(
      `The desktop evidence executable is already running. Close only that evidence instance before retrying: ${formatSpeakRightProcessConflicts(running)}`,
    );
  }

  const profileRoot = await mkdtemp(
    path.join(os.tmpdir(), "speakright-release-evidence-"),
  );
  const logDir = path.join(profileRoot, "logs");
  const settingsDir = path.join(profileRoot, "settings");
  const settingsStorePath = path.join(settingsDir, SETTINGS_STORE_FILE_NAME);
  await Promise.all([
    mkdir(logDir, { recursive: true }),
    mkdir(settingsDir, { recursive: true }),
  ]);
  const canonicalSettingsDirectory = await realpath(settingsDir);
  const child = spawn(executable, [], {
    detached: false,
    env: buildEnv(
      profileRoot,
      buildManifest.credentialNamespace,
      logDir,
      settingsStorePath,
    ),
    stdio: "ignore",
    windowsHide: false,
  });
  const childState = {
    code: null,
    error: null,
    exited: false,
    signal: null,
  };
  child.once("error", (error) => {
    childState.error = error;
  });
  child.once("exit", (code, signal) => {
    childState.code = code;
    childState.exited = true;
    childState.signal = signal;
  });
  const artifacts = [];
  const attemptedExternalOrigins = new Set();
  const successfulExternalOrigins = new Set();
  let cdp = null;
  let runtimeLogInitialized = false;

  try {
    const target = await waitForDevtoolsTarget(profileRoot, childState);
    cdp = await createCdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    runtimeLogInitialized = await waitForRuntimeLog(logDir);
    const applicationOrigin = await evaluate(cdp, "window.location.origin");
    const allowedOrigins = new Set([
      applicationOrigin,
      "http://asset.localhost",
      "http://ipc.localhost",
    ]);
    const recordExternalOrigin = (target, event) => {
      try {
        const origin = new URL(event?.url ?? "").origin;
        if (origin !== "null" && !allowedOrigins.has(origin))
          target.add(origin);
      } catch {
        // Non-network URLs are outside this policy.
      }
    };
    cdp.on("Network.requestWillBeSent", (event) =>
      recordExternalOrigin(attemptedExternalOrigins, event.request),
    );
    cdp.on("Network.responseReceived", (event) =>
      recordExternalOrigin(successfulExternalOrigins, event.response),
    );
    await cdp.send("Network.setBlockedURLs", {
      urls: [
        "https://*/*",
        "http://127.0.0.1/*",
        "http://localhost/*",
        "http://[::1]/*",
      ],
    });
    await setViewport(cdp, DESKTOP_EVIDENCE_VIEWPORTS[0]);
    await proveFixtureBuild(cdp);
    assertRuntimeBoundary(
      await inspectRuntimeBoundary(cdp, canonicalSettingsDirectory),
      "pre-capture verification",
    );

    for (const viewport of DESKTOP_EVIDENCE_VIEWPORTS) {
      await setViewport(cdp, viewport);
      const viewportDir = path.join(outputRoot, viewport.id);
      await mkdir(viewportDir, { recursive: true });

      for (const shot of RELEASE_EVIDENCE_SHOTS) {
        const bannerGeometry = await prepareShot(cdp, shot);
        const result = await cdp.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
          fromSurface: true,
        });
        const buffer = Buffer.from(result.data, "base64");
        const dimensions = pngDimensions(buffer);
        if (
          dimensions.width !== viewport.width ||
          dimensions.height !== viewport.height
        ) {
          throw new Error(
            `${shot.id} captured at ${dimensions.width}x${dimensions.height}; expected ${viewport.id}.`,
          );
        }
        const outputPath = path.join(viewportDir, `${shot.id}.png`);
        await writeFile(outputPath, buffer);
        artifacts.push({
          edition: "desktop",
          viewport: viewport.id,
          id: shot.id,
          path: path.relative(root, outputPath).replaceAll("\\", "/"),
          width: dimensions.width,
          height: dimensions.height,
          sha256: sha256(buffer),
          geometry: {
            banner: bannerGeometry.rect,
            bannerCollisions: bannerGeometry.collisions.length,
            bannerWithinViewport: bannerGeometry.withinViewport,
            bannerOccludedPoints: bannerGeometry.occludedPoints.length,
          },
          scoreDisclosure:
            shot.bannerKind === "example-score"
              ? EXAMPLE_SCORE_DISCLOSURE
              : null,
        });
        console.log(`Captured Desktop ${viewport.id} ${shot.id}`);
      }
    }
    if (successfulExternalOrigins.size > 0) {
      throw new Error(
        `Desktop evidence received an external network response: ${[
          ...successfulExternalOrigins,
        ].join(", ")}`,
      );
    }
    assertRuntimeBoundary(
      await inspectRuntimeBoundary(cdp, canonicalSettingsDirectory),
      "post-capture verification",
    );
  } finally {
    cdp?.close();
    if (!child.killed) child.kill();
    await delay(500);
    await rm(profileRoot, { recursive: true, force: true });
  }
  if (existsSync(profileRoot)) {
    throw new Error("Desktop evidence TEMP runtime directory was not removed.");
  }
  await assertCurrentSourceSnapshot(
    buildManifest.sourceSnapshot,
    buildManifest.sourceCommit,
  );
  const assetSet = await assertCurrentAssetSet(
    buildManifest.assetSet,
    buildManifest.sourceCommit,
  );
  const generatorSnapshot = await assertCurrentGeneratorSnapshot(
    buildManifest.generatorSnapshot,
    buildManifest.sourceCommit,
  );

  const manifestPath = path.join(outputRoot, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        version: RELEASE_EVIDENCE_VERSION,
        edition: "desktop",
        fixtureBuildRequired: true,
        paidApiCalls: false,
        assetSet,
        generatorSnapshot,
        captureTransport: buildManifest.captureTransport,
        credentialNamespace: buildManifest.credentialNamespace,
        sourceSnapshot: buildManifest.sourceSnapshot,
        sourceWorktreeClean: true,
        buildManifestSha256: sha256(buildManifestBuffer),
        nativeHttpAttempts: 0,
        secureStoreSlotsEmpty: true,
        runtimeIsolation: {
          logDirectory: "os-temp-child",
          logInitialized: runtimeLogInitialized,
          logRetained: false,
          settingsStorePath: "os-temp-child",
          settingsStoreRetained: false,
          webViewProfile: "os-temp-child",
          profileRetained: false,
        },
        networkGuard: buildManifest.networkGuard,
        sourceCommit: buildManifest.sourceCommit,
        executable: {
          fileName: path.basename(executable),
          sha256: executableHash,
        },
        networkPolicy:
          "HTTPS and loopback provider requests blocked; isolated Tauri origins allowed; external responses must remain zero",
        attemptedExternalOrigins: [...attemptedExternalOrigins].sort(),
        successfulExternalOrigins: [],
        artifacts,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Desktop release evidence manifest: ${manifestPath}`);
}

const invokedAsScript =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
