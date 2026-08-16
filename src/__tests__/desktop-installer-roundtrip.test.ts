import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertRoundtripPathPolicy,
  buildNsisInstallArgs,
  buildNsisUninstallArgs,
  createSanitizedFailureSummary,
  createSanitizedSummary,
  hasExactPassingRoundtripChecks,
  InstallerRoundtripError,
  REQUIRED_ROUNDTRIP_CHECKS,
  runInstallerRoundtrip,
} from "../../scripts/desktop-installer-roundtrip-core.mjs";

const root = process.cwd();

function plan() {
  const tempRoot = join(root, ".roundtrip-test-temp");
  const sandboxRoot = join(
    tempRoot,
    "speakright-installer-roundtrip",
    "run-test",
  );
  const installDir = join(sandboxRoot, "install");
  return {
    runId: "test",
    tempRoot,
    sandboxRoot,
    installDir,
    webViewProfileDir: join(sandboxRoot, "webview2-profile"),
    logDir: join(sandboxRoot, "logs"),
    settingsStoreDir: join(sandboxRoot, "settings"),
    settingsStorePath: join(
      sandboxRoot,
      "settings",
      "speakright-settings.json",
    ),
    markerPath: join(sandboxRoot, ".speakright-installer-roundtrip.json"),
    installedExe: join(installDir, "speakright.exe"),
    uninstallerPath: join(installDir, "uninstall.exe"),
  };
}

function fakeAdapter(overrides: Record<string, unknown> = {}) {
  const calls: Array<string | [string, unknown]> = [];
  const adapter = {
    async inspectPreflight() {
      calls.push("inspectPreflight");
      return {
        registrations: [],
        productKeys: [],
        shortcuts: [],
        runEntries: [],
        processes: [],
        defaultInstallDirs: [],
        targetEntries: [],
      };
    },
    async prepareSandbox() {
      calls.push("prepareSandbox");
    },
    async runInstaller(_plan: unknown, args: unknown) {
      calls.push(["runInstaller", args]);
    },
    async verifyInstalled() {
      calls.push("verifyInstalled");
      return { payload: true, registration: true, shortcuts: true };
    },
    async launchInstalledApp() {
      calls.push("launchInstalledApp");
      return 4242;
    },
    async assertOwnedProcess(_plan: unknown, pid: unknown) {
      calls.push(["assertOwnedProcess", pid]);
    },
    async waitForWindow(_plan: unknown, pid: unknown) {
      calls.push(["waitForWindow", pid]);
    },
    async assertIsolatedWebViewProfile() {
      calls.push("assertIsolatedWebViewProfile");
    },
    async closeAndWait(_plan: unknown, pid: unknown) {
      calls.push(["closeAndWait", pid]);
      return 0;
    },
    async terminateOwnedProcess(_plan: unknown, pid: unknown) {
      calls.push(["terminateOwnedProcess", pid]);
    },
    async runUninstaller(_plan: unknown, args: unknown) {
      calls.push(["runUninstaller", args]);
    },
    async cleanupExpectedNativeResidue() {
      calls.push("cleanupExpectedNativeResidue");
      return { selfResidueRemoved: true, productKeyRemoved: true };
    },
    async inspectResiduals() {
      calls.push("inspectResiduals");
      return {
        registrations: [],
        productKeys: [],
        shortcuts: [],
        runEntries: [],
        processes: [],
        installEntries: [],
      };
    },
    async rollbackOwnedInstallation() {
      calls.push("rollbackOwnedInstallation");
    },
    async cleanupSandbox() {
      calls.push("cleanupSandbox");
    },
    ...overrides,
  };
  return { adapter, calls };
}

