import { beforeEach, describe, expect, it, vi } from "vitest";

type CorruptLocalDataMockItem = {
  key: string;
  raw: string;
  reason: string;
  detectedAt: string;
  schemaVersion: number;
};

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
    configuredApiKeys: 2,
    apiKeySlots: 4,
    dataSchemaVersion: 3,
    corruptItems: 0,
  })),
  readCorruptLocalData: vi.fn<() => CorruptLocalDataMockItem[]>(() => []),
  isTauriEnvironment: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@/lib/data-registry", () => ({
  getLocalDataSummary: mocks.getLocalDataSummary,
}));

vi.mock("@/lib/local-data-migrations", () => ({
  readCorruptLocalData: mocks.readCorruptLocalData,
}));

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

describe("desktop diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauriEnvironment.mockReturnValue(true);
    mocks.readCorruptLocalData.mockReturnValue([]);
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

    expect(bundle.schemaVersion).toBe(2);
    expect(bundle.product).toBe("SpeakRight Desktop");
    expect(bundle.release.currentVersion).toBeTruthy();
    expect(bundle.dataSummary.configuredApiKeys).toBe(2);
    expect(bundle.dataSummary.apiKeySlots).toBe(4);
    expect(bundle.corruptLocalData).toEqual([]);
    expect(bundle.runtime.app_identifier).toBe("com.speakright.desktop");
    expect(bundle.runtime.log.path).toBe(
      "<local-app-data>/com.speakright.desktop/logs/speakright.log",
    );
    expect(bundle.runtime.log.path).not.toContain("Users/me");
    expect(bundle.excluded).toContain("API keys");
    expect(bundle.excluded).toContain("Local user profile path");
    expect(bundle.excluded).toContain("Benchmark audio blobs");
    expect(bundle.excluded).toContain("Raw quarantined local data values");
  });

  it("summarizes quarantined local data without raw values", async () => {
    const { buildDesktopSupportBundle } = await import(
      "@/lib/desktop-diagnostics"
    );
    mocks.getLocalDataSummary.mockReturnValueOnce({
      learningKeys: 3,
      cacheKeys: 1,
      configuredApiKeys: 0,
      apiKeySlots: 4,
      dataSchemaVersion: 3,
      corruptItems: 1,
    });
    mocks.readCorruptLocalData.mockReturnValueOnce([
      {
        key: "speakright_score_history",
        raw: "{secret-ish broken score history",
        reason: "Malformed JSON",
        detectedAt: "2026-06-16T00:00:00.000Z",
        schemaVersion: 2,
      },
    ]);

    const bundle = await buildDesktopSupportBundle();
    const serialized = JSON.stringify(bundle);

    expect(bundle.dataSummary.corruptItems).toBe(1);
    expect(bundle.corruptLocalData).toEqual([
      {
        key: "speakright_score_history",
        reason: "Malformed JSON",
        detectedAt: "2026-06-16T00:00:00.000Z",
        schemaVersion: 2,
        rawCharacters: 32,
      },
    ]);
    expect(serialized).not.toContain("{secret-ish broken score history");
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
