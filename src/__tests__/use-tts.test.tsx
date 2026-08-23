import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTts } from "@/hooks/use-tts";

const mocks = vi.hoisted(() => ({
  elevenLabsTts: vi.fn(),
  hermesXaiTts: vi.fn(),
  vertexGeminiTts: vi.fn(),
  getElevenLabsConfig: vi.fn(),
  getStandardTtsConfig: vi.fn(),
  getVertexGeminiTtsConfig: vi.fn(),
  playBlob: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  elevenLabsTts: mocks.elevenLabsTts,
  hermesXaiTts: mocks.hermesXaiTts,
  vertexGeminiTts: mocks.vertexGeminiTts,
}));

vi.mock("@/lib/api-keys", () => ({
  getElevenLabsConfig: mocks.getElevenLabsConfig,
  getStandardTtsConfig: mocks.getStandardTtsConfig,
  getVertexGeminiTtsConfig: mocks.getVertexGeminiTtsConfig,
}));

vi.mock("@/hooks/use-audio-player", () => ({
  useAudioPlayer: () => ({
    isPlaying: false,
    playBlob: mocks.playBlob,
  }),
}));

describe("useTts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getElevenLabsConfig.mockReturnValue({
      apiKey: "test-key",
      voiceId: "VoiceId12345",
      modelId: "eleven_flash_v2_5",
    });
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "elevenlabs" });
    mocks.getVertexGeminiTtsConfig.mockReturnValue({ voiceName: "Kore" });
    mocks.elevenLabsTts.mockResolvedValue(
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    );
    mocks.hermesXaiTts.mockResolvedValue(
      new Blob([new Uint8Array([4, 5, 6])], { type: "audio/mpeg" }),
    );
    mocks.vertexGeminiTts.mockResolvedValue(
      new Blob([new Uint8Array([7, 8, 9])], { type: "audio/wav" }),
    );
  });

  it("normalizes raw English TTS failures before showing them", async () => {
    mocks.elevenLabsTts.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useTts());

    await act(async () => {
      await result.current.speak("This is a sentence.");
    });

    expect(result.current.error).toContain("无法播放标准示范");
    expect(result.current.error).toContain("无法连接当前标准示范服务");
    expect(result.current.error).not.toContain("Failed to fetch");
    expect(mocks.playBlob).not.toHaveBeenCalled();
  });

  it("plays audio when the provider returns a blob", async () => {
    const { result } = renderHook(() => useTts());

    await act(async () => {
      await result.current.speak("This is a sentence.");
    });

    expect(result.current.error).toBeNull();
    expect(mocks.playBlob).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("routes speech through Hermes without reading ElevenLabs credentials", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "hermes-grok" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    const { result } = renderHook(() => useTts());

    await act(async () => {
      await result.current.speak("This is a sentence.");
    });

    expect(mocks.hermesXaiTts).toHaveBeenCalledWith("This is a sentence.");
    expect(mocks.elevenLabsTts).not.toHaveBeenCalled();
    expect(mocks.playBlob).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("routes speech through Vertex Gemini with the saved voice", async () => {
    mocks.getStandardTtsConfig.mockReturnValue({ provider: "vertex-gemini" });
    mocks.getElevenLabsConfig.mockReturnValue(null);
    mocks.getVertexGeminiTtsConfig.mockReturnValue({ voiceName: "Aoede" });
    const { result } = renderHook(() => useTts());

    await act(async () => {
      await result.current.speak("This is a sentence.");
    });

    expect(mocks.vertexGeminiTts).toHaveBeenCalledWith(
      "This is a sentence.",
      { voiceName: "Aoede" },
    );
    expect(mocks.elevenLabsTts).not.toHaveBeenCalled();
    expect(mocks.playBlob).toHaveBeenCalledWith(expect.any(Blob));
  });
});
