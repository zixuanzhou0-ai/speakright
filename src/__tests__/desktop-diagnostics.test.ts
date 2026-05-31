import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async () => ({
    app_identifier: "com.speakright.desktop",
    log: {
      path: "C:/Users/me/AppData/Local/com.speakright.desktop/logs/speakright.log",
      bytes: 84,
      tail: ["[INFO] SpeakRight desktop runtime initialized"],
      error: null,
    },
  })),
  getLocalDataSummary: vi.fn(() => ({
    learningKeys: 2,
    cacheKeys: 1,
    apiKeySlots: 4,
    dataSchemaVersion: 3,
    corruptItems: 0,
  })),
  isTauriEnvironment: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@/lib/data-registry", () => ({
  getLocalDataSummary: mocks.getLocalDataSummary,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

describe("desktop diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriEnvironment.mockReturnValue(true);
  });

  it("reads runtime diagnostics through the desktop command", async () => {
    const { getDesktopRuntimeDiagnostics } = await import(
      "@/lib/desktop-diagnostics"
    );

    const diagnostics = await getDesktopRuntimeDiagnostics();

    expect(mocks.invoke).toHaveBeenCalledWith("desktop_diagnostics");
    expect(diagnostics.log.tail[0]).toContain("runtime initialized");
    expect(diagnostics.log.path).toContain("speakright.log");
  });

  it("builds a support bundle without secrets or audio blobs", async () => {
    const { buildDesktopSupportBundle } = await import(
      "@/lib/desktop-diagnostics"
    );

    const bundle = await buildDesktopSupportBundle();

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.product).toBe("SpeakRight Desktop");
    expect(bundle.release.currentVersion).toBeTruthy();
    expect(bundle.dataSummary.apiKeySlots).toBe(4);
    expect(bundle.runtime.app_identifier).toBe("com.speakright.desktop");
    expect(bundle.excluded).toContain("API keys");
    expect(bundle.excluded).toContain("Benchmark audio blobs");
  });

  it("returns a clear browser-dev diagnostic fallback", async () => {
    const { getDesktopRuntimeDiagnostics } = await import(
      "@/lib/desktop-diagnostics"
    );
    mocks.isTauriEnvironment.mockReturnValue(false);

    const diagnostics = await getDesktopRuntimeDiagnostics();

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(diagnostics.log.error).toContain("desktop app");
  });
});
