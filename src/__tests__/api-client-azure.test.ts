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

  function decodePronunciationConfig(callIndex = 0) {
    const request = mocks.apiFetch.mock.calls[callIndex]?.[1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    return JSON.parse(
      Buffer.from(headers["Pronunciation-Assessment"], "base64").toString(
        "utf8",
      ),
    ) as Record<string, unknown>;
  }

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

  it("enables Azure prosody only for English sentence assessment", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ NBest: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ NBest: [] })));

    await assessPronunciation(
      new Blob(["audio"], { type: "audio/wav" }),
      "I need a cup of coffee.",
      "secret",
      "eastus",
      "en-US",
    );
    expect(decodePronunciationConfig()).toMatchObject({
      ReferenceText: "I need a cup of coffee.",
      EnableProsodyAssessment: true,
    });

    await assessPronunciation(
      new Blob(["audio"], { type: "audio/wav" }),
      "Necesito una taza de cafe.",
      "secret",
      "eastus",
      "es-ES",
    );
    expect(decodePronunciationConfig(1).EnableProsodyAssessment).toBeUndefined();
  });
});
