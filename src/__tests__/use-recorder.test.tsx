import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRecorderRuntimeErrorMessage,
  getRecorderStartErrorMessage,
  useRecorder,
} from "@/hooks/use-recorder";

const originalMediaDevices = navigator.mediaDevices;
const originalMediaRecorder = globalThis.MediaRecorder;

function setMediaDevices(value: MediaDevices | undefined): void {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

function setMediaRecorder(value: unknown): void {
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    writable: true,
    value,
  });
}

describe("recorder startup errors", () => {
  afterEach(() => {
    setMediaDevices(originalMediaDevices);
    if (originalMediaRecorder) {
      setMediaRecorder(originalMediaRecorder);
    } else {
      Reflect.deleteProperty(globalThis, "MediaRecorder");
    }
    vi.restoreAllMocks();
  });

  it.each([
    [
      "NotAllowedError",
      "麦克风权限被拒绝，请在 Windows 隐私设置中允许 SpeakRight 使用麦克风后重试。",
    ],
    ["NotFoundError", "未检测到可用麦克风，请连接或启用麦克风后重试。"],
    [
      "NotReadableError",
      "麦克风正被其他应用占用或无法启动，请关闭占用麦克风的应用后重试。",
    ],
    [
      "OverconstrainedError",
      "当前麦克风不支持所需录音格式，请换一个输入设备后重试。",
    ],
    [
      "SecurityError",
      "系统安全策略阻止了麦克风访问，请检查 Windows 隐私权限后重试。",
    ],
    ["AbortError", "麦克风启动中断，请重新插拔设备或重启 SpeakRight 后重试。"],
  ])("maps %s to an actionable Chinese message", (name, message) => {
    expect(getRecorderStartErrorMessage(new DOMException("", name))).toBe(
      message,
    );
  });

  it.each([
    [
      "NotAllowedError",
      "录音过程中麦克风权限被系统撤销，请在 Windows 隐私设置中允许 SpeakRight 使用麦克风后重录。",
    ],
    [
      "NotFoundError",
      "录音过程中麦克风断开，请重新连接或启用麦克风后重录。",
    ],
    [
      "NotReadableError",
      "录音过程中麦克风被其他应用占用或中断，请关闭占用麦克风的应用后重录。",
    ],
    ["AbortError", "录音过程中麦克风中断，请重新插拔设备或重启 SpeakRight 后重录。"],
  ])("maps runtime %s to an actionable Chinese message", (name, message) => {
    expect(getRecorderRuntimeErrorMessage(new DOMException("", name))).toBe(
      message,
    );
  });

  it("shows an unsupported microphone message when mediaDevices is missing", async () => {
    setMediaDevices(undefined);
    setMediaRecorder(function MockMediaRecorder() {});

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.error).toBe(
      "当前桌面运行环境无法访问麦克风，请确认使用 Release EXE 并重启应用。",
    );
  });

  it("shows an unsupported recorder message before asking for microphone access", async () => {
    const getUserMedia = vi.fn();
    setMediaDevices({ getUserMedia } as unknown as MediaDevices);
    Reflect.deleteProperty(globalThis, "MediaRecorder");

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      "当前桌面运行环境不支持录音编码，请更新系统 WebView 或重启 SpeakRight 后重试。",
    );
  });

  it("stops an opened stream when recorder initialization fails", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const RecorderCtor = vi.fn(function MockMediaRecorder() {
      throw new DOMException("", "NotReadableError");
    });

    setMediaDevices({ getUserMedia } as unknown as MediaDevices);
    setMediaRecorder(RecorderCtor);

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { sampleRate: 16000, channelCount: 1 },
    });
    expect(RecorderCtor).toHaveBeenCalledWith(stream);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBe(
      "麦克风正被其他应用占用或无法启动，请关闭占用麦克风的应用后重试。",
    );
  });

  it("stops the stream and discards partial audio when recording fails mid-session", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    let recorder:
      | (MediaRecorder & {
          ondataavailable: ((event: BlobEvent) => void) | null;
          onerror: ((event: Event) => void) | null;
          onstop: (() => void) | null;
          start: () => void;
          stop: () => void;
        })
      | null = null;

    const RecorderCtor = vi.fn(function MockMediaRecorder(this: MediaRecorder) {
      Object.assign(this, {
        mimeType: "audio/webm",
        ondataavailable: null,
        onerror: null,
        onstop: null,
        state: "inactive",
        start: vi.fn(function start(this: MediaRecorder) {
          Object.assign(this, { state: "recording" });
        }),
        stop: vi.fn(function stopRecording(this: MediaRecorder) {
          Object.assign(this, { state: "inactive" });
          this.onstop?.(new Event("stop"));
        }),
      });
      recorder = this as typeof recorder;
    });

    setMediaDevices({ getUserMedia } as unknown as MediaDevices);
    setMediaRecorder(RecorderCtor);

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      recorder?.ondataavailable?.({
        data: new Blob(["partial"], { type: "audio/webm" }),
      } as BlobEvent);
      recorder?.onerror?.(
        Object.assign(new Event("error"), {
          error: new DOMException("", "NotReadableError"),
        }),
      );
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.stream).toBeNull();
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.rawBlob).toBeNull();
    expect(result.current.error).toBe(
      "录音过程中麦克风被其他应用占用或中断，请关闭占用麦克风的应用后重录。",
    );
  });
});
