import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillRecording } from "@/components/drill/drill-recording";
import type { DrillItem } from "@/types/drill";

const item: DrillItem = {
  text: "responsibility",
  ipa: "/rɪˌspɑːnsəˈbɪləti/",
  phoneme: "ih",
  description: "目标词完整读出来。",
};

function renderRecording(error: string | null = null) {
  return render(
    <DrillRecording
      item={item}
      index={0}
      total={5}
      isRecording={false}
      isAssessing={false}
      audioBlob={null}
      stream={null}
      recorderError={error}
      onStartRecording={vi.fn()}
      onStopRecording={vi.fn()}
    />,
  );
}

describe("DrillRecording", () => {
  it("shows recorder startup errors inside the drill card", () => {
    renderRecording("未检测到可用麦克风，请连接或启用麦克风后重试。");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("未检测到可用麦克风");
    expect(alert).toHaveAttribute(
      "data-smoke",
      "drill-recording-recorder-error",
    );
    expect(alert).toHaveClass("break-words");
    expect(alert).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("keeps long drill targets visible while showing the normal idle state", () => {
    renderRecording();

    expect(screen.getByText("responsibility")).toBeInTheDocument();
    expect(screen.getByText("点击按钮开始录音")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
