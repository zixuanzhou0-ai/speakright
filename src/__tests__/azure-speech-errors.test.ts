import { describe, expect, it } from "vitest";
import { normalizeAzureSpeechError } from "@/lib/azure-speech-errors";

describe("normalizeAzureSpeechError", () => {
  it("preserves already localized Azure provider errors", () => {
    expect(
      normalizeAzureSpeechError(
        new Error("无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。"),
      ),
    ).toBe("无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。");
  });

  it("normalizes raw English network failures", () => {
    const message = normalizeAzureSpeechError(new TypeError("Failed to fetch"));

    expect(message).toBe(
      "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    );
    expect(message).not.toContain("Failed to fetch");
  });

  it("normalizes raw parse failures without leaking implementation details", () => {
    const message = normalizeAzureSpeechError(
      new SyntaxError("Unexpected token < in JSON at position 0"),
    );

    expect(message).toContain("Azure Speech 返回的数据暂时无法解析");
    expect(message).not.toContain("Unexpected token");
  });
});
