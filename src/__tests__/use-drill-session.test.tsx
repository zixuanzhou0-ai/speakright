import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDrillSession } from "@/hooks/use-drill-session";
import type { DrillItem, DrillSessionConfig } from "@/types/drill";

const audioBlob = new Blob([new Uint8Array([1, 2, 3])], {
  type: "audio/wav",
});

const drillConfig: DrillSessionConfig = {
  kind: "word",
  phonemeSlug: "th",
  itemCount: 1,
  passThreshold: 70,
};

const drillItem: DrillItem = {
  text: "think",
  phoneme: "th",
  ipa: "/θɪŋk/",
};

const mocks = vi.hoisted(() => ({
  assess: vi.fn(),
  azureError: null as string | null,
  getLastError: vi.fn<() => string | null>(() => null),
  recorderReset: vi.fn(),
  azureReset: vi.fn(),
  addScore: vi.fn(),
}));

vi.mock("@/hooks/use-recorder", () => ({
  useRecorder: () => ({
    audioBlob,
    autoStopped: false,
    error: null,
    isRecording: false,
    reset: mocks.recorderReset,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    stream: null,
  }),
}));

vi.mock("@/hooks/use-azure-assessment", () => ({
  useAzureAssessment: () => ({
    assess: mocks.assess,
    error: mocks.azureError,
    getLastError: mocks.getLastError,
    isLoading: false,
    reset: mocks.azureReset,
    result: null,
    restore: vi.fn(),
  }),
}));

vi.mock("@/lib/score-history", () => ({
  addScore: mocks.addScore,
}));

describe("useDrillSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.azureError = null;
    mocks.getLastError.mockReturnValue(null);
    mocks.assess.mockResolvedValue(null);
    mocks.addScore.mockReturnValue(true);
  });

  it("uses the latest same-turn Azure failure reason for drill scoring errors", async () => {
    mocks.assess.mockImplementationOnce(async () => {
      mocks.getLastError.mockReturnValueOnce(
        "请先到设置页配置 Azure Speech API 密钥和区域；配置后回到本页重新评分。",
      );
      return null;
    });

    const { result } = renderHook(() => useDrillSession());

    act(() => {
      result.current.start(drillConfig, [drillItem]);
    });

    await act(async () => {
      await result.current.submitRecording();
    });

    expect(result.current.phase).toEqual({
      type: "error",
      message:
        "请先到设置页配置 Azure Speech API 密钥和区域；配置后回到本页重新评分。",
    });
  });

  it("falls back to an actionable Azure recovery message instead of a generic retry", async () => {
    const { result } = renderHook(() => useDrillSession());

    act(() => {
      result.current.start(drillConfig, [drillItem]);
    });

    await act(async () => {
      await result.current.submitRecording();
    });

    expect(result.current.phase).toEqual({
      type: "error",
      message:
        "评分失败：请检查 Azure Speech API 密钥、区域、网络或代理后重试。",
    });
  });

  it("keeps drill scoring moving while surfacing local score-save failures", async () => {
    mocks.assess.mockResolvedValueOnce({
      pronunciationScore: 88,
      accuracyScore: 87,
      fluencyScore: 86,
      completenessScore: 89,
      words: [
        {
          word: "think",
          accuracyScore: 88,
          errorType: "None",
          phonemes: [{ phoneme: "th", accuracyScore: 88 }],
          syllables: [],
        },
      ],
    });
    mocks.addScore.mockReturnValueOnce(false);

    const { result } = renderHook(() =>
      useDrillSession({ scoreHistoryPrefix: "en-US" }),
    );

    act(() => {
      result.current.start(drillConfig, [drillItem]);
    });

    await act(async () => {
      await result.current.submitRecording();
    });

    expect(result.current.phase.type).toBe("feedback");
    expect(result.current.localSaveError).toContain("本次评分已完成");
    expect(result.current.localSaveError).toContain("本机训练趋势记录未保存");
  });
});
