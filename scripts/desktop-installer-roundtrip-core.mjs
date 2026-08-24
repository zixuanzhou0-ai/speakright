import path from "node:path";

export const ROUNDTRIP_SCHEMA_VERSION = 2;
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
const CLEANUP_PHASES = new Set([
  "cleanup",
  "terminate-owned-process",
  "owned-installation-rollback",
  "sandbox-remove",
]);
const CLEANUP_CODES = new Set([
  "cleanup-error",
  "process-ownership",
  "termination-timeout",
  "webview-exit-timeout",
  "rollback-failed",
  "unsafe-cleanup",
  "EBUSY",
  "ENOTEMPTY",
  "EPERM",
  "ETIMEDOUT",
]);
export const REQUIRED_ROUNDTRIP_CHECKS = Object.freeze([
  "preflightClean",
  "targetWasEmpty",
  "installedPayloadVerified",
  "registrationOwned",
  "shortcutsOwned",
  "windowObserved",
  "isolatedWebViewProfile",
  "releaseDebugTransportDisabled",
  "cleanExit",
  "nativeUninstallerCompleted",
  "installDirectoryRemoved",
  "registrationRemoved",
  "shortcutsRemoved",
]);

export class InstallerRoundtripError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InstallerRoundtripError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new InstallerRoundtripError(code, message);
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

