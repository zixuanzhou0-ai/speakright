import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    values: new Map<string, unknown>(),
    getError: null as Error | null,
    setError: null as Error | null,
    deleteError: null as Error | null,
    saveError: null as Error | null,
  };

  function MockLazyStore(path: string) {
    return {
      path,
      get: async (key: string) => {
        if (state.getError) throw state.getError;
        return state.values.get(key);
      },
      set: async (key: string, value: unknown) => {
        if (state.setError) throw state.setError;
        state.values.set(key, value);
      },
      delete: async (key: string) => {
        if (state.deleteError) throw state.deleteError;
        state.values.delete(key);
      },
      save: async () => {
        if (state.saveError) throw state.saveError;
      },
    };
  }

  return {
    state,
    isTauriEnvironment: vi.fn(() => true),
    LazyStore: vi.fn(MockLazyStore),
  };
});

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriEnvironment: mocks.isTauriEnvironment,
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: mocks.LazyStore,
}));

describe("tauri store wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.isTauriEnvironment.mockReturnValue(true);
    mocks.state.values.clear();
    mocks.state.getError = null;
    mocks.state.setError = null;
    mocks.state.deleteError = null;
    mocks.state.saveError = null;
  });

  it("uses localStorage only outside Tauri", async () => {
    mocks.isTauriEnvironment.mockReturnValue(false);
    const { storeDelete, storeGet, storeSet } = await import(
      "@/lib/tauri-store"
    );

    await storeSet("speakright_coach_mode", "strict");
    await expect(storeGet("speakright_coach_mode")).resolves.toBe("strict");
    await storeDelete("speakright_coach_mode");

    expect(localStorage.getItem("speakright_coach_mode")).toBeNull();
    expect(mocks.LazyStore).not.toHaveBeenCalled();
  });

  it("propagates Tauri store read failures", async () => {
    mocks.state.getError = new Error("read denied");
    const { storeGet } = await import("@/lib/tauri-store");

    await expect(storeGet("speakright_coach_mode")).rejects.toThrow(
      "Tauri store read failed: read denied",
    );
  });

  it("propagates Tauri store write failures without falling back to localStorage", async () => {
    mocks.state.saveError = new Error("disk full");
    const { storeSet } = await import("@/lib/tauri-store");

    await expect(storeSet("speakright_coach_mode", "strict")).rejects.toThrow(
      "Tauri store write failed: disk full",
    );

    expect(localStorage.getItem("speakright_coach_mode")).toBeNull();
  });

  it("propagates Tauri store delete failures without pretending data was removed", async () => {
    mocks.state.values.set("speakright_coach_mode", "hard");
    mocks.state.deleteError = new Error("delete denied");
    const { storeDelete, storeGet } = await import("@/lib/tauri-store");

    await expect(storeDelete("speakright_coach_mode")).rejects.toThrow(
      "Tauri store delete failed: delete denied",
    );

    await expect(storeGet("speakright_coach_mode")).resolves.toBe("hard");
  });
});
