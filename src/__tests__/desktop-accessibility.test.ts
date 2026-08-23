// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("desktop accessibility contracts", () => {
  it("names every native window control", () => {
    const source = readFileSync("src/components/layout/titlebar.tsx", "utf8");

    expect(source).toContain('aria-label="最小化窗口"');
    expect(source).toContain(
      'aria-label={isMaximized ? "还原窗口" : "最大化窗口"}',
    );
    expect(source).toContain('aria-label="关闭窗口"');
    expect(source).toContain('invoke("exit_app")');
    expect(source).not.toContain("getCurrentWindow().close()");
  });

  it("exposes a named microphone selector and refresh action", () => {
    const source = readFileSync(
      "src/components/audio/microphone-device-select.tsx",
      "utf8",
    );

    expect(source).toContain('aria-label="刷新麦克风列表"');
    expect(source).toContain('aria-label="麦克风"');
    expect(source).toContain("min-h-11");
  });
});
