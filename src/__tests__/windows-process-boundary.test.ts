import { describe, expect, it } from "vitest";
import {
  findOwnedProcessSnapshots,
  waitForWindowsProcessSnapshotsToExit,
} from "../../scripts/lib/windows-process-boundary.mjs";

describe("Windows process boundary", () => {
  it("selects only matching descendants of the requested root", () => {
    const processes = [
      { processId: 10, parentProcessId: 1, name: "speakright.exe" },
      { processId: 11, parentProcessId: 10, name: "msedgewebview2.exe" },
      { processId: 12, parentProcessId: 11, name: "msedgewebview2.exe" },
      { processId: 20, parentProcessId: 1, name: "other-app.exe" },
      { processId: 21, parentProcessId: 20, name: "msedgewebview2.exe" },
    ];

    expect(
      findOwnedProcessSnapshots({
        processes,
        rootPid: 10,
        executableName: "msedgewebview2.exe",
      }),
    ).toEqual([
      { processId: 11, name: "msedgewebview2.exe" },
      { processId: 12, name: "msedgewebview2.exe" },
    ]);
  });

  it("waits for exact snapshots and treats PID reuse as exited", async () => {
    const processTables = [
      [
        { processId: 11, parentProcessId: 10, name: "msedgewebview2.exe" },
        { processId: 21, parentProcessId: 20, name: "msedgewebview2.exe" },
      ],
      [
        { processId: 11, parentProcessId: 30, name: "replacement.exe" },
        { processId: 21, parentProcessId: 20, name: "msedgewebview2.exe" },
      ],
    ];
    let reads = 0;

    await waitForWindowsProcessSnapshotsToExit(
      [{ processId: 11, name: "msedgewebview2.exe" }],
      {
        readProcessTable: async () =>
          processTables[Math.min(reads++, processTables.length - 1)],
        wait: async () => {},
      },
    );

    expect(reads).toBe(2);
  });

  it("rejects a missing root instead of selecting unrelated processes", () => {
    expect(() =>
      findOwnedProcessSnapshots({
        processes: [
          { processId: 21, parentProcessId: 20, name: "msedgewebview2.exe" },
        ],
        rootPid: 10,
        executableName: "msedgewebview2.exe",
      }),
    ).toThrow("owned process root is missing");
  });
});
