import { beforeEach, describe, expect, it, vi } from "vitest";
import { mimoTts, miniMaxTtsAligned } from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/platform/browser-fetch", () => ({
  apiFetch: mocks.apiFetch,
}));

function responseWithUrl(response: Response, url: string): Response {
  Object.defineProperty(response, "url", { configurable: true, value: url });
  return response;
}

describe("domestic TTS browser API clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts MiniMax hex audio and official millisecond word subtitles", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "000102ff",
              subtitle_file: "https://filecdn.minimax.chat/subtitles/test.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { text: "Hello", time_begin: 0, time_end: 420 },
            { text: "world", time_begin: 450, time_end: 900 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await miniMaxTtsAligned("mini-key", "Hello world", {
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
      languageId: "en-US",
      speed: 0.9,
    });

    expect(result.audioBlob.type).toBe("audio/mpeg");
    expect(result.audioBlob.size).toBe(4);
    expect(result.wordTimings).toEqual([
      { word: "Hello", start: 0, end: 0.42 },
      { word: "world", start: 0.45, end: 0.9 },
    ]);
    expect(result.alignmentOutcome).toBe("matched");
    const [url, init] = mocks.apiFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.minimaxi.com/v1/t2a_v2");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer mini-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "speech-2.8-turbo",
      subtitle_enable: true,
      subtitle_type: "word",
      output_format: "hex",
      language_boost: "English",
      voice_setting: {
        voice_id: "English_expressive_narrator",
        speed: 0.9,
      },
    });
    const [subtitleUrl, subtitleInit] = mocks.apiFetch.mock.calls[1] as [
      URL,
      RequestInit,
    ];
    expect(subtitleUrl.toString()).toBe(
      "https://filecdn.minimax.chat/subtitles/test.json",
    );
    expect(subtitleInit).toEqual(
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("keeps MiniMax audio but drops an untrusted or unavailable subtitle URL", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            audio: "0102",
            subtitle_file: "https://example.test/untrusted.json",
          },
          base_resp: { status_code: 0, status_msg: "success" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await miniMaxTtsAligned("mini-key", "Hello", {
      modelId: "speech-2.8-hd",
      voiceId: "English_PatientMan",
    });

    expect(result.audioBlob.size).toBe(2);
    expect(result.wordTimings).toEqual([]);
    expect(result.alignmentOutcome).toBe("transient-unavailable");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("drops a subtitle response redirected away from the trusted CDN", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0102",
              subtitle_file: "https://filecdn.minimax.chat/subtitles/test.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        responseWithUrl(
          new Response(
            JSON.stringify([{ text: "Hello", time_begin: 0, time_end: 420 }]),
          ),
          "http://127.0.0.1/private",
        ),
      );

    await expect(
      miniMaxTtsAligned("mini-key", "Hello", {}),
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
              audio: "0102",
              subtitle_file:
                "https://filecdn.minimax.chat/subtitles/retry.json",
            },
            base_resp: { status_code: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockRejectedValueOnce(new TypeError("temporary CDN outage"));

    await expect(
      miniMaxTtsAligned("mini-key", "Hello", {}),
    ).resolves.toMatchObject({
      wordTimings: [],
      alignmentOutcome: "transient-unavailable",
    });
  });

  it("surfaces actionable MiniMax authentication errors", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response('{"error":"invalid key"}', { status: 401 }),
    );

    await expect(
      miniMaxTtsAligned("bad-key", "Hello", {
        modelId: "speech-2.8-turbo",
        voiceId: "English_expressive_narrator",
      }),
    ).rejects.toThrow("MiniMax 认证失败");
  });

  it("rejects a MiniMax HTTP-200 service error and invalid model before playback", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: null,
          base_resp: { status_code: 1008, status_msg: "insufficient balance" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      miniMaxTtsAligned("mini-key", "Hello", {
        modelId: "speech-2.8-turbo",
        voiceId: "English_expressive_narrator",
      }),
    ).rejects.toThrow("额度不足");

    await expect(
      miniMaxTtsAligned("mini-key", "Hello", {
        modelId: "untrusted-model",
        voiceId: "English_expressive_narrator",
      }),
    ).rejects.toThrow("受支持的 MiniMax Speech 2.8 模型");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it("drops an overlapping MiniMax subtitle timeline", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0102",
              subtitle_file: "https://filecdn.minimax.chat/subtitles/test.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { text: "Hello", time_begin: 400, time_end: 800 },
            { text: "world", time_begin: 700, time_end: 900 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await miniMaxTtsAligned("mini-key", "Hello world", {
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });

    expect(result.wordTimings).toEqual([]);
    expect(result.alignmentOutcome).toBe("transcript-mismatch");
  });

  it("rejects structurally valid subtitles that do not match the requested text", async () => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0102",
              subtitle_file: "https://filecdn.minimax.chat/subtitles/test.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { text: "Read", time_begin: 0, time_end: 200 },
            { text: "twenty", time_begin: 220, time_end: 400 },
            { text: "twenty-six", time_begin: 420, time_end: 700 },
            { text: "now", time_begin: 720, time_end: 900 },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await miniMaxTtsAligned("mini-key", "Read 2026 now", {});

    expect(result.wordTimings).toEqual([]);
    expect(result.alignmentOutcome).toBe("transcript-mismatch");
  });

  it.each([
    { label: "numeric strings", timeBegin: "0", timeEnd: "420" },
    { label: "null", timeBegin: null, timeEnd: 420 },
    { label: "empty strings", timeBegin: "", timeEnd: 420 },
  ])("drops MiniMax subtitle timestamps encoded as $label", async ({
    timeBegin,
    timeEnd,
  }) => {
    mocks.apiFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              audio: "0102",
              subtitle_file: "https://filecdn.minimax.chat/subtitles/test.json",
            },
            base_resp: { status_code: 0, status_msg: "success" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { text: "Hello", time_begin: timeBegin, time_end: timeEnd },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const result = await miniMaxTtsAligned("mini-key", "Hello", {
      modelId: "speech-2.8-turbo",
      voiceId: "English_expressive_narrator",
    });

    expect(result.wordTimings).toEqual([]);
  });

  it("sends MiMo target text as the assistant message and decodes WAV audio", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            { message: { audio: { data: btoa("\u0000\u0001\u0002") } } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await mimoTts("mimo-key", "Hello, learner.", {
      modelId: "mimo-v2.5-tts",
      voiceId: "Mia",
      languageId: "en-US",
      speed: 0.9,
    });

    expect(result.type).toBe("audio/wav");
    expect(result.size).toBe(3);
    const [url, init] = mocks.apiFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer mimo-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "mimo-v2.5-tts",
      audio: { format: "wav", voice: "Mia" },
    });
    expect(body.messages.at(-1)).toEqual({
      role: "assistant",
      content: "Hello, learner.",
    });
    expect(body.messages[0].content).toContain(
      "at a clear, slightly slow teaching pace",
    );
  });

  it("rejects malformed MiMo audio without exposing the raw response", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: {} }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      mimoTts("mimo-key", "Hello", {
        modelId: "mimo-v2.5-tts",
        voiceId: "Dean",
      }),
    ).rejects.toThrow("小米 MiMo 没有返回可播放音频");
  });

  it("blocks unsupported MiMo languages and voice IDs before sending a key", async () => {
    await expect(
      mimoTts("mimo-key", "Bonjour", {
        modelId: "mimo-v2.5-tts",
        voiceId: "Mia",
        languageId: "fr-FR",
      }),
    ).rejects.toThrow("当前仅开放英语预置音色");

    await expect(
      mimoTts("mimo-key", "Hello", {
        modelId: "mimo-v2.5-tts",
        voiceId: "unknown-voice",
      }),
    ).rejects.toThrow("受支持的小米 MiMo 英文预置音色");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
