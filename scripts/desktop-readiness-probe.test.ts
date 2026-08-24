import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { InstallerRoundtripError } from "./desktop-installer-roundtrip-core.mjs";
import {
  assertRetainedDesktopReadiness,
  isDesktopReadinessComplete,
  isPendingWebViewStartupError,
  observeDesktopReadinessLog,
  retainDesktopReadiness,
  waitForDesktopReadiness,
} from "./desktop-readiness-probe.mjs";

function readyObservation() {
  return {
    processAlive: true,
    exitCode: null,
    exitSignal: null,
    windowObserved: true,
    logKind: "file",
    logBytes: 64,
    logReadable: true,
    markerPresent: true,
    webViewDirKind: "directory",
    profilePopulated: true,
    webViewProfileOwned: true,
  };
}

describe("desktop readiness probe", () => {
  it("waits for every readiness signal under one shared budget", async () => {
    let elapsedMs = 0;
    const readiness = await waitForDesktopReadiness({
      timeoutMs: 120_000,
      intervalMs: 1_000,
      now: () => elapsedMs,
      sleep: async (delayMs: number) => {
        elapsedMs += delayMs;
      },
      observe: async () => ({
        processAlive: true,
        exitCode: null,
        exitSignal: null,
        windowObserved: elapsedMs >= 1_000,
        logKind: elapsedMs >= 40_000 ? "file" : "unavailable",
        logBytes: elapsedMs >= 45_000 ? 64 : null,
        logReadable: elapsedMs >= 40_000,
        markerPresent: elapsedMs >= 45_000,
        webViewDirKind: elapsedMs >= 50_000 ? "directory" : "missing",
        profilePopulated: elapsedMs >= 50_000,
        webViewProfileOwned: elapsedMs >= 50_000,
      }),
    });

    expect(elapsedMs).toBe(50_000);
    expect(isDesktopReadinessComplete(readiness)).toBe(true);
  });

  it("does not grant a new polling window after the launch deadline", async () => {
    let observations = 0;
    await expect(
      waitForDesktopReadiness({
        deadlineMs: 120_000,
        intervalMs: 1_000,
        now: () => 120_000,
        sleep: async () => undefined,
        observe: async () => {
          observations += 1;
          return readyObservation();
        },
      }),
    ).rejects.toMatchObject({ code: "window-timeout" });
    expect(observations).toBe(0);
  });

  it("deducts time already spent since launch from the absolute deadline", async () => {
    let elapsedMs = 40_000;
    await expect(
      waitForDesktopReadiness({
        deadlineMs: 120_000,
        intervalMs: 1_000,
        now: () => elapsedMs,
        sleep: async (delayMs: number) => {
          elapsedMs += delayMs;
        },
        observe: async () => ({
          ...readyObservation(),
          logBytes: 0,
          markerPresent: false,
        }),
      }),
    ).rejects.toMatchObject({ code: "isolated-log-missing" });
    expect(elapsedMs).toBe(120_000);
  });

  it("aborts an in-flight observation when the absolute deadline arrives", async () => {
    const startedAt = Date.now();
    let aborted = false;
    await expect(
      waitForDesktopReadiness({
        deadlineMs: startedAt + 25,
        intervalMs: 1_000,
        observe: async ({ signal }: { signal: AbortSignal }) =>
          new Promise((_, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(signal.reason);
              },
              { once: true },
            );
          }),
      }),
    ).rejects.toMatchObject({ code: "window-timeout" });
    expect(aborted).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it("rejects a ready observation that completes after the launch deadline", async () => {
    let elapsedMs = 110_000;
    await expect(
      waitForDesktopReadiness({
        deadlineMs: 120_000,
        intervalMs: 1_000,
        now: () => elapsedMs,
        sleep: async () => undefined,
        observe: async () => {
          elapsedMs = 120_001;
          return readyObservation();
        },
      }),
    ).rejects.toMatchObject({ code: "readiness-timeout" });
  });

  it("treats only exact WebView startup races as retryable", () => {
    for (const message of [
      "installed app did not expose an owned WebView2 process",
      "installed app root process is missing from process-tree inspection",
    ]) {
      expect(
        isPendingWebViewStartupError(
          new InstallerRoundtripError("webview-profile", message),
        ),
      ).toBe(true);
    }
    expect(
      isPendingWebViewStartupError(
        new InstallerRoundtripError(
          "webview-profile",
          "owned WebView2 process did not use the isolated profile",
        ),
      ),
    ).toBe(false);
  });

  it("retains and revalidates the complete result across adapter phases", () => {
    const record: { readiness: ReturnType<typeof readyObservation> | null } = {
      readiness: null,
    };
    expect(() => assertRetainedDesktopReadiness(record)).toThrowError(
      /did not retain its complete passing result/,
    );
    const observation = readyObservation();
    expect(retainDesktopReadiness(record, observation)).toBe(observation);
    expect(assertRetainedDesktopReadiness(record)).toBe(observation);
    expect(() =>
      retainDesktopReadiness(record, {
        ...observation,
        webViewProfileOwned: false,
      }),
    ).toThrowError(/did not return its complete passing result/);
  });

  it("reads the runtime marker through one identity-checked file handle", async () => {
    const directory = mkdtempSync(join(tmpdir(), "speakright-readiness-log-"));
    const logPath = join(directory, "speakright.log");
    try {
      const contents = "SpeakRight desktop runtime initialized\n";
      writeFileSync(logPath, contents, "utf8");
      await expect(
        observeDesktopReadinessLog(
          logPath,
          "SpeakRight desktop runtime initialized",
        ),
      ).resolves.toEqual({
        logKind: "file",
        logBytes: Buffer.byteLength(contents),
        logLastLine: "SpeakRight desktop runtime initialized",
        logModifiedAtMs: expect.any(Number),
        logReadable: true,
        markerPresent: true,
      });
      await expect(
        observeDesktopReadinessLog(
          join(directory, "missing.log"),
          "SpeakRight desktop runtime initialized",
        ),
      ).resolves.toMatchObject({ logKind: "missing" });
      await expect(
        observeDesktopReadinessLog(
          directory,
          "SpeakRight desktop runtime initialized",
        ),
      ).rejects.toMatchObject({ code: "unsafe-log-target" });
      const symlinkPath = join(directory, "linked.log");
      symlinkSync(logPath, symlinkPath, "file");
      await expect(
        observeDesktopReadinessLog(
          symlinkPath,
          "SpeakRight desktop runtime initialized",
        ),
      ).rejects.toMatchObject({ code: "unsafe-log-target" });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("classifies a missing setup marker at the shared deadline", async () => {
    let elapsedMs = 0;
    const probe = waitForDesktopReadiness({
      timeoutMs: 120_000,
      intervalMs: 1_000,
      now: () => elapsedMs,
      sleep: async (delayMs: number) => {
        elapsedMs += delayMs;
      },
      observe: async () => ({
        ...readyObservation(),
        logBytes: 0,
        markerPresent: false,
      }),
    });

    await expect(probe).rejects.toMatchObject({
      code: "isolated-log-missing",
      message: expect.stringContaining("markerPresent=false"),
    });
    expect(elapsedMs).toBe(120_000);
  });

  it("fails immediately when the installed process exits during readiness", async () => {
    let elapsedMs = 0;
    const probe = waitForDesktopReadiness({
      timeoutMs: 120_000,
      intervalMs: 1_000,
      now: () => elapsedMs,
      sleep: async (delayMs: number) => {
        elapsedMs += delayMs;
      },
      observe: async () => ({
        ...readyObservation(),
        processAlive: elapsedMs < 5_000,
        exitCode: elapsedMs < 5_000 ? null : 23,
        markerPresent: false,
        webViewDirKind: "missing",
        profilePopulated: false,
        webViewProfileOwned: false,
      }),
    });

    await expect(probe).rejects.toMatchObject({
      code: "installed-app-exited",
      message: expect.stringContaining("exitCode=23"),
    });
    expect(elapsedMs).toBe(5_000);
  });

  it("rejects unsafe runtime paths without waiting", async () => {
    let elapsedMs = 0;
    await expect(
      waitForDesktopReadiness({
        timeoutMs: 120_000,
        intervalMs: 1_000,
        now: () => elapsedMs,
        sleep: async (delayMs: number) => {
          elapsedMs += delayMs;
        },
        observe: async () => ({
          ...readyObservation(),
          logKind: "symlink",
          logBytes: null,
          logReadable: false,
          markerPresent: false,
        }),
      }),
    ).rejects.toMatchObject({ code: "unsafe-log-target" });
    expect(elapsedMs).toBe(0);
  });

  it("wires the absolute deadline, abort signal, and exit recheck into Windows", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "desktop-installer-roundtrip.mjs"),
      "utf8",
    );
    const spawnHandler = source.indexOf('child.once("spawn", () => {');
    const deadlineAssignment = source.indexOf(
      "record.readinessDeadline =",
      spawnHandler,
    );
    const spawnResolution = source.indexOf("resolve();", spawnHandler);
    expect(spawnHandler).toBeGreaterThan(-1);
    expect(deadlineAssignment).toBeGreaterThan(spawnHandler);
    expect(spawnResolution).toBeGreaterThan(deadlineAssignment);
    expect(source).toContain("deadlineMs: record.readinessDeadline");
    expect(source).toContain("observeDesktopReadinessLog(");
    expect(source).not.toContain("readFile(logPath");
    expect(source).toContain("getProcessTree(signal)");
    const smokeSource = readFileSync(
      join(process.cwd(), "scripts", "desktop-smoke.mjs"),
      "utf8",
    );
    expect(smokeSource).toContain("observeDesktopReadinessLog(");
    expect(smokeSource).not.toContain("stat(logPath)");
    expect(smokeSource).not.toContain("readFile(logPath");
    const retainResult = source.indexOf(
      "retainDesktopReadiness(record, observation)",
    );
    const revalidateResult = source.indexOf(
      "assertRetainedDesktopReadiness(record)",
    );
    expect(retainResult).toBeGreaterThan(-1);
    expect(revalidateResult).toBeGreaterThan(retainResult);
    const processExitRecheck = source.indexOf(
      "const processAfterTree = await inspectTrackedProcess(signal)",
    );
    const retryableWebViewCheck = source.indexOf(
      "isPendingWebViewStartupError(error)",
    );
    expect(processExitRecheck).toBeGreaterThan(-1);
    expect(retryableWebViewCheck).toBeGreaterThan(processExitRecheck);
  });
});
