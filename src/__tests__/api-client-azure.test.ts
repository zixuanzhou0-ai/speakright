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
});
