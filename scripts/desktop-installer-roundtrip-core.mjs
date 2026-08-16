import path from "node:path";

export const ROUNDTRIP_SCHEMA_VERSION = 1;
export const REQUIRED_ROUNDTRIP_CHECKS = Object.freeze([
  "preflightClean",
  "targetWasEmpty",
  "installedPayloadVerified",
  "registrationOwned",
  "shortcutsOwned",
  "windowObserved",
  "isolatedWebViewProfile",
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
    if (!Object.values(installed).every((value) => value === true)) {
      fail(
        "install-verification",
        "installed payload ownership checks did not all pass",
      );
    }

    launchedPid = await adapter.launchInstalledApp(plan);
    await adapter.assertOwnedProcess(plan, launchedPid);
    await adapter.waitForWindow(plan, launchedPid);
    checks.windowObserved = true;
    await adapter.assertIsolatedWebViewProfile(plan);
    checks.isolatedWebViewProfile = true;

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
        rollbackErrors.push(error);
      }
    }
    if (!completed && installStarted) {
      cleanup.rollbackAttempted = true;
      try {
        await adapter.rollbackOwnedInstallation(plan);
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
    if (sandboxPrepared) {
      try {
        await adapter.cleanupSandbox(plan);
        cleanup.sandboxRemoved = true;
      } catch (error) {
        rollbackErrors.push(error);
      }
    }
  }

  if (primaryError) {
    if (rollbackErrors.length > 0) {
      const wrapped = new InstallerRoundtripError(
        primaryError.code ?? "roundtrip-failed",
        `${primaryError.message}; ${rollbackErrors.length} rollback operation(s) also failed`,
      );
      wrapped.cause = primaryError;
      wrapped.rollbackErrors = rollbackErrors;
      throw wrapped;
    }
    throw primaryError;
  }
  if (rollbackErrors.length > 0) {
    fail(
      "cleanup-failed",
      `${rollbackErrors.length} cleanup operation(s) failed`,
    );
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

export function createSanitizedSummary({
  version,
  installer,
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
    },
  };
}
