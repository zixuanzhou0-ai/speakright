import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  elevenLabsTts,
  elevenLabsTtsAligned,
  fetchElevenLabsUsage,
  fetchPronunciation,
  hermesXaiStatus,
  hermesXaiTts,
  hermesXaiTtsAligned,
  testElevenLabs,
  vertexGeminiStatus,
  vertexGeminiTts,
} from "@/lib/api-client";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/platform/browser-fetch", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("browser audio API client errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses the localhost Hermes bridge for status and audio", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            voice_id: "eve",
            protocolVersion: 1,
            sessionToken: "test-session-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(hermesXaiStatus()).resolves.toMatchObject({
      available: true,
      voiceId: "eve",
    });
    const audio = await hermesXaiTts("Hello", { speed: 1 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:17831/health",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17831/tts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-SpeakRight-Bridge-Token": "test-session-token",
        }),
        body: JSON.stringify({
          text: "Hello",
          languageId: "en-US",
          speed: 1,
        }),
      }),
    );
    expect(audio.size).toBe(3);
  });

  it("reads Hermes JSON audio and character alignment from the localhost bridge", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            protocolVersion: 1,
            sessionToken: "aligned-session-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audio_base64: "AQID",
            content_type: "audio/mpeg",
            audio_timestamps: {
              graph_chars: ["H", "i"],
              graph_times: [
                [0, 0.08],
                [0.08, 0.16],
              ],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await hermesXaiStatus();
    const result = await hermesXaiTtsAligned("Hi", { speed: 1 });

    expect(result.audioBlob.type).toBe("audio/mpeg");
    expect(result.audioBlob.size).toBe(3);
    expect(result.alignment).toEqual({
      characters: ["H", "i"],
      character_start_times_seconds: [0, 0.08],
      character_end_times_seconds: [0.08, 0.16],
    });
  });

  it("keeps Hermes JSON audio when its alignment is malformed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            protocolVersion: 1,
            sessionToken: "malformed-alignment-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            audioBase64: "AQID",
            mimeType: "audio/mpeg",
            alignment: {
              characters: ["H", "i"],
              character_start_times_seconds: [0],
              character_end_times_seconds: [0.08],
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await hermesXaiStatus();
    const result = await hermesXaiTtsAligned("Hi", { speed: 1 });

    expect(result.audioBlob.size).toBe(3);
    expect(result.alignment).toBeNull();
  });

  it("merges an external abort signal into the Hermes bridge timeout signal", async () => {
    let bridgeSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            protocolVersion: 1,
            sessionToken: "abort-test-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            bridgeSignal = init.signal ?? undefined;
            bridgeSignal?.addEventListener(
              "abort",
              () => reject(bridgeSignal?.reason),
              { once: true },
            );
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await hermesXaiStatus();

    const controller = new AbortController();
    const request = hermesXaiTts("Hello", { signal: controller.signal });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bridgeSignal).not.toBe(controller.signal);

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(bridgeSignal?.aborted).toBe(true);
  });

  it("uses the localhost bridge for Vertex status and WAV audio", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            model: "gemini-3.1-flash-tts-preview",
            authReady: true,
            projectConfigured: true,
            protocolVersion: 1,
            sessionToken: "vertex-session-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "audio/wav" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(vertexGeminiStatus()).resolves.toMatchObject({
      available: true,
      authReady: true,
      projectConfigured: true,
    });
    const audio = await vertexGeminiTts("Hello", {
      languageId: "en-US",
      speed: 0.9,
      voiceName: "Charon",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:17831/vertex/health",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:17831/vertex/tts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-SpeakRight-Bridge-Token": "vertex-session-token",
        }),
        body: JSON.stringify({
          text: "Hello",
          languageId: "en-US",
          speed: 0.9,
          voiceName: "Charon",
        }),
      }),
    );
    expect(audio.type).toBe("audio/wav");
    expect(audio.size).toBe(3);
  });

  it("merges an external abort signal into the Vertex bridge timeout signal", async () => {
    let bridgeSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            available: true,
            authReady: true,
            projectConfigured: true,
            protocolVersion: 1,
            sessionToken: "vertex-abort-token",
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            bridgeSignal = init.signal ?? undefined;
            bridgeSignal?.addEventListener(
              "abort",
              () => reject(bridgeSignal?.reason),
              { once: true },
            );
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await vertexGeminiStatus();

    const controller = new AbortController();
    const request = vertexGeminiTts("Hello", {
      voiceName: "Kore",
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(bridgeSignal).not.toBe(controller.signal);

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(bridgeSignal?.aborted).toBe(true);
  });

  it("rejects an unauthenticated process occupying the Hermes bridge port", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ available: true, provider: "xai" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(hermesXaiStatus()).resolves.toMatchObject({
      available: false,
      detail: expect.stringContaining("不是兼容的 SpeakRight 爱马仕桥接"),
    });
  });

  it("returns Chinese ElevenLabs connection-test errors", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("invalid key", { status: 401 }),
    );

    await expect(testElevenLabs("bad-key")).resolves.toEqual({
      success: false,
      error: "ElevenLabs 认证失败，请检查设置页里的 API Key 是否正确。",
    });

    mocks.apiFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(testElevenLabs("secret")).resolves.toEqual({
      success: false,
      error: "无法连接 ElevenLabs，请检查网络、代理或 ElevenLabs 配置后重试。",
    });
  });

  it("throws Chinese ElevenLabs usage and TTS errors", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("quota exhausted", { status: 429 }),
    );

    await expect(fetchElevenLabsUsage("secret")).rejects.toThrow(
      "ElevenLabs 请求过于频繁或额度不足，请稍后重试或检查 ElevenLabs 用量。",
    );

    await expect(
      elevenLabsTts("secret", "bad voice id", "hello", "eleven_flash_v2_5"),
    ).rejects.toThrow(
      "ElevenLabs Voice ID 格式无效，请在设置页重新选择或填写声音。",
    );

    await expect(
      elevenLabsTts(
        "secret",
        "VoiceId12345",
        "x".repeat(501),
        "eleven_flash_v2_5",
      ),
    ).rejects.toThrow("标准示范文本过长，请控制在 500 个字符以内。");

    mocks.apiFetch.mockRejectedValueOnce(new TypeError("network offline"));

    await expect(
      elevenLabsTts("secret", "VoiceId12345", "hello", "eleven_flash_v2_5"),
    ).rejects.toThrow(
      "无法连接 ElevenLabs，请检查网络、代理或 ElevenLabs 配置后重试。",
    );
  });

  it("throws Chinese aligned TTS provider errors", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response("model missing", { status: 404 }),
    );

    await expect(
      elevenLabsTtsAligned("secret", "VoiceId12345", "hello", "missing-model"),
    ).rejects.toThrow(
      "ElevenLabs 声音或模型不可用，请检查 Voice ID 和 Model。",
    );
  });

  it("forwards AbortSignal to ElevenLabs aligned TTS", async () => {
    mocks.apiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ audio_base64: "AA==", alignment: null }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const controller = new AbortController();

    await elevenLabsTtsAligned(
      "secret",
      "VoiceId12345",
      "hello",
      "eleven_flash_v2_5",
      0.9,
      controller.signal,
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/with-timestamps"),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("throws Chinese online dictionary pronunciation errors", async () => {
    await expect(fetchPronunciation("   ")).rejects.toThrow(
      "请输入要播放发音的单词。",
    );

    await expect(fetchPronunciation("x".repeat(81))).rejects.toThrow(
      "单词发音文本过长，请控制在 80 个字符以内。",
    );

    mocks.apiFetch.mockResolvedValueOnce(new Response("", { status: 404 }));

    await expect(fetchPronunciation("notaword")).rejects.toThrow(
      "在线词典没有找到这个词的发音，请换一个词或使用内置练习词。",
    );

    mocks.apiFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(fetchPronunciation("hello")).rejects.toThrow(
      "无法连接在线词典发音，请检查网络后重试；已内置的本地音频不受影响。",
    );
  });
});
