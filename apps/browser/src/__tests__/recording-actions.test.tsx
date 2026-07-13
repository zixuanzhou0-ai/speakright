import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecordingActions } from "@/components/audio/recording-actions";

describe("RecordingActions accessibility", () => {
  it("names and disables every icon-only action before a recording exists", () => {
    render(
      <RecordingActions
        hasRecording={false}
        isPlaying={false}
        isAssessing={false}
        onReplay={vi.fn()}
        onClear={vi.fn()}
        onAssess={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "播放录音" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除录音" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "提交录音评分" })).toBeDisabled();
  });

  it("keeps every action named when a recording is ready", () => {
    render(
      <RecordingActions
        hasRecording
        isPlaying={false}
        isAssessing={false}
        onReplay={vi.fn()}
        onClear={vi.fn()}
        onAssess={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "播放录音" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "删除录音" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "提交录音评分" })).toBeEnabled();
  });
});
