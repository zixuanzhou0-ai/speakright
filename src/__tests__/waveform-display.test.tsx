import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WaveformDisplay } from "@/components/audio/waveform-display";

const wavesurferMock = vi.hoisted(() => ({
  destroy: vi.fn(),
  loadBlob: vi.fn(),
  on: vi.fn(),
  playPause: vi.fn(),
  create: vi.fn(),
}));

vi.mock("wavesurfer.js", () => ({
  default: {
    create: wavesurferMock.create,
  },
}));

const originalAudioContext = window.AudioContext;
const originalWebkitAudioContext = (
  window as unknown as { webkitAudioContext?: typeof AudioContext }
).webkitAudioContext;

function setWindowCtor(
  name: "AudioContext" | "webkitAudioContext",
  value: unknown,
) {
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value,
  });
}

describe("WaveformDisplay degraded states", () => {
  afterEach(() => {
    setWindowCtor("AudioContext", originalAudioContext);
    setWindowCtor("webkitAudioContext", originalWebkitAudioContext);
    vi.restoreAllMocks();
  });

  it("shows a Chinese status when live waveform rendering is unavailable", async () => {
    setWindowCtor("AudioContext", undefined);
    setWindowCtor("webkitAudioContext", undefined);

    render(<WaveformDisplay stream={{} as MediaStream} />);

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("data-smoke", "waveform-display-warning");
    expect(status).toHaveTextContent("录音波形暂时不可用");
    expect(status).toHaveTextContent("录音仍会继续");
  });

  it("clears the live waveform warning after recording stops", async () => {
    setWindowCtor("AudioContext", undefined);
    setWindowCtor("webkitAudioContext", undefined);

    const { rerender } = render(<WaveformDisplay stream={{} as MediaStream} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "录音波形暂时不可用",
    );

    rerender(<WaveformDisplay stream={null} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a Chinese status when saved recording waveform loading fails", async () => {
    wavesurferMock.create.mockReturnValue({
      destroy: wavesurferMock.destroy,
      loadBlob: wavesurferMock.loadBlob.mockRejectedValueOnce(
        new Error("decoder failed"),
      ),
      on: wavesurferMock.on,
      playPause: wavesurferMock.playPause,
    });

    render(<WaveformDisplay audioBlob={new Blob(["audio"])} />);

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("录音波形暂时不可用");
    expect(status).toHaveTextContent("录音已保留");
    expect(wavesurferMock.destroy).toHaveBeenCalled();
  });
});