function readinessComplete(observation) {
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

function readinessTimeoutFailure(observation) {
  const state = readinessStateLabel(observation);
  if (readinessComplete(observation)) {
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
    if (readinessComplete(observation) && observedAt < deadline) {
      return observation;
    }

    const remainingMs = deadline - observedAt;
    if (remainingMs <= 0) break;
    await sleep(Math.min(intervalMs, remainingMs));
  }

  readinessTimeoutFailure(observation);
}

function taggedCleanupError(error, phase) {
  const tagged = new InstallerRoundtripError(
    typeof error?.code === "string" ? error.code : "cleanup-error",
    error instanceof Error ? error.message : String(error),
  );
  tagged.cleanupPhase = phase;
  tagged.cause = error;
  return tagged;
}

function sanitizedCleanupFailure({ phase, code }) {
  return {
    phase: CLEANUP_PHASES.has(phase) ? phase : "cleanup",
    code: CLEANUP_CODES.has(code) ? code : "cleanup-error",
  };
}

function cleanupFailureDescriptors(errors) {
  return errors.map((error) =>
    sanitizedCleanupFailure({
      phase: error.cleanupPhase,
      code: error.code,
    }),
  );
}

function normalized(value) {
  return path.resolve(value).toLocaleLowerCase("en-US");
}

export function isStrictPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(parent, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function assertRoundtripPathPolicy(plan) {
  if (!plan || typeof plan !== "object") {
    fail("invalid-plan", "round-trip plan is missing");
  }
  if (!path.isAbsolute(plan.tempRoot) || !path.isAbsolute(plan.sandboxRoot)) {
    fail("unsafe-path", "temporary and sandbox paths must be absolute");
  }
  if (!isStrictPathInside(plan.tempRoot, plan.sandboxRoot)) {
    fail(
      "unsafe-path",
      "sandbox must be a strict child of the resolved TEMP root",
    );
  }
  for (const [label, candidate] of [
    ["install directory", plan.installDir],
    ["WebView2 profile", plan.webViewProfileDir],
    ["desktop log directory", plan.logDir],
    ["desktop settings store directory", plan.settingsStoreDir],
    ["desktop settings store", plan.settingsStorePath],
    ["round-trip marker", plan.markerPath],
  ]) {
    if (!isStrictPathInside(plan.sandboxRoot, candidate)) {
      fail("unsafe-path", `${label} must be a strict child of the sandbox`);
    }
  }
  if (normalized(plan.installDir) === normalized(plan.sandboxRoot)) {
    fail("unsafe-path", "install directory cannot equal the sandbox root");
  }
  if (path.basename(plan.settingsStorePath) !== "speakright-settings.json") {
    fail(
      "unsafe-path",
      "desktop settings store must use the expected file name",
    );
  }
  if (
    normalized(path.dirname(plan.settingsStorePath)) !==
    normalized(plan.settingsStoreDir)
  ) {
    fail(
      "unsafe-path",
      "desktop settings store must be inside its isolated directory",
    );
  }
  assertNsisArgumentPath(plan.installDir);
}

function assertNsisArgumentPath(candidate) {
  if (!path.isAbsolute(candidate)) {
    fail("unsafe-path", "NSIS target directory must be absolute");
  }
  if (/["\r\n]/u.test(candidate)) {
    fail(
      "unsafe-path",
      "NSIS target directory cannot contain quotes or line breaks",
    );
  }
}

export function buildNsisInstallArgs(installDir) {
  assertNsisArgumentPath(installDir);
  // NSIS requires /D= to be the final, unquoted command-line argument.
  return ["/S", "/P", `/D=${path.resolve(installDir)}`];
}

export function buildNsisUninstallArgs(installDir) {
  assertNsisArgumentPath(installDir);
  // _?= prevents the temporary self-copy and lets the caller wait for completion.
  // NSIS requires it to be the final, unquoted command-line argument.
  return ["/S", "/P", `_?=${path.resolve(installDir)}`];
}

function populated(value) {
  return Array.isArray(value) && value.length > 0;
}

export function assertCleanPreflight(state) {
  if (!state || typeof state !== "object") {
    fail("preflight-unavailable", "preflight inspection did not return state");
  }
  const blockers = [
    ["existing-registration", "SpeakRight registration", state.registrations],
    ["existing-product-key", "SpeakRight product key", state.productKeys],
    ["existing-shortcut", "SpeakRight shortcut", state.shortcuts],
    ["existing-run-value", "SpeakRight startup value", state.runEntries],
    ["existing-process", "running SpeakRight process", state.processes],
    [
      "existing-install-directory",
      "existing SpeakRight install directory",
      state.defaultInstallDirs,
    ],
    [
      "target-not-empty",
      "non-empty or pre-existing round-trip target",
      state.targetEntries,
    ],
  ];
  for (const [code, label, values] of blockers) {
    if (populated(values)) {
      fail(
        code,
        `preflight found ${label}; refusing to modify an existing installation`,
      );
    }
  }
}

export function assertNoResiduals(state) {
  if (!state || typeof state !== "object") {
    fail(
      "residual-inspection-unavailable",
      "post-uninstall inspection did not return state",
    );
  }
  const residuals = [
    ["registration", state.registrations],
    ["product key", state.productKeys],
    ["shortcut", state.shortcuts],
    ["startup value", state.runEntries],
    ["process", state.processes],
    ["install file", state.installEntries],
  ];
  const found = residuals
    .filter(([, values]) => populated(values))
    .map(([label]) => label);
  if (found.length > 0) {
    fail(
      "uninstall-residue",
      `post-uninstall residue remains: ${found.join(", ")}`,
    );
  }
}

function ownedProcessesForRoot(processes, rootPid, failureCode) {
  if (!Array.isArray(processes) || !Number.isInteger(rootPid) || rootPid <= 0) {
    fail(failureCode, "owned process-tree inspection is unavailable");
  }

  const records = new Map();
  for (const process of processes) {
    const processId = Number(process?.processId);
    const parentProcessId = Number(process?.parentProcessId);
    if (processId === 0) continue;
    if (
      !Number.isInteger(processId) ||
      processId <= 0 ||
      !Number.isInteger(parentProcessId) ||
      parentProcessId < 0 ||
      records.has(processId)
    ) {
      fail(
        failureCode,
        "process-tree inspection returned an invalid or duplicate process",
      );
    }
    records.set(processId, {
      processId,
      parentProcessId,
      name: String(process?.name ?? ""),
      commandLine: process?.commandLine,
    });
  }
  if (!records.has(rootPid)) {
    fail(
      failureCode,
      "installed app root process is missing from process-tree inspection",
    );
  }

  const ownedProcessIds = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records.values()) {
      if (
        !ownedProcessIds.has(record.processId) &&
        ownedProcessIds.has(record.parentProcessId)
      ) {
        ownedProcessIds.add(record.processId);
        changed = true;
      }
    }
  }
  return [...ownedProcessIds].map((pid) => records.get(pid));
}

function ownedWebViewProcesses(processes, rootPid, failureCode) {
  const ownedProcesses = ownedProcessesForRoot(processes, rootPid, failureCode);
  const webViewProcesses = ownedProcesses.filter(
    (process) =>
      process.name.toLocaleLowerCase("en-US") === "msedgewebview2.exe",
  );
  if (webViewProcesses.length === 0) {
    fail(failureCode, "installed app did not expose an owned WebView2 process");
  }
  return { ownedProcesses, webViewProcesses };
}

function chromiumSwitchValue(commandLine, switchName) {
  const escapedSwitch = switchName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(
    `(?:^|\\s)--${escapedSwitch}=(?:"([^"]+)"|([^\\s"]+))`,
    "iu",
  ).exec(commandLine);
  return match?.[1] ?? match?.[2] ?? null;
}

export function getOwnedWebViewProcesses({ processes, rootPid }) {
  return ownedWebViewProcesses(processes, rootPid, "owned-process-inspection")
    .webViewProcesses;
}

export function assertOwnedWebViewProfile({
  processes,
  rootPid,
  expectedProfileDir,
  profilePopulated,
}) {
  if (
    typeof expectedProfileDir !== "string" ||
    !path.isAbsolute(expectedProfileDir) ||
    typeof profilePopulated !== "boolean"
  ) {
    fail("webview-profile", "isolated WebView2 profile evidence is invalid");
  }
  const { webViewProcesses } = ownedWebViewProcesses(
    processes,
    rootPid,
    "webview-profile",
  );
  for (const process of webViewProcesses) {
    if (typeof process.commandLine !== "string") {
      fail("webview-profile", "owned WebView2 command line is unavailable");
    }
    const actualProfileDir = chromiumSwitchValue(
      process.commandLine,
      "user-data-dir",
    );
    if (
      !actualProfileDir ||
      normalized(actualProfileDir) !== normalized(expectedProfileDir)
    ) {
      fail(
        "webview-profile",
        "owned WebView2 process did not use the isolated profile",
      );
    }
  }
  if (!profilePopulated) {
    fail("webview-profile", "isolated WebView2 profile was not populated");
  }
  return webViewProcesses;
}

export function assertNoOwnedDebugTransport({
  processes,
  rootPid,
  devToolsActivePortPresent,
}) {
  if (typeof devToolsActivePortPresent !== "boolean") {
    fail(
      "debug-transport-inspection",
      "DevToolsActivePort inspection did not return a boolean",
    );
  }
  const { ownedProcesses, webViewProcesses } = ownedWebViewProcesses(
    processes,
    rootPid,
    "debug-transport-inspection",
  );
  if (
    webViewProcesses.some((process) => typeof process.commandLine !== "string")
  ) {
    fail(
      "debug-transport-inspection",
      "owned WebView2 command line could not be inspected",
    );
  }
  const forbiddenArgument = /--remote-debugging-(?:port|pipe)(?:=|\s|"|$)/iu;
  if (
    ownedProcesses.some(
      (process) =>
        typeof process.commandLine === "string" &&
        forbiddenArgument.test(process.commandLine),
    ) ||
    devToolsActivePortPresent
  ) {
    fail(
      "release-debug-transport",
      "publishable installed app exposed a remote debugging transport",
    );
  }
}

export async function runInstallerRoundtrip({
  plan,
  adapter,
  now = () => Date.now(),
}) {
  assertRoundtripPathPolicy(plan);
  if (!adapter || typeof adapter !== "object") {
    fail("invalid-adapter", "round-trip adapter is missing");
  }

  const startedAt = now();
  const checks = Object.fromEntries(
    REQUIRED_ROUNDTRIP_CHECKS.map((key) => [key, false]),
  );
  const cleanup = {
    forcedOwnedProcessTermination: false,
    nativeSelfResidueRemoved: false,
    ownedProductKeyResidueRemoved: false,
    rollbackAttempted: false,
    sandboxRemoved: false,
  };
  let sandboxPrepared = false;
  let installStarted = false;
  let launchedPid = null;
  let completed = false;
  let result;
  let primaryError;
  const rollbackErrors = [];

  try {
    const preflight = await adapter.inspectPreflight(plan);
    assertCleanPreflight(preflight);
    checks.preflightClean = true;
    checks.targetWasEmpty = true;

    await adapter.prepareSandbox(plan);
    sandboxPrepared = true;

    installStarted = true;
    await adapter.runInstaller(plan, buildNsisInstallArgs(plan.installDir));
    const installed = await adapter.verifyInstalled(plan);
    checks.installedPayloadVerified = installed.payload === true;
    checks.registrationOwned = installed.registration === true;
    checks.shortcutsOwned = installed.shortcuts === true;
    const failedInstalledChecks = Object.entries(installed)
      .filter(([, value]) => value !== true)
      .map(([key]) => key)
      .sort();
    if (failedInstalledChecks.length > 0) {
      fail(
        "install-verification",
        `installed payload ownership checks did not all pass: ${failedInstalledChecks.join(", ")}`,
      );
    }

    launchedPid = await adapter.launchInstalledApp(plan);
    await adapter.assertOwnedProcess(plan, launchedPid);
    const readiness = await adapter.waitForReadiness(plan, launchedPid);
    checks.windowObserved = readiness?.window === true;
    checks.isolatedWebViewProfile = readiness?.isolatedWebViewProfile === true;
    if (!checks.windowObserved || !checks.isolatedWebViewProfile) {
      fail(
        "invalid-readiness-result",
        "desktop readiness probe did not return its complete passing result",
      );
    }
    await adapter.assertReleaseDebugTransportDisabled(plan, launchedPid);
    checks.releaseDebugTransportDisabled = true;

    const exitCode = await adapter.closeAndWait(plan, launchedPid);
    launchedPid = null;
    if (exitCode !== 0) {
      fail("unclean-exit", `installed app exited with code ${exitCode}`);
    }
    checks.cleanExit = true;

    await adapter.runUninstaller(plan, buildNsisUninstallArgs(plan.installDir));
    checks.nativeUninstallerCompleted = true;
    const nativeCleanup = await adapter.cleanupExpectedNativeResidue(plan);
    cleanup.nativeSelfResidueRemoved =
      nativeCleanup.selfResidueRemoved === true;
    cleanup.ownedProductKeyResidueRemoved =
      nativeCleanup.productKeyRemoved === true;

    const residuals = await adapter.inspectResiduals(plan);
    assertNoResiduals(residuals);
    checks.installDirectoryRemoved = true;
    checks.registrationRemoved = true;
    checks.shortcutsRemoved = true;
    completed = true;
    result = { checks, cleanup };
  } catch (error) {
    primaryError = error;
  } finally {
    if (launchedPid !== null) {
      try {
        await adapter.terminateOwnedProcess(plan, launchedPid);
        cleanup.forcedOwnedProcessTermination = true;
      } catch (error) {
        rollbackErrors.push(
          taggedCleanupError(error, "terminate-owned-process"),
        );
      }
    }
    if (!completed && installStarted) {
      cleanup.rollbackAttempted = true;
      try {
        await adapter.rollbackOwnedInstallation(plan);
      } catch (error) {
        rollbackErrors.push(
          taggedCleanupError(error, "owned-installation-rollback"),
        );
      }
    }
    if (sandboxPrepared) {
      try {
        await adapter.cleanupSandbox(plan);
        cleanup.sandboxRemoved = true;
      } catch (error) {
        rollbackErrors.push(taggedCleanupError(error, "sandbox-remove"));
      }
    }
  }

  if (primaryError) {
    if (rollbackErrors.length > 0) {
      const rollbackFailures = cleanupFailureDescriptors(rollbackErrors);
      const rollbackLabel = rollbackFailures
        .map(({ phase, code }) => `${phase}:${code}`)
        .join(", ");
      const wrapped = new InstallerRoundtripError(
        primaryError.code ?? "roundtrip-failed",
        `${primaryError.message}; rollback cleanup also failed [${rollbackLabel}]`,
      );
      wrapped.cause = primaryError;
      wrapped.rollbackErrors = rollbackErrors;
      wrapped.rollbackFailures = rollbackFailures;
      throw wrapped;
    }
    throw primaryError;
  }
  if (rollbackErrors.length > 0) {
    const rollbackFailures = cleanupFailureDescriptors(rollbackErrors);
    const error = new InstallerRoundtripError(
      "cleanup-failed",
      `cleanup failed [${rollbackFailures
        .map(({ phase, code }) => `${phase}:${code}`)
        .join(", ")}]`,
    );
    error.rollbackErrors = rollbackErrors;
    error.rollbackFailures = rollbackFailures;
    throw error;
  }
  if (!result) {
    fail("result-missing", "round-trip completed without a result");
  }

  return {
    ...result,
    durationMs: Math.max(0, now() - startedAt),
  };
}

export function hasExactPassingRoundtripChecks(checks) {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    return false;
  }
  const actualKeys = Object.keys(checks).sort();
  const requiredKeys = [...REQUIRED_ROUNDTRIP_CHECKS].sort();
  return (
    actualKeys.length === requiredKeys.length &&
    actualKeys.every((key, index) => key === requiredKeys[index]) &&
    requiredKeys.every((key) => checks[key] === true)
  );
}

export function matchesRoundtripArtifactIdentity(identity, artifact) {
  return (
    identity &&
    typeof identity === "object" &&
    artifact &&
    typeof artifact === "object" &&
    typeof identity.fileName === "string" &&
    identity.fileName.length > 0 &&
    path.basename(identity.fileName) === identity.fileName &&
    identity.fileName ===
      path.basename(artifact.path ?? artifact.fileName ?? "") &&
    Number.isSafeInteger(identity.bytes) &&
    identity.bytes >= 0 &&
    identity.bytes === artifact.bytes &&
    typeof identity.sha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(identity.sha256) &&
    identity.sha256 === artifact.sha256
  );
}

export function createSanitizedSummary({
  version,
  installer,
  releaseExecutable,
  outcome,
  completedAt,
}) {
  if (!hasExactPassingRoundtripChecks(outcome?.checks)) {
    fail(
      "invalid-checks",
      "round-trip summary requires the complete passing check set",
    );
  }
  if (outcome?.cleanup?.sandboxRemoved !== true) {
    fail("invalid-cleanup", "round-trip sandbox cleanup is incomplete");
  }
  const sanitizedReleaseExecutable = {
    fileName: path.basename(releaseExecutable?.fileName ?? ""),
    bytes: releaseExecutable?.bytes,
    sha256: releaseExecutable?.sha256,
  };
  if (
    !matchesRoundtripArtifactIdentity(
      sanitizedReleaseExecutable,
      sanitizedReleaseExecutable,
    )
  ) {
    fail(
      "invalid-release-executable",
      "round-trip summary requires a valid release executable identity",
    );
  }
  return {
    schemaVersion: ROUNDTRIP_SCHEMA_VERSION,
    productName: "SpeakRight",
    version,
    status: "passed",
    completedAt,
    platform: "win32",
    installer: {
      fileName: path.basename(installer.fileName),
      bytes: installer.bytes,
      sha256: installer.sha256,
    },
    releaseExecutable: sanitizedReleaseExecutable,
    checks: outcome.checks,
    cleanup: outcome.cleanup,
    durationMs: outcome.durationMs,
  };
}

export function createSanitizedFailureSummary({
  version,
  installer,
  error,
  completedAt,
}) {
  return {
    schemaVersion: ROUNDTRIP_SCHEMA_VERSION,
    productName: "SpeakRight",
    version,
    status: "failed",
    completedAt,
    platform: "win32",
    installer: installer
      ? {
          fileName: path.basename(installer.fileName),
          bytes: installer.bytes,
          sha256: installer.sha256,
        }
      : null,
    failure: {
      code: error?.code ?? "roundtrip-failed",
      rollbackFailures: Array.isArray(error?.rollbackFailures)
        ? error.rollbackFailures.map(sanitizedCleanupFailure)
        : [],
    },
  };
}