describe("desktop installer round-trip safety", () => {
  it("uses documented NSIS final-argument semantics", () => {
    const currentPlan = plan();
    expect(buildNsisInstallArgs(currentPlan.installDir)).toEqual([
      "/S",
      "/P",
      `/D=${currentPlan.installDir}`,
    ]);
    expect(buildNsisUninstallArgs(currentPlan.installDir)).toEqual([
      "/S",
      "/P",
      `_?=${currentPlan.installDir}`,
    ]);

    const spacedInstallDir = join(
      currentPlan.sandboxRoot,
      "install path with spaces",
    );
    expect(buildNsisInstallArgs(spacedInstallDir).at(-1)).toBe(
      `/D=${spacedInstallDir}`,
    );
    expect(buildNsisUninstallArgs(spacedInstallDir).at(-1)).toBe(
      `_?=${spacedInstallDir}`,
    );
    expect(() =>
      buildNsisInstallArgs(`${currentPlan.installDir}\nunsafe`),
    ).toThrowError(/line breaks/);
  });

  it("rejects traversal, sibling, and sandbox-equals-target paths", () => {
    const safe = plan();
    expect(() => assertRoundtripPathPolicy(safe)).not.toThrow();
    expect(() =>
      assertRoundtripPathPolicy({
        ...safe,
        installDir: join(safe.tempRoot, "outside-install"),
      }),
    ).toThrowError(/strict child of the sandbox/);
    expect(() =>
      assertRoundtripPathPolicy({
        ...safe,
        sandboxRoot: safe.tempRoot,
      }),
    ).toThrowError(/strict child of the resolved TEMP root/);
    expect(() =>
      assertRoundtripPathPolicy({
        ...safe,
        logDir: join(safe.tempRoot, "outside-logs"),
      }),
    ).toThrowError(/desktop log directory must be a strict child/);
    expect(() =>
      assertRoundtripPathPolicy({
        ...safe,
        settingsStorePath: join(safe.tempRoot, "speakright-settings.json"),
      }),
    ).toThrowError(/desktop settings store must be a strict child/);
    expect(() =>
      assertRoundtripPathPolicy({
        ...safe,
        settingsStorePath: join(safe.settingsStoreDir, "other.json"),
      }),
    ).toThrowError(/expected file name/);
  });

  it("fails closed before any mutation when an existing install is registered", async () => {
    const { adapter, calls } = fakeAdapter({
      async inspectPreflight() {
        calls.push("inspectPreflight");
        return {
          registrations: [{ label: "hkcu:SpeakRight" }],
          productKeys: [],
          shortcuts: [],
          runEntries: [],
          processes: [],
          defaultInstallDirs: [],
          targetEntries: [],
        };
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({ code: "existing-registration" });
    expect(calls).toEqual(["inspectPreflight"]);
  });

  it("fails closed before any mutation when the target already exists", async () => {
    const { adapter, calls } = fakeAdapter({
      async inspectPreflight() {
        calls.push("inspectPreflight");
        return {
          registrations: [],
          productKeys: [],
          shortcuts: [],
          runEntries: [],
          processes: [],
          defaultInstallDirs: [],
          targetEntries: ["unexpected.txt"],
        };
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({ code: "target-not-empty" });
    expect(calls).toEqual(["inspectPreflight"]);
  });

  it("fails closed before mutation when a SpeakRight startup value exists", async () => {
    const { adapter, calls } = fakeAdapter({
      async inspectPreflight() {
        calls.push("inspectPreflight");
        return {
          registrations: [],
          productKeys: [],
          shortcuts: [],
          runEntries: [{ name: "SpeakRight", value: "portable.exe" }],
          processes: [],
          defaultInstallDirs: [],
          targetEntries: [],
        };
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({ code: "existing-run-value" });
    expect(calls).toEqual(["inspectPreflight"]);
  });

  it("performs install, launch, clean close, uninstall, and strict cleanup in order", async () => {
    const { adapter, calls } = fakeAdapter();
    const times = [1_000, 1_750];
    const outcome = await runInstallerRoundtrip({
      plan: plan(),
      adapter,
      now: () => times.shift() ?? 1_750,
    });

    expect(calls).toEqual([
      "inspectPreflight",
      "prepareSandbox",
      ["runInstaller", buildNsisInstallArgs(plan().installDir)],
      "verifyInstalled",
      "launchInstalledApp",
      ["assertOwnedProcess", 4242],
      ["waitForWindow", 4242],
      "assertIsolatedWebViewProfile",
      ["closeAndWait", 4242],
      ["runUninstaller", buildNsisUninstallArgs(plan().installDir)],
      "cleanupExpectedNativeResidue",
      "inspectResiduals",
      "cleanupSandbox",
    ]);
    expect(outcome.durationMs).toBe(750);
    expect(outcome.checks).toBeDefined();
    if (!outcome.checks) throw new Error("fixture outcome is missing checks");
    expect(Object.values(outcome.checks)).toEqual(
      expect.arrayContaining([true]),
    );
    expect(Object.values(outcome.checks).every(Boolean)).toBe(true);
    expect(hasExactPassingRoundtripChecks(outcome.checks)).toBe(true);
    expect(outcome.cleanup).toMatchObject({
      nativeSelfResidueRemoved: true,
      ownedProductKeyResidueRemoved: true,
      sandboxRemoved: true,
    });
  });

  it("rejects an installed payload that does not match the release executable", async () => {
    const { adapter, calls } = fakeAdapter({
      async verifyInstalled() {
        calls.push("verifyInstalled");
        return { payload: false, registration: true, shortcuts: true };
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({ code: "install-verification" });
    expect(calls).toContain("rollbackOwnedInstallation");
    expect(calls).not.toContain("launchInstalledApp");
  });

  it("requires the exact fixed check set for public evidence", () => {
    const complete = Object.fromEntries(
      REQUIRED_ROUNDTRIP_CHECKS.map((key) => [key, true]),
    );
    expect(hasExactPassingRoundtripChecks(complete)).toBe(true);
    const { cleanExit: _missing, ...missing } = complete;
    expect(hasExactPassingRoundtripChecks(missing)).toBe(false);
    expect(
      hasExactPassingRoundtripChecks({ ...complete, unknownCheck: true }),
    ).toBe(false);
    expect(
      hasExactPassingRoundtripChecks({ ...complete, cleanExit: false }),
    ).toBe(false);
  });

  it("only asks the adapter to terminate the tracked child and still rolls back", async () => {
    const { adapter, calls } = fakeAdapter({
      async waitForWindow() {
        calls.push(["waitForWindow", 4242]);
        throw new InstallerRoundtripError("window-timeout", "fixture failure");
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({ code: "window-timeout" });
    expect(calls).toContainEqual(["terminateOwnedProcess", 4242]);
    expect(calls).toContain("rollbackOwnedInstallation");
    expect(calls).toContain("cleanupSandbox");
    expect(calls).not.toContainEqual(["terminateOwnedProcess", 1]);
  });

  it("preserves the primary failure when PID ownership blocks rollback termination", async () => {
    const { adapter, calls } = fakeAdapter({
      async waitForWindow() {
        calls.push(["waitForWindow", 4242]);
        throw new InstallerRoundtripError("window-timeout", "fixture failure");
      },
      async terminateOwnedProcess() {
        calls.push(["terminateOwnedProcess", 4242]);
        throw new InstallerRoundtripError(
          "process-ownership",
          "fixture ownership mismatch",
        );
      },
    });
    await expect(
      runInstallerRoundtrip({ plan: plan(), adapter }),
    ).rejects.toMatchObject({
      code: "window-timeout",
      rollbackErrors: expect.arrayContaining([
        expect.objectContaining({ code: "process-ownership" }),
      ]),
    });
    expect(calls).toContain("rollbackOwnedInstallation");
    expect(calls).toContain("cleanupSandbox");
  });

  it("emits a path-free summary suitable for public release evidence", () => {
    const currentPlan = plan();
    const summary = createSanitizedSummary({
      version: "1.1.0",
      installer: {
        fileName: join(currentPlan.tempRoot, "SpeakRight_1.1.0_x64-setup.exe"),
        bytes: 123,
        sha256: "a".repeat(64),
      },
      outcome: {
        checks: Object.fromEntries(
          REQUIRED_ROUNDTRIP_CHECKS.map((key) => [key, true]),
        ),
        cleanup: { sandboxRemoved: true },
        durationMs: 500,
      },
      completedAt: "2026-08-16T00:00:00.000Z",
    });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain(currentPlan.tempRoot);
    expect(serialized).not.toMatch(/[A-Za-z]:\\Users\\/i);
    expect(summary.installer.fileName).toBe("SpeakRight_1.1.0_x64-setup.exe");

    const failed = createSanitizedFailureSummary({
      version: "1.1.0",
      installer: null,
      error: Object.assign(
        new Error("C:\\Users\\Alice\\secret sk-test-not-for-logs"),
        { code: "fixture-failure" },
      ),
      completedAt: "2026-08-16T00:00:00.000Z",
    });
    expect(JSON.stringify(failed)).not.toContain("Alice");
    expect(JSON.stringify(failed)).not.toContain("sk-test-not-for-logs");
    expect(failed.failure.code).toBe("fixture-failure");
  });

  it("wires the real round-trip before report generation and preview gating", () => {
    const packageJson = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    for (const scriptName of ["validate:desktop", "validate:desktop-ci"]) {
      const script = packageJson.scripts[scriptName];
      expect(script).toContain("desktop:installer-roundtrip");
      expect(script.indexOf("desktop:installer-roundtrip")).toBeLessThan(
        script.indexOf("desktop:release-report"),
      );
    }

    const workflow = readFileSync(
      join(root, ".github/workflows/release-desktop-preview.yml"),
      "utf8",
    );
    expect(workflow).toContain("isolated installer round-trip");
    expect(workflow).toContain("RELEASE_VERSION: $");
    expect(workflow).toContain(
      "$($env:RELEASE_VERSION)_installer-roundtrip.json",
    );
    expect(workflow).toContain("Copy-Item -LiteralPath $roundtripReport");
    expect(workflow.indexOf("npm run validate:desktop")).toBeLessThan(
      workflow.indexOf("npm run desktop:preview-release-gate"),
    );

    const report = readFileSync(
      join(root, "scripts/desktop-release-report.mjs"),
      "utf8",
    );
    expect(report).toContain("installerRoundtrip");
    expect(report).toContain("does not match the current NSIS artifact");
    expect(report).toContain("hasExactPassingRoundtripChecks");

    const previewGate = readFileSync(
      join(root, "scripts/desktop-preview-release-gate.mjs"),
      "utf8",
    );
    expect(previewGate).toContain("hasExactPassingRoundtripChecks");
  });

  it("keeps process termination and recursive cleanup behind ownership checks", () => {
    const script = readFileSync(
      join(root, "scripts/desktop-installer-roundtrip.mjs"),
      "utf8",
    );
    const core = readFileSync(
      join(root, "scripts/desktop-installer-roundtrip-core.mjs"),
      "utf8",
    );
    expect(script).toContain("WEBVIEW2_USER_DATA_FOLDER");
    expect(script).toContain("SPEAKRIGHT_LOG_DIR");
    expect(script).toContain("SPEAKRIGHT_SETTINGS_STORE_PATH");
    expect(script).toContain("isolated runtime log");
    expect(script).toContain("releaseExeSha256");
    expect(script).toContain("releaseExeBytes");
    expect(script).toContain("assertReleaseExecutableUnchanged");
    expect(script).toContain("installer-roundtrip-$" + "{randomUUID()}");
    expect(script).toContain('reviewedTauriCliVersion = "2.10.1"');
    expect(script).toContain("WriteUninstaller");
    expect(script).toContain("assertOwnedProcess(plan, pid)");
    expect(script).toContain("ExecutablePath");
    expect(script).toContain(
      "assertCleanPreflight(await inspectSystemState(plan))",
    );
    expect(script).toContain("foreign-process-before-uninstall");
    expect(script).toContain("foreign-process-before-rollback");
    expect(script).toContain("CurrentVersion\\Run");
    expect(core).toContain("existing-run-value");
    expect(script.match(/windowsVerbatimArguments: true/g)).toHaveLength(3);
    expect(script).toContain("Stop-Process -Id $processId -Force");
    expect(script).toContain("await assertMarker(plan)");
    expect(script).toContain(
      "await rm(plan.sandboxRoot, { recursive: true, force: false })",
    );
    expect(script).not.toContain("taskkill");
    expect(script).not.toContain("Remove-Item -Recurse");
  });
});
