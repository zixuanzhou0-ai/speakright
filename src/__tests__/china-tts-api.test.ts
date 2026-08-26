import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapMiniMaxSubtitleTimings,
  mimoTts,
  miniMaxTtsAligned,
} from "@/lib/api-client";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("@/lib/tauri-http", () => ({ apiFetch: mocks.apiFetch }));

function responseWithUrl(response: Response, url: string): Response {
  Object.defineProperty(response, "url", { configurable: true, value: url });
  return response;
}

describe("mainland China TTS clients", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps verified MiniMax word subtitles without guessing", () => {
    expect(
      mapMiniMaxSubtitleTimings("Don't repeat repeat.", [
        { text: "Don", time_begin: 0, time_end: 120 },
        { text: "'", time_begin: 120, time_end: 130 },
        { text: "t", time_begin: 130, time_end: 240 },
        { text: "repeat", time_begin: 250, time_end: 600 },
        { text: "repeat.", time_begin: 620, time_end: 980 },
      ]),
    ).toEqual([
      { word: "Don't", start: 0, end: 0.24 },
      { word: "repeat", start: 0.25, end: 0.6 },
      { word: "repeat.", start: 0.62, end: 0.98 },
    ]);

    expect(
      mapMiniMaxSubtitleTimings("Read 2026 now", [
        { text: "Read", time_begin: 0, time_end: 200 },
        { text: "twenty", time_begin: 210, time_end: 400 },
        { text: "twenty-six", time_begin: 410, time_end: 700 },
        { text: "now", time_begin: 710, time_end: 900 },
      ]),
    ).toEqual([]);
    expect(
      mapMiniMaxSubtitleTimings("Don't", [
        { text: "Dont", time_begin: 0, time_end: 300 },
      ]),
    ).toEqual([]);
    expect(
      mapMiniMaxSubtitleTimings("time moves", [
        { text: "time", time_begin: 300, time_end: 500 },
        { text: "moves", time_begin: 200, time_end: 700 },
      ]),
    ).toEqual([]);
    expect(
      mapMiniMaxSubtitleTimings("time moves", [
        { text: "time", time_begin: 0, time_end: 500 },
        { text: "moves", time_begin: 450, time_end: 800 },
      ]),
    ).toEqual([]);
  });

  it("decodes MiniMax hex audio and downloads exact-host word timestamps", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "00010203",
              subtitle_file:
                "https://filecdn.minimax.chat/subtitle/speakright.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { text: "Hello", time_begin: 20, time_end: 280 },
            { text: "world.", time_begin: 300, time_end: 720 },
          ]),
          { headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await miniMaxTtsAligned("secret", "Hello world.", {
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
      languageId: "en-US",
      speed: 0.9,
    });

    expect(result.audioBlob.type).toBe("audio/mpeg");
    expect(result.audioBlob.size).toBe(4);
    expect(result.wordTimings).toEqual([
      { word: "Hello", start: 0.02, end: 0.28 },
      { word: "world.", start: 0.3, end: 0.72 },
    ]);
    expect(result.alignmentOutcome).toBe("matched");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "https://api.minimaxi.com/v1/t2a_v2",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      }),
    );
    const request = JSON.parse(
      (mocks.apiFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(request).toMatchObject({
      model: "speech-2.8-turbo",
      subtitle_enable: true,
      subtitle_type: "word",
      output_format: "hex",
      language_boost: "English",
    });
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "https://filecdn.minimax.chat/subtitle/speakright.json",
      expect.objectContaining({
        maxRedirections: 0,
        redirect: "error",
      }),
    );
  });

  it("keeps MiniMax audio but rejects untrusted subtitle hosts", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            audio: "0001",
            subtitle_file: "https://attacker.example/subtitle.json",
          },
          base_resp: { status_code: 0 },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      miniMaxTtsAligned("secret", "Hello", {}),
    ).resolves.toMatchObject({
      wordTimings: [],
      alignmentOutcome: "transient-unavailable",
    });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("drops MiniMax subtitles when the final response URL leaves the trusted host", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0001",
              subtitle_file:
                "https://filecdn.minimax.chat/subtitle/speakright.json",
            },
            base_resp: { status_code: 0 },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        responseWithUrl(
          new Response(
            JSON.stringify([{ text: "Hello", time_begin: 0, time_end: 300 }]),
          ),
          "https://attacker.example/redirected.json",
        ),
      );

    await expect(
      miniMaxTtsAligned("secret", "Hello", {}),
    ).resolves.toMatchObject({
      wordTimings: [],
      alignmentOutcome: "transient-unavailable",
    });
  });

  it("marks a temporary MiniMax subtitle CDN failure as retryable", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0001",
              subtitle_file: "https://filecdn.minimax.chat/subtitle/retry.json",
            },
            base_resp: { status_code: 0 },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new TypeError("temporary CDN outage"));

    await expect(
      miniMaxTtsAligned("secret", "Hello", {}),
    ).resolves.toMatchObject({
      wordTimings: [],
      alignmentOutcome: "transient-unavailable",
    });
  });

  it("rejects MiniMax logical errors and malformed hex on HTTP 200", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: null,
          base_resp: { status_code: 1004, status_msg: "invalid token" },
        }),
      ),
    );
    await expect(miniMaxTtsAligned("secret", "Hello", {})).rejects.toThrow(
      "MiniMax 标准示范生成失败",
    );

    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { audio: "abc" },
          base_resp: { status_code: 0 },
        }),
      ),
    );
    await expect(miniMaxTtsAligned("secret", "Hello", {})).rejects.toThrow(
      "无效或过大的音频数据",
    );
  });

  it("decodes MiMo WAV audio and keeps the target text in assistant role", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { audio: { data: "UklGRg==" } } }],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    const blob = await mimoTts("mimo-secret", "Practice clearly.", {
      modelId: "mimo-v2.5-tts",
      voiceId: "Chloe",
      languageId: "en-US",
      speed: 0.8,
    });

    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(4);
    const request = JSON.parse(
      (mocks.apiFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(request.model).toBe("mimo-v2.5-tts");
    expect(request.audio).toEqual({ format: "wav", voice: "Chloe" });
    expect(request.messages[1]).toEqual({
      role: "assistant",
      content: "Practice clearly.",
    });
    expect(request.messages[0].content).toContain(
      "slightly slow teaching pace",
    );
  });

  it("blocks MiMo English voices for non-English learning languages", async () => {
    await expect(
      mimoTts("secret", "Bonjour", { languageId: "fr-FR" }),
    ).rejects.toThrow("目前仅用于英语标准示范");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
