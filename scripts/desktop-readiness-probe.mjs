import { lstat, open } from "node:fs/promises";
import { InstallerRoundtripError } from "./desktop-installer-roundtrip-core.mjs";

export const DESKTOP_READINESS_TIMEOUT_MS = 120_000;
export const DESKTOP_READINESS_POLL_MS = 250;

const PENDING_WEBVIEW_MESSAGES = new Set([
  "installed app did not expose an owned WebView2 process",
  "installed app root process is missing from process-tree inspection",
]);
const SAFE_PATH_KINDS = new Set([
  "missing",
  "file",
  "directory",
  "symlink",
  "other",
]);
const TRANSIENT_LOG_ERROR_CODES = new Set([
  "EACCES",
  "EBUSY",
  "ENOENT",
  "EPERM",
]);

function fail(code, message) {
  throw new InstallerRoundtripError(code, message);
}

function emptyLogObservation(kind) {
  return {
    logKind: kind,
    logBytes: null,
    logLastLine: "",
    logModifiedAtMs: null,
    logReadable: false,
    markerPresent: false,
  };
}

export async function observeDesktopReadinessLog(filePath, marker, signal) {
  if (typeof filePath !== "string" || typeof marker !== "string" || !marker) {
    fail("invalid-readiness-probe", "desktop readiness log probe is invalid");
  }

  let handle;
  try {
    handle = await open(filePath, "r");
  } catch (error) {
    if (error?.code === "ENOENT") return emptyLogObservation("missing");
    if (TRANSIENT_LOG_ERROR_CODES.has(error?.code)) {
      return emptyLogObservation("unavailable");
    }
    if (error?.code === "EISDIR") {
      fail("unsafe-log-target", "isolated runtime log is not a regular file");
    }
    throw error;
  }

  try {
    let openedInfo;
    let pathInfo;
    try {
      [openedInfo, pathInfo] = await Promise.all([
        handle.stat({ bigint: true }),
        lstat(filePath, { bigint: true }),
      ]);
    } catch (error) {
      if (TRANSIENT_LOG_ERROR_CODES.has(error?.code)) {
        return emptyLogObservation("unavailable");
      }
      throw error;
    }
    if (
      !openedInfo.isFile() ||
      !pathInfo.isFile() ||
      pathInfo.isSymbolicLink() ||
      openedInfo.dev !== pathInfo.dev ||
      openedInfo.ino !== pathInfo.ino
    ) {
      fail(
        "unsafe-log-target",
        "isolated runtime log changed identity or is not a regular file",
      );
    }

    let contents;
    try {
      contents = await handle.readFile({ encoding: "utf8", signal });
    } catch (error) {
      if (TRANSIENT_LOG_ERROR_CODES.has(error?.code)) {
        return emptyLogObservation("unavailable");
      }
      throw error;
    }
    const logBytes = Number(openedInfo.size);
    if (!Number.isSafeInteger(logBytes) || logBytes < 0) {
      fail("unsafe-log-target", "isolated runtime log size is invalid");
    }
    const logModifiedAtMs = Number(openedInfo.mtimeMs);
    if (!Number.isFinite(logModifiedAtMs) || logModifiedAtMs < 0) {
      fail(
        "unsafe-log-target",
        "isolated runtime log modification time is invalid",
      );
    }
    return {
      logKind: "file",
      logBytes,
      logLastLine: contents.trim().split(/\r?\n/).at(-1) ?? "",
      logModifiedAtMs,
      logReadable: true,
      markerPresent: contents.includes(marker),
    };
  } finally {
    await handle.close();
  }
}

function readinessStateLabel(observation) {
  const safeKind = (value) =>
    SAFE_PATH_KINDS.has(value) ? value : "unavailable";
  const safeBytes =
    Number.isSafeInteger(observation?.logBytes) && observation.logBytes >= 0
      ? observation.logBytes
      : "unavailable";
  return [
    `processAlive=${observation?.processAlive === true}`,
    `windowObserved=${observation?.windowObserved === true}`,
    `logKind=${safeKind(observation?.logKind)}`,
    `logBytes=${safeBytes}`,
    `logReadable=${observation?.logReadable === true}`,
    `markerPresent=${observation?.markerPresent === true}`,
    `webViewDirKind=${safeKind(observation?.webViewDirKind)}`,
    `profilePopulated=${observation?.profilePopulated === true}`,
    `webViewProfileOwned=${observation?.webViewProfileOwned === true}`,
  ].join(", ");
}

export function isDesktopReadinessComplete(observation) {
  return (
    observation?.windowObserved === true &&
    observation?.logKind === "file" &&
    observation?.logReadable === true &&
    observation?.markerPresent === true &&
    observation?.webViewDirKind === "directory" &&
    observation?.profilePopulated === true &&
    observation?.webViewProfileOwned === true
  );
}

