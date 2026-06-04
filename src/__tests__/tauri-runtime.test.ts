import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/tauri-http";
import { isTauriEnvironment } from "@/lib/tauri-runtime";

const pluginFetch = vi.fn();

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: pluginFetch,
}));

describe("tauri runtime detection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    pluginFetch.mockReset();
    Reflect.deleteProperty(globalThis, "isTauri");
  });

  it("uses official Tauri v2 runtime marker", () => {
    vi.stubGlobal("isTauri", true);
    expect(isTauriEnvironment()).toBe(true);
  });

  it("routes desktop HTTP through Tauri plugin fetch", async () => {
    vi.stubGlobal("isTauri", true);
    const response = new Response("ok");
    pluginFetch.mockResolvedValue(response);

    await expect(
      apiFetch("https://dict.youdao.com/dictvoice?type=2&audio=hello"),
    ).resolves.toBe(response);
    expect(pluginFetch).toHaveBeenCalledWith(
      "https://dict.youdao.com/dictvoice?type=2&audio=hello",
      undefined,
    );
  });
});
