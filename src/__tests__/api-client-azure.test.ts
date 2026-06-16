import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessPronunciation,
  testAzure,
  transcribeSpeech,
} from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/tauri-http", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("Azure desktop API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes valid regions before constructing Azure token URLs", async () => {
    mocks.apiFetch.mockResolvedValueOnce(new Response("token"));

    await expect(testAzure("secret", " EastUS2 ")).resolves.toEqual({
      success: true,
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      "https://eastus2.api.cognitive.microsoft.com/sts/v1.0/issueToken",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects invalid regions before testing Azure credentials", async () => {
    await expect(
      testAzure("secret", "eastus.example.com"),
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("只能包含字母、数字和连字符"),
    });
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid regions before pronunciation assessment network calls", async () => {
    await expect(
      assessPronunciation(
        new Blob(["audio"], { type: "audio/wav" }),
        "hello",
        "secret",
        "https://eastus",
      ),
    ).rejects.toThrow("只能包含字母、数字和连字符");

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid regions before transcription network calls", async () => {
    await expect(
      transcribeSpeech(
        new Blob(["audio"], { type: "audio/wav" }),
        "secret",
        "eastus/path",
      ),
    ).rejects.toThrow("只能包含字母、数字和连字符");

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("returns a Chinese Azure auth error for invalid credentials", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("invalid subscription key", { status: 401 }),
    );

    await expect(testAzure("bad-key", "eastus")).resolves.toEqual({
      success: false,
      error:
        "Azure Speech 认证失败，请检查设置页里的 Subscription Key 和区域是否匹配。",
    });
  });

  it("returns a Chinese Azure network error when connection testing cannot reach Azure", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(testAzure("secret", "eastus")).resolves.toEqual({
      success: false,
      error: "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    });
  });

  it("does not leak unknown English desktop transport errors during connection testing", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error("plugin-http panicked"));

    await expect(testAzure("secret", "eastus")).resolves.toEqual({
      success: false,
      error:
        "Azure Speech 请求失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。",
    });
  });

  it("throws a Chinese no-speech message for Azure assessment silence", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("No speech detected", { status: 400 }),
    );

    await expect(
      assessPronunciation(
        new Blob(["audio"], { type: "audio/wav" }),
        "hello",
        "secret",
        "eastus",
      ),
    ).rejects.toThrow(
      "没有检测到清晰语音，请靠近麦克风、读完目标内容后重新录音。",
    );
  });

  it("throws a Chinese Azure assessment network error", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new TypeError("network offline"));

    await expect(
      assessPronunciation(
        new Blob(["audio"], { type: "audio/wav" }),
        "hello",
        "secret",
        "eastus",
      ),
    ).rejects.toThrow(
      "无法连接 Azure Speech，请检查网络、代理或 Azure 区域后重试。",
    );
  });

  it("does not leak unknown English desktop transport errors during assessment", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error("plugin-http panicked"));

    await expect(
      assessPronunciation(
        new Blob(["audio"], { type: "audio/wav" }),
        "hello",
        "secret",
        "eastus",
      ),
    ).rejects.toThrow(
      "Azure Speech 请求失败，请检查 Azure Speech API 密钥、区域、网络或代理后重试。",
    );
  });

  it("throws a Chinese no-speech message for Azure NoMatch responses", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      Response.json({ RecognitionStatus: "NoMatch" }),
    );

    await expect(
      assessPronunciation(
        new Blob(["audio"], { type: "audio/wav" }),
        "hello",
        "secret",
        "eastus",
      ),
    ).rejects.toThrow(
      "没有检测到清晰语音，请靠近麦克风、读完目标内容后重新录音。",
    );
  });

  it("throws a Chinese message when Azure transcription returns no text", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      Response.json({
        RecognitionStatus: "Success",
        NBest: [{}],
      }),
    );

    await expect(
      transcribeSpeech(
        new Blob(["audio"], { type: "audio/wav" }),
        "secret",
        "eastus",
      ),
    ).rejects.toThrow("Azure Speech 没有返回可用转写文本，请重新录音后再试。");
  });
});