export function retainDesktopReadiness(record, observation) {
  if (!record || typeof record !== "object") {
    fail("process-tracking", "installed app process was not tracked");
  }
  if (!isDesktopReadinessComplete(observation)) {
    fail(
      "invalid-readiness-result",
      "desktop readiness probe did not return its complete passing result",
    );
  }
  record.readiness = observation;
  return observation;
}

export function assertRetainedDesktopReadiness(record) {
  if (!record || typeof record !== "object") {
    fail("process-tracking", "installed app process was not tracked");
  }
  if (!isDesktopReadinessComplete(record.readiness)) {
    fail(
      "invalid-readiness-result",
      "desktop readiness probe did not retain its complete passing result",
    );
  }
  return record.readiness;
}

function readinessTimeoutFailure(observation) {
  const state = readinessStateLabel(observation);
  if (isDesktopReadinessComplete(observation)) {
    fail(
      "readiness-timeout",
      `installed app became ready only after the launch deadline; ${state}`,
    );
  }
  if (observation?.windowObserved !== true) {
    fail(
      "window-timeout",
      `installed app did not expose the expected SpeakRight window; ${state}`,
    );
  }
  if (
    observation?.logKind !== "file" ||
    observation.logReadable !== true ||
    observation.markerPresent !== true
  ) {
    fail(
      "isolated-log-missing",
      `installed app did not write its isolated runtime log; ${state}`,
    );
  }
  fail(
    "webview-profile",
    `installed app did not establish its isolated WebView2 profile; ${state}`,
  );
}

export function isPendingWebViewStartupError(error) {
  return (
    error instanceof InstallerRoundtripError &&
    error.code === "webview-profile" &&
    PENDING_WEBVIEW_MESSAGES.has(error.message)
  );
}

export async function waitForDesktopReadiness({
  observe,
  now = () => Date.now(),
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  timeoutMs = DESKTOP_READINESS_TIMEOUT_MS,
  intervalMs = DESKTOP_READINESS_POLL_MS,
  deadlineMs = /** @type {number | null} */ (null),
}) {
  const hasAbsoluteDeadline = deadlineMs != null;
  if (
    typeof observe !== "function" ||
    typeof now !== "function" ||
    typeof sleep !== "function" ||
    (!hasAbsoluteDeadline && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) ||
    (hasAbsoluteDeadline && !Number.isFinite(deadlineMs)) ||
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0
  ) {
    fail("invalid-readiness-probe", "desktop readiness probe is invalid");
  }

  const deadline = hasAbsoluteDeadline ? deadlineMs : now() + timeoutMs;
  let observation;
  while (true) {
    const remainingBeforeObservation = deadline - now();
    if (remainingBeforeObservation <= 0) break;

    const controller = new AbortController();
    const abortTimer = setTimeout(
      () => controller.abort(),
      remainingBeforeObservation,
    );
    try {
      observation = await observe({
        signal: controller.signal,
        deadlineMs: deadline,
      });
    } catch (error) {
      if (controller.signal.aborted) break;
      throw error;
    } finally {
      clearTimeout(abortTimer);
    }
    if (!observation || typeof observation !== "object") {
      fail(
        "invalid-readiness-observation",
        "desktop readiness observation is invalid",
      );
    }
    if (observation.processAlive !== true) {
      const exitCode = Number.isInteger(observation.exitCode)
        ? observation.exitCode
        : "unknown";
      fail(
        "installed-app-exited",
        `installed app exited before readiness (exitCode=${exitCode}, signaled=${observation.exitSignal != null})`,
      );
    }
    if (
      observation.logKind === "directory" ||
      observation.logKind === "symlink" ||
      observation.logKind === "other"
    ) {
      fail(
        "unsafe-log-target",
        `isolated runtime log has an unsafe file type; ${readinessStateLabel(observation)}`,
      );
    }
    if (
      observation.webViewDirKind === "file" ||
      observation.webViewDirKind === "symlink" ||
      observation.webViewDirKind === "other"
    ) {
      fail(
        "unsafe-webview-profile",
        `isolated WebView2 profile has an unsafe file type; ${readinessStateLabel(observation)}`,
      );
    }
    const observedAt = now();
    if (isDesktopReadinessComplete(observation) && observedAt < deadline) {
      return observation;
    }

    const remainingMs = deadline - observedAt;
    if (remainingMs <= 0) break;
    await sleep(Math.min(intervalMs, remainingMs));
  }

  readinessTimeoutFailure(observation);
}
